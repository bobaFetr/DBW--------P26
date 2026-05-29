using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;
namespace MyLibrary;
public class Singles
{
    [Key]
    public int SongId {get; set;}
    public string SongName {get; set;} = string.Empty;

    public DateTime ReleaseDate {get; set;}
    public string AvaibleonYotube {get; set;} = string.Empty;

    public string AvaibleonSpotify {get; set;} = string.Empty;

    public int AlbumId {get; set;}
}