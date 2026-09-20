using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using MediaPlayer.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace MediaPlayer.Services
{
    // Implementation of IVideoService 
    // Connects to Supabase REST API, with local folder fallback
    public class VideoService : IVideoService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        private readonly string[] _supportedVideoExtensions = { ".mp4", ".webm", ".ogg", ".mov" };

        // Constructor injection (just like in Practical 9.1)
        public VideoService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _environment = environment;
        }

        // 1. Fetch all videos from Supabase
        public async Task<List<VideoItem>> GetAllVideosAsync()
        {
            var supabaseUrl = _configuration["Supabase:Url"];
            var supabaseKey = _configuration["Supabase:AnonKey"];

            // Check if user has entered their Supabase credentials
            if (!string.IsNullOrWhiteSpace(supabaseUrl) && 
                !string.IsNullOrWhiteSpace(supabaseKey) && 
                !supabaseUrl.Contains("YOUR-PROJECT-ID"))
            {
                try
                {
                    var client = _httpClientFactory.CreateClient();
                    var requestUrl = $"{supabaseUrl.TrimEnd('/')}/rest/v1/videos?select=*";

                    var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
                    request.Headers.Add("apikey", supabaseKey);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", supabaseKey);

                    var response = await client.SendAsync(request);

                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync();
                        var videos = JsonSerializer.Deserialize<List<VideoItem>>(json, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (videos != null && videos.Count > 0)
                        {
                            return videos;
                        }
                    }
                }
                catch
                {
                    // If network fails, gracefully drop down to local fallback
                }
            }

            // Fallback: Read videos directly from local folder wwwroot/media/video
            return GetLocalVideos();
        }

        // 2. Find a specific video by ID
        public async Task<VideoItem?> GetVideoByIdAsync(string id)
        {
            var videos = await GetAllVideosAsync();
            return videos.FirstOrDefault(v => v.Id == id);
        }

        // 3. Search videos by keyword in title or filename
        public async Task<List<VideoItem>> SearchVideosAsync(string query)
        {
            var videos = await GetAllVideosAsync();

            if (string.IsNullOrWhiteSpace(query))
            {
                return videos;
            }

            query = query.Trim();

            return videos.Where(v =>
                v.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                v.FileName.Contains(query, StringComparison.OrdinalIgnoreCase)
            ).ToList();
        }

        // Helper method: Reads local video files if database is unreachable
        private List<VideoItem> GetLocalVideos()
        {
            var list = new List<VideoItem>();
            var videoDir = Path.Combine(_environment.WebRootPath, "media", "video");

            if (!Directory.Exists(videoDir))
            {
                return list;
            }

            var files = Directory.GetFiles(videoDir, "*.*", SearchOption.AllDirectories);

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                if (!_supportedVideoExtensions.Contains(ext))
                {
                    continue;
                }

                var fileName = Path.GetFileName(file);
                var title = Path.GetFileNameWithoutExtension(file);

                var relativePath = Path.GetRelativePath(_environment.WebRootPath, file)
                    .Replace("\\", "/");

                // Create a clean URL-safe ID for local file
                var id = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(relativePath))
                    .Replace("+", "-")
                    .Replace("/", "_")
                    .TrimEnd('=');

                list.Add(new VideoItem
                {
                    Id = id,
                    Title = title,
                    FileName = fileName,
                    FilePath = "/" + relativePath,
                    Duration = "0:30",
                    CreatedAt = File.GetCreationTime(file)
                });
            }

            return list;
        }
    }
}