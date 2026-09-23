// ========================================================
// TATA PACK MEDIA PLAYER CONTROLLER
// ========================================================

let allMediaItems = [];   // Mixed Audio + Video
let videoItems = [];      // Supabase Videos
let audioItems = [];      // Local Audio
let currentVideoIdx = -1;

// 1. PAGE SWITCHER (Home, Audio, Video, Playlists, Favorites)
function showPage(pageName) {
    const pages = ['pageHome', 'pageAudio', 'pageVideo', 'pagePlaylists', 'pageFavorites', 'pageRecentlyPlayed'];
    const navButtons = ['btnNavHome', 'btnNavAudio', 'btnNavVideo', 'btnNavPlaylists', 'btnNavFavorites', 'btnNavRecentlyPlayed'];

    pages.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.style.display = 'none';
    });

    navButtons.forEach(b => {
        const el = document.getElementById(b);
        if (el) el.classList.remove('active');
    });

    if (pageName === 'home') {
        document.getElementById('pageHome').style.display = 'block';
        document.getElementById('btnNavHome').classList.add('active');
        loadAllMedia();
    } else if (pageName === 'audio') {
        document.getElementById('pageAudio').style.display = 'block';
        document.getElementById('btnNavAudio').classList.add('active');
        loadAudioPage();
    } else if (pageName === 'video') {
        document.getElementById('pageVideo').style.display = 'block';
        document.getElementById('btnNavVideo').classList.add('active');
        loadVideoPage();
    } else if (pageName === 'playlists') {
        document.getElementById('pagePlaylists').style.display = 'block';
        document.getElementById('btnNavPlaylists').classList.add('active');
    } else if (pageName === 'favorites') {
        document.getElementById('pageFavorites').style.display = 'block';
        document.getElementById('btnNavFavorites').classList.add('active');
    } else if (pageName === 'recentlyPlayed') {
        document.getElementById('pageRecentlyPlayed').style.display = 'block';
        document.getElementById('btnNavRecentlyPlayed').classList.add('active');
    }
}

// 2. LOAD ALL MEDIA (Fetches Audio + Supabase Videos and blends them!)
async function loadAllMedia() {
    try {
        // Fetch audio and video in parallel
        const [audioRes, videoRes] = await Promise.all([
            fetch('/api/media/audio'),
            fetch('/api/video')
        ]);

        audioItems = audioRes.ok ? await audioRes.json() : [];
        videoItems = videoRes.ok ? await videoRes.json() : [];

        // Normalize and combine
        allMediaItems = [
            ...audioItems.map(a => ({
                id: a.id,
                title: a.title,
                type: 'Audio',
                duration: '3:45',
                streamUrl: `/api/media/play/${encodeURIComponent(a.id)}`
            })),
            ...videoItems.map(v => ({
                id: v.id,
                title: v.title,
                type: 'Video',
                duration: v.duration || '0:30',
                streamUrl: `/api/video/play/${encodeURIComponent(v.id)}`
            }))
        ];

        renderHomeGrid(allMediaItems);
    } catch (err) {
        console.error('Failed to load all media:', err);
    }
}

// 3. RENDER HOME GRID
function renderHomeGrid(items) {
    const grid = document.getElementById('homeMediaGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (items.length === 0) {
        grid.innerHTML = '<p>No media files found.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card-item';

        const isVideo = item.type === 'Video';
        const thumbContent = isVideo 
            ? `<video src="${item.streamUrl}#t=1" preload="metadata" muted></video>`
            : `<span>🎵</span>`;

        card.innerHTML = `
            <div class="card-thumb-box">
                ${thumbContent}
                <span class="card-duration">${item.duration}</span>
            </div>
            <div style="margin-top: 8px;">
                <strong>${item.title}</strong>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <small style="color: #777;">${isVideo ? '🎬 Video' : '🎵 Audio'}</small>
                    <button type="button" style="padding: 2px 8px; font-size: 11px;">▶ Play</button>
                </div>
            </div>
        `;

        card.onclick = () => {
            if (isVideo) {
                showPage('video');
                playSelectedVideo(item.id);
            } else {
                showPage('audio');
                playSelectedAudio(item);
            }
        };

        grid.appendChild(card);
    });
}

// Filter pills on Home page (All / Audio / Video)
function filterHomeMedia(type) {
    const pills = document.querySelectorAll('.filter-pills .pill');
    pills.forEach(p => p.classList.remove('active'));

    event.target.classList.add('active');

    if (type === 'all') {
        renderHomeGrid(allMediaItems);
    } else if (type === 'audio') {
        renderHomeGrid(allMediaItems.filter(x => x.type === 'Audio'));
    } else if (type === 'video') {
        renderHomeGrid(allMediaItems.filter(x => x.type === 'Video'));
    }
}

// 4. AUDIO PAGE LOGIC
async function loadAudioPage() {
    if (audioItems.length === 0) {
        const res = await fetch('/api/media/audio');
        if (res.ok) audioItems = await res.json();
    }

    const queue = document.getElementById('audioQueueList');
    if (!queue) return;
    queue.innerHTML = '';

    audioItems.forEach(song => {
        const row = document.createElement('div');
        row.className = 'audio-row-item';
        row.innerHTML = `
            <div>
                <strong>${song.title}</strong>
                <small style="display: block; color: #777;">🎵 Audio Track</small>
            </div>
            <button type="button" style="padding: 4px 8px;">▶</button>
        `;
        row.onclick = () => playSelectedAudio(song);
        queue.appendChild(row);
    });

    if (audioItems.length > 0) {
        playSelectedAudio(audioItems[0], false);
    }
}

function playSelectedAudio(song, autoPlay = true) {
    const player = document.getElementById('mainAudioPlayer');
    document.getElementById('audioPlayerTitle').innerText = song.title;
    const streamUrl = `/api/media/play/${encodeURIComponent(song.id)}`;

    player.src = streamUrl;
    window.currentAudioMedia = { id: song.id, title: song.title, type: 'Audio', streamUrl: streamUrl };
    if (autoPlay) { player.play(); recordRecentlyPlayed(window.currentAudioMedia); }
}

// 5. VIDEO PAGE LOGIC
async function loadVideoPage() {
    if (videoItems.length === 0) {
        const res = await fetch('/api/video');
        if (res.ok) videoItems = await res.json();
    }

    const grid = document.getElementById('videoLibraryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    videoItems.forEach((v, idx) => {
        const card = document.createElement('div');
        card.className = 'media-card-item';
        const streamUrl = `/api/video/play/${encodeURIComponent(v.id)}`;

        card.innerHTML = `
            <div class="card-thumb-box">
                <video src="${streamUrl}#t=1" preload="metadata" muted></video>
                <span class="card-duration">${v.duration || '0:00'}</span>
            </div>
            <div style="margin-top: 8px;">
                <strong>${v.title}</strong>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <small style="color: #777;">🎬 Video</small>
                    <button type="button" style="padding: 2px 8px; font-size: 11px;">▶ Play</button>
                </div>
            </div>
        `;
        card.onclick = () => selectVideoByIndex(idx, true);
        grid.appendChild(card);
    });

    if (videoItems.length > 0 && currentVideoIdx === -1) {
        selectVideoByIndex(0, false);
    }
}

function selectVideoByIndex(index, autoPlay = true) {
    if (index < 0 || index >= videoItems.length) return;
    currentVideoIdx = index;
    const v = videoItems[currentVideoIdx];

    document.getElementById('videoDisplayTitle').innerText = v.title;
    document.getElementById('videoDisplayMeta').innerText = `Video • ${v.duration || '0:00'}`;

    const video = document.getElementById('mainVideoPlayer');
    video.src = `/api/video/play/${encodeURIComponent(v.id)}`;

    attachVideoEvents(video);

    window.currentVideoMedia = { id: v.id, title: v.title, type: 'Video', streamUrl: `/api/video/play/${encodeURIComponent(v.id)}` };
    if (autoPlay) { video.play(); recordRecentlyPlayed(window.currentVideoMedia); }
}

function playSelectedVideo(id) {
    const idx = videoItems.findIndex(x => x.id === id);
    if (idx !== -1) {
        selectVideoByIndex(idx, true);
    }
}

function attachVideoEvents(video) {
    const seekBar = document.getElementById('videoSeekBar');
    const curText = document.getElementById('currentTimeText');
    const durText = document.getElementById('totalDurationText');
    const playBtn = document.getElementById('btnPlayPause');

    video.onloadedmetadata = () => {
        seekBar.max = video.duration;
        durText.innerText = formatTime(video.duration);
    };

    video.ontimeupdate = () => {
        seekBar.value = video.currentTime;
        curText.innerText = formatTime(video.currentTime);
    };

    seekBar.oninput = () => {
        video.currentTime = seekBar.value;
    };

    video.onplay = () => { if (playBtn) playBtn.innerText = '⏸ Pause'; };
    video.onpause = () => { if (playBtn) playBtn.innerText = '▶ Play'; };
    video.onended = () => { nextVideo(); };

    document.getElementById('videoVolume').oninput = (e) => {
        video.volume = e.target.value;
        video.muted = (e.target.value === '0');
        document.getElementById('btnMute').innerText = video.muted ? '🔇' : '🔊';
    };
}

// Video Controls
function togglePlayPause() {
    const v = document.getElementById('mainVideoPlayer');
    if (!v) return;
    v.paused ? v.play() : v.pause();
}

function stopVideo() {
    const v = document.getElementById('mainVideoPlayer');
    if (!v) return;
    v.pause();
    v.currentTime = 0;
}

function previousVideo() {
    if (videoItems.length === 0) return;
    let prev = currentVideoIdx - 1;
    if (prev < 0) prev = videoItems.length - 1;
    selectVideoByIndex(prev, true);
}

function nextVideo() {
    if (videoItems.length === 0) return;
    let next = currentVideoIdx + 1;
    if (next >= videoItems.length) next = 0;
    selectVideoByIndex(next, true);
}

function toggleMute() {
    const v = document.getElementById('mainVideoPlayer');
    if (!v) return;
    v.muted = !v.muted;
    document.getElementById('btnMute').innerText = v.muted ? '🔇' : '🔊';
}

function changePlaybackSpeed(rate) {
    const v = document.getElementById('mainVideoPlayer');
    if (v) v.playbackRate = parseFloat(rate);
}

function toggleFullscreen() {
    const v = document.getElementById('mainVideoPlayer');
    if (!v) return;
    if (!document.fullscreenElement) {
        v.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function formatTime(secs) {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// 6. GLOBAL SEARCH
function handleGlobalSearch(query) {
    if (!query || query.trim() === '') {
        renderHomeGrid(allMediaItems);
        return;
    }
    const q = query.toLowerCase().trim();
    const filtered = allMediaItems.filter(x => x.title.toLowerCase().includes(q));
    renderHomeGrid(filtered);
}

// Auto load Home on start
document.addEventListener('DOMContentLoaded', () => {
    loadAllMedia();
});
