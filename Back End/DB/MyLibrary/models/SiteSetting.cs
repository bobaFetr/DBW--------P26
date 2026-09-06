using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class SiteSetting
{
    [Key]
    [MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    public bool BooleanValue { get; set; }
}
