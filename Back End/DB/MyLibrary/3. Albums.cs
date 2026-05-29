using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class Albums
{
    [Key]
    public int AlbumId {get; set;}
    public DateTime ReleaseDate {get; set;}
    public string Title {get; set;} = string.Empty;
    
    public int NumberOfSongs {get; set;}
    public int ArtistId {get; set;}
    public int SongId {get; set;}
}