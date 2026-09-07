using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using MyApi.Services;

namespace MyApi.Tests;

public sealed class ApiAntiforgeryFilterTests
{
    [Fact]
    public async Task OnAuthorizationAsync_InvalidToken_ReturnsBadRequest()
    {
        var context = new AuthorizationFilterContext(
            new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
            []);
        context.HttpContext.Request.Method = HttpMethods.Post;
        var filter = new ApiAntiforgeryFilter(new RejectingAntiforgery());

        await filter.OnAuthorizationAsync(context);

        var result = Assert.IsType<BadRequestObjectResult>(context.Result);
        Assert.Equal(400, result.StatusCode);
        Assert.Equal("The anti-forgery token is invalid or missing.", result.Value);
    }

    private sealed class RejectingAntiforgery : IAntiforgery
    {
        public AntiforgeryTokenSet GetAndStoreTokens(HttpContext httpContext) => throw new NotSupportedException();
        public AntiforgeryTokenSet GetTokens(HttpContext httpContext) => throw new NotSupportedException();
        public Task<bool> IsRequestValidAsync(HttpContext httpContext) => Task.FromResult(false);
        public void SetCookieTokenAndHeader(HttpContext httpContext) => throw new NotSupportedException();

        public Task ValidateRequestAsync(HttpContext httpContext) =>
            Task.FromException(new AntiforgeryValidationException("Invalid token."));
    }
}
