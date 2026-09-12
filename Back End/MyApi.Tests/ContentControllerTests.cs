using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Controllers;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentControllerTests
{
    [Theory]
    [InlineData("{\"date\":\"2026-09-13T00:00:00Z\",\"event\":\"Live show\"}")]
    [InlineData("{\"date\":\"2026-09-13T00:00:00Z\",\"event\":\"Live show\",\"description\":\"\"}")]
    [InlineData("{\"date\":\"2026-09-13T00:00:00Z\",\"event\":\"Live show\",\"description\":null}")]
    public async Task Create_TimelineWithoutDescription_IsPublishedAndReadable(string json)
    {
        using var db = TestDb.Create();
        var controller = CreateController(db);
        using var payload = JsonDocument.Parse(json);
        Assert.IsType<OkObjectResult>(await controller.Create("timeline", payload.RootElement, CancellationToken.None));
        var result = Assert.IsType<OkObjectResult>((await controller.GetAll("timeline", CancellationToken.None)).Result);
        var timeline = Assert.IsType<TimeLine>(Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(result.Value)));
        Assert.Equal("Live show", timeline.Event);
        Assert.Equal(string.Empty, timeline.Description);
    }

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

        var controller = CreateController(dbContext);

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

        var controller = CreateController(dbContext);
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
        var audit = await dbContext.AdminAuditLogs.SingleAsync();
        Assert.Equal("content_updated", audit.Action);
        Assert.Equal("reviewer", audit.PerformedByUserId);
        Assert.Equal("7", audit.EntityId);
    }

    [Fact]
    public async Task CreateAndDelete_RecordAuditWithGeneratedId()
    {
        using var db = TestDb.Create();
        var controller = CreateController(db);
        using var payload = JsonDocument.Parse("""{"date":"2026-09-07T00:00:00Z","location":"Venue"}""");
        Assert.IsType<OkObjectResult>(await controller.Create("concerts", payload.RootElement, CancellationToken.None));
        var concert = await db.Concerts.SingleAsync();
        var id = concert.ConcertId;
        Assert.True(id > 0);
        Assert.IsType<NoContentResult>(await controller.Delete("concerts", id, CancellationToken.None));
        Assert.Empty(await db.Concerts.ToListAsync());
        var logs = await db.AdminAuditLogs.ToListAsync();
        Assert.Equal(2, logs.Count);
        Assert.Contains(logs, log => log.Action == "content_created" && log.EntityId == id.ToString());
        Assert.Contains(logs, log => log.Action == "content_deleted" && log.EntityId == id.ToString());
    }

    [Fact]
    public async Task GetAll_EqualDates_UsesPrimaryKeyToSeparatePages()
    {
        using var db = TestDb.Create();
        foreach (var id in new[] { 9, 2, 7 })
            db.Concerts.Add(new Concerts { ConcertId = id, Date = new DateTime(2026, 9, 7), Location = "Venue" });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        var first = Assert.IsType<OkObjectResult>((await controller.GetAll("concerts", CancellationToken.None, 1, 2)).Result);
        var second = Assert.IsType<OkObjectResult>((await controller.GetAll("concerts", CancellationToken.None, 2, 2)).Result);
        Assert.Equal(new[] { 2, 7 }, Assert.IsAssignableFrom<IEnumerable<object>>(first.Value).Cast<Concerts>().Select(row => row.ConcertId));
        Assert.Equal(9, Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(second.Value).Cast<Concerts>()).ConcertId);
    }

    [Fact]
    public async Task Cursor_RemainsStableAfterDeletionDateEditAndInsertion()
    {
        using var db = TestDb.Create();
        foreach (var id in new[] { 1, 2, 3, 4 })
            db.Concerts.Add(new Concerts { ConcertId = id, Date = new DateTime(2026, 9, id), Location = "Venue" });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        var first = Assert.IsType<OkObjectResult>((await controller.GetAll("concerts", CancellationToken.None, pageSize: 2, afterId: 0)).Result);
        Assert.Equal(new[] { 1, 2 }, Assert.IsAssignableFrom<IEnumerable<object>>(first.Value).Cast<Concerts>().Select(x => x.ConcertId));
        db.Concerts.Remove(await db.Concerts.SingleAsync(x => x.ConcertId == 2));
        (await db.Concerts.SingleAsync(x => x.ConcertId == 3)).Date = new DateTime(2020, 1, 1);
        db.Concerts.Add(new Concerts { ConcertId = 5, Date = new DateTime(2030, 1, 1), Location = "New" });
        await db.SaveChangesAsync();
        var next = Assert.IsType<OkObjectResult>((await controller.GetAll("concerts", CancellationToken.None, pageSize: 2, afterId: 2)).Result);
        Assert.Equal(new[] { 3, 4 }, Assert.IsAssignableFrom<IEnumerable<object>>(next.Value).Cast<Concerts>().Select(x => x.ConcertId));
        var last = Assert.IsType<OkObjectResult>((await controller.GetAll("concerts", CancellationToken.None, pageSize: 2, afterId: 4)).Result);
        Assert.Equal(5, Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(last.Value).Cast<Concerts>()).ConcertId);
    }

    [Theory]
    [InlineData(-1, 1)]
    [InlineData(0, 2)]
    public async Task Cursor_RejectsInvalidOrMixedPagination(int cursor, int page)
    {
        using var db = TestDb.Create();
        Assert.IsType<BadRequestObjectResult>((await CreateController(db).GetAll("concerts", CancellationToken.None, page, 2, cursor)).Result);
    }

    [Theory]
    [InlineData("gallery", "imageUrl", "{\"title\":\"Optional media\"}")]
    [InlineData("members", "photoUrl", "{\"name\":\"Member\",\"instrument\":\"Guitar\"}")]
    [InlineData("albums", "photoUrl", "{\"title\":\"Album\"}")]
    [InlineData("singles", "photoUrl", "{\"songName\":\"Single\"}")]
    public async Task OptionalMedia_CreateWithoutUrlAndClearExistingUrl_PersistsNull(string type, string field, string json)
    {
        using var db = TestDb.Create();
        var controller = CreateController(db);
        var payload = JsonSerializer.Deserialize<Dictionary<string, object?>>(json)!;
        var created = Assert.IsType<OkObjectResult>(await controller.Create(type, JsonSerializer.SerializeToElement(payload), CancellationToken.None));
        var entity = created.Value!;
        var entry = db.Entry(entity);
        var property = entry.Properties.Single(p => p.Metadata.Name.Equals(field, StringComparison.OrdinalIgnoreCase));
        Assert.Null(property.CurrentValue);
        var id = (int)entry.Properties.Single(p => p.Metadata.IsPrimaryKey()).CurrentValue!;
        foreach (var blank in new string?[] { null, "", " \t\r\n" })
        {
            payload[field] = "https://example.com/image.jpg";
            Assert.IsType<OkObjectResult>(await controller.Update(type, id, JsonSerializer.SerializeToElement(payload), CancellationToken.None));
            Assert.Equal("https://example.com/image.jpg", property.CurrentValue);
            payload[field] = blank;
            Assert.IsType<OkObjectResult>(await controller.Update(type, id, JsonSerializer.SerializeToElement(payload), CancellationToken.None));
            Assert.Null(property.CurrentValue);
        }
    }

    private static ContentController CreateController(AppDbContext db) => new(db, new ContentInputValidator(db))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "reviewer")], "test"))
            }
        }
    };
}
