using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/content-admin-requests")]
public class AdminRequestsController(
    AppDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    ICodeGenerator codeGenerator,
    IAuditLogger auditLogger) : ControllerBase
{
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<AdminRequestResponse>> Create(CreateAdminRequestDto request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (await userManager.IsInRoleAsync(user, "ContentAdmin") ||
            await userManager.IsInRoleAsync(user, "SuperAdmin"))
        {
            return BadRequest("This user is already an admin.");
        }

        var hasPendingRequest = await dbContext.AdminRequests.AnyAsync(adminRequest =>
            adminRequest.UserId == user.Id &&
            adminRequest.Status == AdminRequestStatus.Pending);

        if (hasPendingRequest)
        {
            return Conflict("This user already has a pending content admin request.");
        }

        var adminRequest = new AdminRequest
        {
            RequestCode = await codeGenerator.NextAdminRequestCodeAsync(),
            UserId = user.Id,
            Message = CleanOptionalText(request.Message)
        };

        dbContext.AdminRequests.Add(adminRequest);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict("This user already has a pending content admin request.");
        }

        return CreatedAtAction(nameof(GetById), new { id = adminRequest.Id }, ToResponse(adminRequest));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<AdminRequestResponse>> GetById(Guid id)
    {
        var adminRequest = await dbContext.AdminRequests
            .Include(request => request.User)
            .FirstOrDefaultAsync(request => request.Id == id);

        return adminRequest is null ? NotFound() : Ok(ToResponse(adminRequest));
    }

    [HttpGet("pending")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<IEnumerable<AdminRequestResponse>>> GetPending()
    {
        var requests = await dbContext.AdminRequests
            .Include(request => request.User)
            .Where(request => request.Status == AdminRequestStatus.Pending)
            .OrderBy(request => request.RequestedAtUtc)
            .Select(request => ToResponse(request))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<AdminRequestResponse>> Approve(Guid id, ReviewRequestDto request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)
            : null;

        var adminRequest = await dbContext.AdminRequests
            .Include(requestEntity => requestEntity.User)
            .FirstOrDefaultAsync(requestEntity => requestEntity.Id == id);

        if (adminRequest is null)
        {
            return NotFound();
        }

        if (adminRequest.Status != AdminRequestStatus.Pending)
        {
            return Conflict("Only pending requests can be approved.");
        }

        adminRequest.Status = AdminRequestStatus.Approved;
        adminRequest.ReviewedBySuperAdminId = superAdmin.Id;
        adminRequest.ReviewedAtUtc = DateTime.UtcNow;
        adminRequest.ReviewNote = CleanOptionalText(request.ReviewNote);

        if (!await userManager.IsInRoleAsync(adminRequest.User, "ContentAdmin"))
        {
            var roleResult = await userManager.AddToRoleAsync(adminRequest.User, "ContentAdmin");
            if (!roleResult.Succeeded)
            {
                return BadRequest(roleResult.Errors);
            }
        }

        if (!adminRequest.User.EmailConfirmed)
        {
            adminRequest.User.EmailConfirmed = true;
            var updateResult = await userManager.UpdateAsync(adminRequest.User);
            if (!updateResult.Succeeded)
            {
                return BadRequest(updateResult.Errors);
            }
        }

        var stampResult = await userManager.UpdateSecurityStampAsync(adminRequest.User);
        if (!stampResult.Succeeded)
        {
            return BadRequest(stampResult.Errors);
        }

        var hasProfile = await dbContext.AdminProfiles.AnyAsync(profile => profile.UserId == adminRequest.UserId);
        if (!hasProfile)
        {
            dbContext.AdminProfiles.Add(new AdminProfile
            {
                UserId = adminRequest.UserId,
                AdminCode = await codeGenerator.NextContentAdminCodeAsync(),
                AdminKind = AdminKind.ContentAdmin,
                ApprovedByUserId = superAdmin.Id
            });
        }

        await dbContext.SaveChangesAsync();
        await auditLogger.LogAsync(
            adminRequest.UserId,
            "content_admin_request_approved",
            superAdmin.Id,
            nameof(AdminRequest),
            adminRequest.Id.ToString());

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        return Ok(ToResponse(adminRequest));
    }

    [HttpPost("{id:guid}/deny")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<AdminRequestResponse>> Deny(Guid id, ReviewRequestDto request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        var adminRequest = await dbContext.AdminRequests
            .Include(requestEntity => requestEntity.User)
            .FirstOrDefaultAsync(requestEntity => requestEntity.Id == id);

        if (adminRequest is null)
        {
            return NotFound();
        }

        if (adminRequest.Status != AdminRequestStatus.Pending)
        {
            return Conflict("Only pending requests can be denied.");
        }

        adminRequest.Status = AdminRequestStatus.Denied;
        adminRequest.ReviewedBySuperAdminId = superAdmin.Id;
        adminRequest.ReviewedAtUtc = DateTime.UtcNow;
        adminRequest.ReviewNote = CleanOptionalText(request.ReviewNote);
        await dbContext.SaveChangesAsync();

        return Ok(ToResponse(adminRequest));
    }

    private static AdminRequestResponse ToResponse(AdminRequest request)
    {
        return new AdminRequestResponse(
            request.Id,
            request.RequestCode,
            request.UserId,
            request.User?.UserName,
            request.User?.Email,
            request.User?.DisplayName,
            request.Status,
            request.Message,
            request.RequestedAtUtc,
            request.ReviewedBySuperAdminId,
            request.ReviewedAtUtc,
            request.ReviewNote);
    }

    private static string? CleanOptionalText(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrEmpty(cleaned) ? null : cleaned;
    }
}
