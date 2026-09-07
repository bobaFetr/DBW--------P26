using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Controllers;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class AdminDashboardTests
{
    [Theory]
    [InlineData(true, 61)]
    [InlineData(false, 60)]
    public async Task Summary_CountsBeyondFirstPageAndScopesPendingRequests(bool superAdmin, long expectedPending)
    {
        using var db = TestDb.Create();
        for (var index = 0; index < 60; index++)
        {
            db.Gallery.Add(new Gallery { Title = "Photo", ImageUrl = "/image.png" });
            db.ContentChangeRequests.Add(new ContentChangeRequest
            {
                ChangeCode = $"CHG-{index}", RequestedByUserId = "owner", ContentType = "gallery", PayloadJson = "{}"
            });
        }
        db.ContentChangeRequests.Add(new ContentChangeRequest
        {
            ChangeCode = "other", RequestedByUserId = "other", ContentType = "gallery", PayloadJson = "{}"
        });
        db.ContentChangeRequests.Add(new ContentChangeRequest
        {
            ChangeCode = "approved", RequestedByUserId = "owner", ContentType = "gallery", PayloadJson = "{}",
            Status = ContentChangeStatus.Approved
        });
        foreach (var (id, active, disabled) in new[] { ("active", true, false), ("inactive", false, false), ("disabled", true, true) })
            db.AdminProfiles.Add(new AdminProfile
            {
                User = new ApplicationUser { Id = id, UserName = id, IsDisabled = disabled },
                AdminCode = id, AdminKind = AdminKind.ContentAdmin, IsActive = active
            });
        await db.SaveChangesAsync();
        var controller = new AdminDashboardController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity([
                        new Claim(ClaimTypes.NameIdentifier, "owner"),
                        new Claim(ClaimTypes.Role, superAdmin ? "SuperAdmin" : "ContentAdmin")], "test"))
                }
            }
        };
        var response = Assert.IsType<OkObjectResult>((await controller.GetSummary(CancellationToken.None)).Result);
        var summary = Assert.IsType<AdminDashboardSummary>(response.Value);
        Assert.Equal(60, summary.PublicRows);
        Assert.Equal(expectedPending, summary.PendingReview);
        Assert.Equal(superAdmin ? (long?)1 : null, summary.ActiveContentAdmins);
    }

    [Fact]
    public async Task AuditCursor_ReachesOlderAndRevokedAccountEventsDespiteNewInsert()
    {
        using var db = TestDb.Create();
        var timestamp = new DateTime(2026, 9, 7, 0, 0, 0, DateTimeKind.Utc);
        for (var index = 0; index < 105; index++)
            db.AdminAuditLogs.Add(new AdminAuditLog
            {
                AdminUserId = "revoked", Action = "change", CreatedAtUtc = timestamp.AddSeconds(index)
            });
        await db.SaveChangesAsync();
        var controller = new ContentAdminsController(db, null!, new AuditLogger(db));
        var first = Rows(await controller.GetAudit(null, CancellationToken.None, 100));
        Assert.Equal(100, first.Count);
        db.AdminAuditLogs.Add(new AdminAuditLog { AdminUserId = "other", Action = "new", CreatedAtUtc = timestamp.AddDays(1) });
        await db.SaveChangesAsync();
        var cursor = first[^1];
        var next = Rows(await controller.GetAudit(null, CancellationToken.None, 100, cursor.CreatedAtUtc, cursor.Id));
        Assert.Equal(5, next.Count);
        Assert.Empty(first.Select(row => row.Id).Intersect(next.Select(row => row.Id)));
        Assert.All(next, row => Assert.Equal("revoked", row.AdminUserId));
        Assert.IsType<BadRequestObjectResult>((await controller.GetAudit(null, CancellationToken.None, 50, timestamp)).Result);
    }

    [Fact]
    public async Task AdminList_EqualNames_CanLoadBeyondFifty()
    {
        using var db = TestDb.Create();
        for (var index = 59; index >= 0; index--)
            db.AdminProfiles.Add(new AdminProfile
            {
                User = new ApplicationUser { Id = $"user-{index:D2}", UserName = "same" },
                AdminCode = $"CA-{index}", AdminKind = AdminKind.ContentAdmin
            });
        await db.SaveChangesAsync();
        var controller = new ContentAdminsController(db, null!, new AuditLogger(db));
        var response = Assert.IsType<OkObjectResult>((await controller.GetAll(2, 50)).Result);
        var rows = Assert.IsAssignableFrom<IEnumerable<ContentAdminResponse>>(response.Value).ToList();
        Assert.Equal(10, rows.Count);
        Assert.Equal("user-50", rows[0].UserId);
    }

    private static List<AdminAuditLogResponse> Rows(ActionResult<IEnumerable<AdminAuditLogResponse>> result) =>
        Assert.IsAssignableFrom<IEnumerable<AdminAuditLogResponse>>(Assert.IsType<OkObjectResult>(result.Result).Value).ToList();
}
