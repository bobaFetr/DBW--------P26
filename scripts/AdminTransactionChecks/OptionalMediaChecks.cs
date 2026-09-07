using Microsoft.EntityFrameworkCore;
using MyApi.Services;
using MyLibrary;
using Npgsql;

internal static class OptionalMediaChecks
{
    public static async Task Run(string connectionString)
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        await db.Database.MigrateAsync();
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("""
            SELECT table_name, column_name, is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND
              ((table_name IN ('Members', 'Albums', 'Singles') AND column_name = 'PhotoUrl')
                OR (table_name = 'Gallery' AND column_name = 'ImageUrl'))
            ORDER BY table_name;
            """, connection);
        await using (var reader = await command.ExecuteReaderAsync())
        {
            var count = 0;
            while (await reader.ReadAsync())
            {
                if (reader.GetString(2) != "YES") throw new InvalidOperationException("Media column is still required.");
                Console.WriteLine($"PASS: {reader.GetString(0)}.{reader.GetString(1)} permits NULL.");
                count++;
            }
            if (count != 4) throw new InvalidOperationException("Expected four media columns.");
        }

        // Verify real SQL NULL persistence without leaving test content behind.
        await using var transaction = await db.Database.BeginTransactionAsync();
        var member = EntityValueNormalizer.Normalize(new Members { Name = "Null check", Instrument = "Guitar", PhotoUrl = " \t " });
        var gallery = EntityValueNormalizer.Normalize(new Gallery { Title = "Null check", ImageUrl = "" });
        var album = EntityValueNormalizer.Normalize(new Albums { Title = "Null check", PhotoUrl = null });
        var single = EntityValueNormalizer.Normalize(new Singles { SongName = "Null check", PhotoUrl = "\r\n" });
        db.AddRange(member, gallery, album, single);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        if (!await db.Members.AnyAsync(x => x.Id == member.Id && x.PhotoUrl == null)
            || !await db.Gallery.AnyAsync(x => x.Id == gallery.Id && x.ImageUrl == null)
            || !await db.Albums.AnyAsync(x => x.AlbumId == album.AlbumId && x.PhotoUrl == null)
            || !await db.Singles.AnyAsync(x => x.SongId == single.SongId && x.PhotoUrl == null))
            throw new InvalidOperationException("Missing media did not persist as SQL NULL.");
        await transaction.RollbackAsync();
        Console.WriteLine("PASS: blank/missing media persists as SQL NULL for all four collections; verification rows rolled back.");
    }
}
