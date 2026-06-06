using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
        await dbContext.Database.EnsureCreatedAsync();

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
            role: "ContentAdmin");

        await EnsureAdminProfileAsync(
            dbContext,
            contentAdmin.Id,
            adminCode: "CADM-000001",
            adminKind: AdminKind.ContentAdmin,
            approvedByUserId: superAdmin.Id);
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
        string role)
    {
        var user = await userManager.FindByNameAsync(username);

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
        }

        if (!await userManager.IsInRoleAsync(user, role))
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

    private static string FormatErrors(IdentityResult result)
    {
        return string.Join(", ", result.Errors.Select(error => error.Description));
    }
}
