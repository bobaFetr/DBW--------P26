using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.DependencyInjection;

namespace MyLibrary;

public class Members
{
    [Key]
    public int Id {get; set;}
    public string Name {get; set;} = string.Empty;
    public string Insrtument {get; set;} = string.Empty;
    public string photoUrl {get; set;} = string.Empty;
}