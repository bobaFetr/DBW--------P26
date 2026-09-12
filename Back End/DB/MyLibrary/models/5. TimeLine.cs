using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class TimeLine
{
    [Key]
    public int Id {get; set;}
    public DateTime Date {get; set;}
    [Required]
    public string Event {get; set;} = string.Empty;
    public string Description {get; set;} = string.Empty;
    public string Location {get; set;} = string.Empty;//optional
}
