using System.ComponentModel.DataAnnotations;

namespace MyApi.Dto;

public record RegisterRequest(
    [Required, StringLength(64, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9._-]+$")] string UserName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [StringLength(120)] string? DisplayName);

public record LoginRequest(
    [Required, StringLength(256)] string Email,
    [Required, StringLength(128)] string Password);

public record CurrentUserResponse(
    string Id,
    string? UserName,
    string? Email,
    string? DisplayName,
    IReadOnlyList<string> Roles);
