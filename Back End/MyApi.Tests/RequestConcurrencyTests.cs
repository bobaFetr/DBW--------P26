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
using Npgsql;

namespace MyApi.Tests;

public sealed class RequestConcurrencyTests : IDisposable
{
    private readonly ServiceProvider services;

    public RequestConcurrencyTests()
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

    [Theory]
    [InlineData("approve", "cancel")]
    [InlineData("approve", "deny")]
    [InlineData("approve", "approve")]
    [InlineData("cancel", "approve")]
    [InlineData("cancel", "deny")]
    [InlineData("deny", "approve")]
    [InlineData("deny", "cancel")]
    public async Task ContentRequest_StaleTransitionConflictsAndPreservesWinner(string winner, string loser)
    {
        var id = Guid.NewGuid();
        using (var setup = services.CreateScope())
        {
            var db = setup.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new ApplicationUser { Id = "owner", UserName = "owner" });
            db.ContentChangeRequests.Add(new ContentChangeRequest
            {
                Id = id, ChangeCode = "CHG-RACE", RequestedByUserId = "owner",
                ContentType = "news", Action = ContentChangeAction.Create,
                PayloadJson = """{"title":"Published once","content":"Body","author":"Band","publicationDate":"2026-09-07T00:00:00Z"}"""
            });
            await db.SaveChangesAsync();
        }

        // Both contexts observe Pending. Keep one tracked copy stale while
        // another request commits, reproducing the dangerous interleaving.
        using var staleScope = services.CreateScope();
        var staleDb = staleScope.ServiceProvider.GetRequiredService<AppDbContext>();
        await staleDb.ContentChangeRequests.Include(request => request.RequestedByUser).SingleAsync();
        using (var winningScope = services.CreateScope())
        {
            var result = await Transition(ContentController(winningScope), id, winner, "winner");
            Assert.IsType<OkObjectResult>(result.Result);
        }

        var staleResult = await Transition(ContentController(staleScope), id, loser, "loser");
        Assert.IsType<ConflictObjectResult>(staleResult.Result);

        using var verification = services.CreateScope();
        var database = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        var saved = await database.ContentChangeRequests.SingleAsync();
        Assert.Equal(winner switch
        {
            "approve" => ContentChangeStatus.Approved,
            "deny" => ContentChangeStatus.Denied,
            _ => ContentChangeStatus.Cancelled
        }, saved.Status);
        Assert.Equal(winner == "cancel" ? null : "winner", saved.ReviewNote);
        Assert.Equal(winner == "approve" ? 1 : 0, await database.News.CountAsync());
    }

    [Theory]
    [InlineData("approve", "deny")]
    [InlineData("approve", "approve")]
    [InlineData("deny", "approve")]
    public async Task AdminRequest_StaleTransitionCannotOverwriteDecisionOrGrantAccess(string winner, string loser)
    {
        var id = Guid.NewGuid();
        using (var setup = services.CreateScope())
        {
            var db = setup.ServiceProvider.GetRequiredService<AppDbContext>();
            var users = setup.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roles = setup.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            Assert.True((await roles.CreateAsync(new IdentityRole("ContentAdmin"))).Succeeded);
            Assert.True((await users.CreateAsync(new ApplicationUser
            {
                Id = "reviewer", UserName = "reviewer", EmailConfirmed = true
            })).Succeeded);
            Assert.True((await users.CreateAsync(new ApplicationUser
            {
                Id = "candidate", UserName = "candidate", Email = "candidate@example.com"
            })).Succeeded);
            db.AdminRequests.Add(new AdminRequest
            {
                Id = id, UserId = "candidate", RequestCode = "AREQ-RACE"
            });
            await db.SaveChangesAsync();
        }

        using var staleScope = services.CreateScope();
        var staleDb = staleScope.ServiceProvider.GetRequiredService<AppDbContext>();
        await staleDb.AdminRequests.Include(request => request.User).SingleAsync();
        using (var winningScope = services.CreateScope())
        {
            var result = await Transition(AdminController(winningScope), id, winner, "winner");
            Assert.IsType<OkObjectResult>(result.Result);
        }

        var staleResult = await Transition(AdminController(staleScope), id, loser, "loser");
        Assert.IsType<ConflictObjectResult>(staleResult.Result);

        using var verification = services.CreateScope();
        var database = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        var manager = verification.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var saved = await database.AdminRequests.SingleAsync();
        var candidate = await manager.FindByIdAsync("candidate");
        Assert.Equal(winner == "approve" ? AdminRequestStatus.Approved : AdminRequestStatus.Denied, saved.Status);
        Assert.Equal("winner", saved.ReviewNote);
        Assert.Equal(winner == "approve", await manager.IsInRoleAsync(candidate!, "ContentAdmin"));
        Assert.Equal(winner == "approve", candidate!.EmailConfirmed);
        Assert.Equal(winner == "approve" ? 1 : 0, await database.AdminProfiles.CountAsync());
    }

    [Theory]
    [InlineData(PostgresErrorCodes.SerializationFailure, false)]
    [InlineData(PostgresErrorCodes.SerializationFailure, true)]
    [InlineData(PostgresErrorCodes.DeadlockDetected, false)]
    [InlineData(PostgresErrorCodes.DeadlockDetected, true)]
    public async Task PostgreSqlConcurrencyFailure_ReturnsConflictWithoutRetry(string sqlState, bool wrapped)
    {
        var calls = 0;
        var postgresError = new PostgresException("Concurrent update", "ERROR", "ERROR", sqlState);
        Exception error = wrapped ? new DbUpdateException("Save failed", postgresError) : postgresError;
        var result = await RequestConcurrencyGuard.ExecuteAsync<string>(() =>
        {
            calls++;
            return Task.FromException<ActionResult<string>>(error);
        });
        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task KickOut_RequiresPasswordThenRevokesRoleProfileAndSessionStamp()
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        Assert.True((await roles.CreateAsync(new IdentityRole("ContentAdmin"))).Succeeded);
        var reviewer = new ApplicationUser { Id = "reviewer", UserName = "reviewer" };
        var target = new ApplicationUser { Id = "target", UserName = "target" };
        Assert.True((await users.CreateAsync(reviewer, "Review-Password-2026!")).Succeeded);
        Assert.True((await users.CreateAsync(target)).Succeeded);
        Assert.True((await users.AddToRoleAsync(target, "ContentAdmin")).Succeeded);
        db.AdminProfiles.Add(new AdminProfile { UserId = target.Id, AdminKind = AdminKind.ContentAdmin, AdminCode = "CA-TEST" });
        await db.SaveChangesAsync();
        var stamp = await users.GetSecurityStampAsync(target);
        var controller = new ContentAdminsController(db, users, new AuditLogger(db)) { ControllerContext = Actor(reviewer.Id) };

        Assert.IsType<UnauthorizedObjectResult>(await controller.KickOut(target.Id, new KickContentAdminRequest("wrong")));
        Assert.True(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.Single(await db.AdminProfiles.ToListAsync());
        Assert.Empty(await db.AdminAuditLogs.ToListAsync());

        Assert.IsType<NoContentResult>(await controller.KickOut(target.Id, new KickContentAdminRequest("Review-Password-2026!")));
        Assert.False(await users.IsInRoleAsync(target, "ContentAdmin"));
        Assert.NotEqual(stamp, await users.GetSecurityStampAsync(target));
        Assert.Empty(await db.AdminProfiles.ToListAsync());
        Assert.NotNull(await users.FindByIdAsync(target.Id));
        var audit = await db.AdminAuditLogs.SingleAsync();
        Assert.Equal("content_admin_access_revoked", audit.Action);
        Assert.Equal(target.Id, audit.AdminUserId);
        Assert.Equal(reviewer.Id, audit.PerformedByUserId);
    }

    [Fact]
    public async Task UnrelatedDatabaseFailure_IsNotReportedAsConcurrencyConflict()
    {
        var error = new DbUpdateException("Unrelated write failure");
        var thrown = await Assert.ThrowsAsync<DbUpdateException>(() =>
            RequestConcurrencyGuard.ExecuteAsync<string>(() => Task.FromException<ActionResult<string>>(error)));
        Assert.Same(error, thrown);
    }

    [Theory]
    [InlineData(ContentChangeAction.Delete, false, true)]
    [InlineData(ContentChangeAction.Update, false, false)]
    [InlineData(ContentChangeAction.Delete, true, true)]
    [InlineData(ContentChangeAction.Update, true, false)]
    public async Task RemovalApproval_AllowsChangedOrMissingTargetsButProtectsUpdates(
        ContentChangeAction action, bool removeTarget, bool approved)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.Add(new ApplicationUser { Id = "owner", UserName = "owner" });
        var news = new News { Title = "Original", Content = "Body", Author = "Band", PublicationDate = DateTime.UtcNow };
        db.News.Add(news);
        await db.SaveChangesAsync();
        var validator = new ContentInputValidator(db);
        var request = new ContentChangeRequest
        {
            Id = Guid.NewGuid(), ChangeCode = "CHG-REMOVAL", RequestedByUserId = "owner",
            ContentType = "news", Action = action, TargetEntityId = news.NewsId.ToString(),
            TargetVersion = await validator.GetTargetVersionAsync("news", news.NewsId.ToString()),
            PayloadJson = "{}"
        };
        db.ContentChangeRequests.Add(request);
        news.Title = "Edited after submission";
        if (removeTarget) db.News.Remove(news);
        await db.SaveChangesAsync();

        var result = await ContentController(scope).Approve(request.Id, new ReviewRequestDto("Reviewed removal"));
        if (approved)
        {
            Assert.IsType<OkObjectResult>(result.Result);
            Assert.Empty(await db.News.ToListAsync());
            Assert.Equal(ContentChangeStatus.Approved, request.Status);
            Assert.Equal("owner", request.ReviewedBySuperAdminId);
            Assert.NotNull(request.ReviewedAtUtc);
            Assert.Contains(await db.AdminAuditLogs.ToListAsync(), log => log.Action == "content_change_approved");
            Assert.IsType<ConflictObjectResult>((await ContentController(scope).Approve(
                request.Id, new ReviewRequestDto("Duplicate approval"))).Result);
        }
        else
        {
            Assert.IsType<ConflictObjectResult>(result.Result);
            Assert.Equal(ContentChangeStatus.Pending, request.Status);
            if (!removeTarget) Assert.Equal("Edited after submission", (await db.News.SingleAsync()).Title);
        }
    }

    private static ControllerContext Actor(string userId) => new()
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId)], "test"))
        }
    };

    private static ContentRequestsController ContentController(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var validator = new ContentInputValidator(db);
        return new ContentRequestsController(db,
            scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(),
            new CodeGenerator(), new ContentChangeApplier(db, validator), validator, new AuditLogger(db))
        {
            ControllerContext = Actor("owner")
        };
    }

    private static AdminRequestsController AdminController(IServiceScope scope) => new(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(), new CodeGenerator(),
        new AuditLogger(scope.ServiceProvider.GetRequiredService<AppDbContext>()))
    {
        ControllerContext = Actor("reviewer")
    };

    private static Task<ActionResult<ContentChangeRequestResponse>> Transition(
        ContentRequestsController controller, Guid id, string action, string note) => action switch
    {
        "approve" => controller.Approve(id, new ReviewRequestDto(note)),
        "deny" => controller.Deny(id, new ReviewRequestDto(note)),
        _ => controller.Cancel(id)
    };

    private static Task<ActionResult<AdminRequestResponse>> Transition(
        AdminRequestsController controller, Guid id, string action, string note) => action == "approve"
        ? controller.Approve(id, new ReviewRequestDto(note))
        : controller.Deny(id, new ReviewRequestDto(note));

    public void Dispose() => services.Dispose();
}
