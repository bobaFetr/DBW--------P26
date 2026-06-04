using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class News
{
    [Key]
    public int NewsId {get; set;}
    [Required]
    public string Title {get; set;} = string.Empty;
    [Required]
    public string Content {get; set;} = string.Empty;
    [Required]
    public DateTime PublicationDate {get; set;}
    [Required]
    public string Author {get; set;} = string.Empty;
}