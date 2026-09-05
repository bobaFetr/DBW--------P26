namespace MyApi.Services;

public interface ICodeGenerator
{
    Task<string> NextAdminRequestCodeAsync(CancellationToken cancellationToken = default);
    Task<string> NextContentChangeCodeAsync(CancellationToken cancellationToken = default);
    Task<string> NextContentAdminCodeAsync(CancellationToken cancellationToken = default);
}

public class CodeGenerator : ICodeGenerator
{
    public Task<string> NextAdminRequestCodeAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(NewCode("AREQ"));
    }

    public Task<string> NextContentChangeCodeAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(NewCode("CHG"));
    }

    public Task<string> NextContentAdminCodeAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(NewCode("CADM"));
    }

    private static string NewCode(string prefix) =>
        $"{prefix}-{Guid.NewGuid():N}"[..(prefix.Length + 21)].ToUpperInvariant();
}
