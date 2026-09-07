using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Controllers;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentControllerTests
{
    [Fact]
    public async Task GetAll_GalleryWithLegacyMissingMedia_ReturnsTheEditableRow()
    {
        using var dbContext = TestDb.Create();
        dbContext.Gallery.Add(new Gallery
        {
            Id = 7,
            Title = "Legacy gallery row",
            ImageUrl = null
        });
        await dbContext.SaveChangesAsync();

        var controller = new ContentController(dbContext, new ContentInputValidator(dbContext));

        var result = await controller.GetAll("gallery", CancellationToken.None);

        var response = Assert.IsType<OkObjectResult>(result.Result);
        var rows = Assert.IsAssignableFrom<IEnumerable<object>>(response.Value);
        var gallery = Assert.IsType<Gallery>(Assert.Single(rows));
        Assert.Null(gallery.ImageUrl);
    }

    [Fact]
    public async Task Update_ExistingConcert_UpdatesRowAndPreservesPrimaryKey()
    {
        using var dbContext = TestDb.Create();
        dbContext.Concerts.Add(new Concerts
        {
            ConcertId = 7,
            Date = new DateTime(2026, 1, 1, 20, 0, 0, DateTimeKind.Utc),
            Location = "Old venue",
            NumberOfSongs = 3
        });
        await dbContext.SaveChangesAsync();

        var controller = new ContentController(dbContext, new ContentInputValidator(dbContext));
        using var document = JsonDocument.Parse("""
            {
              "concertId": 999,
              "date": "2026-06-01T20:00:00Z",
              "location": "New venue",
              "numberOfSongs": 11
            }
            """);

        var result = await controller.Update("concerts", 7, document.RootElement, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        var concert = await dbContext.Concerts.SingleAsync();
        Assert.Equal(7, concert.ConcertId);
        Assert.Equal("New venue", concert.Location);
        Assert.Equal(11, concert.NumberOfSongs);
    }
}
