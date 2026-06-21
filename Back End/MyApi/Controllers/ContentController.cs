using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/content")]
public class ContentController(
    AppDbContext dbContext,
    IContentInputValidator contentInputValidator) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [HttpGet("{contentType}")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<object>>> GetAll(
        string contentType,
        CancellationToken cancellationToken)
    {
        if (!contentInputValidator.TryNormalizeContentType(contentType, out var normalizedContentType))
        {
            return BadRequest("Unsupported content type.");
        }

        return Ok(normalizedContentType switch
        {
            "albums" => await dbContext.Albums
                .OrderByDescending(item => item.ReleaseDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "singles" => await dbContext.Singles
                .OrderByDescending(item => item.ReleaseDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "concerts" => await dbContext.Concerts
                .OrderByDescending(item => item.Date)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "news" => await dbContext.News
                .OrderByDescending(item => item.PublicationDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "timeline" => await dbContext.TimeLines
                .OrderByDescending(item => item.Date)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "members" => await dbContext.Members
                .OrderBy(item => item.Name)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "gallery" => await dbContext.Gallery
                .OrderBy(item => item.Title)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            _ => Array.Empty<object>()
        });
    }

    [HttpPost("{contentType}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Create(
        string contentType,
        JsonElement payload,
        CancellationToken cancellationToken)
    {
        if (!contentInputValidator.TryNormalizeContentType(contentType, out var normalizedContentType))
        {
            return BadRequest("Unsupported content type.");
        }

        object created;
        try
        {
            created = normalizedContentType switch
            {
                "albums" => Add<Albums>(payload, entity => dbContext.Albums.Add(entity)),
                "singles" => Add<Singles>(payload, entity => dbContext.Singles.Add(entity)),
                "concerts" => Add<Concerts>(payload, entity => dbContext.Concerts.Add(entity)),
                "news" => Add<News>(payload, entity => dbContext.News.Add(entity)),
                "timeline" => Add<TimeLine>(payload, entity => dbContext.TimeLines.Add(entity)),
                "members" => Add<Members>(payload, entity => dbContext.Members.Add(entity)),
                "gallery" => Add<Gallery>(payload, entity => dbContext.Gallery.Add(entity)),
                _ => throw new InvalidOperationException("Unsupported content type.")
            };
        }
        catch (JsonException)
        {
            return BadRequest("Request body does not match the selected content type.");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var validationError = await contentInputValidator.ValidateEntityAsync(created, cancellationToken);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(created);
    }

    [HttpDelete("{contentType}/{id:int}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Delete(
        string contentType,
        int id,
        CancellationToken cancellationToken)
    {
        if (!contentInputValidator.TryNormalizeContentType(contentType, out var normalizedContentType))
        {
            return BadRequest("Unsupported content type.");
        }

        object? entity = normalizedContentType switch
        {
            "albums" => await dbContext.Albums.FindAsync([id], cancellationToken),
            "singles" => await dbContext.Singles.FindAsync([id], cancellationToken),
            "concerts" => await dbContext.Concerts.FindAsync([id], cancellationToken),
            "news" => await dbContext.News.FindAsync([id], cancellationToken),
            "timeline" => await dbContext.TimeLines.FindAsync([id], cancellationToken),
            "members" => await dbContext.Members.FindAsync([id], cancellationToken),
            "gallery" => await dbContext.Gallery.FindAsync([id], cancellationToken),
            _ => null
        };

        if (entity is null)
        {
            return NotFound();
        }

        dbContext.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPut("{contentType}/{id:int}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Update(
        string contentType,
        int id,
        JsonElement payload,
        CancellationToken cancellationToken)
    {
        if (!contentInputValidator.TryNormalizeContentType(contentType, out var normalizedContentType))
        {
            return BadRequest("Unsupported content type.");
        }

        object? existing;
        object updated;
        string keyPropertyName;
        try
        {
            (existing, updated, keyPropertyName) = normalizedContentType switch
            {
                "albums" => await ReadUpdate<Albums>(id, nameof(Albums.AlbumId), payload, cancellationToken),
                "singles" => await ReadUpdate<Singles>(id, nameof(Singles.SongId), payload, cancellationToken),
                "concerts" => await ReadUpdate<Concerts>(id, nameof(Concerts.ConcertId), payload, cancellationToken),
                "news" => await ReadUpdate<News>(id, nameof(News.NewsId), payload, cancellationToken),
                "timeline" => await ReadUpdate<TimeLine>(id, nameof(TimeLine.Id), payload, cancellationToken),
                "members" => await ReadUpdate<Members>(id, nameof(Members.Id), payload, cancellationToken),
                "gallery" => await ReadUpdate<Gallery>(id, nameof(Gallery.Id), payload, cancellationToken),
                _ => throw new InvalidOperationException("Unsupported content type.")
            };
        }
        catch (JsonException)
        {
            return BadRequest("Request body does not match the selected content type.");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        if (existing is null)
        {
            return NotFound();
        }

        var validationError = await contentInputValidator.ValidateEntityAsync(updated, cancellationToken);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        SetKeyValue(updated, keyPropertyName, id);
        dbContext.Entry(existing).CurrentValues.SetValues(updated);
        dbContext.Entry(existing).Property(keyPropertyName).IsModified = false;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(existing);
    }

    private static TEntity Add<TEntity>(
        JsonElement payload,
        Func<TEntity, Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<TEntity>> add)
        where TEntity : class
    {
        var entity = payload.Deserialize<TEntity>(JsonOptions)
            ?? throw new InvalidOperationException("Request body could not be read.");

        EntityValueNormalizer.Normalize(entity);
        add(entity);
        return entity;
    }

    private async Task<(object? Existing, object Updated, string KeyPropertyName)> ReadUpdate<TEntity>(
        int id,
        string keyPropertyName,
        JsonElement payload,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        var existing = await dbContext.Set<TEntity>().FindAsync([id], cancellationToken);
        var updated = payload.Deserialize<TEntity>(JsonOptions)
            ?? throw new InvalidOperationException("Request body could not be read.");

        EntityValueNormalizer.Normalize(updated);
        return (existing, updated, keyPropertyName);
    }

    private static void SetKeyValue(object entity, string keyPropertyName, int id)
    {
        var keyProperty = entity.GetType().GetProperty(keyPropertyName)
            ?? throw new InvalidOperationException($"Key property '{keyPropertyName}' was not found.");

        keyProperty.SetValue(entity, id);
    }
}
