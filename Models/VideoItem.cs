using System;
using System.Text.Json.Serialization;

namespace MediaPlayer.Models
{
    // Represents a single video record from our Supabase 'videos' table 
    public class VideoItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("file_name")]
        public string FileName { get; set; } = string.Empty;

        [JsonPropertyName("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [JsonPropertyName("duration")]
        public string Duration { get; set; } = "0:00";

        [JsonPropertyName("created_at")]
        public DateTime? CreatedAt { get; set; } = DateTime.Now;
    }
}