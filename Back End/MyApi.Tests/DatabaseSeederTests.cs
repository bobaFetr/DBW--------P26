using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public sealed class DatabaseSeederTests : IDisposable
{
    private static readonly DatabaseSeedOptions SeedOptions = new(
        "TestSuperAdmin-2026!", "TestContentAdmin-2026!");
    private readonly ServiceProvider services;

    public DatabaseSeederTests()
    {
        var databaseName = Guid.NewGuid().ToString();
        var collection = new ServiceCollection();
        collection.AddLogging();
        collection.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(databaseName));
        collection.AddIdentityCore<ApplicationUser>()
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>();
        services = collection.BuildServiceProvider();
    }

    [Fact]
    public async Task FreshDatabase_CreatesDesignatedAdminsOnlyOnce()
    {
        await DatabaseSeeder.SeedAsync(services, SeedOptions);
        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.Equal(2, await db.Users.CountAsync());
        Assert.Equal(2, await db.AdminProfiles.CountAsync());
        foreach (var (name, role, password) in new[]
        {
            ("superadmin", "SuperAdmin", SeedOptions.SuperAdminPassword),
            ("contentadmin", "ContentAdmin", SeedOptions.ContentAdminPassword)
        })
        {
            var user = await manager.FindByNameAsync(name);
            Assert.NotNull(user);
            Assert.True(await manager.IsInRoleAsync(user, role));
            Assert.True(await manager.CheckPasswordAsync(user, password));
            Assert.Contains(await manager.GetClaimsAsync(user), claim => claim.Type == "admin_code");
        }
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task KickedDefaultAdmin_IsNotRecreatedOrReplacedByAnotherAdmin(
        bool addOtherAdmin, bool legacyDatabase)
    {
        await DatabaseSeeder.SeedAsync(services, SeedOptions);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await manager.FindByNameAsync("contentadmin");
            await ContentAdminDataDeletion.DeleteAsync(db, user!);
            if (legacyDatabase)
            {
                db.SiteSettings.RemoveRange(db.SiteSettings);
                await db.SaveChangesAsync();
            }
            if (addOtherAdmin)
            {
                var other = new ApplicationUser
                {
                    UserName = "other-admin", Email = "other@example.com", DisplayName = "Other Admin"
                };
                Assert.True((await manager.CreateAsync(other)).Succeeded);
                Assert.True((await manager.AddToRoleAsync(other, "ContentAdmin")).Succeeded);
            }
        }

        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        using var verification = services.CreateScope();
        var users = verification.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.Null(await users.FindByNameAsync("contentadmin"));
        if (addOtherAdmin)
        {
            var other = await users.FindByNameAsync("other-admin");
            Assert.NotNull(other);
            Assert.Equal("other@example.com", other.Email);
            Assert.Equal("Other Admin", other.DisplayName);
            Assert.True(await users.IsInRoleAsync(other, "ContentAdmin"));
        }
    }

    [Fact]
    public async Task CompletedBootstrap_DoesNotRecreateAccountsEvenWhenAllUsersAreDeleted()
    {
        await DatabaseSeeder.SeedAsync(services, SeedOptions);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var user in await db.Users.ToListAsync())
            {
                await ContentAdminDataDeletion.DeleteAsync(db, user);
            }
        }

        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        using var verification = services.CreateScope();
        var database = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await database.Users.ToListAsync());
    }

    [Theory]
    [InlineData("other-admin")]
    [InlineData("contentadmin")]
    [InlineData("superadmin")]
    public async Task LegacyDatabase_LeavesExistingIdentityAndRevocationUntouched(string userName)
    {
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new ApplicationUser
            {
                Id = "existing-user", UserName = userName, NormalizedUserName = userName.ToUpperInvariant(),
                Email = "existing@example.com", DisplayName = "Existing Name", IsDisabled = true,
                EmailConfirmed = false
            });
            db.AdminProfiles.Add(new AdminProfile
            {
                UserId = "existing-user", AdminCode = "CUSTOM-CODE", AdminKind = AdminKind.ContentAdmin,
                IsActive = false, DisabledByUserId = "reviewer", DisabledAtUtc = DateTime.UnixEpoch
            });
            await db.SaveChangesAsync();
        }

        await DatabaseSeeder.SeedAsync(services, SeedOptions);
        await DatabaseSeeder.SeedAsync(services, SeedOptions);

        using var verification = services.CreateScope();
        var database = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = Assert.Single(await database.Users.ToListAsync());
        Assert.Equal(userName, user.UserName);
        Assert.Equal("existing@example.com", user.Email);
        Assert.Equal("Existing Name", user.DisplayName);
        Assert.True(user.IsDisabled);
        Assert.False(user.EmailConfirmed);
        Assert.Empty(await database.UserRoles.ToListAsync());
        var profile = Assert.Single(await database.AdminProfiles.ToListAsync());
        Assert.False(profile.IsActive);
        Assert.Equal("CUSTOM-CODE", profile.AdminCode);
        Assert.Equal("reviewer", profile.DisabledByUserId);
        Assert.Equal(DateTime.UnixEpoch, profile.DisabledAtUtc);
    }

    public void Dispose() => services.Dispose();
}
