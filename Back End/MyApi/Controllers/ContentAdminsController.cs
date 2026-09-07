using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/content-admins")]
[Authorize(Roles = "SuperAdmin")]
public class ContentAdminsController(
    AppDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    IAuditLogger auditLogger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ContentAdminResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1 || pageSize < 1) return BadRequest("Page and pageSize must be positive.");

        var admins = await dbContext.AdminProfiles
            .Include(profile => profile.User)
            .Where(profile => profile.AdminKind == AdminKind.ContentAdmin)
            .OrderBy(profile => profile.User.DisplayName ?? profile.User.UserName)
            .ThenBy(profile => profile.UserId)
            .Skip((page - 1) * Math.Min(pageSize, 50))
            .Take(Math.Min(pageSize, 50))
            .Select(profile => ToResponse(profile))
            .ToListAsync();

        return Ok(admins);
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<ContentAdminResponse>> GetByUserId(string userId)
    {
        var profile = await dbContext.AdminProfiles
            .Include(profileEntity => profileEntity.User)
            .FirstOrDefaultAsync(profileEntity =>
                profileEntity.UserId == userId &&
                profileEntity.AdminKind == AdminKind.ContentAdmin);

        return profile is null ? NotFound() : Ok(ToResponse(profile));
    }

    [HttpGet("audit")]
    [HttpGet("{userId}/audit")]
    public async Task<ActionResult<IEnumerable<AdminAuditLogResponse>>> GetAudit(
        string? userId,
        CancellationToken cancellationToken,
        [FromQuery] int pageSize = 50,
        [FromQuery] DateTime? afterCreatedAtUtc = null,
        [FromQuery] Guid? afterId = null)
    {
        if (pageSize < 1 || afterCreatedAtUtc.HasValue != afterId.HasValue)
            return BadRequest("Provide a positive page size and both cursor values.");
        var query = dbContext.AdminAuditLogs.AsNoTracking();
        if (!string.IsNullOrEmpty(userId)) query = query.Where(log => log.AdminUserId == userId);
        if (afterCreatedAtUtc.HasValue && afterId.HasValue)
        {
            var timestamp = afterCreatedAtUtc.Value;
            var cursorId = afterId.Value;
            query = query.Where(log => log.CreatedAtUtc < timestamp ||
                (log.CreatedAtUtc == timestamp && log.Id.CompareTo(cursorId) < 0));
        }
        var logs = await query
            .OrderByDescending(log => log.CreatedAtUtc)
            .ThenByDescending(log => log.Id)
            .Take(Math.Min(pageSize, 100))
            .Select(log => new AdminAuditLogResponse(
                log.Id,
                log.AdminUserId,
                log.PerformedByUserId,
                log.Action,
                log.EntityType,
                log.EntityId,
                log.DetailsJson,
                log.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Ok(logs);
    }

    [HttpDelete("{userId}")]
    [EnableRateLimiting("ReauthSensitive")]
    public async Task<IActionResult> KickOut(string userId, KickContentAdminRequest? request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request?.Password))
        {
            return BadRequest("Super admin password is required before kicking a content admin.");
        }

        if (!await userManager.CheckPasswordAsync(superAdmin, request.Password))
        {
            return Unauthorized("Super admin password is incorrect.");
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        if (await userManager.IsInRoleAsync(user, "SuperAdmin"))
        {
            return BadRequest("A super admin cannot be kicked out through the content admin endpoint.");
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync()
            : null;

        if (await userManager.IsInRoleAsync(user, "ContentAdmin"))
        {
            var roleResult = await userManager.RemoveFromRoleAsync(user, "ContentAdmin");
            if (!roleResult.Succeeded)
            {
                return BadRequest(roleResult.Errors);
            }

            var stampResult = await userManager.UpdateSecurityStampAsync(user);
            if (!stampResult.Succeeded)
            {
                return BadRequest(stampResult.Errors);
            }
        }

        var profile = await dbContext.AdminProfiles.FirstOrDefaultAsync(profileEntity =>
            profileEntity.UserId == userId &&
            profileEntity.AdminKind == AdminKind.ContentAdmin);
        if (profile is not null)
        {
            dbContext.AdminProfiles.Remove(profile);
        }

        await dbContext.SaveChangesAsync();
        await auditLogger.LogAsync(
            userId,
            "content_admin_access_revoked",
            superAdmin.Id,
            nameof(AdminProfile),
            profile?.Id.ToString());

        if (transaction is not null) await transaction.CommitAsync();
        return NoContent();
    }

    private static ContentAdminResponse ToResponse(AdminProfile profile)
    {
        return new ContentAdminResponse(
            profile.UserId,
            profile.User.UserName,
            profile.User.Email,
            profile.User.DisplayName,
            profile.AdminCode,
            profile.IsActive,
            profile.ApprovedAtUtc);
    }
}
