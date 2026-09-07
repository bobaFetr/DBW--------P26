using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/admin-dashboard")]
[Authorize(Roles = "SuperAdmin,ContentAdmin")]
public class AdminDashboardController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<AdminDashboardSummary>> GetSummary(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        var publicRows = await dbContext.Albums.LongCountAsync(cancellationToken)
            + await dbContext.Singles.LongCountAsync(cancellationToken)
            + await dbContext.Concerts.LongCountAsync(cancellationToken)
            + await dbContext.News.LongCountAsync(cancellationToken)
            + await dbContext.TimeLines.LongCountAsync(cancellationToken)
            + await dbContext.Members.LongCountAsync(cancellationToken)
            + await dbContext.Gallery.LongCountAsync(cancellationToken);
        var isSuperAdmin = User.IsInRole("SuperAdmin");
        var pending = dbContext.ContentChangeRequests.Where(request => request.Status == ContentChangeStatus.Pending);
        if (!isSuperAdmin) pending = pending.Where(request => request.RequestedByUserId == userId);

        var pendingReview = await pending.LongCountAsync(cancellationToken);
        long? activeContentAdmins = isSuperAdmin
            ? await dbContext.AdminProfiles.LongCountAsync(profile =>
                profile.AdminKind == AdminKind.ContentAdmin && profile.IsActive && !profile.User.IsDisabled,
                cancellationToken)
            : null;
        return Ok(new AdminDashboardSummary(publicRows, pendingReview, activeContentAdmins));
    }
}

public record AdminDashboardSummary(long PublicRows, long PendingReview, long? ActiveContentAdmins);
