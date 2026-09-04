using MyLibrary;

namespace MyApi.Services;

public interface IAuditLogger
{
    Task LogAsync(
        string adminUserId,
        string action,
        string? performedByUserId = null,
        string? entityType = null,
        string? entityId = null,
        string? detailsJson = null,
        CancellationToken cancellationToken = default);
}

public class AuditLogger(AppDbContext dbContext) : IAuditLogger
{
    public async Task LogAsync(
        string adminUserId,
        string action,
        string? performedByUserId = null,
        string? entityType = null,
        string? entityId = null,
        string? detailsJson = null,
        CancellationToken cancellationToken = default)
    {
        dbContext.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminUserId = adminUserId,
            PerformedByUserId = performedByUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            DetailsJson = detailsJson
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

