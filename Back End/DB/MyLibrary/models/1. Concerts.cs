using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class Concerts
{
    [Key]
    public int ConcertId { get; set; }

    [Required]
    public DateTime Date { get; set; }

    [Required]
    public string Location { get; set; } = string.Empty;

    public TimeOnly? Time { get; set; }

    public int NumberOfSongs { get; set; }

    public ICollection<ConcertSong> ConcertSongs { get; set; } = new List<ConcertSong>();
}
