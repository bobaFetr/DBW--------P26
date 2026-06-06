using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using System.Text.Json;

namespace MyLibrary;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var connectionString = GetConnectionString();

        optionsBuilder.UseNpgsql(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }

    private static string GetConnectionString()
    {
        var environmentConnectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

        if (!string.IsNullOrWhiteSpace(environmentConnectionString))
        {
            return environmentConnectionString;
        }

        foreach (var appSettingsPath in GetAppSettingsPaths())
        {
            var connectionString = TryReadConnectionString(appSettingsPath);
            if (!string.IsNullOrWhiteSpace(connectionString))
            {
                return connectionString;
            }
        }

        throw new InvalidOperationException(
            "Connection string 'DefaultConnection' was not found. Set ConnectionStrings__DefaultConnection or add it to MyApi appsettings.");
    }

    private static IEnumerable<string> GetAppSettingsPaths()
    {
        var currentDirectory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (currentDirectory is not null)
        {
            yield return Path.Combine(
                currentDirectory.FullName,
                "Back End",
                "MyApi",
                "appsettings.Development.json");
            yield return Path.Combine(
                currentDirectory.FullName,
                "Back End",
                "MyApi",
                "appsettings.json");
            yield return Path.Combine(
                currentDirectory.FullName,
                "MyApi",
                "appsettings.Development.json");
            yield return Path.Combine(
                currentDirectory.FullName,
                "MyApi",
                "appsettings.json");

            currentDirectory = currentDirectory.Parent;
        }
    }

    private static string? TryReadConnectionString(string appSettingsPath)
    {
        if (!File.Exists(appSettingsPath))
        {
            return null;
        }

        using var stream = File.OpenRead(appSettingsPath);
        using var document = JsonDocument.Parse(stream);

        if (!document.RootElement.TryGetProperty("ConnectionStrings", out var connectionStrings)
            || !connectionStrings.TryGetProperty("DefaultConnection", out var defaultConnection))
        {
            return null;
        }

        return defaultConnection.GetString();
    }
}
