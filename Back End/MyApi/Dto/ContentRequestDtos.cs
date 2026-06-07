using System.ComponentModel.DataAnnotations;
using MyLibrary;

namespace MyApi.Dto;

public record CreateContentChangeRequestDto(
    [Required] string ContentType,
    string? TargetEntityId,
    ContentChangeAction Action,
    [Required] string PayloadJson,
    string? Message);

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

