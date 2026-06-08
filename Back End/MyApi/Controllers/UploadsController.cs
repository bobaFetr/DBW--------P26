using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MyApi.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize(Roles = "SuperAdmin,ContentAdmin")]
public class UploadsController(IWebHostEnvironment environment) : ControllerBase
{
    private static readonly Dictionary<string, string[]> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = ["image/jpeg"],
        [".jpeg"] = ["image/jpeg"],
        [".png"] = ["image/png"],
        [".webp"] = ["image/webp"],
        [".gif"] = ["image/gif"]
    };

    [HttpPost("images")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ImageUploadResponse>> UploadImage(IFormFile file)
    {
        if (file.Length == 0)
        {
            return BadRequest("The uploaded file is empty.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedContentTypes.TryGetValue(extension, out var allowedContentTypes) ||
            !allowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest("Only JPG, PNG, WEBP, and GIF image files are allowed.");
        }

        await using var input = file.OpenReadStream();
        if (!await HasValidImageSignatureAsync(input, extension))
        {
            return BadRequest("The uploaded file content does not match a supported image format.");
        }

        var uploadRoot = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "images");
        Directory.CreateDirectory(uploadRoot);

        var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(uploadRoot, fileName);

        input.Position = 0;
        await using (var stream = System.IO.File.Create(filePath))
        {
            await input.CopyToAsync(stream);
        }

        var url = $"{Request.Scheme}://{Request.Host}/uploads/images/{fileName}";
        return Ok(new ImageUploadResponse(url));
    }

    private static async Task<bool> HasValidImageSignatureAsync(Stream stream, string extension)
    {
        var header = new byte[12];
        var bytesRead = await stream.ReadAsync(header);

        return extension.ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => bytesRead >= 3 &&
                header[0] == 0xFF &&
                header[1] == 0xD8 &&
                header[2] == 0xFF,
            ".png" => bytesRead >= 8 &&
                header[0] == 0x89 &&
                header[1] == 0x50 &&
                header[2] == 0x4E &&
                header[3] == 0x47 &&
                header[4] == 0x0D &&
                header[5] == 0x0A &&
                header[6] == 0x1A &&
                header[7] == 0x0A,
            ".gif" => bytesRead >= 6 &&
                header[0] == 0x47 &&
                header[1] == 0x49 &&
                header[2] == 0x46 &&
                header[3] == 0x38 &&
                (header[4] == 0x37 || header[4] == 0x39) &&
                header[5] == 0x61,
            ".webp" => bytesRead >= 12 &&
                header[0] == 0x52 &&
                header[1] == 0x49 &&
                header[2] == 0x46 &&
                header[3] == 0x46 &&
                header[8] == 0x57 &&
                header[9] == 0x45 &&
                header[10] == 0x42 &&
                header[11] == 0x50,
            _ => false
        };
    }
}

public record ImageUploadResponse(string Url);
