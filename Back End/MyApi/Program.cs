using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";
const string AuthRateLimitPolicy = "AuthSensitive";
const string ReauthRateLimitPolicy = "ReauthSensitive";
const string AdminMutationRateLimitPolicy = "AdminMutation";

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = 5 * 1024 * 1024;
});

var frontendOrigins = GetFrontendOrigins(builder.Configuration, builder.Environment);
ValidateProductionHostSettings(builder.Configuration, builder.Environment);

// Add services to the container.

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.")));

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
    options.Cookie.SameSite = SameSiteMode.Lax;
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
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5 * 1024 * 1024;
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientPartition(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy(AuthRateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientPartition(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy(AdminMutationRateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientPartition(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy(ReauthRateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientPartition(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0
            }));
});
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, BcryptPasswordHasher>();
builder.Services.AddScoped<IAuditLogger, AuditLogger>();
builder.Services.AddScoped<ICodeGenerator, CodeGenerator>();
builder.Services.AddScoped<IContentInputValidator, ContentInputValidator>();
builder.Services.AddScoped<IContentChangeApplier, ContentChangeApplier>();
builder.Services.AddControllers(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

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

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        if (context.Context.Request.Path.StartsWithSegments("/uploads", StringComparison.OrdinalIgnoreCase))
        {
            var headers = context.Context.Response.Headers;
            headers["Content-Disposition"] = "inline";
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
            headers.TryAdd("X-Content-Type-Options", "nosniff");
        }
    }
});
app.UseCors(FrontendCorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

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

static string GetRequiredConfiguration(IConfiguration configuration, string key)
{
    return configuration[key]
        ?? throw new InvalidOperationException($"Configuration value '{key}' was not found.");
}
