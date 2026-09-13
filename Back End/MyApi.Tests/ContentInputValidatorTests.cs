using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class ContentInputValidatorTests
{
    [Theory]
    [InlineData("{}")]
    [InlineData("{\"content\":null}")]
    [InlineData("{\"content\":\"\"}")]
    [InlineData("{\"content\":\"   \"}")]
    public async Task News_AllowsMissingOrBlankContent(string optionalFields)
    {
        using var db = TestDb.Create();
        var validator = new ContentInputValidator(db);
        var fields = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(optionalFields)!;
        fields["title"] = "Band update";
        fields["author"] = "Band";
        fields["publicationDate"] = "2026-09-13T00:00:00Z";
        var payload = System.Text.Json.JsonSerializer.Serialize(fields);
        Assert.Null(await validator.ValidateChangeRequestAsync(ContentChangeAction.Create, "news", null, payload));
        await new ContentChangeApplier(db, validator).ApplyAsync(new ContentChangeRequest
        {
            ContentType = "news", Action = ContentChangeAction.Create, PayloadJson = payload
        });
        var news = Assert.Single(db.News);
        Assert.NotNull(news.Content);
        Assert.True(string.IsNullOrWhiteSpace(news.Content));
        Assert.True(System.ComponentModel.DataAnnotations.Validator.TryValidateObject(
            news, new System.ComponentModel.DataAnnotations.ValidationContext(news), null, true));
    }

    [Fact]
    public async Task News_StillRejectsOverlongContent()
    {
        using var db = TestDb.Create();
        var error = await new ContentInputValidator(db).ValidateEntityAsync(new News
        {
            Title = "Update", Author = "Band", PublicationDate = DateTime.UtcNow,
            Content = new string('x', 10_001)
        });
        Assert.NotNull(error);
        Assert.Contains("Content", error);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"description\":null}")]
    [InlineData("{\"description\":\"\"}")]
    [InlineData("{\"description\":\"   \"}")]
    public async Task Timeline_AllowsMissingOrBlankDescription(string optionalFields)
    {
        using var db = TestDb.Create();
        var validator = new ContentInputValidator(db);
        var fields = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(optionalFields)!;
        fields["event"] = "Live show";
        fields["date"] = "2026-09-13T00:00:00Z";
        var payload = System.Text.Json.JsonSerializer.Serialize(fields);
        Assert.Null(await validator.ValidateChangeRequestAsync(ContentChangeAction.Create, "timeline", null, payload));
        var request = new ContentChangeRequest { ContentType = "timeline", Action = ContentChangeAction.Create, PayloadJson = payload };
        await new ContentChangeApplier(db, validator).ApplyAsync(request);
        var timeline = Assert.Single(db.TimeLines);
        Assert.True(string.IsNullOrWhiteSpace(timeline.Description));
    }

    [Fact]
    public async Task Timeline_StillRejectsOverlongDescription()
    {
        using var db = TestDb.Create();
        var error = await new ContentInputValidator(db).ValidateEntityAsync(new TimeLine
        {
            Date = DateTime.UtcNow, Event = "Live show", Description = new string('x', 5001)
        });
        Assert.NotNull(error);
        Assert.Contains("Description", error);
    }

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
            Date = new DateTime(2026, 1, 1),
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
            Date = new DateTime(2026, 1, 1),
            Location = "Sofia",
            NumberOfSongs = -1
        });

        Assert.Equal("NumberOfSongs cannot be negative.", error);
    }

    [Theory]
    [InlineData("concerts")]
    [InlineData("news")]
    [InlineData("timeline")]
    public async Task ValidateEntityAsync_RejectsMissingRequiredDates(string contentType)
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);
        object entity = contentType switch
        {
            "concerts" => new Concerts { Location = "Sofia" },
            "news" => new News { Title = "Update", Content = "News", Author = "Band" },
            _ => new TimeLine { Event = "Formed", Description = "The beginning" }
        };

        var error = await validator.ValidateEntityAsync(entity);

        Assert.Contains("required", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateEntityAsync_AcceptsAlbumTrackList()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = """
                [
                  { "songName": "Intro", "duration": "1:05", "text": "Opening words" },
                  { "songName": "Closer", "duration": "4:02" }
                ]
                """,
            NumberOfSongs = 2
        });

        Assert.Null(error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsAlbumTrackListWithInvalidDuration()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = """[{ "songName": "Intro", "duration": "1:75" }]""",
            NumberOfSongs = 1
        });

        Assert.Equal("Duration must use minutes:seconds format.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsUnsafeAlbumTrackYoutubeUrl()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = """[{ "songName": "Intro", "duration": "1:05", "availableOnYoutube": "javascript:alert(1)" }]""",
            NumberOfSongs = 1
        });

        Assert.Equal("AvailableOnYoutube must be a valid HTTP or HTTPS URL.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsNullNavigationCollection()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            Singles = null!
        });

        Assert.Equal("Singles are managed separately and cannot be supplied inside an album.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsNonTextAlbumTrackProperties()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = """[{ "songName": "Intro", "duration": 65 }]"""
        });

        Assert.Equal("Album song properties must contain text values.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsAlbumTrackListWithoutSongName()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = """[{ "songName": "", "duration": "1:05" }]""",
            NumberOfSongs = 1
        });

        Assert.Equal("SongName is required.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsAlbumTrackListWithTooLongText()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Albums
        {
            Title = "Debut",
            TrackListJson = $$"""[{ "songName": "Intro", "duration": "1:05", "text": "{{new string('x', 5_001)}}" }]""",
            NumberOfSongs = 1
        });

        Assert.Equal("Text cannot exceed 5000 characters.", error);
    }

    [Theory]
    [InlineData("/uploads/images/photo.png")]
    [InlineData("/BUntitled.png")]
    [InlineData("https://example.com/member.png")]
    [InlineData("http://example.com/member.png")]
    [InlineData("data:image/jpeg;base64,AQIDBA==")]
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
    [InlineData("/images/photo.png", "PhotoUrl must be an uploaded image path, image data URL, or HTTP(S) URL.")]
    [InlineData("javascript:alert(1)", "PhotoUrl must be a valid HTTP or HTTPS URL.")]
    [InlineData("data:text/html;base64,AQIDBA==", "PhotoUrl must be a JPEG, PNG, WEBP, or GIF image data URL.")]
    [InlineData("data:image/jpeg;base64,not-base64!", "PhotoUrl image data must be valid base64.")]
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
    public async Task ValidateEntityAsync_AcceptsDatabaseVideoPathForGallery()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);
        var videoId = Guid.NewGuid();

        var error = await validator.ValidateEntityAsync(new Gallery
        {
            Title = "Live Clip",
            ImageUrl = $"/api/uploads/videos/{videoId}"
        });

        Assert.Null(error);
    }

    [Fact]
    public async Task ValidateEntityAsync_AcceptsVideoDataUrlForGallery()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Gallery
        {
            Title = "Legacy Live Clip",
            ImageUrl = "data:video/mp4;base64,AQIDBA=="
        });

        Assert.Null(error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsVideoDataUrlForMemberPhoto()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Members
        {
            Name = "Alex",
            Instrument = "Guitar",
            PhotoUrl = "data:video/mp4;base64,AQIDBA=="
        });

        Assert.Equal("PhotoUrl must be a JPEG, PNG, WEBP, or GIF image data URL.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsUnsafeGalleryMediaPath()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Gallery
        {
            Title = "Live Clip",
            ImageUrl = "/videos/live.mp4"
        });

        Assert.Equal("ImageUrl must be an uploaded media path, media data URL, or HTTP(S) URL.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsOldUploadedVideoFilePathForGallery()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Gallery
        {
            Title = "Live Clip",
            ImageUrl = "/uploads/videos/live.mp4"
        });

        Assert.Equal("ImageUrl must be an uploaded media path, media data URL, or HTTP(S) URL.", error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsInvalidVideoDataUrlForGallery()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Gallery
        {
            Title = "Live Clip",
            ImageUrl = "data:video/mp4;base64,not-base64!"
        });

        Assert.Equal("ImageUrl video data must be valid base64.", error);
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

    [Fact]
    public async Task ValidateEntityAsync_AcceptsSingleDescription()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Singles
        {
            SongName = "Signal",
            Description = "A short text about the single."
        });

        Assert.Null(error);
    }

    [Fact]
    public async Task ValidateEntityAsync_RejectsImageDataUrlForStreamingLinks()
    {
        using var dbContext = TestDb.Create();
        var validator = new ContentInputValidator(dbContext);

        var error = await validator.ValidateEntityAsync(new Singles
        {
            SongName = "Signal",
            AvailableOnYoutube = "data:image/jpeg;base64,AQIDBA=="
        });

        Assert.Equal("AvailableOnYoutube must be a valid HTTP or HTTPS URL.", error);
    }
}
