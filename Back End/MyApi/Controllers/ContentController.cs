using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/content")]
public class ContentController(AppDbContext dbContext) : ControllerBase
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
        return Ok(contentType.Trim().ToLowerInvariant() switch
        {
            "albums" or "album" => await dbContext.Albums
                .OrderByDescending(item => item.ReleaseDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "singles" or "single" => await dbContext.Singles
                .OrderByDescending(item => item.ReleaseDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "concerts" or "concert" => await dbContext.Concerts
                .OrderByDescending(item => item.Date)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "news" => await dbContext.News
                .OrderByDescending(item => item.PublicationDate)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "timeline" or "timelines" => await dbContext.TimeLines
                .OrderByDescending(item => item.Date)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "members" or "member" => await dbContext.Members
                .OrderBy(item => item.Name)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            "gallery" => await dbContext.Gallery
                .OrderBy(item => item.Title)
                .Cast<object>()
                .ToListAsync(cancellationToken),
            _ => throw new InvalidOperationException($"Unsupported content type '{contentType}'.")
        });
    }

    [HttpPost("{contentType}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Create(
        string contentType,
        JsonElement payload,
        CancellationToken cancellationToken)
    {
        object created = contentType.Trim().ToLowerInvariant() switch
        {
            "albums" or "album" => Add<Albums>(payload, entity => dbContext.Albums.Add(entity)),
            "singles" or "single" => Add<Singles>(payload, entity => dbContext.Singles.Add(entity)),
            "concerts" or "concert" => Add<Concerts>(payload, entity => dbContext.Concerts.Add(entity)),
            "news" => Add<News>(payload, entity => dbContext.News.Add(entity)),
            "timeline" or "timelines" => Add<TimeLine>(payload, entity => dbContext.TimeLines.Add(entity)),
            "members" or "member" => Add<Members>(payload, entity => dbContext.Members.Add(entity)),
            "gallery" => Add<Gallery>(payload, entity => dbContext.Gallery.Add(entity)),
            _ => throw new InvalidOperationException($"Unsupported content type '{contentType}'.")
        };

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
        object? entity = contentType.Trim().ToLowerInvariant() switch
        {
            "albums" or "album" => await dbContext.Albums.FindAsync([id], cancellationToken),
            "singles" or "single" => await dbContext.Singles.FindAsync([id], cancellationToken),
            "concerts" or "concert" => await dbContext.Concerts.FindAsync([id], cancellationToken),
            "news" => await dbContext.News.FindAsync([id], cancellationToken),
            "timeline" or "timelines" => await dbContext.TimeLines.FindAsync([id], cancellationToken),
            "members" or "member" => await dbContext.Members.FindAsync([id], cancellationToken),
            "gallery" => await dbContext.Gallery.FindAsync([id], cancellationToken),
            _ => throw new InvalidOperationException($"Unsupported content type '{contentType}'.")
        };

        if (entity is null)
        {
            return NotFound();
        }

        dbContext.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static TEntity Add<TEntity>(
        JsonElement payload,
        Func<TEntity, Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<TEntity>> add)
        where TEntity : class
    {
        var entity = payload.Deserialize<TEntity>(JsonOptions)
            ?? throw new InvalidOperationException("Request body could not be read.");

        DateTimeNormalizer.NormalizeUtc(entity);
        add(entity);
        return entity;
    }
}
