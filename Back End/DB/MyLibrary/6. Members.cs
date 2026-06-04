using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class Members
{
    [Key]
    public int Id {get; set;}
    [Required]
    public string Name {get; set;} = string.Empty;
    [Required]
    public string Instrument {get; set;} = string.Empty;
    [Required]
    public string PhotoUrl {get; set;} = string.Empty;
}