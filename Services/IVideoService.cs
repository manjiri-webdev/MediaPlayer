using System.Collections.Generic;
using System.Threading.Tasks;
using MediaPlayer.Models;

namespace MediaPlayer.Services
{
    // Interface for Video operations 
    public interface IVideoService
    {
        // Get all videos
        Task<List<VideoItem>> GetAllVideosAsync();

        // Get single video by its ID
        Task<VideoItem?> GetVideoByIdAsync(string id);

        // Search videos by title or file name
        Task<List<VideoItem>> SearchVideosAsync(string query);
    }
}