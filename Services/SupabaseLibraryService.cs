using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using MediaPlayer.Models;

namespace MediaPlayer.Services;

public class SupabaseLibraryService : ISupabaseLibraryService
{
    private readonly IHttpClientFactory _factory;
    private readonly IConfiguration _configuration;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public SupabaseLibraryService(IHttpClientFactory factory, IConfiguration configuration)
    {
        _factory = factory;
        _configuration = configuration;
    }

    private HttpRequestMessage Request(HttpMethod method, string table, string query = "")
    {
        var url = $"{_configuration["Supabase:Url"]?.TrimEnd('/')}/rest/v1/{table}{query}";
        var key = _configuration["Supabase:AnonKey"] ?? "";
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("apikey", key);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        return request;
    }

    private static void JsonBody(HttpRequestMessage request, object body)
    {
        request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
    }

    private async Task<List<T>> GetListAsync<T>(HttpRequestMessage request)
    {
        var response = await _factory.CreateClient().SendAsync(request);
        if (!response.IsSuccessStatusCode) return [];
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
    }

    public Task<List<PlaylistRecord>> GetPlaylistsAsync(string clientId) =>
        GetListAsync<PlaylistRecord>(Request(HttpMethod.Get, "playlists", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&order=created_at.asc"));

    public async Task<PlaylistRecord?> CreatePlaylistAsync(string clientId, string name)
    {
        using var request = Request(HttpMethod.Post, "playlists", "?select=*");
        request.Headers.Add("Prefer", "return=representation");
        JsonBody(request, new { client_id = clientId, name = name.Trim() });
        var response = await _factory.CreateClient().SendAsync(request);
        if (!response.IsSuccessStatusCode) return null;
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<PlaylistRecord>>(json, JsonOptions)?.FirstOrDefault();
    }

    public async Task<bool> DeletePlaylistAsync(string clientId, string playlistId)
    {
        using var request = Request(HttpMethod.Delete, "playlists", $"?id=eq.{Uri.EscapeDataString(playlistId)}&client_id=eq.{Uri.EscapeDataString(clientId)}");
        var response = await _factory.CreateClient().SendAsync(request);
        return response.IsSuccessStatusCode;
    }

    public Task<List<PlaylistItemRecord>> GetPlaylistItemsAsync(string clientId, string playlistId) =>
        GetListAsync<PlaylistItemRecord>(Request(HttpMethod.Get, "playlist_items", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&playlist_id=eq.{Uri.EscapeDataString(playlistId)}&order=added_at.desc"));

    public async Task<bool> AddPlaylistItemAsync(string clientId, string playlistId, string mediaId, string mediaType, string title, string streamUrl)
    {
        using var request = Request(HttpMethod.Post, "playlist_items", "?on_conflict=playlist_id,media_id");
        request.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
        JsonBody(request, new { client_id = clientId, playlist_id = playlistId, media_id = mediaId, media_type = mediaType, title, stream_url = streamUrl });
        return (await _factory.CreateClient().SendAsync(request)).IsSuccessStatusCode;
    }

    public async Task<bool> RemovePlaylistItemAsync(string clientId, string playlistId, string mediaId)
    {
        using var request = Request(HttpMethod.Delete, "playlist_items", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&playlist_id=eq.{Uri.EscapeDataString(playlistId)}&media_id=eq.{Uri.EscapeDataString(mediaId)}");
        return (await _factory.CreateClient().SendAsync(request)).IsSuccessStatusCode;
    }

    public Task<List<FavoriteRecord>> GetFavoritesAsync(string clientId) =>
        GetListAsync<FavoriteRecord>(Request(HttpMethod.Get, "favorites", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&order=created_at.desc"));

    public async Task<bool> IsFavoriteAsync(string clientId, string mediaId)
    {
        using var request = Request(HttpMethod.Get, "favorites", $"?select=id&client_id=eq.{Uri.EscapeDataString(clientId)}&media_id=eq.{Uri.EscapeDataString(mediaId)}&limit=1");
        return (await GetListAsync<FavoriteRecord>(request)).Count > 0;
    }

    public async Task<bool> AddFavoriteAsync(string clientId, string mediaId, string mediaType, string title, string streamUrl)
    {
        using var request = Request(HttpMethod.Post, "favorites", "?on_conflict=client_id,media_id");
        request.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
        JsonBody(request, new { client_id = clientId, media_id = mediaId, media_type = mediaType, title, stream_url = streamUrl });
        return (await _factory.CreateClient().SendAsync(request)).IsSuccessStatusCode;
    }

    public async Task<bool> RemoveFavoriteAsync(string clientId, string mediaId)
    {
        using var request = Request(HttpMethod.Delete, "favorites", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&media_id=eq.{Uri.EscapeDataString(mediaId)}");
        return (await _factory.CreateClient().SendAsync(request)).IsSuccessStatusCode;
    }

    public Task<List<RecentlyPlayedRecord>> GetRecentlyPlayedAsync(string clientId) =>
        GetListAsync<RecentlyPlayedRecord>(Request(HttpMethod.Get, "recently_played", $"?client_id=eq.{Uri.EscapeDataString(clientId)}&order=played_at.desc"));

    public async Task<bool> RecordRecentlyPlayedAsync(string clientId, string mediaId, string mediaType, string title, string streamUrl)
    {
        using var request = Request(HttpMethod.Post, "recently_played", "?on_conflict=client_id,media_id");
        request.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
        JsonBody(request, new { client_id = clientId, media_id = mediaId, media_type = mediaType, title, stream_url = streamUrl, played_at = DateTime.UtcNow });
        return (await _factory.CreateClient().SendAsync(request)).IsSuccessStatusCode;
    }
}
