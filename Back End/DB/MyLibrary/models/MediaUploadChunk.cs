using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class MediaUploadChunk
{
    [Key]
    public Guid Id { get; set; }

    public Guid MediaUploadId { get; set; }

    public int Sequence { get; set; }

    [Required]
    public byte[] Data { get; set; } = [];

    public MediaUpload? MediaUpload { get; set; }
}
