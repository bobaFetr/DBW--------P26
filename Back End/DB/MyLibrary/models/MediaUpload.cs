using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class MediaUpload
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public string FileName { get; set; } = string.Empty;

    [Required]
    public string ContentType { get; set; } = string.Empty;

    [Required]
    public string Kind { get; set; } = string.Empty;

    public long Length { get; set; }

    [Required]
    public byte[] Data { get; set; } = [];

    public DateTime CreatedAtUtc { get; set; }
}
