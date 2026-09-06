using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Services;

public static class ContentAdminDataDeletion
{
    public static async Task DeleteAsync(
        AppDbContext dbContext,
        ApplicationUser user,
        CancellationToken cancellationToken = default)
    {
        var userId = user.Id;

        dbContext.AdminProfiles.RemoveRange(
            dbContext.AdminProfiles.Where(profile => profile.UserId == userId));
        dbContext.AdminRequests.RemoveRange(
            dbContext.AdminRequests.Where(request => request.UserId == userId));
        dbContext.ContentChangeRequests.RemoveRange(
            dbContext.ContentChangeRequests.Where(request => request.RequestedByUserId == userId));
        dbContext.AdminAuditLogs.RemoveRange(
            dbContext.AdminAuditLogs.Where(log => log.AdminUserId == userId));

        dbContext.UserClaims.RemoveRange(
            dbContext.UserClaims.Where(claim => claim.UserId == userId));
        dbContext.UserLogins.RemoveRange(
            dbContext.UserLogins.Where(login => login.UserId == userId));
        dbContext.UserRoles.RemoveRange(
            dbContext.UserRoles.Where(role => role.UserId == userId));
        dbContext.UserTokens.RemoveRange(
            dbContext.UserTokens.Where(token => token.UserId == userId));
        dbContext.Users.Remove(user);

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
