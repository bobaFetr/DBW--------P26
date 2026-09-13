using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using MyApi.Services;

namespace MyApi.Tests;

public class GlobalRequestLimiterTests
{
    [Theory]
    [InlineData("SuperAdmin")]
    [InlineData("ContentAdmin")]
    public void Admin_CanReloadTenTimes_ButCannotReadWithoutBound(string role)
    {
        using var limiter = GlobalRequestLimiter.Create(_ => "same-user");
        var context = Request("GET", role);
        for (var reload = 0; reload < 10; reload++)
            for (var request = 0; request < 13; request++)
            {
                using var lease = limiter.AttemptAcquire(context);
                Assert.True(lease.IsAcquired);
            }
        using var rejected = limiter.AttemptAcquire(context);
        Assert.False(rejected.IsAcquired);
    }

    [Theory]
    [InlineData("GET", null)]
    [InlineData("GET", "User")]
    [InlineData("POST", "SuperAdmin")]
    [InlineData("DELETE", "ContentAdmin")]
    public void OrdinaryTraffic_KeepsExistingBurst(string method, string? role)
    {
        using var limiter = GlobalRequestLimiter.Create(_ => "same-user");
        var context = Request(method, role);
        for (var request = 0; request < 60; request++)
        {
            using var lease = limiter.AttemptAcquire(context);
            Assert.True(lease.IsAcquired);
        }
        using var rejected = limiter.AttemptAcquire(context);
        Assert.False(rejected.IsAcquired);
    }

    [Fact]
    public void ExhaustedReadBucket_DoesNotBlockWrites_OrAnotherAdmin()
    {
        using var limiter = GlobalRequestLimiter.Create(context => context.User.Identity!.Name!);
        var read = Request("GET", "SuperAdmin");
        for (var request = 0; request < 130; request++)
        {
            using var lease = limiter.AttemptAcquire(read);
            Assert.True(lease.IsAcquired);
        }
        using var write = limiter.AttemptAcquire(Request("POST", "SuperAdmin"));
        using var other = limiter.AttemptAcquire(Request("GET", "SuperAdmin", "other"));
        Assert.True(write.IsAcquired);
        Assert.True(other.IsAcquired);
    }

    [Fact]
    public void ReadsAndWrites_ShareTwelveConcurrentSlots_ReleasedOnCompletion()
    {
        using var limiter = GlobalRequestLimiter.Create(_ => "same-user");
        var leases = Enumerable.Range(0, 12)
            .Select(index => limiter.AttemptAcquire(Request(index % 2 == 0 ? "GET" : "POST", "SuperAdmin")))
            .ToList();
        try
        {
            Assert.All(leases, lease => Assert.True(lease.IsAcquired));
            using var rejected = limiter.AttemptAcquire(Request("GET", "SuperAdmin"));
            Assert.False(rejected.IsAcquired);
            leases[0].Dispose();
            using var next = limiter.AttemptAcquire(Request("GET", "SuperAdmin"));
            Assert.True(next.IsAcquired);
        }
        finally
        {
            foreach (var lease in leases) lease.Dispose();
        }
    }

    private static HttpContext Request(string method, string? role, string name = "admin")
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        if (role is not null)
            context.User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.Name, name), new Claim(ClaimTypes.Role, role)
            ], "test"));
        return context;
    }
}
