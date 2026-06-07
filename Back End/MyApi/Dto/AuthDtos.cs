using System.ComponentModel.DataAnnotations;

namespace MyApi.Dto;

public record RegisterRequest(
    [Required] string UserName,
    [Required, EmailAddress] string Email,
    [Required] string Password,
    string? DisplayName);

public record LoginRequest(
    [Required] string Email,
    [Required] string Password);

public record CurrentUserResponse(
    string Id,
    string? UserName,
    string? Email,
    string? DisplayName,
    IReadOnlyList<string> Roles);

