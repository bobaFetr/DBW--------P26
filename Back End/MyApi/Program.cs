using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";
const string AuthRateLimitPolicy = "AuthSensitive";
const string AdminMutationRateLimitPolicy = "AdminMutation";

// Add services to the container.

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.")));

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddSignInManager()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        FrontendCorsPolicy,
        policy => policy
            .WithOrigins(
                "http://localhost:3000",
                "https://localhost:3000",
                "http://127.0.0.1:3000",
                "https://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
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
});
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, BcryptPasswordHasher>();
builder.Services.AddScoped<IAuditLogger, AuditLogger>();
builder.Services.AddScoped<ICodeGenerator, CodeGenerator>();
builder.Services.AddScoped<IContentChangeApplier, ContentChangeApplier>();
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

await DatabaseSeeder.SeedAsync(
    app.Services,
    new DatabaseSeedOptions(
        SuperAdminPassword: app.Configuration["SeedUsers:SuperAdminPassword"] ?? "Super@2025",
        ContentAdminPassword: app.Configuration["SeedUsers:ContentAdminPassword"] ?? "Admin@2025"));

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseCors(FrontendCorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

static string GetClientPartition(HttpContext context)
{
    return context.User.Identity?.IsAuthenticated == true
        ? $"user:{context.User.Identity.Name}"
        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}
