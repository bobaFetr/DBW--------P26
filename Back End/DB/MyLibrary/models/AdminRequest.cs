using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public enum AdminRequestStatus
{
    Pending = 1,
    Approved = 2,
    Denied = 3,
    Cancelled = 4
}

public class AdminRequest
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public string RequestCode { get; set; } = string.Empty;
    // Example: AREQ-000001

    [Required]
    public string UserId { get; set; } = string.Empty;

    public ApplicationUser User { get; set; } = null!;

    [Required, ConcurrencyCheck]
    public AdminRequestStatus Status { get; set; } = AdminRequestStatus.Pending;

    public string? Message { get; set; }

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    public string? ReviewedBySuperAdminId { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }

    public string? ReviewNote { get; set; }
}
