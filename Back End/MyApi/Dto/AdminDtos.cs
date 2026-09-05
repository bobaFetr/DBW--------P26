using System.ComponentModel.DataAnnotations;
using MyLibrary;

namespace MyApi.Dto;

public record CreateAdminRequestDto([StringLength(1000)] string? Message);

public record ReviewRequestDto([StringLength(1000)] string? ReviewNote);

public record KickContentAdminRequest([Required, StringLength(128)] string? Password);

public record AdminRequestResponse(
    Guid Id,
    string RequestCode,
    string UserId,
    string? UserName,
    string? Email,
    string? DisplayName,
    AdminRequestStatus Status,
    string? Message,
    DateTime RequestedAtUtc,
    string? ReviewedBySuperAdminId,
    DateTime? ReviewedAtUtc,
    string? ReviewNote);

public record ContentAdminResponse(
    string UserId,
    string? UserName,
    string? Email,
    string? DisplayName,
    string AdminCode,
    bool IsActive,
    DateTime ApprovedAtUtc);
