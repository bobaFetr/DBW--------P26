using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class Concerts
{
    [Key]
    public int ConcertId {get; set;}
    public DateTime Date {get; set;}
    public string  Location {get; set;} = string.Empty;
    public TimeOnly Time {get; set;}
    public int NumberOfSongs {get; set;}

    public int SongsPerformed {get; set;}

    public int SongId {get; set;}
}
