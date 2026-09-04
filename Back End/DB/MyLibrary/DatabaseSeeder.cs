using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace MyLibrary;

public sealed record DatabaseSeedOptions(
    string SuperAdminPassword,
    string ContentAdminPassword);

public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        IServiceProvider services,
        DatabaseSeedOptions options)
    {
        using var scope = services.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await EnsureRoleAsync(roleManager, "SuperAdmin");
        await EnsureRoleAsync(roleManager, "ContentAdmin");

        var superAdmin = await EnsureUserAsync(
            userManager,
            username: "superadmin",
            email: "superadmin@paralyze.local",
            displayName: "Super Admin",
            password: options.SuperAdminPassword,
            role: "SuperAdmin");

        await EnsureAdminProfileAsync(
            dbContext,
            superAdmin.Id,
            adminCode: "SADM-000001",
            adminKind: AdminKind.SuperAdmin,
            approvedByUserId: null);

        var contentAdmin = await EnsureUserAsync(
            userManager,
            username: "contentadmin",
            email: "contentadmin@paralyze.local",
            displayName: "Content Admin",
            password: options.ContentAdminPassword,
            role: "ContentAdmin",
            ensureRoleForExistingUser: false);

        var contentAdminHasRole = await userManager.IsInRoleAsync(contentAdmin, "ContentAdmin");
        if (contentAdminHasRole)
        {
            await EnsureAdminProfileAsync(
                dbContext,
                contentAdmin.Id,
                adminCode: "CADM-000001",
                adminKind: AdminKind.ContentAdmin,
                approvedByUserId: superAdmin.Id);
        }

        await EnsureIdentityMetadataAsync(
            userManager,
            roleManager,
            superAdmin,
            contentAdminHasRole ? contentAdmin : null);
    }

    private static async Task EnsureRoleAsync(
        RoleManager<IdentityRole> roleManager,
        string roleName)
    {
        if (await roleManager.RoleExistsAsync(roleName))
        {
            return;
        }

        var result = await roleManager.CreateAsync(new IdentityRole(roleName));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to create role '{roleName}': {FormatErrors(result)}");
        }
    }

    private static async Task<ApplicationUser> EnsureUserAsync(
        UserManager<ApplicationUser> userManager,
        string username,
        string email,
        string displayName,
        string password,
        string role,
        bool ensureRoleForExistingUser = true)
    {
        var user = await userManager.FindByNameAsync(username);
        var userWasCreated = false;

        if (user is null)
        {
            var usersInRole = await userManager.GetUsersInRoleAsync(role);
            if (usersInRole.Count == 1)
            {
                user = usersInRole[0];
            }
        }

        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = username,
                Email = email,
                EmailConfirmed = true,
                DisplayName = displayName
            };

            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to create user '{username}': {FormatErrors(createResult)}");
            }

            userWasCreated = true;
        }
        else
        {
            user.UserName = username;
            user.Email = email;
            user.EmailConfirmed = true;
            user.DisplayName = displayName;

            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to update user '{username}': {FormatErrors(updateResult)}");
            }
        }

        if ((userWasCreated || ensureRoleForExistingUser) &&
            !await userManager.IsInRoleAsync(user, role))
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            if (!roleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to add user '{username}' to role '{role}': {FormatErrors(roleResult)}");
            }
        }

        return user;
    }

    private static async Task EnsureAdminProfileAsync(
        AppDbContext dbContext,
        string userId,
        string adminCode,
        AdminKind adminKind,
        string? approvedByUserId)
    {
        var profile = await dbContext.AdminProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
        {
            dbContext.AdminProfiles.Add(new AdminProfile
            {
                UserId = userId,
                AdminCode = adminCode,
                AdminKind = adminKind,
                IsActive = true,
                ApprovedByUserId = approvedByUserId
            });

            await dbContext.SaveChangesAsync();
            return;
        }

        profile.AdminCode = adminCode;
        profile.AdminKind = adminKind;
        profile.IsActive = true;
        profile.DisabledAtUtc = null;
        profile.DisabledByUserId = null;

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureIdentityMetadataAsync(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ApplicationUser superAdmin,
        ApplicationUser? contentAdmin)
    {
        await EnsureRoleClaimAsync(roleManager, "SuperAdmin", "permission", "content.manage_all");
        await EnsureRoleClaimAsync(roleManager, "ContentAdmin", "permission", "content.request_changes");

        await EnsureUserClaimAsync(userManager, superAdmin, "admin_code", "SADM-000001");

        if (contentAdmin is not null)
        {
            await EnsureUserClaimAsync(userManager, contentAdmin, "admin_code", "CADM-000001");
        }
    }

    private static async Task EnsureRoleClaimAsync(
        RoleManager<IdentityRole> roleManager,
        string roleName,
        string claimType,
        string claimValue)
    {
        var role = await roleManager.FindByNameAsync(roleName)
            ?? throw new InvalidOperationException($"Role '{roleName}' was not found.");
        var claims = await roleManager.GetClaimsAsync(role);

        if (claims.Any(claim => claim.Type == claimType && claim.Value == claimValue))
        {
            return;
        }

        var result = await roleManager.AddClaimAsync(role, new Claim(claimType, claimValue));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to add claim to role '{roleName}': {FormatErrors(result)}");
        }
    }

    private static async Task EnsureUserClaimAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string claimType,
        string claimValue)
    {
        var claims = await userManager.GetClaimsAsync(user);

        if (claims.Any(claim => claim.Type == claimType && claim.Value == claimValue))
        {
            return;
        }

        var result = await userManager.AddClaimAsync(user, new Claim(claimType, claimValue));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to add claim to user '{user.UserName}': {FormatErrors(result)}");
        }
    }

    private static string FormatErrors(IdentityResult result)
    {
        return string.Join(", ", result.Errors.Select(error => error.Description));
    }
}
