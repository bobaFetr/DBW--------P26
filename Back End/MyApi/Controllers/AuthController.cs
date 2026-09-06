using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyApi.Dto;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    AppDbContext dbContext,
    ICodeGenerator codeGenerator,
    IAntiforgery antiforgery,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("csrf")]
    [AllowAnonymous]
    public ActionResult<CsrfTokenResponse> GetCsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        return Ok(new CsrfTokenResponse(tokens.RequestToken!));
    }

    [HttpPost("register-content-admin-request")]
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    public async Task<ActionResult<AdminRequestResponse>> RegisterContentAdminRequest(
        RegisterRequest request)
    {
        var requestsEnabled = await dbContext.SiteSettings
            .Where(setting => setting.Key == CaRequestsPermissionController.SettingKey)
            .Select(setting => setting.BooleanValue)
            .SingleOrDefaultAsync();
        if (!requestsEnabled)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "CA requests are forbidden");
        }

        if (User.Identity?.IsAuthenticated == true)
        {
            await RevokeCurrentSessionAsync();
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync()
            : null;

        var email = request.Email.Trim();
        var userName = request.UserName.Trim();
        var userByEmail = await userManager.FindByEmailAsync(email);
        var userByName = await userManager.FindByNameAsync(userName);
        ApplicationUser user;

        if (userByEmail is not null || userByName is not null)
        {
            if (userByEmail is null || userByName is null || userByEmail.Id != userByName.Id)
            {
                return BadRequest("The username or email is already registered to another account.");
            }

            user = userByEmail;
            if (await userManager.IsInRoleAsync(user, "ContentAdmin") ||
                await userManager.IsInRoleAsync(user, "SuperAdmin"))
            {
                return BadRequest("This account is already an administrator.");
            }

            if (!await userManager.CheckPasswordAsync(user, request.Password))
            {
                return Unauthorized("The existing account credentials are incorrect.");
            }

            var hasPendingRequest = await dbContext.AdminRequests.AnyAsync(adminRequest =>
                adminRequest.UserId == user.Id &&
                adminRequest.Status == AdminRequestStatus.Pending);
            if (hasPendingRequest)
            {
                return Conflict("This account already has a pending content admin request.");
            }

            user.DisplayName = CleanOptionalText(request.DisplayName);
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest(updateResult.Errors);
            }
        }
        else
        {
            user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                EmailConfirmed = false,
                DisplayName = CleanOptionalText(request.DisplayName)
            };

            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                return BadRequest(result.Errors);
            }
        }

        var adminRequest = new AdminRequest
        {
            RequestCode = await codeGenerator.NextAdminRequestCodeAsync(),
            UserId = user.Id,
            Message = "I want to help manage site content."
        };

        dbContext.AdminRequests.Add(adminRequest);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict("This account already has a pending content admin request.");
        }
        if (transaction is not null)
        {
            await transaction.CommitAsync();
        }

        return Created(
            $"/api/content-admin-requests/{adminRequest.Id}",
            new AdminRequestResponse(
                adminRequest.Id,
                adminRequest.RequestCode,
                adminRequest.UserId,
                user.UserName,
                user.Email,
                user.DisplayName,
                adminRequest.Status,
                adminRequest.Message,
                adminRequest.RequestedAtUtc,
                adminRequest.ReviewedBySuperAdminId,
                adminRequest.ReviewedAtUtc,
                adminRequest.ReviewNote));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    public async Task<ActionResult<CurrentUserResponse>> Login(LoginRequest request)
    {
        var identifier = request.Email.Trim();
        var user = await userManager.FindByEmailAsync(identifier)
            ?? await userManager.FindByNameAsync(identifier);
        if (user is null || user.IsDisabled)
        {
            return Unauthorized();
        }

        var result = await signInManager.PasswordSignInAsync(
            user.UserName!,
            request.Password,
            isPersistent: false,
            lockoutOnFailure: true);

        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
            {
                return Unauthorized(new { message = "Account locked. Try again later." });
            }

            return Unauthorized(new { message = "Wrong password" });
        }

        return Ok(await ToCurrentUserResponse(user));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var user = await userManager.GetUserAsync(User);

        await RevokeCurrentSessionAsync(user);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        return user is null ? Unauthorized() : Ok(await ToCurrentUserResponse(user));
    }

    private async Task<CurrentUserResponse> ToCurrentUserResponse(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new CurrentUserResponse(
            user.Id,
            user.UserName,
            user.Email,
            user.DisplayName,
            roles.ToList());
    }

    private static string? CleanOptionalText(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrEmpty(cleaned) ? null : cleaned;
    }

    private async Task RevokeCurrentSessionAsync(ApplicationUser? user = null)
    {
        user ??= await userManager.GetUserAsync(User);
        if (user is not null)
        {
            await userManager.UpdateSecurityStampAsync(user);
        }

        await signInManager.SignOutAsync();
        Response.Cookies.Delete("Paralyze.Csrf", new CookieOptions
        {
            HttpOnly = true,
            SameSite = environment.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
            Secure = !environment.IsDevelopment()
        });
    }

}

public record CsrfTokenResponse(string Token);
