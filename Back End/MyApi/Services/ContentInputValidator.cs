using System.Text.Json;
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
}

public sealed class ContentInputValidator(AppDbContext dbContext) : IContentInputValidator
{
    private const int MaxPayloadJsonLength = 20_000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
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
            ?? ValidateOptionalUrl(single.AvailableOnYoutube, "AvailableOnYoutube")
            ?? ValidateOptionalUrl(single.AvailableOnSpotify, "AvailableOnSpotify");
    }

    private static string? ValidateConcert(Concerts concert)
    {
        return ValidateRequiredText(concert.Location, "Location", 200)
            ?? ValidateNonNegative(concert.NumberOfSongs, "NumberOfSongs");
    }

    private static string? ValidateNews(News news)
    {
        return ValidateRequiredText(news.Title, "Title", 200)
            ?? ValidateRequiredText(news.Content, "Content", 10_000)
            ?? ValidateRequiredText(news.Author, "Author", 150);
    }

    private static string? ValidateTimeline(TimeLine timeLine)
    {
        return ValidateRequiredText(timeLine.Event, "Event", 200)
            ?? ValidateRequiredText(timeLine.Description, "Description", 5_000)
            ?? ValidateOptionalText(timeLine.Location, "Location", 200);
    }

    private static string? ValidateMember(Members member)
    {
        return ValidateRequiredText(member.Name, "Name", 150)
            ?? ValidateRequiredText(member.Instrument, "Instrument", 100)
            ?? ValidateRequiredUrl(member.PhotoUrl, "PhotoUrl");
    }

    private static string? ValidateGallery(Gallery gallery)
    {
        return ValidateRequiredText(gallery.Title, "Title", 200)
            ?? ValidateOptionalText(gallery.Description, "Description", 2_000)
            ?? ValidateRequiredUrl(gallery.ImageUrl, "ImageUrl");
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

    private static string? ValidateRequiredUrl(string? value, string fieldName)
    {
        return string.IsNullOrWhiteSpace(value)
            ? $"{fieldName} is required."
            : ValidateOptionalUrl(value, fieldName);
    }

    private static string? ValidateOptionalUrl(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.Length > 500)
        {
            return $"{fieldName} cannot exceed 500 characters.";
        }

        if (value.StartsWith('/'))
        {
            return value.StartsWith("/uploads/images/", StringComparison.Ordinal)
                || value.Equals("/BUntitled.png", StringComparison.Ordinal)
                    ? null
                    : $"{fieldName} must be an uploaded image path or HTTPS URL.";
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                ? null
                : $"{fieldName} must be a valid HTTP or HTTPS URL.";
    }
}
