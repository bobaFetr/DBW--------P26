using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class News
{
    [Key]
    public int NewsId {get; set;}
    public string Title {get; set;} = string.Empty;
    public string Content {get; set;} = string.Empty;
    public DateTime PublicationDate {get; set;}
    public string Author {get; set;} = string.Empty;
}