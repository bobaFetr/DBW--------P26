namespace MyLibrary;

public class ConcertSong
{
    public int ConcertId { get; set; }

    public Concerts Concert { get; set; } = null!;

    public int SongId { get; set; }

    public Singles Song { get; set; } = null!;

    public int DisplayOrder { get; set; }
}
