using MediaPlayer.Models;

namespace MediaPlayer.Services;

public interface ISupabaseLibraryService
{
    Task<List<PlaylistRecord>> GetPlaylistsAsync(string clientId);
    Task<PlaylistRecord?> CreatePlaylistAsync(string clientId, string name);
    Task<bool> DeletePlaylistAsync(string clientId, string playlistId);
    Task<List<PlaylistItemRecord>> GetPlaylistItemsAsync(string clientId, string playlistId);
    Task<bool> AddPlaylistItemAsync(string clientId, string playlistId, string mediaId, string mediaType, string title, string streamUrl);
    Task<bool> RemovePlaylistItemAsync(string clientId, string playlistId, string mediaId);
    Task<List<FavoriteRecord>> GetFavoritesAsync(string clientId);
    Task<bool> IsFavoriteAsync(string clientId, string mediaId);
    Task<bool> AddFavoriteAsync(string clientId, string mediaId, string mediaType, string title, string streamUrl);
    Task<bool> RemoveFavoriteAsync(string clientId, string mediaId);
    Task<List<RecentlyPlayedRecord>> GetRecentlyPlayedAsync(string clientId);
    Task<bool> RecordRecentlyPlayedAsync(string clientId, string mediaId, string mediaType, string title, string streamUrl);
}
