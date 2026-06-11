using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentInputValidatorTests
{
    [Theory]
    [InlineData("album", "albums")]
    [InlineData(" Albums ", "albums")]
    [InlineData("single", "singles")]
    [InlineData("concert", "concerts")]
    [InlineData("timelines", "timeline")]
    [InlineData("member", "members")]
    [InlineData("gallery", "gallery")]
    public void TryNormalizeContentType_AcceptsSupportedAliases(string input, string expected)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var result = validator.TryNormalizeContentType(input, out var normalized);

        Assert.True(result);
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("videos")]
    public void TryNormalizeContentType_RejectsUnsupportedValues(string? input)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var result = validator.TryNormalizeContentType(input, out var normalized);

        Assert.False(result);
        Assert.Equal(string.Empty, normalized);
    }

    [Fact]
    public async Task ValidateChangeRequestAsync_RequiresPositiveTargetForUpdates()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateChangeRequestAsync(
            ContentChangeAction.Update,
            "concerts",
            "0",
            """{"location":"Sofia","numberOfSongs":2}""");

        Assert.Equal("TargetEntityId must be a positive integer for update and delete requests.", error);
    }

    [Fact]
    public async Task ValidateChangeRequestAsync_AllowsDeleteWithoutPayload()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateChangeRequestAsync(
            ContentChangeAction.Delete,
            "concerts",
            "42",
            null);

        Assert.Null(error);
    }

    [Fact]
    public async Task ValidateChangeRequestAsync_RejectsInvalidJson()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateChangeRequestAsync(
            ContentChangeAction.Create,
            "news",
            null,
            "{not-json");

        Assert.Equal("PayloadJson must contain valid JSON.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsConcertWithoutLocation()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Concerts
        {
            Location = " ",
            NumberOfSongs = 1
        });

        Assert.Equal("Location is required.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsNegativeConcertSongCount()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Concerts
        {
            Location = "Sofia",
            NumberOfSongs = -1
        });

        Assert.Equal("NumberOfSongs cannot be negative.", error);
    }

    [Theory]
    [InlineData("/uploads/images/photo.png")]
    [InlineData("/BUntitled.png")]
    [InlineData("https://example.com/member.png")]
    [InlineData("http://example.com/member.png")]
    public async Task ValidateEntityAsync_AcceptsAllowedImageUrls(string url)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Members
        {
            Name = "Alex",
            Instrument = "Guitar",
            PhotoUrl = url
        });

        Assert.Null(error);
    }

    [Theory]
    [InlineData("/images/photo.png", "PhotoUrl must be an uploaded image path or HTTPS URL.")]
    [InlineData("javascript:alert(1)", "PhotoUrl must be a valid HTTP or HTTPS URL.")]
    public async Task ValidateEntityAsync_RejectsUnsafeImageUrls(string url, string expected)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Members
        {
            Name = "Alex",
            Instrument = "Guitar",
            PhotoUrl = url
        });

        Assert.Equal(expected, error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsSingleWithMissingAlbum()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Singles
        {
            SongName = "Signal",
            AlbumId = 999
        });

        Assert.Equal("AlbumId '999' does not exist. Leave Album ID empty or choose an existing album.", error);
    }
}
