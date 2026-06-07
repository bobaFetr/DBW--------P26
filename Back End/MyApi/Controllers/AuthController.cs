using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
    IAuditLogger auditLogger,
    AppDbContext dbContext,
    ICodeGenerator codeGenerator) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<CurrentUserResponse>> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = request.UserName,
            Email = request.Email,
            DisplayName = request.DisplayName
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        await signInManager.SignInAsync(user, isPersistent: false);
        return Ok(await ToCurrentUserResponse(user));
    }

    [HttpPost("register-content-admin-request")]
    [AllowAnonymous]
    public async Task<ActionResult<AdminRequestResponse>> RegisterContentAdminRequest(
        RegisterRequest request)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            await signInManager.SignOutAsync();
        }

        var user = new ApplicationUser
        {
            UserName = request.UserName,
            Email = request.Email,
            DisplayName = request.DisplayName
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        var adminRequest = new AdminRequest
        {
            RequestCode = await codeGenerator.NextAdminRequestCodeAsync(),
            UserId = user.Id,
            Message = "I want to help manage site content."
        };

        dbContext.AdminRequests.Add(adminRequest);
        await dbContext.SaveChangesAsync();

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
    public async Task<ActionResult<CurrentUserResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email)
            ?? await userManager.FindByNameAsync(request.Email);
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

        var roles = await userManager.GetRolesAsync(user);
        if (roles.Contains("ContentAdmin") || roles.Contains("SuperAdmin"))
        {
            await auditLogger.LogAsync(user.Id, "admin_login", user.Id);
        }

        return Ok(await ToCurrentUserResponse(user));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is not null)
        {
            var roles = await userManager.GetRolesAsync(user);
            if (roles.Contains("ContentAdmin") || roles.Contains("SuperAdmin"))
            {
                await auditLogger.LogAsync(user.Id, "admin_logout", user.Id);
            }
        }

        await signInManager.SignOutAsync();
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
}
