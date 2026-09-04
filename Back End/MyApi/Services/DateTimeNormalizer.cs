using System.Reflection;

namespace MyApi.Services;

public static class DateTimeNormalizer
{
    public static TEntity NormalizeUtc<TEntity>(TEntity entity)
        where TEntity : class
    {
        foreach (var property in typeof(TEntity).GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            if (!property.CanRead || !property.CanWrite)
            {
                continue;
            }

            if (property.PropertyType == typeof(DateTime))
            {
                var value = (DateTime)property.GetValue(entity)!;
                property.SetValue(entity, ToUtc(value));
                continue;
            }

            if (property.PropertyType == typeof(DateTime?))
            {
                var value = (DateTime?)property.GetValue(entity);
                if (value.HasValue)
                {
                    property.SetValue(entity, ToUtc(value.Value));
                }
            }
        }

        return entity;
    }

    private static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
