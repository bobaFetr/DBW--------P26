using MyLibrary;

namespace MyApi.Services;

public static class EntityValueNormalizer
{
    public static TEntity Normalize<TEntity>(TEntity entity)
        where TEntity : class
    {
        DateTimeNormalizer.NormalizeUtc(entity);

        switch (entity)
        {
            case TimeLine timeLine:
                timeLine.Location ??= string.Empty;
                timeLine.Description ??= string.Empty;
                break;
            case Gallery gallery:
                gallery.Description ??= string.Empty;
                gallery.ImageUrl = NormalizeMedia(gallery.ImageUrl);
                break;
            case Members member:
                member.PhotoUrl = NormalizeMedia(member.PhotoUrl);
                break;
            case Albums album:
                album.PhotoUrl = NormalizeMedia(album.PhotoUrl);
                break;
            case Singles single:
                single.PhotoUrl = NormalizeMedia(single.PhotoUrl);
                break;
        }

        return entity;
    }

    private static string? NormalizeMedia(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
