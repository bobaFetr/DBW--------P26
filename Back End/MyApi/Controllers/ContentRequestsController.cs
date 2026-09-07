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
    IContentChangeApplier contentChangeApplier,
    IContentInputValidator contentInputValidator,
    IAuditLogger auditLogger) : ControllerBase
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

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        await auditLogger.LogAsync(
            user.Id,
            "content_change_requested",
            user.Id,
            nameof(ContentChangeRequest),
            changeRequest.Id.ToString());

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
    public async Task<ActionResult<IEnumerable<ContentChangeRequestResponse>>> GetPending(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1 || pageSize < 1) return BadRequest("Page and pageSize must be positive.");

        var requests = await dbContext.ContentChangeRequests
            .Include(changeRequest => changeRequest.RequestedByUser)
            .Where(changeRequest => changeRequest.Status == ContentChangeStatus.Pending)
            .OrderBy(changeRequest => changeRequest.RequestedAtUtc)
            .Skip((page - 1) * Math.Min(pageSize, 50))
            .Take(Math.Min(pageSize, 50))
            .Select(changeRequest => ToResponse(changeRequest))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpGet("mine")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<ContentChangeRequestResponse>>> GetMine(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (page < 1 || pageSize < 1) return BadRequest("Page and pageSize must be positive.");

        var requests = await dbContext.ContentChangeRequests
            .Include(changeRequest => changeRequest.RequestedByUser)
            .Where(changeRequest => changeRequest.RequestedByUserId == user.Id)
            .OrderByDescending(changeRequest => changeRequest.RequestedAtUtc)
            .Skip((page - 1) * Math.Min(pageSize, 50))
            .Take(Math.Min(pageSize, 50))
            .Select(changeRequest => ToResponse(changeRequest))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "SuperAdmin")]
    public Task<ActionResult<ContentChangeRequestResponse>> Approve(Guid id, ReviewRequestDto request) =>
        RequestConcurrencyGuard.ExecuteAsync(() => ApproveCore(id, request));

    private async Task<ActionResult<ContentChangeRequestResponse>> ApproveCore(Guid id, ReviewRequestDto request)
    {
        var superAdmin = await userManager.GetUserAsync(User);
        if (superAdmin is null)
        {
            return Unauthorized();
        }

        var isRelational = dbContext.Database.IsRelational();
        await using var transaction = isRelational
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

        if (isRelational && !await TryFinalizePendingRequestAsync(
                changeRequest,
                ContentChangeStatus.Approved,
                superAdmin.Id,
                CleanOptionalText(request.ReviewNote)))
        {
            return Conflict("Only pending content requests can be approved.");
        }

        if (!isRelational && !await TryFinalizePendingRequestAsync(
                changeRequest,
                ContentChangeStatus.Approved,
                superAdmin.Id,
                CleanOptionalText(request.ReviewNote)))
        {
            return Conflict("Only pending content requests can be approved.");
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

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        await auditLogger.LogAsync(
            changeRequest.RequestedByUserId,
            "content_change_approved",
            superAdmin.Id,
            nameof(ContentChangeRequest),
            changeRequest.Id.ToString());

        return Ok(ToResponse(changeRequest));
    }

    [HttpPost("{id:guid}/deny")]
    [Authorize(Roles = "SuperAdmin")]
    public Task<ActionResult<ContentChangeRequestResponse>> Deny(Guid id, ReviewRequestDto request) =>
        RequestConcurrencyGuard.ExecuteAsync(() => DenyCore(id, request));

    private async Task<ActionResult<ContentChangeRequestResponse>> DenyCore(Guid id, ReviewRequestDto request)
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

        if (!await TryFinalizePendingRequestAsync(
                changeRequest,
                ContentChangeStatus.Denied,
                superAdmin.Id,
                CleanOptionalText(request.ReviewNote)))
        {
            return Conflict("Only pending content requests can be denied.");
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        await auditLogger.LogAsync(
            changeRequest.RequestedByUserId,
            "content_change_denied",
            superAdmin.Id,
            nameof(ContentChangeRequest),
            changeRequest.Id.ToString());

        return Ok(ToResponse(changeRequest));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize]
    public Task<ActionResult<ContentChangeRequestResponse>> Cancel(Guid id) =>
        RequestConcurrencyGuard.ExecuteAsync(() => CancelCore(id));

    private async Task<ActionResult<ContentChangeRequestResponse>> CancelCore(Guid id)
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

        if (!await TryFinalizePendingRequestAsync(
                changeRequest,
                ContentChangeStatus.Cancelled,
                reviewedBySuperAdminId: null,
                reviewNote: null))
        {
            return Conflict("Only pending content requests can be cancelled.");
        }

        await auditLogger.LogAsync(
            user.Id,
            "content_change_cancelled",
            user.Id,
            nameof(ContentChangeRequest),
            changeRequest.Id.ToString());

        return Ok(ToResponse(changeRequest));
    }

    private async Task<bool> TryFinalizePendingRequestAsync(
        ContentChangeRequest changeRequest,
        ContentChangeStatus status,
        string? reviewedBySuperAdminId,
        string? reviewNote)
    {
        var reviewedAtUtc = DateTime.UtcNow;

        if (dbContext.Database.IsRelational())
        {
            var updated = await dbContext.ContentChangeRequests
                .Where(request => request.Id == changeRequest.Id &&
                    request.Status == ContentChangeStatus.Pending)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(request => request.Status, status)
                    .SetProperty(request => request.ReviewedBySuperAdminId, reviewedBySuperAdminId)
                    .SetProperty(request => request.ReviewedAtUtc, reviewedAtUtc)
                    .SetProperty(request => request.ReviewNote, reviewNote));
            if (updated == 0)
            {
                return false;
            }

            changeRequest.Status = status;
            changeRequest.ReviewedBySuperAdminId = reviewedBySuperAdminId;
            changeRequest.ReviewedAtUtc = reviewedAtUtc;
            changeRequest.ReviewNote = reviewNote;
            dbContext.Entry(changeRequest).State = EntityState.Unchanged;
            return true;
        }

        if (changeRequest.Status != ContentChangeStatus.Pending)
        {
            return false;
        }

        changeRequest.Status = status;
        changeRequest.ReviewedBySuperAdminId = reviewedBySuperAdminId;
        changeRequest.ReviewedAtUtc = reviewedAtUtc;
        changeRequest.ReviewNote = reviewNote;
        await dbContext.SaveChangesAsync();
        return true;
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
