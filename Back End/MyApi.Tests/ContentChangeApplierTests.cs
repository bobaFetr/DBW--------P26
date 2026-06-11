using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentChangeApplierTests
{
    [Fact]
    public async Task ApplyAsync_CreateConcert_InsertsNormalizedEntity()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);
        var applier = new ContentChangeApplier(dbContext, validator);

        await applier.ApplyAsync(new ContentChangeRequest
        {
            ContentType = "concert",
            Action = ContentChangeAction.Create,
            PayloadJson = """
                {
                  "date": "2026-06-01T20:00:00",
                  "location": "Sofia",
                  "numberOfSongs": 12
                }
                """
        });

        var concert = await dbContext.Concerts.SingleAsync();
        Assert.Equal("Sofia", concert.Location);
        Assert.Equal(12, concert.NumberOfSongs);
        Assert.Equal(DateTimeKind.Utc, concert.Date.Kind);
    }

    [Fact]
    public async Task ApplyAsync_UpdateConcert_PreservesPrimaryKey()
    {
        using var dbContext = TestDb.Create();
        dbContext.Concerts.Add(new Concerts
        {
            ConcertId = 7,
            Date = new DateTime(2026, 1, 1, 20, 0, 0, DateTimeKind.Utc),
            Location = "Old",
            NumberOfSongs = 3
        });
        await dbContext.SaveChangesAsync();

        var validator = new ContentInputValidator(dbContext);
        var applier = new ContentChangeApplier(dbContext, validator);

        await applier.ApplyAsync(new ContentChangeRequest
        {
            ContentType = "concerts",
            Action = ContentChangeAction.Update,
            TargetEntityId = "7",
            PayloadJson = """
                {
                  "concertId": 999,
                  "date": "2026-06-01T20:00:00Z",
                  "location": "New",
                  "numberOfSongs": 9
                }
                """
        });

        var concert = await dbContext.Concerts.SingleAsync();
        Assert.Equal(7, concert.ConcertId);
        Assert.Equal("New", concert.Location);
        Assert.Equal(9, concert.NumberOfSongs);
    }

    [Fact]
    public async Task ApplyAsync_DeleteConcert_RemovesExistingEntity()
    {
        using var dbContext = TestDb.Create();
        dbContext.Concerts.Add(new Concerts
        {
            ConcertId = 7,
            Date = DateTime.UtcNow,
            Location = "Sofia",
            NumberOfSongs = 3
        });
        await dbContext.SaveChangesAsync();

        var validator = new ContentInputValidator(dbContext);
        var applier = new ContentChangeApplier(dbContext, validator);

        await applier.ApplyAsync(new ContentChangeRequest
        {
            ContentType = "concerts",
            Action = ContentChangeAction.Delete,
            TargetEntityId = "7",
            PayloadJson = "{}"
        });

        Assert.Empty(await dbContext.Concerts.ToListAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("0")]
    [InlineData("abc")]
    public async Task ApplyAsync_UpdateRequiresValidPositiveTargetId(string? targetEntityId)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);
        var applier = new ContentChangeApplier(dbContext, validator);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            applier.ApplyAsync(new ContentChangeRequest
            {
                ContentType = "concerts",
                Action = ContentChangeAction.Update,
                TargetEntityId = targetEntityId,
                PayloadJson = """{"location":"Sofia","numberOfSongs":3}"""
            }));

        Assert.Contains("TargetEntityId", exception.Message);
    }

    [Fact]
    public async Task ApplyAsync_DoesNotSaveInvalidCreatedEntity()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);
        var applier = new ContentChangeApplier(dbContext, validator);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            applier.ApplyAsync(new ContentChangeRequest
            {
                ContentType = "concerts",
                Action = ContentChangeAction.Create,
                PayloadJson = """{"location":"","numberOfSongs":3}"""
            }));

        Assert.Equal("Location is required.", exception.Message);
        Assert.Empty(await dbContext.Concerts.ToListAsync());
    }
}
