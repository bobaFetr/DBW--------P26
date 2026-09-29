using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Controllers;
using MyApi.Dto;
using MyLibrary;

namespace MyApi.Tests;

public class CaRequestsPermissionControllerTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AuthenticatedRequest_WhenPermissionIsMissingOrDisabled_IsRejected(bool stored)
    {
        using var db = TestDb.Create();
        if (stored)
        {
            db.SiteSettings.Add(new SiteSetting
            {
                Key = CaRequestsPermissionController.SettingKey, BooleanValue = false
            });
            await db.SaveChangesAsync();
        }
        var controller = new AdminRequestsController(db, null!, null!, null!);
        var result = await controller.Create(new CreateAdminRequestDto("Please approve"));
        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, response.StatusCode);
        Assert.Empty(db.AdminRequests);
    }

    [Fact]
    public async Task Registration_WhenPermissionIsDisabled_ReturnsExactForbiddenError()
    {
        using var dbContext = TestDb.Create();
        var controller = new AuthController(null!, null!, dbContext, null!, null!, null!);
        var request = new RegisterRequest(
            "candidate",
            "candidate@example.com",
            "ValidPassword-2026!",
            "Candidate");

        var result = await controller.RegisterContentAdminRequest(request);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, response.StatusCode);
        Assert.Equal("CA requests are forbidden", response.Value);
        Assert.Empty(dbContext.Users);
        Assert.Empty(dbContext.AdminRequests);
    }

    [Fact]
    public async Task Get_WithoutStoredSetting_DefaultsToDisabled()
    {
        using var dbContext = TestDb.Create();
        var controller = new CaRequestsPermissionController(dbContext);

        var result = await controller.Get(CancellationToken.None);

        var response = Assert.IsType<OkObjectResult>(result.Result);
        var value = Assert.IsType<CaRequestsPermissionResponse>(response.Value);
        Assert.False(value.Enabled);
    }

    [Fact]
    public async Task Set_PersistsEnabledStatus()
    {
        using var dbContext = TestDb.Create();
        var controller = new CaRequestsPermissionController(dbContext);

        await controller.Set(new CaRequestsPermissionRequest(true), CancellationToken.None);

        var setting = await dbContext.SiteSettings.SingleAsync();
        Assert.Equal(CaRequestsPermissionController.SettingKey, setting.Key);
        Assert.True(setting.BooleanValue);
    }

    [Fact]
    public async Task Set_UpdatesExistingStatus()
    {
        using var dbContext = TestDb.Create();
        dbContext.SiteSettings.Add(new SiteSetting
        {
            Key = CaRequestsPermissionController.SettingKey,
            BooleanValue = true
        });
        await dbContext.SaveChangesAsync();
        var controller = new CaRequestsPermissionController(dbContext);

        await controller.Set(new CaRequestsPermissionRequest(false), CancellationToken.None);

        Assert.False((await dbContext.SiteSettings.SingleAsync()).BooleanValue);
    }
}
