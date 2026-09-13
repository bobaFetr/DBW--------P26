using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class News
{
    [Key]
    public int NewsId {get; set;}
    [Required]
    public string Title {get; set;} = string.Empty;
    private string content = string.Empty;
    // Keep the existing non-null database column while accepting an omitted body.
    [Required(AllowEmptyStrings = true)]
    [System.Diagnostics.CodeAnalysis.AllowNull]
    public string Content { get => content; set => content = value ?? string.Empty; }
    [Required]
    public DateTime PublicationDate {get; set;}
    [Required]
    public string Author {get; set;} = string.Empty;
}
