using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Controllers;
using MyApi.Dto;
using MyLibrary;

namespace MyApi.Tests;

public sealed class RequestPaginationTests
{
    [Fact]
    public async Task ContentRequestCursor_ReturnsNextPendingRequestAfterEarlierReview()
    {
        using var dbContext = TestDb.Create();
        var start = new DateTime(2026, 9, 7, 12, 0, 0, DateTimeKind.Utc);
        dbContext.Users.Add(new ApplicationUser
        {
            Id = "content-admin",
            UserName = "content-admin"
        });
        for (var index = 0; index < 51; index++)
        {
            dbContext.ContentChangeRequests.Add(new ContentChangeRequest
            {
                Id = Guid.NewGuid(),
                ChangeCode = $"CHG-{index:D6}",
                RequestedByUserId = "content-admin",
                ContentType = "news",
                PayloadJson = "{}",
                RequestedAtUtc = start.AddMinutes(index)
            });
        }
        await dbContext.SaveChangesAsync();

        var controller = new ContentRequestsController(
            dbContext, null!, null!, null!, null!, null!);
        var firstPage = await controller.GetPending(page: 1, pageSize: 50);
        var firstPageRows = Assert.IsAssignableFrom<IEnumerable<ContentChangeRequestResponse>>(
            Assert.IsType<OkObjectResult>(firstPage.Result).Value).ToList();
        var cursor = firstPageRows[^1];

        var reviewed = await dbContext.ContentChangeRequests
            .SingleAsync(request => request.Id == firstPageRows[0].Id);
        reviewed.Status = ContentChangeStatus.Approved;
        await dbContext.SaveChangesAsync();

        var nextPage = await controller.GetPending(
            page: 1,
            pageSize: 50,
            afterRequestedAtUtc: cursor.RequestedAtUtc,
            afterId: cursor.Id);

        var nextPageRows = Assert.IsAssignableFrom<IEnumerable<ContentChangeRequestResponse>>(
            Assert.IsType<OkObjectResult>(nextPage.Result).Value).ToList();
        Assert.Single(nextPageRows);
        Assert.Equal("CHG-000050", nextPageRows[0].ChangeCode);
    }

    [Fact]
    public async Task AdminRequestCursor_ReturnsNextPendingRequestAfterEarlierReview()
    {
        using var dbContext = TestDb.Create();
        var start = new DateTime(2026, 9, 7, 12, 0, 0, DateTimeKind.Utc);
        for (var index = 0; index < 51; index++)
        {
            dbContext.Users.Add(new ApplicationUser
            {
                Id = $"candidate-{index}",
                UserName = $"candidate-{index}"
            });
            dbContext.AdminRequests.Add(new AdminRequest
            {
                Id = Guid.NewGuid(),
                RequestCode = $"AREQ-{index:D6}",
                UserId = $"candidate-{index}",
                RequestedAtUtc = start.AddMinutes(index)
            });
        }
        await dbContext.SaveChangesAsync();

        var controller = new AdminRequestsController(dbContext, null!, null!, null!);
        var firstPage = await controller.GetPending(page: 1, pageSize: 50);
        var firstPageRows = Assert.IsAssignableFrom<IEnumerable<AdminRequestResponse>>(
            Assert.IsType<OkObjectResult>(firstPage.Result).Value).ToList();
        var cursor = firstPageRows[^1];

        var reviewed = await dbContext.AdminRequests
            .SingleAsync(request => request.Id == firstPageRows[0].Id);
        reviewed.Status = AdminRequestStatus.Approved;
        await dbContext.SaveChangesAsync();

        var nextPage = await controller.GetPending(
            page: 1,
            pageSize: 50,
            afterRequestedAtUtc: cursor.RequestedAtUtc,
            afterId: cursor.Id);

        var nextPageRows = Assert.IsAssignableFrom<IEnumerable<AdminRequestResponse>>(
            Assert.IsType<OkObjectResult>(nextPage.Result).Value).ToList();
        Assert.Single(nextPageRows);
        Assert.Equal("AREQ-000050", nextPageRows[0].RequestCode);
    }
}
