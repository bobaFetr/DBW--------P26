using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public enum AdminKind
{
    ContentAdmin = 1,
    SuperAdmin = 2
}

public class AdminProfile
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public ApplicationUser User { get; set; } = null!;

    [Required]
    public string AdminCode { get; set; } = string.Empty;
    // Example: CADM-000001 or SADM-000001

    [Required]
    public AdminKind AdminKind { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime ApprovedAtUtc { get; set; } = DateTime.UtcNow;

    public string? ApprovedByUserId { get; set; }

    public DateTime? DisabledAtUtc { get; set; }

    public string? DisabledByUserId { get; set; }
}