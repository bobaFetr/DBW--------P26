using Microsoft.EntityFrameworkCore;
using MyApi.Services;

namespace MyApi.Tests;

public class AuditLoggerTests
{
    [Fact]
    public async Task LogAsync_PersistsTheActionAndActor()
    {
        using var dbContext = TestDb.Create();
        var logger = new AuditLogger(dbContext);

        await logger.LogAsync(
            "content-admin-1",
            "content_change_requested",
            "content-admin-1",
            "ContentChangeRequest",
            "request-1");

        var log = await dbContext.AdminAuditLogs.SingleAsync();
        Assert.Equal("content-admin-1", log.AdminUserId);
        Assert.Equal("content_change_requested", log.Action);
        Assert.Equal("content-admin-1", log.PerformedByUserId);
        Assert.Equal("ContentChangeRequest", log.EntityType);
        Assert.Equal("request-1", log.EntityId);
    }
}
