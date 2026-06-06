using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class Albums
{
    [Key]
    public int AlbumId { get; set; }

    public DateTime? ReleaseDate { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    public int NumberOfSongs { get; set; }

    public ICollection<Singles> Singles { get; set; } = new List<Singles>();
}