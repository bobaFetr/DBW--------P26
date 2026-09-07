using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyApi.Controllers;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class AdminLifecycleTests
{
    [Fact]
    public async Task Signup_Duplicate_Denial_Reapplication_Approval_Revocation_Reapproval()
    {
        var collection = new ServiceCollection();
        collection.AddLogging();
        collection.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        collection.AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole>().AddEntityFrameworkStores<AppDbContext>();
        using var services = collection.BuildServiceProvider();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        Assert.True((await roles.CreateAsync(new IdentityRole("ContentAdmin"))).Succeeded);
        var reviewer = new ApplicationUser { UserName = "reviewer", Email = "reviewer@example.test" };
        Assert.True((await users.CreateAsync(reviewer, "Review-Password-2026!")).Succeeded);
        db.SiteSettings.Add(new SiteSetting { Key = CaRequestsPermissionController.SettingKey, BooleanValue = true });
        await db.SaveChangesAsync();
        var auth = new AuthController(users, null!, db, new CodeGenerator(), null!, null!)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var actor = new ControllerContext { HttpContext = new DefaultHttpContext {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, reviewer.Id)], "test"))
        }};
        var reviews = new AdminRequestsController(db, users, new CodeGenerator(), new AuditLogger(db)) { ControllerContext = actor };
        var admins = new ContentAdminsController(db, users, new AuditLogger(db)) { ControllerContext = actor };
        var signup = new RegisterRequest("candidate", "candidate@example.test", "Candidate-Password-2026!", "Candidate");

        var first = Assert.IsType<AdminRequestResponse>(Assert.IsType<CreatedResult>((await auth.RegisterContentAdminRequest(signup)).Result).Value);
        Assert.IsType<ConflictObjectResult>((await auth.RegisterContentAdminRequest(signup)).Result);
        var target = (await users.FindByNameAsync("candidate"))!;
        Assert.False(target.EmailConfirmed);
        Assert.False(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.IsType<OkObjectResult>((await reviews.Deny(first.Id, new ReviewRequestDto("Test denial"))).Result);
        Assert.IsType<UnauthorizedObjectResult>((await auth.RegisterContentAdminRequest(signup with { Password = "Wrong-Password-2026!" })).Result);
        var second = Assert.IsType<AdminRequestResponse>(Assert.IsType<CreatedResult>((await auth.RegisterContentAdminRequest(signup)).Result).Value);
        Assert.Equal(first.UserId, second.UserId);
        Assert.IsType<OkObjectResult>((await reviews.Approve(second.Id, new ReviewRequestDto("Test approval"))).Result);
        Assert.True(target.EmailConfirmed);
        Assert.True(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.Single(await db.AdminProfiles.ToListAsync());
        Assert.IsType<BadRequestObjectResult>((await auth.RegisterContentAdminRequest(signup)).Result);
        var stamp = target.SecurityStamp;
        Assert.IsType<NoContentResult>(await admins.KickOut(target.Id, new KickContentAdminRequest("Review-Password-2026!")));
        Assert.NotEqual(stamp, target.SecurityStamp);
        Assert.False(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.Empty(await db.AdminProfiles.ToListAsync());
        var third = Assert.IsType<AdminRequestResponse>(Assert.IsType<CreatedResult>((await auth.RegisterContentAdminRequest(signup)).Result).Value);
        Assert.Equal(first.UserId, third.UserId);
        Assert.IsType<OkObjectResult>((await reviews.Approve(third.Id, new ReviewRequestDto("Reapproved"))).Result);
        Assert.True(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.Single(await db.AdminProfiles.ToListAsync());
        Assert.Equal(2, await db.Users.CountAsync());
        Assert.Equal(4, await db.AdminAuditLogs.CountAsync());
    }
}
