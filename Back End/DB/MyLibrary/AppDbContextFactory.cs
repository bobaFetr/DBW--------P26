using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Npgsql;
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
            return NormalizePostgresConnectionString(environmentConnectionString);
        }

        var renderDatabaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(renderDatabaseUrl))
        {
            return NormalizePostgresConnectionString(renderDatabaseUrl);
        }

        foreach (var appSettingsPath in GetAppSettingsPaths())
        {
            var connectionString = TryReadConnectionString(appSettingsPath);
            if (!string.IsNullOrWhiteSpace(connectionString))
            {
                return NormalizePostgresConnectionString(connectionString);
            }
        }

        throw new InvalidOperationException(
            "Connection string 'DefaultConnection' was not found. Set ConnectionStrings__DefaultConnection or add it to MyApi appsettings.");
    }

    private static string NormalizePostgresConnectionString(string connectionString)
    {
        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
        {
            return connectionString;
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty,
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
            SslMode = SslMode.Require
        };

        if (uri.Port > 0)
        {
            builder.Port = uri.Port;
        }

        foreach (var queryPart in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var keyValue = queryPart.Split('=', 2);
            if (keyValue.Length != 2 ||
                !keyValue[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (Enum.TryParse<SslMode>(
                Uri.UnescapeDataString(keyValue[1]),
                ignoreCase: true,
                out var sslMode))
            {
                builder.SslMode = sslMode;
            }
        }

        return builder.ConnectionString;
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
