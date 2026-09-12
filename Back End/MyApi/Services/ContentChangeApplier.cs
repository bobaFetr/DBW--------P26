using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Services;

public interface IContentChangeApplier
{
    Task ApplyAsync(ContentChangeRequest request, CancellationToken cancellationToken = default);
}

public class ContentChangeApplier(
    AppDbContext dbContext,
    IContentInputValidator contentInputValidator) : IContentChangeApplier
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public async Task ApplyAsync(ContentChangeRequest request, CancellationToken cancellationToken = default)
    {
        if (!contentInputValidator.TryNormalizeContentType(request.ContentType, out var normalizedContentType))
        {
            throw new InvalidOperationException("Unsupported content type.");
        }

        switch (normalizedContentType)
        {
            case "albums":
                await ApplyEntityAsync<Albums, int>(
                    request,
                    nameof(Albums.AlbumId),
                    entity => dbContext.Albums.Add(entity),
                    cancellationToken);
                break;
            case "singles":
                await ApplyEntityAsync<Singles, int>(
                    request,
                    nameof(Singles.SongId),
                    entity => dbContext.Singles.Add(entity),
                    cancellationToken);
                break;
            case "concerts":
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
                await ApplyEntityAsync<TimeLine, int>(
                    request,
                    nameof(TimeLine.Id),
                    entity => dbContext.TimeLines.Add(entity),
                    cancellationToken);
                break;
            case "members":
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
                throw new InvalidOperationException("Unsupported content type.");
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
            PreserveKeyValue(entity, keyPropertyName, default(TKey)!);
            EntityValueNormalizer.Normalize(entity);
            var validationError = await contentInputValidator.ValidateEntityAsync(entity, cancellationToken);
            if (validationError is not null)
            {
                throw new InvalidOperationException(validationError);
            }

            add(entity);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        if (string.IsNullOrWhiteSpace(request.TargetEntityId))
        {
            throw new InvalidOperationException("TargetEntityId is required for update and delete requests.");
        }

        if (!TryConvertKey(request.TargetEntityId, out TKey key))
        {
            throw new InvalidOperationException("TargetEntityId must be a valid positive integer.");
        }

        var existing = await dbContext.Set<TEntity>().FindAsync([key], cancellationToken);

        if (existing is null)
        {
            // A removal is already satisfied if another approved request or a
            // direct deletion removed the target. Still finalize and audit approval.
            if (request.Action == ContentChangeAction.Delete) return;

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
        EntityValueNormalizer.Normalize(updated);
        var updateValidationError = await contentInputValidator.ValidateEntityAsync(updated, cancellationToken);
        if (updateValidationError is not null)
        {
            throw new InvalidOperationException(updateValidationError);
        }

        PreserveKeyValue(updated, keyPropertyName, key);
        dbContext.Entry(existing).CurrentValues.SetValues(updated);
        dbContext.Entry(existing).Property(keyPropertyName).IsModified = false;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static TEntity Deserialize<TEntity>(string payloadJson)
    {
        return JsonSerializer.Deserialize<TEntity>(payloadJson, JsonOptions)
            ?? throw new InvalidOperationException("PayloadJson could not be read.");
    }

    private static bool TryConvertKey<TKey>(string? targetEntityId, out TKey key)
        where TKey : notnull
    {
        key = default!;

        if (typeof(TKey) == typeof(int) &&
            int.TryParse(targetEntityId, out var parsed) &&
            parsed > 0)
        {
            key = (TKey)(object)parsed;
            return true;
        }

        return false;
    }

    private static void PreserveKeyValue<TEntity, TKey>(
        TEntity entity,
        string keyPropertyName,
        TKey key)
        where TEntity : class
        where TKey : notnull
    {
        var keyProperty = typeof(TEntity).GetProperty(keyPropertyName)
            ?? throw new InvalidOperationException($"Key property '{keyPropertyName}' was not found.");

        keyProperty.SetValue(entity, key);
    }
}
