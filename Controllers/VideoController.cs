using System.IO;
using System.Threading.Tasks;
using MediaPlayer.Models;
using MediaPlayer.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace MediaPlayer.Controllers
{
    // Controller for Video operations 
    [ApiController]
    [Route("api/[controller]")]
    public class VideoController : ControllerBase
    {
        private readonly IVideoService _videoService;
        private readonly IWebHostEnvironment _environment;

        // Constructor Injection 
        public VideoController(
            IVideoService videoService,
            IWebHostEnvironment environment)
        {
            _videoService = videoService;
            _environment = environment;
        }

        // 1. GET: /api/video
        // Returns the list of all videos
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var videos = await _videoService.GetAllVideosAsync();
            return Ok(videos);
        }

        // 2. GET: /api/video/{id}
        // Returns details of a specific video
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var video = await _videoService.GetVideoByIdAsync(id);

            if (video == null)
            {
                return NotFound("Video not found.");
            }

            return Ok(video);
        }

        // 3. GET: /api/video/search?q=query
        // Searches videos by title
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return BadRequest("Search query is required.");
            }

            var results = await _videoService.SearchVideosAsync(q);
            return Ok(results);
        }

        // 4. GET: /api/video/play/{id}
        // Streams the video file with seeking capability
        [HttpGet("play/{id}")]
        public async Task<IActionResult> Play(string id)
        {
            var video = await _videoService.GetVideoByIdAsync(id);

            if (video == null)
            {
                return NotFound("Video not found.");
            }

            // If stored as an external URL (e.g. cloud storage)
            if (video.FilePath.StartsWith("http://") || video.FilePath.StartsWith("https://"))
            {
                return Redirect(video.FilePath);
            }

            // Resolve file from local wwwroot folder
            var relativePath = video.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var physicalPath = Path.Combine(_environment.WebRootPath, relativePath);

            if (!System.IO.File.Exists(physicalPath))
            {
                // Backup check by filename in media/video
                var backupPath = Path.Combine(_environment.WebRootPath, "media", "video", video.FileName);
                if (System.IO.File.Exists(backupPath))
                {
                    physicalPath = backupPath;
                }
                else
                {
                    return NotFound($"Video file '{video.FileName}' was not found on server.");
                }
            }

            var extension = Path.GetExtension(physicalPath).ToLowerInvariant();
            var contentType = GetVideoContentType(extension);

            // enableRangeProcessing: true is crucial: it allows seeking on the video progress bar!
            return PhysicalFile(physicalPath, contentType, enableRangeProcessing: true);
        }

        // Helper: Returns correct video MIME type for the browser
        private string GetVideoContentType(string extension)
        {
            return extension switch
            {
                ".mp4" => "video/mp4",
                ".webm" => "video/webm",
                ".ogg" => "video/ogg",
                ".mov" => "video/quicktime",
                _ => "application/octet-stream"
            };
        }
    }
}