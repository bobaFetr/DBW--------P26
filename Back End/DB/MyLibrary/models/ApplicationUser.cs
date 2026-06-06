using Microsoft.AspNetCore.Identity;

namespace MyLibrary;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public bool IsDisabled { get; set; } = false;

    public AdminProfile? AdminProfile { get; set; }

    public ICollection<AdminRequest> AdminRequests { get; set; } = new List<AdminRequest>();

    public ICollection<ContentChangeRequest> ContentChangeRequests { get; set; } =
        new List<ContentChangeRequest>();
}
