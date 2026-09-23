// Playlist / Favorites / Recently Played module
// Perf notes (Sakshi):
// - All lists are cached in memory with a short TTL so switching tabs / reopening
//   the playlist picker doesn't re-hit Supabase every time.
// - Favorite toggling and item removal update the UI optimistically instead of
//   waiting on a network round trip, so they no longer "fetch everything, then
//   maybe update one row."
// - Nothing here touches audio/video player globals except the read-only
//   window.currentAudioMedia / window.currentVideoMedia and the showPage() wrapper,
//   same as before.

const CLIENT_ID_KEY = 'mediaPlayerClientId';
const CACHE_TTL_MS = 20000; // data this fresh doesn't need to be re-fetched on every tab switch

let libraryPlaylists = [];
let libraryPlaylistsLoadedAt = 0;

let favoritesCache = [];
let favoriteIds = new Set();
let favoritesLoadedAt = 0;

let recentlyPlayedCache = [];
let recentlyPlayedLoadedAt = 0;

let playlistItemsCache = {};      // playlistId -> items[]
let playlistItemsLoadedAt = {};   // playlistId -> timestamp

let currentLibraryMedia = null;
let currentPlaylistId = null;

function getClientId() {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : 'client-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
}

async function libraryFetch(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) throw new Error(await response.text() || `Request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
}

function mediaAction(mediaId, mediaType, title, streamUrl) {
    return { clientId: getClientId(), mediaId, mediaType, title, streamUrl };
}

function isFresh(timestamp) {
    return Date.now() - timestamp < CACHE_TTL_MS;
}

async function recordRecentlyPlayed(media) {
    try {
        await libraryFetch('/api/library/recently-played', {
            method: 'POST', body: JSON.stringify(mediaAction(media.id, media.type, media.title, media.streamUrl))
        });
        recentlyPlayedLoadedAt = 0; // so the next time that tab opens, it shows the new entry
    } catch (e) { console.warn('Recently played could not be saved:', e); }
}

// ---------- Playlists ----------

function renderPlaylists() {
    const grid = document.getElementById('playlistGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!libraryPlaylists.length) { grid.innerHTML = '<p>No playlists yet. Click + Create Playlist.</p>'; return; }
    for (const p of libraryPlaylists) {
        const card = document.createElement('div'); card.className = 'static-card';
        card.innerHTML = `<div class="static-thumb">📑</div><strong>${escapeHtml(p.name)}</strong><small>Open playlist</small>`;
        card.onclick = () => openPlaylist(p);
        grid.appendChild(card);
    }
}

async function loadPlaylists(forceRefresh = false) {
    if (!forceRefresh && isFresh(libraryPlaylistsLoadedAt)) {
        renderPlaylists();
        return libraryPlaylists;
    }
    if (libraryPlaylists.length) renderPlaylists(); // paint what we have instantly, no blank flash
    try {
        libraryPlaylists = await libraryFetch(`/api/library/playlists?clientId=${encodeURIComponent(getClientId())}`);
        libraryPlaylistsLoadedAt = Date.now();
        renderPlaylists();
    } catch (e) {
        console.error(e);
        if (!libraryPlaylists.length) { const grid = document.getElementById('playlistGrid'); if (grid) grid.innerHTML = '<p>Could not load playlists.</p>'; }
    }
    return libraryPlaylists;
}

async function createPlaylist() {
    const name = prompt('Enter playlist name:');
    if (!name || !name.trim()) return;
    try {
        await libraryFetch('/api/library/playlists', { method: 'POST', body: JSON.stringify({ name: name.trim(), clientId: getClientId() }) });
        await loadPlaylists(true);
    } catch (e) { alert('Could not create playlist. Check the Supabase connection.'); console.error(e); }
}

async function openPlaylist(playlist) {
    currentPlaylistId = playlist.id;
    document.getElementById('selectedPlaylistTitle').textContent = playlist.name;
    document.getElementById('playlistItemsPanel').style.display = 'block';

    const cached = playlistItemsCache[playlist.id];
    const fresh = isFresh(playlistItemsLoadedAt[playlist.id] || 0);
    if (cached && fresh) { renderPlaylistItems(playlist); return; }
    if (cached) renderPlaylistItems(playlist); // show stale data immediately while refreshing

    try {
        const items = await libraryFetch(`/api/library/playlists/${encodeURIComponent(playlist.id)}/items?clientId=${encodeURIComponent(getClientId())}`);
        playlistItemsCache[playlist.id] = items;
        playlistItemsLoadedAt[playlist.id] = Date.now();
        if (currentPlaylistId === playlist.id) renderPlaylistItems(playlist);
    } catch (e) {
        console.error(e);
        if (!cached) { const list = document.getElementById('playlistItemsList'); if (list) list.innerHTML = '<p>Could not load playlist items.</p>'; }
    }
}

function renderPlaylistItems(playlist) {
    const items = playlistItemsCache[playlist.id] || [];
    const list = document.getElementById('playlistItemsList'); list.innerHTML = '';
    if (!items.length) { list.innerHTML = '<p>No media in this playlist yet.</p>'; return; }
    items.forEach(item => {
        const row = document.createElement('div'); row.className = 'audio-row-item';
        row.innerHTML = `<div><strong>${escapeHtml(item.title)}</strong><small style="display:block;color:#777">${item.media_type === 'Video' ? '🎬 Video' : '🎵 Audio'}</small></div><button type="button">Remove</button>`;
        row.querySelector('button').onclick = async e => {
            e.stopPropagation();
            row.remove(); // optimistic: remove instantly, don't wait on the network
            try {
                await libraryFetch(`/api/library/playlists/${encodeURIComponent(playlist.id)}/items/${encodeURIComponent(item.media_id)}?clientId=${encodeURIComponent(getClientId())}`, { method: 'DELETE' });
                playlistItemsCache[playlist.id] = (playlistItemsCache[playlist.id] || []).filter(x => x.media_id !== item.media_id);
            } catch (err) {
                console.error(err);
                playlistItemsLoadedAt[playlist.id] = 0; // force a real refresh since our optimistic removal may be wrong
                openPlaylist(playlist);
            }
        };
        row.onclick = () => playLibraryItem(item);
        list.appendChild(row);
    });
}

function playLibraryItem(item) {
    if (item.media_type === 'Video') { showPage('video'); setTimeout(() => playSelectedVideo(item.mediaId), 100); }
    else { showPage('audio'); const song = audioItems.find(x => x.id === item.mediaId) || { id: item.mediaId, title: item.title }; playSelectedAudio(song); }
}

// ---------- Favorites ----------

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid'); if (!grid) return;
    grid.innerHTML = '';
    if (!favoritesCache.length) { grid.innerHTML = '<p>No favorites yet. Tap 🤍 while playing media.</p>'; return; }
    favoritesCache.forEach(item => {
        const card = document.createElement('div'); card.className = 'media-card-item';
        card.innerHTML = `<div class="card-thumb-box"><span>${item.media_type === 'Video' ? '🎬' : '🎵'}</span></div><div style="margin-top:8px"><strong>${escapeHtml(item.title)}</strong><button type="button" style="float:right">Remove</button></div>`;
        card.onclick = () => playLibraryItem(item);
        card.querySelector('button').onclick = async e => {
            e.stopPropagation();
            card.remove(); // optimistic
            favoriteIds.delete(item.media_id);
            favoritesCache = favoritesCache.filter(x => x.media_id !== item.media_id);
            try {
                await libraryFetch(`/api/library/favorites/${encodeURIComponent(item.media_id)}?clientId=${encodeURIComponent(getClientId())}`, { method: 'DELETE' });
            } catch (err) { console.error(err); favoritesLoadedAt = 0; loadFavorites(true); }
        };
        grid.appendChild(card);
    });
}

async function loadFavorites(forceRefresh = false) {
    const grid = document.getElementById('favoritesGrid'); if (!grid) return;
    if (!forceRefresh && isFresh(favoritesLoadedAt)) { renderFavorites(); return; }
    if (favoritesCache.length) renderFavorites(); // paint stale data instantly while refreshing
    try {
        favoritesCache = await libraryFetch(`/api/library/favorites?clientId=${encodeURIComponent(getClientId())}`);
        favoriteIds = new Set(favoritesCache.map(x => x.media_id));
        favoritesLoadedAt = Date.now();
        renderFavorites();
    } catch (e) { console.error(e); if (!favoritesCache.length) grid.innerHTML = '<p>Could not load favorites.</p>'; }
}

// ---------- Recently Played ----------

function renderRecentlyPlayed() {
    const grid = document.getElementById('recentlyPlayedGrid'); if (!grid) return;
    grid.innerHTML = '';
    if (!recentlyPlayedCache.length) { grid.innerHTML = '<p>No recently played media yet.</p>'; return; }
    recentlyPlayedCache.forEach(item => {
        const card = document.createElement('div'); card.className = 'media-card-item';
        card.innerHTML = `<div class="card-thumb-box"><span>${item.media_type === 'Video' ? '🎬' : '🎵'}</span></div><div style="margin-top:8px"><strong>${escapeHtml(item.title)}</strong><small style="display:block;color:#777">${item.played_at ? new Date(item.played_at).toLocaleString() : ''}</small></div>`;
        card.onclick = () => playLibraryItem(item);
        grid.appendChild(card);
    });
}

async function loadRecentlyPlayed(forceRefresh = false) {
    const grid = document.getElementById('recentlyPlayedGrid'); if (!grid) return;
    if (!forceRefresh && isFresh(recentlyPlayedLoadedAt)) { renderRecentlyPlayed(); return; }
    if (recentlyPlayedCache.length) renderRecentlyPlayed();
    try {
        recentlyPlayedCache = await libraryFetch(`/api/library/recently-played?clientId=${encodeURIComponent(getClientId())}`);
        recentlyPlayedLoadedAt = Date.now();
        renderRecentlyPlayed();
    } catch (e) { console.error(e); if (!recentlyPlayedCache.length) grid.innerHTML = '<p>Could not load recently played.</p>'; }
}

// ---------- Playlist picker (used by both Audio and Video players) ----------

function openPlaylistPicker(media) {
    currentLibraryMedia = media;
    // loadPlaylists() resolves instantly from cache when fresh, so this no longer
    // makes every teammate wait on a Supabase round trip just to open the picker.
    loadPlaylists().then(() => {
        const box = document.getElementById('playlistPickerList'); box.innerHTML = '';
        if (!libraryPlaylists.length) { box.innerHTML = '<p>Create a playlist first.</p>'; }
        libraryPlaylists.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.style = 'display:block;width:100%;margin:7px 0;padding:10px;text-align:left'; b.textContent = '📑 ' + p.name; b.onclick = () => addCurrentToPlaylist(p.id); box.appendChild(b); });
        document.getElementById('playlistPicker').style.display = 'flex';
    });
}
function closePlaylistPicker() { document.getElementById('playlistPicker').style.display = 'none'; }

async function addCurrentToPlaylist(playlistId) {
    if (!currentLibraryMedia) return;
    try {
        await libraryFetch(`/api/library/playlists/${encodeURIComponent(playlistId)}/items`, { method: 'POST', body: JSON.stringify({ ...mediaAction(currentLibraryMedia.id, currentLibraryMedia.type, currentLibraryMedia.title, currentLibraryMedia.streamUrl) }) });
        playlistItemsLoadedAt[playlistId] = 0; // that playlist's contents changed, refetch next time it's opened
        closePlaylistPicker();
        alert('Added to playlist.');
    } catch (e) { alert('Could not add to playlist.'); console.error(e); }
}
function openPlaylistPickerForCurrentAudio() { if (window.currentAudioMedia) openPlaylistPicker(window.currentAudioMedia); }
function openPlaylistPickerForCurrentVideo() { if (window.currentVideoMedia) openPlaylistPicker(window.currentVideoMedia); }

// ---------- Favorite toggle (heart button) ----------
// This used to fetch the ENTIRE favorites list from Supabase on every single
// click just to check membership. Now it trusts the in-memory favoriteIds
// cache (refreshing it only when stale) and updates instantly, optimistically.
async function toggleFavorite(media, button) {
    if (!isFresh(favoritesLoadedAt)) {
        try {
            favoritesCache = await libraryFetch(`/api/library/favorites?clientId=${encodeURIComponent(getClientId())}`);
            favoriteIds = new Set(favoritesCache.map(x => x.media_id));
            favoritesLoadedAt = Date.now();
        } catch (e) { console.error(e); /* fall through, best effort with whatever we have cached */ }
    }

    const wasFavorite = favoriteIds.has(media.id);
    // Optimistic UI update — no waiting on the network to flip the heart.
    if (button) button.textContent = wasFavorite ? '🤍' : '❤️';
    if (wasFavorite) favoriteIds.delete(media.id); else favoriteIds.add(media.id);

    try {
        if (wasFavorite) {
            await libraryFetch(`/api/library/favorites/${encodeURIComponent(media.id)}?clientId=${encodeURIComponent(getClientId())}`, { method: 'DELETE' });
        } else {
            await libraryFetch('/api/library/favorites', { method: 'POST', body: JSON.stringify(mediaAction(media.id, media.type, media.title, media.streamUrl)) });
        }
        favoritesLoadedAt = 0; // list changed; next time the Favorites tab opens, it refetches
    } catch (e) {
        // revert the optimistic change
        if (button) button.textContent = wasFavorite ? '❤️' : '🤍';
        if (wasFavorite) favoriteIds.add(media.id); else favoriteIds.delete(media.id);
        alert('Could not update favorite.'); console.error(e);
    }
}
function toggleCurrentAudioFavorite() { if (window.currentAudioMedia) toggleFavorite(window.currentAudioMedia, document.getElementById('audioFavoriteBtn')); }
function toggleCurrentVideoFavorite() { if (window.currentVideoMedia) toggleFavorite(window.currentVideoMedia, document.getElementById('videoFavoriteBtn')); }

function escapeHtml(value) { const d = document.createElement('div'); d.textContent = value ?? ''; return d.innerHTML; }

// Extend the existing page switcher without replacing the teammates' player code.
const originalShowPage = window.showPage;
window.showPage = function (pageName) {
    originalShowPage(pageName);
    if (pageName === 'playlists') loadPlaylists();
    if (pageName === 'favorites') loadFavorites();
    if (pageName === 'recentlyPlayed') loadRecentlyPlayed();
};
