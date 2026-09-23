using System.Text.Json.Serialization;

namespace MediaPlayer.Models;

public class PlaylistRecord
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("client_id")] public string ClientId { get; set; } = "";
    [JsonPropertyName("created_at")] public DateTime? CreatedAt { get; set; }
}

public class PlaylistItemRecord
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("playlist_id")] public string PlaylistId { get; set; } = "";
    [JsonPropertyName("media_id")] public string MediaId { get; set; } = "";
    [JsonPropertyName("media_type")] public string MediaType { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("stream_url")] public string StreamUrl { get; set; } = "";
    [JsonPropertyName("added_at")] public DateTime? AddedAt { get; set; }
}

public class FavoriteRecord
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("media_id")] public string MediaId { get; set; } = "";
    [JsonPropertyName("media_type")] public string MediaType { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("stream_url")] public string StreamUrl { get; set; } = "";
    [JsonPropertyName("created_at")] public DateTime? CreatedAt { get; set; }
}

public class RecentlyPlayedRecord
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("media_id")] public string MediaId { get; set; } = "";
    [JsonPropertyName("media_type")] public string MediaType { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("stream_url")] public string StreamUrl { get; set; } = "";
    [JsonPropertyName("played_at")] public DateTime? PlayedAt { get; set; }
}

public record CreatePlaylistRequest(string Name, string ClientId);
public record MediaActionRequest(string ClientId, string MediaId, string MediaType, string Title, string StreamUrl);
public record AddPlaylistItemRequest(string ClientId, string MediaId, string MediaType, string Title, string StreamUrl);
