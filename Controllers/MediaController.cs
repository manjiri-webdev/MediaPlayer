using MediaPlayer.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediaPlayer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MediaController : ControllerBase
    {
        private readonly IMediaService _mediaService;
        private readonly IWebHostEnvironment _environment;

        public MediaController(
            IMediaService mediaService,
            IWebHostEnvironment environment)
        {
            _mediaService = mediaService;
            _environment = environment;
        }

        // GET: /api/media
        [HttpGet]
        public IActionResult GetAll()
        {
            return Ok(_mediaService.GetAllMedia());
        }

        // GET: /api/media/audio
        [HttpGet("audio")]
        public IActionResult GetAudio()
        {
            return Ok(_mediaService.GetAudioFiles());
        }

        // GET: /api/media/video
        [HttpGet("video")]
        public IActionResult GetVideo()
        {
            return Ok(_mediaService.GetVideoFiles());
        }

        // GET: /api/media/search?q=my_song
        [HttpGet("search")]
        public IActionResult Search(string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return BadRequest("Search query is required.");

            return Ok(_mediaService.SearchMedia(q));
        }

        // GET: /api/media/{id}
        [HttpGet("{id}")]
        public IActionResult GetById(string id)
        {
            var media = _mediaService.GetMediaById(id);

            if (media == null)
                return NotFound();

            return Ok(media);
        }

        // GET: /api/media/play/{id}
        [HttpGet("play/{id}")]
        public IActionResult Play(string id)
        {
            var media = _mediaService.GetMediaById(id);

            if (media == null)
                return NotFound();

            var relativePath = media.FilePath.TrimStart('/');

            var filePath = Path.Combine(
                _environment.WebRootPath,
                relativePath.Replace(
                    "/",
                    Path.DirectorySeparatorChar.ToString()
                )
            );

            if (!System.IO.File.Exists(filePath))
                return NotFound("Media file not found.");

            var contentType = media.MediaType == "Audio"
                ? GetAudioContentType(media.Extension)
                : GetVideoContentType(media.Extension);

            return PhysicalFile(
                filePath,
                contentType,
                enableRangeProcessing: true
            );
        }

        private string GetAudioContentType(string extension)
        {
            return extension switch
            {
                ".mp3" => "audio/mpeg",
                ".wav" => "audio/wav",
                ".ogg" => "audio/ogg",
                ".m4a" => "audio/mp4",
                _ => "application/octet-stream"
            };
        }

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