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
    public async Task UnrelatedDatabaseFailure_IsNotReportedAsConcurrencyConflict()
    {
        var error = new DbUpdateException("Unrelated write failure");
        var thrown = await Assert.ThrowsAsync<DbUpdateException>(() =>
            RequestConcurrencyGuard.ExecuteAsync<string>(() => Task.FromException<ActionResult<string>>(error)));
        Assert.Same(error, thrown);
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
            new CodeGenerator(), new ContentChangeApplier(db, validator), validator)
        {
            ControllerContext = Actor("owner")
        };
    }

    private static AdminRequestsController AdminController(IServiceScope scope) => new(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(), new CodeGenerator())
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
