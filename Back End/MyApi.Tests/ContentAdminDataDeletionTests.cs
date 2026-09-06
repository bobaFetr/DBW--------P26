using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentAdminDataDeletionTests
{
    [Fact]
    public async Task DeleteAsync_RemovesUserAndAllOwnedAdminData()
    {
        using var dbContext = TestDb.Create();
        var user = new ApplicationUser
        {
            Id = "content-admin-1",
            UserName = "contentadmin",
            NormalizedUserName = "CONTENTADMIN",
            Email = "content@example.com",
            NormalizedEmail = "CONTENT@EXAMPLE.COM"
        };

        dbContext.Users.Add(user);
        dbContext.AdminProfiles.Add(new AdminProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            AdminCode = "CADM-000099",
            AdminKind = AdminKind.ContentAdmin
        });
        dbContext.AdminRequests.Add(new AdminRequest
        {
            Id = Guid.NewGuid(),
            RequestCode = "AREQ-000099",
            UserId = user.Id
        });
        dbContext.ContentChangeRequests.Add(new ContentChangeRequest
        {
            Id = Guid.NewGuid(),
            ChangeCode = "CHG-000099",
            RequestedByUserId = user.Id,
            ContentType = "news",
            Action = ContentChangeAction.Create,
            PayloadJson = "{}"
        });
        dbContext.AdminAuditLogs.Add(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminUserId = user.Id,
            Action = "Test"
        });
        dbContext.UserClaims.Add(new IdentityUserClaim<string> { UserId = user.Id, ClaimType = "test", ClaimValue = "value" });
        dbContext.UserRoles.Add(new IdentityUserRole<string> { UserId = user.Id, RoleId = "content-role" });
        dbContext.UserTokens.Add(new IdentityUserToken<string> { UserId = user.Id, LoginProvider = "test", Name = "token", Value = "secret" });
        await dbContext.SaveChangesAsync();

        await ContentAdminDataDeletion.DeleteAsync(dbContext, user);

        Assert.False(await dbContext.Users.AnyAsync(item => item.Id == user.Id));
        Assert.False(await dbContext.AdminProfiles.AnyAsync(item => item.UserId == user.Id));
        Assert.False(await dbContext.AdminRequests.AnyAsync(item => item.UserId == user.Id));
        Assert.False(await dbContext.ContentChangeRequests.AnyAsync(item => item.RequestedByUserId == user.Id));
        Assert.False(await dbContext.AdminAuditLogs.AnyAsync(item => item.AdminUserId == user.Id));
        Assert.False(await dbContext.UserClaims.AnyAsync(item => item.UserId == user.Id));
        Assert.False(await dbContext.UserRoles.AnyAsync(item => item.UserId == user.Id));
        Assert.False(await dbContext.UserTokens.AnyAsync(item => item.UserId == user.Id));
    }
}
