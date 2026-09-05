using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public enum ContentChangeStatus
{
    Pending = 1,
    Approved = 2,
    Denied = 3,
    Cancelled = 4
}

public enum ContentChangeAction
{
    Create = 1,
    Update = 2,
    Delete = 3
}

public class ContentChangeRequest
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public string ChangeCode { get; set; } = string.Empty;
    // Example: CHG-000001

    [Required]
    public string RequestedByUserId { get; set; } = string.Empty;

    public ApplicationUser RequestedByUser { get; set; } = null!;

    [Required]
    public string ContentType { get; set; } = string.Empty;
    // Example: News, Albums, Singles, Concerts, Members, Gallery, TimeLine

    public string? TargetEntityId { get; set; }

    public string? TargetVersion { get; set; }

    [Required]
    public ContentChangeAction Action { get; set; } = ContentChangeAction.Create;

    [Required]
    public ContentChangeStatus Status { get; set; } = ContentChangeStatus.Pending;

    [Required]
    public string PayloadJson { get; set; } = string.Empty;

    public string? Message { get; set; }

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    public string? ReviewedBySuperAdminId { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }

    public string? ReviewNote { get; set; }
}
