using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using MyApi.Services;
using MyLibrary;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

if (builder.Environment.IsDevelopment())
{
    // Keep local API diagnostics in the terminal. The Windows Event Log provider
    // can require elevated permissions and otherwise mask the real startup error.
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole();
    builder.Logging.AddDebug();
}

const string FrontendCorsPolicy = "Frontend";
const string AuthRateLimitPolicy = "AuthSensitive";
const string ReauthRateLimitPolicy = "ReauthSensitive";
const string AdminMutationRateLimitPolicy = "AdminMutation";
const string UploadRateLimitPolicy = "UploadSensitive";

if (builder.Environment.IsDevelopment())
{
    var dataProtectionKeysPath = Path.Combine(
        builder.Environment.ContentRootPath,
        ".data-protection-keys");
    Directory.CreateDirectory(dataProtectionKeysPath);
    builder.Services
        .AddDataProtection()
        .SetApplicationName("Paralyze.Local")
        .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
}

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(30);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
    options.Limits.MaxRequestBodySize = 160 * 1024 * 1024;
    options.Limits.MinRequestBodyDataRate = new MinDataRate(bytesPerSecond: 240, gracePeriod: TimeSpan.FromSeconds(10));
    options.Limits.MinResponseDataRate = new MinDataRate(bytesPerSecond: 240, gracePeriod: TimeSpan.FromSeconds(10));
});

var frontendOrigins = GetFrontendOrigins(builder.Configuration, builder.Environment);
ValidateProductionHostSettings(builder.Configuration, builder.Environment);
var defaultConnectionString = NormalizePostgresConnectionString(GetRequiredConfiguration(
    builder.Configuration,
    "ConnectionStrings:DefaultConnection",
    "DATABASE_URL"));
ValidateDatabaseConnectionString(defaultConnectionString, builder.Environment);

// Add services to the container.

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(defaultConnectionString));

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Password.RequiredLength = 12;
        options.SignIn.RequireConfirmedAccount = true;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddSignInManager()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.Name = "Paralyze.Auth";
    options.Cookie.SameSite = GetCookieSameSiteMode(builder.Environment);
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
    options.Events.OnValidatePrincipal = ValidatePrincipalAsync;
    options.Events.OnRedirectToLogin = context => WriteApiUnauthorizedAsync(context);
    options.Events.OnRedirectToAccessDenied = context => WriteApiForbiddenAsync(context);
});

builder.Services.Configure<SecurityStampValidatorOptions>(options =>
{
    options.ValidationInterval = TimeSpan.Zero;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        FrontendCorsPolicy,
        policy => policy
            .WithOrigins(frontendOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(180);
    options.IncludeSubDomains = true;
});

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "Paralyze.Csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = GetCookieSameSiteMode(builder.Environment);
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 105 * 1024 * 1024;
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        }

        await context.HttpContext.Response.WriteAsync("Too many requests.", cancellationToken);
    };
    options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
            RateLimitPartition.GetConcurrencyLimiter(
                GetClientPartition(context),
                _ => new ConcurrencyLimiterOptions
                {
                    PermitLimit = 12,
                    QueueLimit = 0
                })),
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
            RateLimitPartition.GetTokenBucketLimiter(
                GetClientPartition(context),
                _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = 60,
                    TokensPerPeriod = 30,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(30),
                    AutoReplenishment = true,
                    QueueLimit = 0
                })));

    options.AddPolicy(AuthRateLimitPolicy, context =>
        RateLimitPartition.GetTokenBucketLimiter(
            GetClientPartition(context),
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 5,
                TokensPerPeriod = 2,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                AutoReplenishment = true,
                QueueLimit = 0
            }));

    options.AddPolicy(AdminMutationRateLimitPolicy, context =>
        RateLimitPartition.GetTokenBucketLimiter(
            GetClientPartition(context),
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 20,
                TokensPerPeriod = 10,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                AutoReplenishment = true,
                QueueLimit = 0
            }));

    options.AddPolicy(ReauthRateLimitPolicy, context =>
        RateLimitPartition.GetTokenBucketLimiter(
            GetClientPartition(context),
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 5,
                TokensPerPeriod = 1,
                ReplenishmentPeriod = TimeSpan.FromMinutes(5),
                AutoReplenishment = true,
                QueueLimit = 0
            }));

    options.AddPolicy(UploadRateLimitPolicy, context =>
        RateLimitPartition.GetTokenBucketLimiter(
            GetClientPartition(context),
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 5,
                TokensPerPeriod = 2,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                AutoReplenishment = true,
                QueueLimit = 0
            }));
});
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, BcryptPasswordHasher>();
builder.Services.AddScoped<ICodeGenerator, CodeGenerator>();
builder.Services.AddScoped<IContentInputValidator, ContentInputValidator>();
builder.Services.AddScoped<IContentChangeApplier, ContentChangeApplier>();
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ApiAntiforgeryFilter>();
});
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .SelectMany(entry => entry.Value!.Errors.Select(error => new IdentityError
            {
                Code = entry.Key,
                Description = string.IsNullOrWhiteSpace(error.ErrorMessage)
                    ? "The submitted value is invalid."
                    : error.ErrorMessage
            }))
            .ToArray();

        return new BadRequestObjectResult(errors);
    };
});
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

await ApplyMigrationsAsync(app.Services);
await DatabaseSeeder.SeedAsync(
    app.Services,
    new DatabaseSeedOptions(
        SuperAdminPassword: GetRequiredConfiguration(app.Configuration, "SeedUsers:SuperAdminPassword"),
        ContentAdminPassword: GetRequiredConfiguration(app.Configuration, "SeedUsers:ContentAdminPassword")));

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors(FrontendCorsPolicy);

var uploadsRoot = Path.Combine(
    app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"),
    "uploads");
Directory.CreateDirectory(uploadsRoot);

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers.TryAdd("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        headers.TryAdd("X-Content-Type-Options", "nosniff");
        headers.TryAdd("X-Frame-Options", "DENY");
        headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
        headers.TryAdd("X-XSS-Protection", "0");
        return Task.CompletedTask;
    });

    await next();
});

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("GlobalExceptionHandler");
        logger.LogError(
            exception,
            "Unhandled API exception for {Method} {Path}",
            context.Request.Method,
            context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "text/plain";
        await context.Response.WriteAsync("The server could not complete this request. Check the API logs for details.");
    });
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
    OnPrepareResponse = context =>
    {
        var headers = context.Context.Response.Headers;
        headers["Content-Disposition"] = "inline";
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
        headers.TryAdd("X-Content-Type-Options", "nosniff");
    }
});
app.UseStaticFiles();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();
app.MapControllers();

app.Run();

static async Task ApplyMigrationsAsync(IServiceProvider services)
{
    await using var scope = services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

static async Task ValidatePrincipalAsync(CookieValidatePrincipalContext context)
{
    if (context.Principal is null)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        return;
    }

    var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var user = await userManager.GetUserAsync(context.Principal);
    if (user is null || user.IsDisabled || !user.EmailConfirmed)
    {
        await RejectPrincipalAsync(context);
        return;
    }

    await SecurityStampValidator.ValidatePrincipalAsync(context);
    if (context.Principal?.Identity?.IsAuthenticated != true)
    {
        return;
    }

    if (!await HasActiveAdminProfileAsync(context, user))
    {
        await RejectPrincipalAsync(context);
    }
}

static async Task<bool> HasActiveAdminProfileAsync(
    CookieValidatePrincipalContext context,
    ApplicationUser user)
{
    var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var roles = await userManager.GetRolesAsync(user);

    if (roles.Contains("SuperAdmin"))
    {
        return await HasActiveProfileAsync(context, user.Id, AdminKind.SuperAdmin);
    }

    if (roles.Contains("ContentAdmin"))
    {
        return await HasActiveProfileAsync(context, user.Id, AdminKind.ContentAdmin);
    }

    return true;
}

static async Task<bool> HasActiveProfileAsync(
    CookieValidatePrincipalContext context,
    string userId,
    AdminKind adminKind)
{
    var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
    return await dbContext.AdminProfiles.AnyAsync(profile =>
        profile.UserId == userId &&
        profile.AdminKind == adminKind &&
        profile.IsActive);
}

static async Task RejectPrincipalAsync(CookieValidatePrincipalContext context)
{
    context.RejectPrincipal();
    await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
}

static string GetClientPartition(HttpContext context)
{
    return context.User.Identity?.IsAuthenticated == true
        ? $"user:{context.User.Identity.Name}"
        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}

static Task WriteApiUnauthorizedAsync(RedirectContext<CookieAuthenticationOptions> context)
{
    if (IsApiRequest(context.Request))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    context.Response.Redirect(context.RedirectUri);
    return Task.CompletedTask;
}

static Task WriteApiForbiddenAsync(RedirectContext<CookieAuthenticationOptions> context)
{
    if (IsApiRequest(context.Request))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }

    context.Response.Redirect(context.RedirectUri);
    return Task.CompletedTask;
}

static bool IsApiRequest(HttpRequest request)
{
    return request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);
}

static string[] GetFrontendOrigins(IConfiguration configuration, IWebHostEnvironment environment)
{
    var origins = configuration
        .GetSection("Cors:FrontendOrigins")
        .Get<string[]>()
        ?.Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Select(origin => origin.Trim().TrimEnd('/'))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (origins is { Length: > 0 })
    {
        if (!environment.IsDevelopment() &&
            origins.Any(origin => origin.StartsWith("http://", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Production CORS origins must use HTTPS.");
        }

        return origins;
    }

    if (environment.IsDevelopment())
    {
        return
        [
            "http://localhost:3000",
            "https://localhost:3000",
            "http://127.0.0.1:3000",
            "https://127.0.0.1:3000"
        ];
    }

    throw new InvalidOperationException("Configure at least one HTTPS Cors:FrontendOrigins value for production.");
}

static void ValidateProductionHostSettings(IConfiguration configuration, IWebHostEnvironment environment)
{
    if (environment.IsDevelopment())
    {
        return;
    }

    var allowedHosts = configuration["AllowedHosts"];
    if (string.IsNullOrWhiteSpace(allowedHosts) || allowedHosts.Trim() == "*")
    {
        throw new InvalidOperationException("Configure explicit AllowedHosts values for production.");
    }
}

static void ValidateDatabaseConnectionString(string connectionString, IWebHostEnvironment environment)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString);

    if (string.IsNullOrWhiteSpace(builder.Host) ||
        string.IsNullOrWhiteSpace(builder.Database) ||
        string.IsNullOrWhiteSpace(builder.Username))
    {
        throw new InvalidOperationException("Database connection string must include Host, Database, and Username.");
    }

    if (!environment.IsDevelopment())
    {
        if (builder.SslMode is SslMode.Disable or SslMode.Prefer)
        {
            throw new InvalidOperationException("Production database connections must require TLS. Set SSL Mode=Require or VerifyFull.");
        }

        if (ContainsEnabledConnectionStringFlag(connectionString, "Trust Server Certificate") ||
            ContainsEnabledConnectionStringFlag(connectionString, "TrustServerCertificate"))
        {
            throw new InvalidOperationException("Production database connections must not use Trust Server Certificate=true.");
        }

        if (builder.IncludeErrorDetail)
        {
            throw new InvalidOperationException("Production database connections must not use Include Error Detail=true.");
        }
    }
}

static bool ContainsEnabledConnectionStringFlag(string connectionString, string key)
{
    return connectionString
        .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Any(part =>
        {
            var separatorIndex = part.IndexOf('=');
            if (separatorIndex <= 0)
            {
                return false;
            }

            var partKey = part[..separatorIndex].Trim();
            var partValue = part[(separatorIndex + 1)..].Trim();
            return partKey.Equals(key, StringComparison.OrdinalIgnoreCase) &&
                bool.TryParse(partValue, out var enabled) &&
                enabled;
        });
}

static SameSiteMode GetCookieSameSiteMode(IWebHostEnvironment environment)
{
    return environment.IsDevelopment()
        ? SameSiteMode.Lax
        : SameSiteMode.None;
}

static string NormalizePostgresConnectionString(string connectionString)
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

static string GetRequiredConfiguration(IConfiguration configuration, params string[] keys)
{
    foreach (var key in keys)
    {
        var value = configuration[key];
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    throw new InvalidOperationException(
        $"None of these configuration values were found: {string.Join(", ", keys)}.");
}
