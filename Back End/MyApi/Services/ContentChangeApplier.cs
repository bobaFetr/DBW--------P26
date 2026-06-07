using System.Text.Json;
using MyLibrary;

namespace MyApi.Services;

public interface IContentChangeApplier
{
    Task ApplyAsync(ContentChangeRequest request, CancellationToken cancellationToken = default);
}

public class ContentChangeApplier(AppDbContext dbContext) : IContentChangeApplier
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task ApplyAsync(ContentChangeRequest request, CancellationToken cancellationToken = default)
    {
        switch (request.ContentType.Trim().ToLowerInvariant())
        {
            case "albums":
            case "album":
                await ApplyEntityAsync<Albums, int>(
                    request,
                    nameof(Albums.AlbumId),
                    entity => dbContext.Albums.Add(entity),
                    cancellationToken);
                break;
            case "singles":
            case "single":
                await ApplyEntityAsync<Singles, int>(
                    request,
                    nameof(Singles.SongId),
                    entity => dbContext.Singles.Add(entity),
                    cancellationToken);
                break;
            case "concerts":
            case "concert":
                await ApplyEntityAsync<Concerts, int>(
                    request,
                    nameof(Concerts.ConcertId),
                    entity => dbContext.Concerts.Add(entity),
                    cancellationToken);
                break;
            case "news":
                await ApplyEntityAsync<News, int>(
                    request,
                    nameof(News.NewsId),
                    entity => dbContext.News.Add(entity),
                    cancellationToken);
                break;
            case "timeline":
            case "timelines":
                await ApplyEntityAsync<TimeLine, int>(
                    request,
                    nameof(TimeLine.Id),
                    entity => dbContext.TimeLines.Add(entity),
                    cancellationToken);
                break;
            case "members":
            case "member":
                await ApplyEntityAsync<Members, int>(
                    request,
                    nameof(Members.Id),
                    entity => dbContext.Members.Add(entity),
                    cancellationToken);
                break;
            case "gallery":
                await ApplyEntityAsync<Gallery, int>(
                    request,
                    nameof(Gallery.Id),
                    entity => dbContext.Gallery.Add(entity),
                    cancellationToken);
                break;
            default:
                throw new InvalidOperationException($"Unsupported content type '{request.ContentType}'.");
        }
    }

    private async Task ApplyEntityAsync<TEntity, TKey>(
        ContentChangeRequest request,
        string keyPropertyName,
        Action<TEntity> add,
        CancellationToken cancellationToken)
        where TEntity : class
        where TKey : notnull
    {
        if (request.Action == ContentChangeAction.Create)
        {
            var entity = Deserialize<TEntity>(request.PayloadJson);
            DateTimeNormalizer.NormalizeUtc(entity);
            add(entity);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        if (string.IsNullOrWhiteSpace(request.TargetEntityId))
        {
            throw new InvalidOperationException("TargetEntityId is required for update and delete requests.");
        }

        var key = (TKey)Convert.ChangeType(request.TargetEntityId, typeof(TKey));
        var existing = await dbContext.Set<TEntity>().FindAsync([key], cancellationToken);

        if (existing is null)
        {
            throw new InvalidOperationException(
                $"{typeof(TEntity).Name} with id '{request.TargetEntityId}' was not found.");
        }

        if (request.Action == ContentChangeAction.Delete)
        {
            dbContext.Set<TEntity>().Remove(existing);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var updated = Deserialize<TEntity>(request.PayloadJson);
        DateTimeNormalizer.NormalizeUtc(updated);
        dbContext.Entry(existing).CurrentValues.SetValues(updated);
        dbContext.Entry(existing).Property(keyPropertyName).IsModified = false;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static TEntity Deserialize<TEntity>(string payloadJson)
    {
        return JsonSerializer.Deserialize<TEntity>(payloadJson, JsonOptions)
            ?? throw new InvalidOperationException("PayloadJson could not be read.");
    }
}
