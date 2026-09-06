using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/ca-requests-permission")]
[Authorize(Roles = "SuperAdmin")]
public class CaRequestsPermissionController(AppDbContext dbContext) : ControllerBase
{
    public const string SettingKey = "CaRegistrationRequestsEnabled";

    [HttpGet]
    public async Task<ActionResult<CaRequestsPermissionResponse>> Get(CancellationToken cancellationToken)
    {
        var enabled = await dbContext.SiteSettings
            .Where(setting => setting.Key == SettingKey)
            .Select(setting => setting.BooleanValue)
            .SingleOrDefaultAsync(cancellationToken);

        return Ok(new CaRequestsPermissionResponse(enabled));
    }

    [HttpPut]
    [EnableRateLimiting("AdminMutation")]
    public async Task<ActionResult<CaRequestsPermissionResponse>> Set(
        CaRequestsPermissionRequest request,
        CancellationToken cancellationToken)
    {
        var setting = await dbContext.SiteSettings.FindAsync([SettingKey], cancellationToken);
        if (setting is null)
        {
            setting = new SiteSetting { Key = SettingKey };
            dbContext.SiteSettings.Add(setting);
        }

        setting.BooleanValue = request.Enabled;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new CaRequestsPermissionResponse(setting.BooleanValue));
    }
}

public record CaRequestsPermissionRequest(bool Enabled);
public record CaRequestsPermissionResponse(bool Enabled);
