using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyLibrary;

namespace MyApi.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize(Roles = "SuperAdmin,ContentAdmin")]
public class UploadsController(AppDbContext dbContext) : ControllerBase
{
    private const long MaxImageBytes = 25 * 1024 * 1024;
    private const long MaxUploadRequestBytes = 30 * 1024 * 1024;
    private const long MaxVideoBytes = 100 * 1024 * 1024;
    private const long MaxVideoUploadRequestBytes = 105 * 1024 * 1024;

    private static readonly Dictionary<string, string[]> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = ["image/jpeg"],
        [".jpeg"] = ["image/jpeg"],
        [".png"] = ["image/png"],
        [".webp"] = ["image/webp"],
        [".gif"] = ["image/gif"]
    };

    private static readonly Dictionary<string, string[]> AllowedVideoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp4"] = ["video/mp4"],
        [".webm"] = ["video/webm"],
        [".mov"] = ["video/quicktime"]
    };

    [HttpPost("images")]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting("UploadSensitive")]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    public async Task<ActionResult<ImageUploadResponse>> UploadImage([FromForm] IFormFile? file)
    {
        if (file is null)
        {
            return BadRequest("An image file is required.");
        }

        if (file.Length == 0)
        {
            return BadRequest("The uploaded file is empty.");
        }

        if (file.Length > MaxImageBytes)
        {
            return BadRequest("The uploaded image cannot exceed 25 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageContentTypes.TryGetValue(extension, out var allowedContentTypes) ||
            !allowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest("Only JPG, PNG, WEBP, and GIF image files are allowed.");
        }

        await using var input = file.OpenReadStream();
        await using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer);
        var bytes = buffer.ToArray();

        if (!TryValidateImage(bytes, extension, out var validationError))
        {
            return BadRequest(validationError);
        }

        var dataUrl = $"data:{GetImageMediaType(extension)};base64,{Convert.ToBase64String(bytes)}";
        return Ok(new ImageUploadResponse(dataUrl));
    }

    [HttpPost("videos")]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting("UploadSensitive")]
    [RequestSizeLimit(MaxVideoUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxVideoUploadRequestBytes)]
    public async Task<ActionResult<MediaUploadResponse>> UploadVideo([FromForm] IFormFile? file)
    {
        if (file is null)
        {
            return BadRequest("A video file is required.");
        }

        if (file.Length == 0)
        {
            return BadRequest("The uploaded file is empty.");
        }

        if (file.Length > MaxVideoBytes)
        {
            return BadRequest("The uploaded video cannot exceed 100 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedVideoContentTypes.TryGetValue(extension, out var allowedContentTypes) ||
            !allowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest("Only MP4, WEBM, and MOV video files are allowed.");
        }

        var header = new byte[(int)Math.Min(file.Length, 64)];
        await using (var headerStream = file.OpenReadStream())
        {
            var bytesRead = await headerStream.ReadAsync(header.AsMemory(0, header.Length));
            if (!TryValidateVideo(header.AsSpan(0, bytesRead), extension, out var validationError))
            {
                return BadRequest(validationError);
            }
        }

        await using var input = file.OpenReadStream();
        await using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer);
        var bytes = buffer.ToArray();

        if (!TryValidateVideo(bytes.AsSpan(0, Math.Min(bytes.Length, 64)), extension, out var fullContentValidationError))
        {
            return BadRequest(fullContentValidationError);
        }

        var mediaType = GetVideoMediaType(extension);
        var upload = new MediaUpload
        {
            Id = Guid.NewGuid(),
            FileName = Path.GetFileName(file.FileName),
            ContentType = mediaType,
            Kind = "video",
            Length = bytes.Length,
            Data = bytes,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.MediaUploads.Add(upload);
        await dbContext.SaveChangesAsync();

        return Ok(new MediaUploadResponse($"/api/uploads/videos/{upload.Id}", mediaType, "video"));
    }

    [HttpGet("videos/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetVideo(Guid id, CancellationToken cancellationToken)
    {
        var upload = await dbContext.MediaUploads
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Id == id && item.Kind == "video",
                cancellationToken);

        if (upload is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(upload.Data, upload.ContentType, enableRangeProcessing: true);
    }

    private static string GetImageMediaType(string extension)
    {
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "application/octet-stream"
        };
    }

    private static string GetVideoMediaType(string extension)
    {
        return extension switch
        {
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".mov" => "video/quicktime",
            _ => "application/octet-stream"
        };
    }

    private static bool TryValidateImage(byte[] bytes, string extension, out string error)
    {
        error = "The uploaded file content does not match a supported image format.";

        if (!TryReadDimensions(bytes, extension, out var width, out var height))
        {
            return false;
        }

        if (width <= 0 || height <= 0)
        {
            error = "The uploaded image dimensions are invalid.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool TryValidateVideo(ReadOnlySpan<byte> bytes, string extension, out string error)
    {
        error = "The uploaded file content does not match a supported video format.";

        var isValid = extension switch
        {
            ".mp4" or ".mov" => HasIsoBaseMediaFileSignature(bytes),
            ".webm" => HasWebmSignature(bytes),
            _ => false
        };

        if (!isValid)
        {
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool HasIsoBaseMediaFileSignature(ReadOnlySpan<byte> bytes)
    {
        return bytes.Length >= 12 &&
            bytes[4] == 0x66 &&
            bytes[5] == 0x74 &&
            bytes[6] == 0x79 &&
            bytes[7] == 0x70;
    }

    private static bool HasWebmSignature(ReadOnlySpan<byte> bytes)
    {
        return bytes.Length >= 4 &&
            bytes[0] == 0x1A &&
            bytes[1] == 0x45 &&
            bytes[2] == 0xDF &&
            bytes[3] == 0xA3;
    }

    private static bool TryReadDimensions(byte[] bytes, string extension, out int width, out int height)
    {
        width = 0;
        height = 0;

        return extension switch
        {
            ".jpg" or ".jpeg" => TryReadJpegDimensions(bytes, out width, out height),
            ".png" => TryReadPngDimensions(bytes, out width, out height),
            ".gif" => TryReadGifDimensions(bytes, out width, out height),
            ".webp" => TryReadWebpDimensions(bytes, out width, out height),
            _ => false
        };
    }

    private static bool TryReadPngDimensions(byte[] bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (bytes.Length < 24 ||
            bytes[0] != 0x89 ||
            bytes[1] != 0x50 ||
            bytes[2] != 0x4E ||
            bytes[3] != 0x47 ||
            bytes[4] != 0x0D ||
            bytes[5] != 0x0A ||
            bytes[6] != 0x1A ||
            bytes[7] != 0x0A)
        {
            return false;
        }

        width = ReadBigEndianInt32(bytes, 16);
        height = ReadBigEndianInt32(bytes, 20);
        return true;
    }

    private static bool TryReadGifDimensions(byte[] bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (bytes.Length < 10 ||
            bytes[0] != 0x47 ||
            bytes[1] != 0x49 ||
            bytes[2] != 0x46 ||
            bytes[3] != 0x38 ||
            (bytes[4] != 0x37 && bytes[4] != 0x39) ||
            bytes[5] != 0x61)
        {
            return false;
        }

        width = ReadLittleEndianUInt16(bytes, 6);
        height = ReadLittleEndianUInt16(bytes, 8);
        return true;
    }

    private static bool TryReadJpegDimensions(byte[] bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8)
        {
            return false;
        }

        var offset = 2;
        while (offset + 3 < bytes.Length)
        {
            if (bytes[offset] != 0xFF)
            {
                offset++;
                continue;
            }

            while (offset < bytes.Length && bytes[offset] == 0xFF)
            {
                offset++;
            }

            if (offset >= bytes.Length)
            {
                return false;
            }

            var marker = bytes[offset++];
            if (marker is 0xD8 or 0xD9)
            {
                continue;
            }

            if (marker == 0xDA || offset + 1 >= bytes.Length)
            {
                return false;
            }

            var segmentLength = ReadBigEndianUInt16(bytes, offset);
            if (segmentLength < 2 || offset + segmentLength > bytes.Length)
            {
                return false;
            }

            if (IsJpegStartOfFrame(marker) && segmentLength >= 7)
            {
                height = ReadBigEndianUInt16(bytes, offset + 3);
                width = ReadBigEndianUInt16(bytes, offset + 5);
                return true;
            }

            offset += segmentLength;
        }

        return false;
    }

    private static bool TryReadWebpDimensions(byte[] bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (bytes.Length < 30 ||
            bytes[0] != 0x52 ||
            bytes[1] != 0x49 ||
            bytes[2] != 0x46 ||
            bytes[3] != 0x46 ||
            bytes[8] != 0x57 ||
            bytes[9] != 0x45 ||
            bytes[10] != 0x42 ||
            bytes[11] != 0x50)
        {
            return false;
        }

        var chunk = System.Text.Encoding.ASCII.GetString(bytes, 12, 4);
        switch (chunk)
        {
            case "VP8X":
                width = 1 + ReadLittleEndianUInt24(bytes, 24);
                height = 1 + ReadLittleEndianUInt24(bytes, 27);
                return true;
            case "VP8 ":
                if (bytes[23] != 0x9D || bytes[24] != 0x01 || bytes[25] != 0x2A)
                {
                    return false;
                }

                width = ReadLittleEndianUInt16(bytes, 26) & 0x3FFF;
                height = ReadLittleEndianUInt16(bytes, 28) & 0x3FFF;
                return true;
            case "VP8L":
                if (bytes.Length < 25 || bytes[20] != 0x2F)
                {
                    return false;
                }

                width = 1 + (((bytes[22] & 0x3F) << 8) | bytes[21]);
                height = 1 + (((bytes[24] & 0x0F) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xC0) >> 6));
                return true;
            default:
                return false;
        }
    }

    private static bool IsJpegStartOfFrame(byte marker)
    {
        return marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or
            0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF;
    }

    private static int ReadBigEndianInt32(byte[] bytes, int offset)
    {
        return (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
    }

    private static int ReadBigEndianUInt16(byte[] bytes, int offset)
    {
        return (bytes[offset] << 8) | bytes[offset + 1];
    }

    private static int ReadLittleEndianUInt16(byte[] bytes, int offset)
    {
        return bytes[offset] | (bytes[offset + 1] << 8);
    }

    private static int ReadLittleEndianUInt24(byte[] bytes, int offset)
    {
        return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    }
}

public record ImageUploadResponse(string Url);
public record MediaUploadResponse(string Url, string MediaType, string Kind);
