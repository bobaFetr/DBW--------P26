using System.ComponentModel.DataAnnotations;
using MyLibrary;

namespace MyApi.Dto;

public record CreateContentChangeRequestDto(
    [Required, StringLength(80)] string ContentType,
    [StringLength(80)] string? TargetEntityId,
    ContentChangeAction Action,
    [Required, StringLength(20000)] string PayloadJson,
    [StringLength(1000)] string? Message);

public record ContentChangeRequestResponse(
    Guid Id,
    string ChangeCode,
    string RequestedByUserId,
    string? RequestedByUserName,
    string ContentType,
    string? TargetEntityId,
    ContentChangeAction Action,
    ContentChangeStatus Status,
    string PayloadJson,
    string? Message,
    DateTime RequestedAtUtc,
    string? ReviewedBySuperAdminId,
    DateTime? ReviewedAtUtc,
    string? ReviewNote);
