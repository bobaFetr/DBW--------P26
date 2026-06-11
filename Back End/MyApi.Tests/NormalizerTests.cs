using MyApi.Services;
using MyLibrary;

namespace MyApi.Tests;

public class NormalizerTests
{
    [Fact]
    public void DateTimeNormalizer_MarksUnspecifiedDateTimeAsUtc()
    {
        var news = new News
        {
            Title = "New",
            Content = "Content",
            Author = "Author",
            PublicationDate = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Unspecified)
        };

        DateTimeNormalizer.NormalizeUtc(news);

        Assert.Equal(DateTimeKind.Utc, news.PublicationDate.Kind);
        Assert.Equal(12, news.PublicationDate.Hour);
    }

    [Fact]
    public void DateTimeNormalizer_LeavesUtcValuesUnchanged()
    {
        var releaseDate = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var single = new Singles
        {
            SongName = "Signal",
            ReleaseDate = releaseDate
        };

        DateTimeNormalizer.NormalizeUtc(single);

        Assert.Equal(releaseDate, single.ReleaseDate);
        Assert.Equal(DateTimeKind.Utc, single.ReleaseDate!.Value.Kind);
    }

    [Fact]
    public void EntityValueNormalizer_DefaultsNullableTextFields()
    {
        var timeline = new TimeLine
        {
            Event = "Started",
            Description = "A beginning",
            Location = null!
        };
        var gallery = new Gallery
        {
            Title = "Poster",
            Description = null!,
            ImageUrl = "/uploads/images/poster.png"
        };

        EntityValueNormalizer.Normalize(timeline);
        EntityValueNormalizer.Normalize(gallery);

        Assert.Equal(string.Empty, timeline.Location);
        Assert.Equal(string.Empty, gallery.Description);
    }
}
