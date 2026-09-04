using System.ComponentModel.DataAnnotations;

namespace MyLibrary;

public class AdminAuditLog
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public string AdminUserId { get; set; } = string.Empty;

    public ApplicationUser AdminUser { get; set; } = null!;

    public string? PerformedByUserId { get; set; }

    [Required]
    public string Action { get; set; } = string.Empty;

    public string? EntityType { get; set; }

    public string? EntityId { get; set; }

    public string? DetailsJson { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
