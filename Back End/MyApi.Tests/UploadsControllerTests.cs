using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using MyApi.Controllers;

namespace MyApi.Tests;

public sealed class UploadsControllerTests : IDisposable
{
    private readonly string rootPath = Path.Combine(Path.GetTempPath(), $"uploads-tests-{Guid.NewGuid():N}");
    private readonly UploadsController controller;

    public UploadsControllerTests()
    {
        Directory.CreateDirectory(rootPath);
        controller = new UploadsController(new TestWebHostEnvironment(rootPath));
    }

    [Fact]
    public async Task UploadImage_RejectsMissingFile()
    {
        var response = await controller.UploadImage(null);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal("An image file is required.", badRequest.Value);
    }

    [Fact]
    public async Task UploadImage_RejectsExtensionContentTypeMismatch()
    {
        var file = CreateFormFile([1, 2, 3], "photo.png", "image/jpeg");

        var response = await controller.UploadImage(file);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal("Only JPG, PNG, WEBP, and GIF image files are allowed.", badRequest.Value);
    }

    [Fact]
    public async Task UploadImage_RejectsFakeImageBytes()
    {
        var file = CreateFormFile([1, 2, 3, 4], "photo.png", "image/png");

        var response = await controller.UploadImage(file);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal("The uploaded file content does not match a supported image format.", badRequest.Value);
    }

    [Fact]
    public async Task UploadImage_AcceptsValidPngAndStoresItUnderUploads()
    {
        var file = CreateFormFile(CreatePngHeader(width: 2, height: 3), "photo.png", "image/png");

        var response = await controller.UploadImage(file);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var upload = Assert.IsType<ImageUploadResponse>(ok.Value);
        Assert.StartsWith("/uploads/images/", upload.Url);
        Assert.EndsWith(".png", upload.Url);

        var storedPath = Path.Combine(
            rootPath,
            "wwwroot",
            upload.Url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        Assert.True(File.Exists(storedPath));
    }

    [Fact]
    public async Task UploadImage_RejectsOversizedDimensions()
    {
        var file = CreateFormFile(CreatePngHeader(width: 8001, height: 1), "huge.png", "image/png");

        var response = await controller.UploadImage(file);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal(
            "The uploaded image cannot exceed 8000px per side or 25000000 total pixels.",
            badRequest.Value);
    }

    public void Dispose()
    {
        if (Directory.Exists(rootPath))
        {
            Directory.Delete(rootPath, recursive: true);
        }
    }

    private static FormFile CreateFormFile(byte[] bytes, string fileName, string contentType)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static byte[] CreatePngHeader(int width, int height)
    {
        var bytes = new byte[24];
        bytes[0] = 0x89;
        bytes[1] = 0x50;
        bytes[2] = 0x4E;
        bytes[3] = 0x47;
        bytes[4] = 0x0D;
        bytes[5] = 0x0A;
        bytes[6] = 0x1A;
        bytes[7] = 0x0A;
        WriteBigEndianInt32(bytes, 16, width);
        WriteBigEndianInt32(bytes, 20, height);
        return bytes;
    }

    private static void WriteBigEndianInt32(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)(value >> 24);
        bytes[offset + 1] = (byte)(value >> 16);
        bytes[offset + 2] = (byte)(value >> 8);
        bytes[offset + 3] = (byte)value;
    }

    private sealed class TestWebHostEnvironment(string contentRootPath) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "MyApi.Tests";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = contentRootPath;
        public string EnvironmentName { get; set; } = "Development";
        public string WebRootPath { get; set; } = Path.Combine(contentRootPath, "wwwroot");
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
}
