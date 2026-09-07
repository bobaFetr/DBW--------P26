using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MyApi.Controllers;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;
using Npgsql;

var apiPath = Path.GetFullPath(Path.Combine("Back End", "MyApi"));
var config = new ConfigurationBuilder().SetBasePath(apiPath)
    .AddJsonFile("appsettings.json").AddJsonFile("appsettings.Development.json", optional: true)
    .AddJsonFile("appsettings.Local.json", optional: true).Build();
var connection = new NpgsqlConnectionStringBuilder(config.GetConnectionString("DefaultConnection"));
if (connection.Host is not ("localhost" or "127.0.0.1" or "::1"))
    throw new InvalidOperationException("Transaction checks require local PostgreSQL.");
var scratchName = "paralyze_admin_check_" + Guid.NewGuid().ToString("N");
if (args.Contains("--apply-optional-media"))
{
    await OptionalMediaChecks.Run(connection.ConnectionString);
    return;
}
connection.Database = scratchName;
var collection = new ServiceCollection();
collection.AddLogging();
collection.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection.ConnectionString));
collection.AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole>().AddEntityFrameworkStores<AppDbContext>();
using var services = collection.BuildServiceProvider();
using var scope = services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
try
{
    await db.Database.EnsureCreatedAsync();
    var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    Check((await roles.CreateAsync(new IdentityRole("ContentAdmin"))).Succeeded, "create role");
    var reviewer = new ApplicationUser { UserName = "reviewer", Email = "reviewer@example.test" };
    var target = new ApplicationUser { UserName = "candidate", Email = "candidate@example.test" };
    Check((await users.CreateAsync(reviewer, "Review-Password-2026!")).Succeeded, "create reviewer");
    Check((await users.CreateAsync(target, "Candidate-Password-2026!")).Succeeded, "create candidate");
    var request = new AdminRequest { RequestCode = "TEST-REQUEST", UserId = target.Id };
    db.AdminRequests.Add(request);
    await db.SaveChangesAsync();
    var actor = new ControllerContext { HttpContext = new DefaultHttpContext {
        User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, reviewer.Id)], "test"))
    }};
    var reviews = new AdminRequestsController(db, users, new CodeGenerator(), new FailingAudit()) { ControllerContext = actor };
    await ExpectAuditFailure(() => reviews.Approve(request.Id, new ReviewRequestDto("Approval rollback")));
    db.ChangeTracker.Clear();
    Check((await db.AdminRequests.SingleAsync()).Status == AdminRequestStatus.Pending, "approval status rollback");
    target = (await users.FindByIdAsync(target.Id))!;
    Check(!await users.IsInRoleAsync(target, "ContentAdmin"), "approval role rollback");
    Check(!target.EmailConfirmed, "approval confirmation rollback");
    Check(!await db.AdminProfiles.AnyAsync(), "approval profile rollback");
    await ExpectAuditFailure(() => reviews.Deny(request.Id, new ReviewRequestDto("Denial rollback")));
    db.ChangeTracker.Clear();
    Check((await db.AdminRequests.SingleAsync()).Status == AdminRequestStatus.Pending, "denial status rollback");

    var successful = new AdminRequestsController(db, users, new CodeGenerator(), new AuditLogger(db)) { ControllerContext = actor };
    Check((await successful.Approve(request.Id, new ReviewRequestDto("Approve"))).Result is OkObjectResult, "approval success");
    target = (await users.FindByIdAsync(target.Id))!;
    var stamp = target.SecurityStamp;
    var admins = new ContentAdminsController(db, users, new FailingAudit()) { ControllerContext = actor };
    await ExpectAuditFailure(() => admins.KickOut(target.Id, new KickContentAdminRequest("Review-Password-2026!")));
    db.ChangeTracker.Clear();
    target = (await users.FindByIdAsync(target.Id))!;
    Check(await users.IsInRoleAsync(target, "ContentAdmin"), "revocation role rollback");
    Check(target.SecurityStamp == stamp, "revocation session-stamp rollback");
    Check(await db.AdminProfiles.AnyAsync(), "revocation profile rollback");
    Console.WriteLine("PASS: PostgreSQL approval, denial, and revocation roll back completely when audit logging fails.");
}
finally
{
    // Only delete the uniquely named database created by this invocation.
    Check(db.Database.GetDbConnection().Database == scratchName && scratchName.StartsWith("paralyze_admin_check_"), "scratch database identity");
    await db.Database.EnsureDeletedAsync();
}
static void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException("Failed: " + message);
}
static async Task ExpectAuditFailure<T>(Func<Task<T>> action)
{
    try { await action(); }
    catch (AuditCheckException) { return; }
    throw new InvalidOperationException("Expected injected audit failure.");
}
sealed class AuditCheckException : Exception { }
sealed class FailingAudit : IAuditLogger
{
    public Task LogAsync(string adminUserId, string action, string? performedByUserId = null,
        string? entityType = null, string? entityId = null, string? detailsJson = null,
        CancellationToken cancellationToken = default) => throw new AuditCheckException();
}
