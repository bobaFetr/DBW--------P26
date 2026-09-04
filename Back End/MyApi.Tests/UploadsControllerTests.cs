using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MyApi.Controllers;
using MyLibrary;

namespace MyApi.Tests;

public sealed class UploadsControllerTests : IDisposable
{
    private readonly AppDbContext dbContext = TestDb.Create();
    private readonly UploadsController controller;

    public UploadsControllerTests()
    {
        controller = new UploadsController(dbContext);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
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
    public async Task UploadImage_AcceptsValidPngAndReturnsDataUrl()
    {
        var file = CreateFormFile(CreatePngHeader(width: 2, height: 3), "photo.png", "image/png");

        var response = await controller.UploadImage(file);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var upload = Assert.IsType<ImageUploadResponse>(ok.Value);
        Assert.Equal($"data:image/png;base64,{Convert.ToBase64String(CreatePngHeader(width: 2, height: 3))}", upload.Url);
    }

    [Fact]
    public async Task UploadVideo_RejectsExtensionContentTypeMismatch()
    {
        var file = CreateFormFile(CreateMp4Header(), "clip.mp4", "video/webm");

        var response = await controller.UploadVideo(file);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal("Only MP4, WEBM, and MOV video files are allowed.", badRequest.Value);
    }

    [Fact]
    public async Task UploadVideo_RejectsFakeVideoBytes()
    {
        var file = CreateFormFile([1, 2, 3, 4], "clip.mp4", "video/mp4");

        var response = await controller.UploadVideo(file);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Equal("The uploaded file content does not match a supported video format.", badRequest.Value);
    }

    [Fact]
    public async Task UploadVideo_AcceptsValidMp4StoresInDatabaseAndReturnsMediaUrl()
    {
        var file = CreateFormFile(CreateMp4Header(), "clip.mp4", "video/mp4");

        var response = await controller.UploadVideo(file);

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var upload = Assert.IsType<MediaUploadResponse>(ok.Value);
        Assert.StartsWith("/api/uploads/videos/", upload.Url);
        Assert.Equal("video/mp4", upload.MediaType);
        Assert.Equal("video", upload.Kind);

        var saved = Assert.Single(dbContext.MediaUploads);
        Assert.Equal("clip.mp4", saved.FileName);
        Assert.Equal("video/mp4", saved.ContentType);
        Assert.Equal("video", saved.Kind);
        Assert.Empty(saved.Data);
        Assert.EndsWith(saved.Id.ToString(), upload.Url);

        var chunk = Assert.Single(dbContext.MediaUploadChunks);
        Assert.Equal(saved.Id, chunk.MediaUploadId);
        Assert.Equal(0, chunk.Sequence);
        Assert.Equal(CreateMp4Header(), chunk.Data);
    }

    [Fact]
    public async Task UploadVideo_SplitsLargeVideoIntoOrderedChunks()
    {
        var bytes = CreateMp4LikeBytes(600_000);
        var file = CreateFormFile(bytes, "clip.mp4", "video/mp4");

        var response = await controller.UploadVideo(file);

        Assert.IsType<OkObjectResult>(response.Result);
        var saved = Assert.Single(dbContext.MediaUploads);
        var chunks = dbContext.MediaUploadChunks
            .Where(chunk => chunk.MediaUploadId == saved.Id)
            .OrderBy(chunk => chunk.Sequence)
            .Select(chunk => chunk.Data)
            .ToList();
        Assert.Equal(2, chunks.Count);

        var streamed = await controller.GetVideo(saved.Id, CancellationToken.None);
        var fileResult = Assert.IsType<FileContentResult>(streamed);
        Assert.Equal(bytes, fileResult.FileContents);
    }

    [Fact]
    public async Task GetVideo_ReturnsChunkedVideoFromDatabase()
    {
        var upload = new MediaUpload
        {
            Id = Guid.NewGuid(),
            FileName = "clip.mp4",
            ContentType = "video/mp4",
            Kind = "video",
            Length = CreateMp4Header().Length,
            Data = [],
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.MediaUploads.Add(upload);
        dbContext.MediaUploadChunks.Add(new MediaUploadChunk
        {
            Id = Guid.NewGuid(),
            MediaUploadId = upload.Id,
            Sequence = 0,
            Data = CreateMp4Header()
        });
        await dbContext.SaveChangesAsync();

        var response = await controller.GetVideo(upload.Id, CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(response);
        Assert.Equal("video/mp4", file.ContentType);
        Assert.True(file.EnableRangeProcessing);
        Assert.Equal(CreateMp4Header(), file.FileContents);
    }

    public void Dispose()
    {
        dbContext.Dispose();
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

    private static byte[] CreateMp4Header()
    {
        return
        [
            0x00, 0x00, 0x00, 0x18,
            0x66, 0x74, 0x79, 0x70,
            0x69, 0x73, 0x6F, 0x6D,
            0x00, 0x00, 0x02, 0x00
        ];
    }

    private static byte[] CreateMp4LikeBytes(int length)
    {
        var bytes = new byte[length];
        var header = CreateMp4Header();
        Buffer.BlockCopy(header, 0, bytes, 0, header.Length);
        for (var index = header.Length; index < bytes.Length; index++)
        {
            bytes[index] = (byte)(index % 251);
        }

        return bytes;
    }

    private static void WriteBigEndianInt32(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)(value >> 24);
        bytes[offset + 1] = (byte)(value >> 16);
        bytes[offset + 2] = (byte)(value >> 8);
        bytes[offset + 3] = (byte)value;
    }

}
