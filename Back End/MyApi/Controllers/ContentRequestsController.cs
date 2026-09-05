using System.Text.Json;
using System.Data;
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
[Route("api/content-requests")]
public class ContentRequestsController(
    AppDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    ICodeGenerator codeGenerator,
    IAuditLogger auditLogger,
    IContentChangeApplier contentChangeApplier,
    IContentInputValidator contentInputValidator) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "SuperAdmin,ContentAdmin")]
    [EnableRateLimiting("AdminMutation")]
    public async Task<ActionResult<ContentChangeRequestResponse>> Create(CreateContentChangeRequestDto request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var validationError = await contentInputValidator.ValidateChangeRequestAsync(
            request.Action,
            request.ContentType,
            request.TargetEntityId,
            request.PayloadJson);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        contentInputValidator.TryNormalizeContentType(request.ContentType, out var normalizedContentType);
        string? targetVersion = null;
        if (request.Action is ContentChangeAction.Update or ContentChangeAction.Delete)
        {
            targetVersion = await contentInputValidator.GetTargetVersionAsync(
                normalizedContentType,
                request.TargetEntityId);
            if (targetVersion is null)
            {
                return NotFound("The target content no longer exists.");
            }
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync()
            : null;

        var changeRequest = new ContentChangeRequest
        {
            ChangeCode = await codeGenerator.NextContentChangeCodeAsync(),
            RequestedByUserId = user.Id,
            ContentType = normalizedContentType,
            TargetEntityId = string.IsNullOrWhiteSpace(request.TargetEntityId)
                ? null
                : request.TargetEntityId.Trim(),
            TargetVersion = targetVersion,
            Action = request.Action,
            PayloadJson = request.PayloadJson,
            Message = CleanOptionalText(request.Message)
        };

        dbContext.ContentChangeRequests.Add(changeRequest);
        await dbContext.SaveChangesAsync();

        if (await userManager.IsInRoleAsync(user, "ContentAdmin"))
        {
            await auditLogger.LogAsync(
                user.Id,
                "content_change_requested",
                user.Id,
                request.ContentType,
                request.TargetEntityId);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = changeRequest.Id }, ToResponse(changeRequest));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<ContentChangeRequestResponse>> GetById(Guid id)
    {
        var request = await dbContext.ContentChangeRequests
            .Include(changeRequest => changeRequest.RequestedByUser)
            .FirstOrDefaultAsync(changeRequest => changeRequest.Id == id);

        return request is null ? NotFound() : Ok(ToResponse(request));
    }

    [HttpGet("pending")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<IEnumerable<ContentChangeRequestResponse>>> GetPending()
    {
        var requests = await dbContext.ContentChangeRequests
            .Include(changeRequest => changeRequest.RequestedByUser)
            .Where(changeRequest => changeRequest.Status == ContentChangeStatus.Pending)
            .OrderBy(changeRequest => changeRequest.RequestedAtUtc)
            .Select(changeRequest => ToResponse(changeRequest))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpGet("mine")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<ContentChangeRequestResponse>>> GetMine()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var requests = await dbContext.ContentChangeRequests
            .Include(changeRequest => changeRequest.RequestedByUser)
            .Where(changeRequest => changeRequest.RequestedByUserId == user.Id)
            .OrderByDescending(changeRequest => changeRequest.RequestedAtUtc)
            .Select(changeRequest => ToResponse(changeRequest))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<ContentChangeRequestResponse>> Approve(Guid id, ReviewRequestDto request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)
            : null;

        var changeRequest = await dbContext.ContentChangeRequests
            .Include(requestEntity => requestEntity.RequestedByUser)
            .FirstOrDefaultAsync(requestEntity => requestEntity.Id == id);

        if (changeRequest is null)
        {
            return NotFound();
        }

        if (changeRequest.Status != ContentChangeStatus.Pending)
        {
            return Conflict("Only pending content requests can be approved.");
        }

        if (changeRequest.Action is ContentChangeAction.Update or ContentChangeAction.Delete)
        {
            var currentVersion = await contentInputValidator.GetTargetVersionAsync(
                changeRequest.ContentType,
                changeRequest.TargetEntityId);
            if (currentVersion is null || currentVersion != changeRequest.TargetVersion)
            {
                return Conflict("The target content changed after this request was submitted. Deny this request and submit a new one.");
            }
        }

        try
        {
            await contentChangeApplier.ApplyAsync(changeRequest);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (JsonException)
        {
            return BadRequest("PayloadJson must contain valid JSON for the selected content type.");
        }
        catch (FormatException)
        {
            return BadRequest("TargetEntityId must be a valid integer.");
        }
        catch (OverflowException)
        {
            return BadRequest("TargetEntityId is outside the supported range.");
        }

        changeRequest.Status = ContentChangeStatus.Approved;
        changeRequest.ReviewedBySuperAdminId = superAdmin.Id;
        changeRequest.ReviewedAtUtc = DateTime.UtcNow;
        changeRequest.ReviewNote = CleanOptionalText(request.ReviewNote);
        await dbContext.SaveChangesAsync();

        if (await userManager.IsInRoleAsync(changeRequest.RequestedByUser, "ContentAdmin"))
        {
            await auditLogger.LogAsync(
                changeRequest.RequestedByUserId,
                "content_change_approved",
                superAdmin.Id,
                changeRequest.ContentType,
                changeRequest.TargetEntityId);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        return Ok(ToResponse(changeRequest));
    }

    [HttpPost("{id:guid}/deny")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<ContentChangeRequestResponse>> Deny(Guid id, ReviewRequestDto request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)
            : null;

        var changeRequest = await dbContext.ContentChangeRequests
            .Include(requestEntity => requestEntity.RequestedByUser)
            .FirstOrDefaultAsync(requestEntity => requestEntity.Id == id);

        if (changeRequest is null)
        {
            return NotFound();
        }

        if (changeRequest.Status != ContentChangeStatus.Pending)
        {
            return Conflict("Only pending content requests can be denied.");
        }

        changeRequest.Status = ContentChangeStatus.Denied;
        changeRequest.ReviewedBySuperAdminId = superAdmin.Id;
        changeRequest.ReviewedAtUtc = DateTime.UtcNow;
        changeRequest.ReviewNote = CleanOptionalText(request.ReviewNote);
        await dbContext.SaveChangesAsync();

        if (await userManager.IsInRoleAsync(changeRequest.RequestedByUser, "ContentAdmin"))
        {
            await auditLogger.LogAsync(
                changeRequest.RequestedByUserId,
                "content_change_denied",
                superAdmin.Id,
                changeRequest.ContentType,
                changeRequest.TargetEntityId);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        return Ok(ToResponse(changeRequest));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize]
    public async Task<ActionResult<ContentChangeRequestResponse>> Cancel(Guid id)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var changeRequest = await dbContext.ContentChangeRequests
            .Include(requestEntity => requestEntity.RequestedByUser)
            .FirstOrDefaultAsync(requestEntity => requestEntity.Id == id);

        if (changeRequest is null)
        {
            return NotFound();
        }

        if (changeRequest.RequestedByUserId != user.Id)
        {
            return Forbid();
        }

        if (changeRequest.Status != ContentChangeStatus.Pending)
        {
            return Conflict("Only pending content requests can be cancelled.");
        }

        changeRequest.Status = ContentChangeStatus.Cancelled;
        await dbContext.SaveChangesAsync();

        return Ok(ToResponse(changeRequest));
    }

    private static ContentChangeRequestResponse ToResponse(ContentChangeRequest request)
    {
        return new ContentChangeRequestResponse(
            request.Id,
            request.ChangeCode,
            request.RequestedByUserId,
            request.RequestedByUser?.UserName,
            request.ContentType,
            request.TargetEntityId,
            request.Action,
            request.Status,
            request.PayloadJson,
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
