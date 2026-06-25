using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class Singles
{
    [Key]
    public int SongId { get; set; }

    [Required]
    public string SongName { get; set; } = string.Empty;

    public DateTime? ReleaseDate { get; set; }

    public string? AvailableOnYoutube { get; set; }

    public string? AvailableOnSpotify { get; set; }

    public string? PhotoUrl { get; set; }

    public string? Description { get; set; }

    public int? AlbumId { get; set; }

    public Albums? Album { get; set; }

    public ICollection<ConcertSong> ConcertSongs { get; set; } = new List<ConcertSong>();
}
