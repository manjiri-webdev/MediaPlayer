using MediaPlayer.Models;
using MediaPlayer.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediaPlayer.Controllers;

[ApiController]
[Route("api/library")]
public class LibraryController : ControllerBase
{
    private readonly ISupabaseLibraryService _library;
    public LibraryController(ISupabaseLibraryService library) => _library = library;

    [HttpGet("playlists")]
    public async Task<IActionResult> Playlists([FromQuery] string clientId) => Ok(await _library.GetPlaylistsAsync(clientId));

    [HttpPost("playlists")]
    public async Task<IActionResult> CreatePlaylist([FromBody] CreatePlaylistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ClientId)) return BadRequest();
        var result = await _library.CreatePlaylistAsync(request.ClientId, request.Name);
        return result == null ? StatusCode(502, "Could not create playlist.") : Ok(result);
    }

    [HttpDelete("playlists/{id}")]
    public async Task<IActionResult> DeletePlaylist(string id, [FromQuery] string clientId) =>
        await _library.DeletePlaylistAsync(clientId, id) ? Ok() : StatusCode(502);

    [HttpGet("playlists/{id}/items")]
    public async Task<IActionResult> PlaylistItems(string id, [FromQuery] string clientId) => Ok(await _library.GetPlaylistItemsAsync(clientId, id));

    [HttpPost("playlists/{id}/items")]
    public async Task<IActionResult> AddPlaylistItem(string id, [FromBody] AddPlaylistItemRequest request) =>
        await _library.AddPlaylistItemAsync(request.ClientId, id, request.MediaId, request.MediaType, request.Title, request.StreamUrl) ? Ok() : StatusCode(502);

    [HttpDelete("playlists/{id}/items/{mediaId}")]
    public async Task<IActionResult> RemovePlaylistItem(string id, string mediaId, [FromQuery] string clientId) =>
        await _library.RemovePlaylistItemAsync(clientId, id, mediaId) ? Ok() : StatusCode(502);

    [HttpGet("favorites")]
    public async Task<IActionResult> Favorites([FromQuery] string clientId) => Ok(await _library.GetFavoritesAsync(clientId));

    [HttpPost("favorites")]
    public async Task<IActionResult> AddFavorite([FromBody] MediaActionRequest request) =>
        await _library.AddFavoriteAsync(request.ClientId, request.MediaId, request.MediaType, request.Title, request.StreamUrl) ? Ok() : StatusCode(502);

    [HttpDelete("favorites/{mediaId}")]
    public async Task<IActionResult> RemoveFavorite(string mediaId, [FromQuery] string clientId) =>
        await _library.RemoveFavoriteAsync(clientId, mediaId) ? Ok() : StatusCode(502);

    [HttpGet("recently-played")]
    public async Task<IActionResult> RecentlyPlayed([FromQuery] string clientId) => Ok(await _library.GetRecentlyPlayedAsync(clientId));

    [HttpPost("recently-played")]
    public async Task<IActionResult> AddRecentlyPlayed([FromBody] MediaActionRequest request) =>
        await _library.RecordRecentlyPlayedAsync(request.ClientId, request.MediaId, request.MediaType, request.Title, request.StreamUrl) ? Ok() : StatusCode(502);
}
