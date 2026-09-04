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
                break;
            case Gallery gallery:
                gallery.Description ??= string.Empty;
                break;
        }

        return entity;
    }
}
