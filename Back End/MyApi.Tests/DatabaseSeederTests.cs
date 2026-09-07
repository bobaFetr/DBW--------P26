using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public sealed class DatabaseSeederTests
{
    private static readonly DatabaseSeedOptions SeedOptions = new(
        "LocalSuperAdmin-2026!",
        "LocalContentAdmin-2026!");

    [Fact]
    public async Task SeedAsync_DoesNotRestoreRevokedDefaultContentAdminAccess()
    {
        await using var services = CreateServices();
        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        await using (var scope = services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var contentAdmin = await userManager.FindByNameAsync("contentadmin");
            Assert.True(
                contentAdmin is not null,
                $"Seeded users: {string.Join(", ", await dbContext.Users.Select(user => user.UserName).ToListAsync())}");

            Assert.True((await userManager.RemoveFromRoleAsync(contentAdmin, "ContentAdmin")).Succeeded);
            dbContext.AdminProfiles.RemoveRange(
                dbContext.AdminProfiles.Where(profile => profile.UserId == contentAdmin.Id));
            await dbContext.SaveChangesAsync();
        }

        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        await using var verificationScope = services.CreateAsyncScope();
        var verificationUserManager = verificationScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var contentAdminAfterReseed = await verificationUserManager.FindByNameAsync("contentadmin");
        Assert.NotNull(contentAdminAfterReseed);
        Assert.False(await verificationUserManager.IsInRoleAsync(contentAdminAfterReseed, "ContentAdmin"));
    }

    [Fact]
    public async Task SeedAsync_DoesNotRenameAnExistingContentAdmin()
    {
        await using var services = CreateServices();
        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        await using (var scope = services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var defaultContentAdmin = await userManager.FindByNameAsync("contentadmin");
            Assert.True(
                defaultContentAdmin is not null,
                $"Seeded users: {string.Join(", ", await dbContext.Users.Select(user => user.UserName).ToListAsync())}");
            Assert.True((await userManager.RemoveFromRoleAsync(defaultContentAdmin, "ContentAdmin")).Succeeded);
            dbContext.AdminProfiles.RemoveRange(
                dbContext.AdminProfiles.Where(profile => profile.UserId == defaultContentAdmin.Id));
            await dbContext.SaveChangesAsync();

            var replacement = new ApplicationUser
            {
                UserName = "replacement-admin",
                Email = "replacement-admin@paralyze.local",
                EmailConfirmed = true,
                DisplayName = "Replacement Admin"
            };
            Assert.True((await userManager.CreateAsync(replacement, "ReplacementAdmin-2026!")).Succeeded);
            Assert.True((await userManager.AddToRoleAsync(replacement, "ContentAdmin")).Succeeded);
            dbContext.AdminProfiles.Add(new AdminProfile
            {
                UserId = replacement.Id,
                AdminCode = "CADM-009999",
                AdminKind = AdminKind.ContentAdmin
            });
            await dbContext.SaveChangesAsync();
        }

        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        await using var verificationScope = services.CreateAsyncScope();
        var verificationUserManager = verificationScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var replacementAdmin = await verificationUserManager.FindByNameAsync("replacement-admin");
        Assert.NotNull(replacementAdmin);
        Assert.Equal("replacement-admin@paralyze.local", replacementAdmin.Email);
        Assert.Equal("Replacement Admin", replacementAdmin.DisplayName);
        var revokedContentAdmin = await verificationUserManager.FindByNameAsync("contentadmin");
        Assert.NotNull(revokedContentAdmin);
        Assert.False(await verificationUserManager.IsInRoleAsync(revokedContentAdmin, "ContentAdmin"));
    }

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();
        var databaseName = Guid.NewGuid().ToString();
        var databaseRoot = new InMemoryDatabaseRoot();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(databaseName, databaseRoot));
        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 12;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>();
        services.AddScoped<IPasswordHasher<ApplicationUser>, BcryptPasswordHasher>();
        return services.BuildServiceProvider();
    }
}
