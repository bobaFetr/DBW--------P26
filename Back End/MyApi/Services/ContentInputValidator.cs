using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Services;

public interface IContentInputValidator
{
    bool TryNormalizeContentType(string? contentType, out string normalizedContentType);
    Task<string?> ValidateChangeRequestAsync(
        ContentChangeAction action,
        string? contentType,
        string? targetEntityId,
        string? payloadJson,
        CancellationToken cancellationToken = default);
    Task<string?> ValidateEntityAsync(object entity, CancellationToken cancellationToken = default);
    Task<string?> GetTargetVersionAsync(
        string? contentType,
        string? targetEntityId,
        CancellationToken cancellationToken = default);
}

public sealed class ContentInputValidator(AppDbContext dbContext) : IContentInputValidator
{
    public const int MaxPayloadJsonLength = 40_000_000;
    private const int MaxUrlLength = 500;
    private const int MaxImageDataUrlLength = 35_000_000;
    private const int MaxImageDataBytes = 25 * 1024 * 1024;
    private const int MaxVideoDataUrlLength = 140_000_000;
    private const int MaxVideoDataBytes = 100 * 1024 * 1024;
    private const int MaxAlbumTrackRows = 100;
    private const int MaxAlbumTrackListJsonLength = 20_000;
    private static readonly Regex TrackDurationPattern = new(@"^\d{1,3}:[0-5]\d$", RegexOptions.Compiled);

    private static readonly string[] AllowedImageDataUrlPrefixes =
    [
        "data:image/jpeg;base64,",
        "data:image/png;base64,",
        "data:image/webp;base64,",
        "data:image/gif;base64,"
    ];

    private static readonly string[] AllowedVideoDataUrlPrefixes =
    [
        "data:video/mp4;base64,",
        "data:video/webm;base64,",
        "data:video/quicktime;base64,"
    ];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    private static readonly HashSet<string> SupportedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "albums",
        "singles",
        "concerts",
        "news",
        "timeline",
        "members",
        "gallery"
    };

    public bool TryNormalizeContentType(string? contentType, out string normalizedContentType)
    {
        normalizedContentType = string.Empty;

        if (string.IsNullOrWhiteSpace(contentType))
        {
            return false;
        }

        normalizedContentType = contentType.Trim().ToLowerInvariant() switch
        {
            "album" or "albums" => "albums",
            "single" or "singles" => "singles",
            "concert" or "concerts" => "concerts",
            "news" => "news",
            "timeline" or "timelines" => "timeline",
            "member" or "members" => "members",
            "gallery" => "gallery",
            _ => string.Empty
        };

        return SupportedContentTypes.Contains(normalizedContentType);
    }

    public async Task<string?> ValidateChangeRequestAsync(
        ContentChangeAction action,
        string? contentType,
        string? targetEntityId,
        string? payloadJson,
        CancellationToken cancellationToken = default)
    {
        if (!TryNormalizeContentType(contentType, out _))
        {
            return "Unsupported content type.";
        }

        if (!Enum.IsDefined(action))
        {
            return "Unsupported content action.";
        }

        if (action is ContentChangeAction.Update or ContentChangeAction.Delete &&
            !IsPositiveInt(targetEntityId))
        {
            return "TargetEntityId must be a positive integer for update and delete requests.";
        }

        if (action == ContentChangeAction.Delete)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return "PayloadJson is required.";
        }

        if (payloadJson.Length > MaxPayloadJsonLength)
        {
            return $"PayloadJson cannot exceed {MaxPayloadJsonLength} characters.";
        }

        using var document = TryParseJsonObject(payloadJson, out var parseError);
        if (parseError is not null)
        {
            return parseError;
        }

        var entity = DeserializeEntity(contentType!, payloadJson, out var deserializeError);
        if (deserializeError is not null)
        {
            return deserializeError;
        }

        EntityValueNormalizer.Normalize(entity!);
        return await ValidateEntityAsync(entity!, cancellationToken);
    }

    public async Task<string?> ValidateEntityAsync(object entity, CancellationToken cancellationToken = default)
    {
        var systemPropertyError = ValidateSystemManagedProperties(entity);
        if (systemPropertyError is not null)
        {
            return systemPropertyError;
        }

        return entity switch
        {
            Albums album => ValidateAlbum(album),
            Singles single => await ValidateSingleAsync(single, cancellationToken),
            Concerts concert => ValidateConcert(concert),
            News news => ValidateNews(news),
            TimeLine timeLine => ValidateTimeline(timeLine),
            Members member => ValidateMember(member),
            Gallery gallery => ValidateGallery(gallery),
            _ => "Unsupported content payload."
        };
    }

    private static string? ValidateAlbum(Albums album)
    {
        return ValidateRequiredText(album.Title, "Title", 200)
            ?? ValidateOptionalUrl(album.PhotoUrl, "PhotoUrl", allowImageDataUrl: true)
            ?? ValidateAlbumTrackList(album.TrackListJson)
            ?? ValidateNonNegative(album.NumberOfSongs, "NumberOfSongs");
    }

    private async Task<string?> ValidateSingleAsync(Singles single, CancellationToken cancellationToken)
    {
        if (single.AlbumId.HasValue &&
            !await dbContext.Albums.AnyAsync(album => album.AlbumId == single.AlbumId, cancellationToken))
        {
            return $"AlbumId '{single.AlbumId}' does not exist. Leave Album ID empty or choose an existing album.";
        }

        return ValidateRequiredText(single.SongName, "SongName", 200)
            ?? ValidateOptionalUrl(single.PhotoUrl, "PhotoUrl", allowImageDataUrl: true)
            ?? ValidateOptionalText(single.Description, "Description", 5_000)
            ?? ValidateOptionalUrl(single.AvailableOnYoutube, "AvailableOnYoutube", allowImageDataUrl: false)
            ?? ValidateOptionalUrl(single.AvailableOnSpotify, "AvailableOnSpotify", allowImageDataUrl: false);
    }

    private static string? ValidateConcert(Concerts concert)
    {
        return ValidateRequiredDate(concert.Date, "Date")
            ?? ValidateRequiredText(concert.Location, "Location", 200)
            ?? ValidateNonNegative(concert.NumberOfSongs, "NumberOfSongs");
    }

    public async Task<string?> GetTargetVersionAsync(
        string? contentType,
        string? targetEntityId,
        CancellationToken cancellationToken = default)
    {
        if (!TryNormalizeContentType(contentType, out var normalizedContentType) ||
            !int.TryParse(targetEntityId, out var id) || id <= 0)
        {
            return null;
        }

        object? entity = normalizedContentType switch
        {
            "albums" => await dbContext.Albums.AsNoTracking().FirstOrDefaultAsync(item => item.AlbumId == id, cancellationToken),
            "singles" => await dbContext.Singles.AsNoTracking().FirstOrDefaultAsync(item => item.SongId == id, cancellationToken),
            "concerts" => await dbContext.Concerts.AsNoTracking().FirstOrDefaultAsync(item => item.ConcertId == id, cancellationToken),
            "news" => await dbContext.News.AsNoTracking().FirstOrDefaultAsync(item => item.NewsId == id, cancellationToken),
            "timeline" => await dbContext.TimeLines.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken),
            "members" => await dbContext.Members.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken),
            "gallery" => await dbContext.Gallery.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken),
            _ => null
        };

        if (entity is null) return null;
        var json = JsonSerializer.Serialize(entity, entity.GetType());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
    }

    private static string? ValidateSystemManagedProperties(object entity)
    {
        return entity switch
        {
            Albums album when album.Singles is null || album.Singles.Count != 0 =>
                "Singles are managed separately and cannot be supplied inside an album.",
            Singles single when single.Album is not null || single.ConcertSongs is null || single.ConcertSongs.Count != 0 =>
                "Album and ConcertSongs are managed separately and cannot be supplied inside a single.",
            Concerts concert when concert.ConcertSongs is null || concert.ConcertSongs.Count != 0 =>
                "ConcertSongs are managed separately and cannot be supplied inside a concert.",
            _ => null
        };
    }

    private static string? ValidateNews(News news)
    {
        return ValidateRequiredDate(news.PublicationDate, "PublicationDate")
            ?? ValidateRequiredText(news.Title, "Title", 200)
            ?? ValidateRequiredText(news.Content, "Content", 10_000)
            ?? ValidateRequiredText(news.Author, "Author", 150);
    }

    private static string? ValidateTimeline(TimeLine timeLine)
    {
        return ValidateRequiredDate(timeLine.Date, "Date")
            ?? ValidateRequiredText(timeLine.Event, "Event", 200)
            ?? ValidateRequiredText(timeLine.Description, "Description", 5_000)
            ?? ValidateOptionalText(timeLine.Location, "Location", 200);
    }

    private static string? ValidateRequiredDate(DateTime value, string fieldName)
    {
        return value == default ? $"{fieldName} is required." : null;
    }

    private static string? ValidateMember(Members member)
    {
        return ValidateRequiredText(member.Name, "Name", 150)
            ?? ValidateRequiredText(member.Instrument, "Instrument", 100)
            ?? ValidateOptionalUrl(member.PhotoUrl, "PhotoUrl", allowImageDataUrl: true);
    }

    private static string? ValidateGallery(Gallery gallery)
    {
        return ValidateRequiredText(gallery.Title, "Title", 200)
            ?? ValidateOptionalText(gallery.Description, "Description", 2_000)
            ?? (string.IsNullOrWhiteSpace(gallery.ImageUrl) ? null : ValidateRequiredMediaUrl(gallery.ImageUrl, "ImageUrl"));
    }

    private static IDisposable? TryParseJsonObject(string payloadJson, out string? error)
    {
        error = null;

        try
        {
            var document = JsonDocument.Parse(payloadJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                document.Dispose();
                error = "PayloadJson must be a JSON object.";
                return null;
            }

            return document;
        }
        catch (JsonException)
        {
            error = "PayloadJson must contain valid JSON.";
            return null;
        }
    }

    private static object? DeserializeEntity(string contentType, string payloadJson, out string? error)
    {
        error = null;

        try
        {
            return contentType.Trim().ToLowerInvariant() switch
            {
                "album" or "albums" => (object?)JsonSerializer.Deserialize<Albums>(payloadJson, JsonOptions),
                "single" or "singles" => JsonSerializer.Deserialize<Singles>(payloadJson, JsonOptions),
                "concert" or "concerts" => JsonSerializer.Deserialize<Concerts>(payloadJson, JsonOptions),
                "news" => JsonSerializer.Deserialize<News>(payloadJson, JsonOptions),
                "timeline" or "timelines" => JsonSerializer.Deserialize<TimeLine>(payloadJson, JsonOptions),
                "member" or "members" => JsonSerializer.Deserialize<Members>(payloadJson, JsonOptions),
                "gallery" => JsonSerializer.Deserialize<Gallery>(payloadJson, JsonOptions),
                _ => null
            } ?? throw new JsonException();
        }
        catch (JsonException)
        {
            error = "PayloadJson does not match the selected content type.";
            return null;
        }
    }

    private static bool IsPositiveInt(string? value)
    {
        return int.TryParse(value, out var parsed) && parsed > 0;
    }

    private static string? ValidateRequiredText(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return $"{fieldName} is required.";
        }

        return ValidateOptionalText(value, fieldName, maxLength);
    }

    private static string? ValidateOptionalText(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        if (value.Length > maxLength)
        {
            return $"{fieldName} cannot exceed {maxLength} characters.";
        }

        return value.Any(character => char.IsControl(character) && !char.IsWhiteSpace(character))
            ? $"{fieldName} cannot contain control characters."
            : null;
    }

    private static string? ValidateNonNegative(int value, string fieldName)
    {
        return value < 0 ? $"{fieldName} cannot be negative." : null;
    }

    private static string? ValidateAlbumTrackList(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.Length > MaxAlbumTrackListJsonLength)
        {
            return $"TrackListJson cannot exceed {MaxAlbumTrackListJsonLength} characters.";
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return "TrackListJson must be a JSON array.";
            }

            var count = 0;
            foreach (var row in document.RootElement.EnumerateArray())
            {
                count++;
                if (count > MaxAlbumTrackRows)
                {
                    return $"TrackListJson cannot contain more than {MaxAlbumTrackRows} songs.";
                }

                if (row.ValueKind != JsonValueKind.Object)
                {
                    return "Each album song row must be a JSON object.";
                }

                var songName = row.TryGetProperty("songName", out var songNameElement)
                    ? songNameElement.GetString()
                    : null;
                var duration = row.TryGetProperty("duration", out var durationElement)
                    ? durationElement.GetString()
                    : null;
                var text = row.TryGetProperty("text", out var textElement)
                    ? textElement.GetString()
                    : null;
                var availableOnYoutube = row.TryGetProperty("availableOnYoutube", out var youtubeElement)
                    ? youtubeElement.GetString()
                    : null;

                var songNameError = ValidateRequiredText(songName, "SongName", 200);
                if (songNameError is not null)
                {
                    return songNameError;
                }

                if (string.IsNullOrWhiteSpace(duration))
                {
                    return "Duration is required.";
                }

                if (!TrackDurationPattern.IsMatch(duration))
                {
                    return "Duration must use minutes:seconds format.";
                }

                var textError = ValidateOptionalText(text, "Text", 5_000);
                if (textError is not null)
                {
                    return textError;
                }

                var youtubeError = ValidateOptionalUrl(
                    availableOnYoutube,
                    "AvailableOnYoutube",
                    allowImageDataUrl: false);
                if (youtubeError is not null)
                {
                    return youtubeError;
                }
            }

            return null;
        }
        catch (JsonException)
        {
            return "TrackListJson must contain valid JSON.";
        }
        catch (InvalidOperationException)
        {
            return "Album song properties must contain text values.";
        }
    }

    private static string? ValidateRequiredUrl(string? value, string fieldName, bool allowImageDataUrl)
    {
        return string.IsNullOrWhiteSpace(value)
            ? $"{fieldName} is required."
            : ValidateOptionalUrl(value, fieldName, allowImageDataUrl);
    }

    private static string? ValidateRequiredMediaUrl(string? value, string fieldName)
    {
        return string.IsNullOrWhiteSpace(value)
            ? $"{fieldName} is required."
            : ValidateOptionalMediaUrl(value, fieldName);
    }

    private static string? ValidateOptionalMediaUrl(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return ValidateMediaDataUrl(value, fieldName);
        }

        if (value.Length > MaxUrlLength)
        {
            return $"{fieldName} cannot exceed {MaxUrlLength} characters.";
        }

        if (value.StartsWith('/'))
        {
            return value.StartsWith("/uploads/images/", StringComparison.Ordinal)
                || IsApiUploadedVideoPath(value)
                || value.Equals("/BUntitled.png", StringComparison.Ordinal)
                    ? null
                    : $"{fieldName} must be an uploaded media path, media data URL, or HTTP(S) URL.";
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                ? null
                : $"{fieldName} must be a valid HTTP or HTTPS URL.";
    }

    private static string? ValidateOptionalUrl(string? value, string fieldName, bool allowImageDataUrl = true)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return allowImageDataUrl
                ? ValidateImageDataUrl(value, fieldName)
                : $"{fieldName} must be a valid HTTP or HTTPS URL.";
        }

        if (value.Length > MaxUrlLength)
        {
            return $"{fieldName} cannot exceed {MaxUrlLength} characters.";
        }

        if (value.StartsWith('/'))
        {
            return value.StartsWith("/uploads/images/", StringComparison.Ordinal)
                || value.Equals("/BUntitled.png", StringComparison.Ordinal)
                    ? null
                    : $"{fieldName} must be an uploaded image path, image data URL, or HTTP(S) URL.";
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                ? null
                : $"{fieldName} must be a valid HTTP or HTTPS URL.";
    }

    private static bool IsApiUploadedVideoPath(string value)
    {
        const string prefix = "/api/uploads/videos/";
        return value.StartsWith(prefix, StringComparison.Ordinal) &&
            Guid.TryParse(value[prefix.Length..], out _);
    }

    private static string? ValidateImageDataUrl(string value, string fieldName)
    {
        var prefix = AllowedImageDataUrlPrefixes.FirstOrDefault(allowedPrefix =>
            value.StartsWith(allowedPrefix, StringComparison.OrdinalIgnoreCase));
        if (prefix is null)
        {
            return $"{fieldName} must be a JPEG, PNG, WEBP, or GIF image data URL.";
        }

        if (value.Length > MaxImageDataUrlLength)
        {
            return $"{fieldName} image data cannot exceed {MaxImageDataUrlLength} characters.";
        }

        var base64 = value[prefix.Length..];
        if (string.IsNullOrWhiteSpace(base64))
        {
            return $"{fieldName} image data is required.";
        }

        try
        {
            var bytes = Convert.FromBase64String(base64);
            return bytes.Length <= MaxImageDataBytes
                ? null
                : $"{fieldName} image data cannot exceed 25 MB.";
        }
        catch (FormatException)
        {
            return $"{fieldName} image data must be valid base64.";
        }
    }

    private static string? ValidateMediaDataUrl(string value, string fieldName)
    {
        var imageError = ValidateImageDataUrl(value, fieldName);
        if (imageError is null)
        {
            return null;
        }

        return ValidateVideoDataUrl(value, fieldName);
    }

    private static string? ValidateVideoDataUrl(string value, string fieldName)
    {
        var prefix = AllowedVideoDataUrlPrefixes.FirstOrDefault(allowedPrefix =>
            value.StartsWith(allowedPrefix, StringComparison.OrdinalIgnoreCase));
        if (prefix is null)
        {
            return $"{fieldName} must be a JPEG, PNG, WEBP, GIF, MP4, WEBM, or MOV data URL.";
        }

        if (value.Length > MaxVideoDataUrlLength)
        {
            return $"{fieldName} video data cannot exceed {MaxVideoDataUrlLength} characters.";
        }

        var base64 = value[prefix.Length..];
        if (string.IsNullOrWhiteSpace(base64))
        {
            return $"{fieldName} video data is required.";
        }

        try
        {
            var bytes = Convert.FromBase64String(base64);
            return bytes.Length <= MaxVideoDataBytes
                ? null
                : $"{fieldName} video data cannot exceed 100 MB.";
        }
        catch (FormatException)
        {
            return $"{fieldName} video data must be valid base64.";
        }
    }
}
