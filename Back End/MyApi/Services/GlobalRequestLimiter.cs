using System.Threading.RateLimiting;

namespace MyApi.Services;

public static class GlobalRequestLimiter
{
    public static PartitionedRateLimiter<HttpContext> Create(Func<HttpContext, string> clientPartition) =>
        PartitionedRateLimiter.CreateChained(
            PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetConcurrencyLimiter(clientPartition(context), _ => new ConcurrencyLimiterOptions
                {
                    PermitLimit = 12,
                    QueueLimit = 0
                })),
            PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var adminRead = HttpMethods.IsGet(context.Request.Method)
                    && context.User.Identity?.IsAuthenticated == true
                    && (context.User.IsInRole("SuperAdmin") || context.User.IsInRole("ContentAdmin"));
                // Separate keys prevent the first request (read or write) from
                // determining the bucket settings for every subsequent request.
                var key = $"{(adminRead ? "admin-read" : "ordinary")}:{clientPartition(context)}";
                return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
                {
                    // One super-admin reload uses 13 requests. Permit ten reloads
                    // from a full bucket, but do not increase sustained read traffic.
                    TokenLimit = adminRead ? 130 : 60,
                    TokensPerPeriod = adminRead ? 1 : 30,
                    ReplenishmentPeriod = adminRead ? TimeSpan.FromSeconds(1) : TimeSpan.FromSeconds(30),
                    AutoReplenishment = true,
                    QueueLimit = 0
                });
            }));
}
