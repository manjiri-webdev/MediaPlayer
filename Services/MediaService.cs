using MediaPlayer.Models;

namespace MediaPlayer.Services
{
    public class MediaService : IMediaService
    {
        private readonly IWebHostEnvironment _environment;

        private readonly string[] _audioExtensions =
        {
            ".mp3", ".wav", ".m4a"
        };

        private readonly string[] _videoExtensions =
        {
            ".mp4", ".webm", ".ogg", ".mov"
        };

        public MediaService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public List<MediaFile> GetAllMedia()
        {
            return GetFiles().ToList();
        }

        public List<MediaFile> GetAudioFiles()
        {
            return GetFiles()
                .Where(x => x.MediaType == "Audio")
                .ToList();
        }

        public List<MediaFile> GetVideoFiles()
        {
            return GetFiles()
                .Where(x => x.MediaType == "Video")
                .ToList();
        }

        public MediaFile? GetMediaById(string id)
        {
            return GetFiles()
                .FirstOrDefault(x => x.Id == id);
        }

        public List<MediaFile> SearchMedia(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return GetAllMedia();

            query = query.Trim();

            return GetFiles()
                .Where(x =>
                    x.Title.Contains(
                        query,
                        StringComparison.OrdinalIgnoreCase
                    )
                    ||
                    x.FileName.Contains(
                        query,
                        StringComparison.OrdinalIgnoreCase
                    )
                    ||
                    x.MediaType.Contains(
                        query,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                .ToList();
        }

        private IEnumerable<MediaFile> GetFiles()
        {
            var mediaRoot = Path.Combine(
                _environment.WebRootPath,
                "media"
            );

            if (!Directory.Exists(mediaRoot))
                yield break;

            foreach (var file in Directory.GetFiles(
                mediaRoot,
                "*.*",
                SearchOption.AllDirectories))
            {
                var extension =
                    Path.GetExtension(file).ToLowerInvariant();

                string? mediaType = null;

                if (_audioExtensions.Contains(extension))
                {
                    mediaType = "Audio";
                }
                else if (_videoExtensions.Contains(extension))
                {
                    mediaType = "Video";
                }

                if (mediaType == null)
                    continue;

                var relativePath = Path.GetRelativePath(
                    _environment.WebRootPath,
                    file
                ).Replace("\\", "/");

                var id = Convert.ToBase64String(
                    System.Text.Encoding.UTF8.GetBytes(relativePath)
                )
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');

                yield return new MediaFile
                {
                    Id = id,
                    FileName = Path.GetFileName(file),
                    Title = Path.GetFileNameWithoutExtension(file),
                    MediaType = mediaType,
                    FilePath = "/" + relativePath,
                    Extension = extension
                };
            }
        }
    }
}