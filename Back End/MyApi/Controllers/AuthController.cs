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

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    public async Task<ActionResult<CurrentUserResponse>> Register(RegisterRequest request)
    {
        var duplicateError = await GetDuplicateAccountErrorAsync(request);
        if (duplicateError is not null)
        {
            return BadRequest(new[] { duplicateError });
        }

        var user = new ApplicationUser
        {
            UserName = request.UserName.Trim(),
            Email = request.Email.Trim(),
            EmailConfirmed = true,
            DisplayName = CleanOptionalText(request.DisplayName)
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok(await ToCurrentUserResponse(user));
    }

    [HttpPost("register-content-admin-request")]
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    public async Task<ActionResult<AdminRequestResponse>> RegisterContentAdminRequest(
        RegisterRequest request)
    {
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
            return Unauthorized();
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

    private async Task<IdentityError?> GetDuplicateAccountErrorAsync(RegisterRequest request)
    {
        var email = request.Email.Trim();
        var userName = request.UserName.Trim();

        if (await userManager.FindByEmailAsync(email) is not null)
        {
            return new IdentityError
            {
                Code = "DuplicateEmail",
                Description = "Email is already registered."
            };
        }

        if (await userManager.FindByNameAsync(userName) is not null)
        {
            return new IdentityError
            {
                Code = "DuplicateUserName",
                Description = "Username is already taken."
            };
        }

        return null;
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
