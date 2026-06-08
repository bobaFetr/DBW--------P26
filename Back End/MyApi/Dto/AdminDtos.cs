using MyLibrary;

namespace MyApi.Dto;

public record CreateAdminRequestDto(string? Message);

public record ReviewRequestDto(string? ReviewNote);

public record KickContentAdminRequest(string? Password);

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

public record AdminAuditLogResponse(
    Guid Id,
    string AdminUserId,
    string? PerformedByUserId,
    string Action,
    string? EntityType,
    string? EntityId,
    string? DetailsJson,
    DateTime CreatedAtUtc);
