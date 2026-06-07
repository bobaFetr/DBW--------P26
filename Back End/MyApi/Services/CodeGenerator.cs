using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Services;

public interface ICodeGenerator
{
    Task<string> NextAdminRequestCodeAsync(CancellationToken cancellationToken = default);
    Task<string> NextContentChangeCodeAsync(CancellationToken cancellationToken = default);
    Task<string> NextContentAdminCodeAsync(CancellationToken cancellationToken = default);
}

public class CodeGenerator(AppDbContext dbContext) : ICodeGenerator
{
    public async Task<string> NextAdminRequestCodeAsync(CancellationToken cancellationToken = default)
    {
        var count = await dbContext.AdminRequests.CountAsync(cancellationToken) + 1;
        return $"AREQ-{count:000000}";
    }

    public async Task<string> NextContentChangeCodeAsync(CancellationToken cancellationToken = default)
    {
        var count = await dbContext.ContentChangeRequests.CountAsync(cancellationToken) + 1;
        return $"CHG-{count:000000}";
    }

    public async Task<string> NextContentAdminCodeAsync(CancellationToken cancellationToken = default)
    {
        var count = await dbContext.AdminProfiles.CountAsync(
            profile => profile.AdminKind == AdminKind.ContentAdmin,
            cancellationToken) + 1;

        return $"CADM-{count:000000}";
    }
}
