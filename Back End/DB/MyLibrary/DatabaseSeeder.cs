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
            role: "ContentAdmin");

        await EnsureAdminProfileAsync(
            dbContext,
            contentAdmin.Id,
            adminCode: "CADM-000001",
            adminKind: AdminKind.ContentAdmin,
            approvedByUserId: superAdmin.Id);

        await EnsureIdentityMetadataAsync(userManager, roleManager, superAdmin, contentAdmin);
        await EnsureSiteContentAsync(dbContext, superAdmin.Id, contentAdmin.Id);
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

    private static async Task EnsureIdentityMetadataAsync(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ApplicationUser superAdmin,
        ApplicationUser contentAdmin)
    {
        await EnsureRoleClaimAsync(roleManager, "SuperAdmin", "permission", "content.manage_all");
        await EnsureRoleClaimAsync(roleManager, "ContentAdmin", "permission", "content.request_changes");

        await EnsureUserClaimAsync(userManager, superAdmin, "admin_code", "SADM-000001");
        await EnsureUserClaimAsync(userManager, contentAdmin, "admin_code", "CADM-000001");

        await EnsureUserLoginAsync(userManager, superAdmin, "Seed", "superadmin", "Seeded superadmin");
        await EnsureUserLoginAsync(userManager, contentAdmin, "Seed", "contentadmin", "Seeded content admin");

        await userManager.SetAuthenticationTokenAsync(
            superAdmin,
            "Seed",
            "InitialToken",
            "superadmin-seed-token");
        await userManager.SetAuthenticationTokenAsync(
            contentAdmin,
            "Seed",
            "InitialToken",
            "contentadmin-seed-token");
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

    private static async Task EnsureUserLoginAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string loginProvider,
        string providerKey,
        string displayName)
    {
        var logins = await userManager.GetLoginsAsync(user);

        if (logins.Any(login =>
            login.LoginProvider == loginProvider && login.ProviderKey == providerKey))
        {
            return;
        }

        var result = await userManager.AddLoginAsync(
            user,
            new UserLoginInfo(loginProvider, providerKey, displayName));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to add login to user '{user.UserName}': {FormatErrors(result)}");
        }
    }

    private static async Task EnsureSiteContentAsync(
        AppDbContext dbContext,
        string superAdminId,
        string contentAdminId)
    {
        await EnsureAlbumsAsync(dbContext, superAdminId);
        await EnsureSinglesAsync(dbContext);
        await EnsureConcertsAsync(dbContext);
        await EnsureConcertSongsAsync(dbContext);
        await EnsureNewsAsync(dbContext);
        await EnsureTimeLinesAsync(dbContext);
        await EnsureMembersAsync(dbContext);
        await EnsureGalleryAsync(dbContext);
        await EnsureAdminRequestsAsync(dbContext, contentAdminId, superAdminId);
        await EnsureContentChangeRequestsAsync(dbContext, contentAdminId, superAdminId);
    }

    private static async Task EnsureAlbumsAsync(AppDbContext dbContext, string superAdminId)
    {
        if (await dbContext.Albums.AnyAsync(album => album.Title == "Seeded Demo Album"))
        {
            return;
        }

        dbContext.Albums.Add(new Albums
        {
            Title = "Seeded Demo Album",
            ReleaseDate = UtcDate(2026, 7, 12),
            NumberOfSongs = 2
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureSinglesAsync(AppDbContext dbContext)
    {
        if (await dbContext.Singles.AnyAsync(single => single.SongName == "Seeded First Single"))
        {
            return;
        }

        var album = await dbContext.Albums.FirstAsync(album => album.Title == "Seeded Demo Album");

        dbContext.Singles.AddRange(
            new Singles
            {
                SongName = "Seeded First Single",
                ReleaseDate = UtcDate(2026, 6, 21),
                AvailableOnYoutube = "https://youtube.com/example",
                AvailableOnSpotify = "https://open.spotify.com/example",
                AlbumId = album.AlbumId
            },
            new Singles
            {
                SongName = "Seeded Second Single",
                ReleaseDate = UtcDate(2026, 8, 2),
                AvailableOnYoutube = "https://youtube.com/example-second",
                AvailableOnSpotify = "https://open.spotify.com/example-second",
                AlbumId = album.AlbumId
            });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureConcertsAsync(AppDbContext dbContext)
    {
        if (await dbContext.Concerts.AnyAsync(concert => concert.Location == "Seeded Sofia Club"))
        {
            return;
        }

        dbContext.Concerts.Add(new Concerts
        {
            Date = UtcDate(2026, 9, 5),
            Location = "Seeded Sofia Club",
            Time = new TimeOnly(20, 30),
            NumberOfSongs = 2
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureConcertSongsAsync(AppDbContext dbContext)
    {
        var concert = await dbContext.Concerts.FirstAsync(
            concert => concert.Location == "Seeded Sofia Club");
        var songs = await dbContext.Singles
            .Where(single => single.SongName == "Seeded First Single"
                || single.SongName == "Seeded Second Single")
            .OrderBy(single => single.SongName)
            .ToListAsync();

        foreach (var song in songs.Select((song, index) => new { Song = song, Index = index }))
        {
            var exists = await dbContext.ConcertSongs.AnyAsync(concertSong =>
                concertSong.ConcertId == concert.ConcertId
                && concertSong.SongId == song.Song.SongId);

            if (exists)
            {
                continue;
            }

            dbContext.ConcertSongs.Add(new ConcertSong
            {
                ConcertId = concert.ConcertId,
                SongId = song.Song.SongId,
                DisplayOrder = song.Index + 1
            });
        }

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureNewsAsync(AppDbContext dbContext)
    {
        if (await dbContext.News.AnyAsync(news => news.Title == "Seeded News Post"))
        {
            return;
        }

        dbContext.News.Add(new News
        {
            Title = "Seeded News Post",
            Content = "This is seeded test news content for the public site.",
            PublicationDate = UtcDate(2026, 6, 7),
            Author = "Paralyze Admin"
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureTimeLinesAsync(AppDbContext dbContext)
    {
        if (await dbContext.TimeLines.AnyAsync(timeLine => timeLine.Event == "SEEDED MILESTONE"))
        {
            return;
        }

        dbContext.TimeLines.Add(new TimeLine
        {
            Date = UtcDate(2024, 12, 27),
            Event = "SEEDED MILESTONE",
            Description = "Seeded timeline data for testing the history page.",
            Location = "Sofia"
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureMembersAsync(AppDbContext dbContext)
    {
        if (await dbContext.Members.AnyAsync(member => member.Name == "Seeded Vocalist"))
        {
            return;
        }

        dbContext.Members.AddRange(
            new Members
            {
                Name = "Seeded Vocalist",
                Instrument = "Vocals",
                PhotoUrl = "/BUntitled.png"
            },
            new Members
            {
                Name = "Seeded Guitarist",
                Instrument = "Guitar",
                PhotoUrl = "/BUntitled.png"
            });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureGalleryAsync(AppDbContext dbContext)
    {
        if (await dbContext.Gallery.AnyAsync(gallery => gallery.Title == "Seeded Gallery Image"))
        {
            return;
        }

        dbContext.Gallery.Add(new Gallery
        {
            Title = "Seeded Gallery Image",
            Description = "Seeded gallery item for testing image content.",
            ImageUrl = "/BUntitled.png"
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureAdminRequestsAsync(
        AppDbContext dbContext,
        string contentAdminId,
        string superAdminId)
    {
        if (await dbContext.AdminRequests.AnyAsync(request => request.RequestCode == "AREQ-000001"))
        {
            return;
        }

        dbContext.AdminRequests.Add(new AdminRequest
        {
            RequestCode = "AREQ-000001",
            UserId = contentAdminId,
            Status = AdminRequestStatus.Approved,
            Message = "Seeded admin access request.",
            RequestedAtUtc = UtcDate(2026, 6, 1),
            ReviewedBySuperAdminId = superAdminId,
            ReviewedAtUtc = UtcDate(2026, 6, 2),
            ReviewNote = "Seeded approval."
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureContentChangeRequestsAsync(
        AppDbContext dbContext,
        string contentAdminId,
        string superAdminId)
    {
        if (await dbContext.ContentChangeRequests.AnyAsync(
            request => request.ChangeCode == "CHG-000001"))
        {
            return;
        }

        dbContext.ContentChangeRequests.AddRange(
            new ContentChangeRequest
            {
                ChangeCode = "CHG-000001",
                RequestedByUserId = contentAdminId,
                ContentType = "News",
                TargetEntityId = null,
                Action = ContentChangeAction.Create,
                Status = ContentChangeStatus.Approved,
                PayloadJson = "{\"title\":\"Seeded request news\",\"content\":\"Seeded approved content change.\"}",
                Message = "Seeded approved content change request.",
                RequestedAtUtc = UtcDate(2026, 6, 3),
                ReviewedBySuperAdminId = superAdminId,
                ReviewedAtUtc = UtcDate(2026, 6, 4),
                ReviewNote = "Seeded content approval."
            },
            new ContentChangeRequest
            {
                ChangeCode = "CHG-000002",
                RequestedByUserId = contentAdminId,
                ContentType = "Gallery",
                TargetEntityId = null,
                Action = ContentChangeAction.Create,
                Status = ContentChangeStatus.Pending,
                PayloadJson = "{\"title\":\"Seeded pending gallery\",\"imageUrl\":\"/BUntitled.png\"}",
                Message = "Seeded pending content change request.",
                RequestedAtUtc = UtcDate(2026, 6, 5)
            });

        await dbContext.SaveChangesAsync();
    }

    private static DateTime UtcDate(int year, int month, int day)
    {
        return new DateTime(year, month, day, 0, 0, 0, DateTimeKind.Utc);
    }

    private static string FormatErrors(IdentityResult result)
    {
        return string.Join(", ", result.Errors.Select(error => error.Description));
    }
}
