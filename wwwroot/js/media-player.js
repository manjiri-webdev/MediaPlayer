let currentMedia = null;


// ==========================================
// LOAD MEDIA
// ==========================================

async function loadMedia(type = "all") {

    let url = "/api/media";

    if (type === "audio") {
        url = "/api/media/audio";
    }

    if (type === "video") {
        url = "/api/media/video";
    }

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Could not load media.");
        }

        const media = await response.json();

        displayMedia(media);

    } catch (error) {

        console.error(error);

        document.getElementById("mediaList").innerHTML =
            "<p>Unable to load media.</p>";
    }
}


// ==========================================
// DISPLAY MEDIA
// ==========================================

function displayMedia(media) {

    const list =
        document.getElementById("mediaList");

    list.innerHTML = "";

    if (media.length === 0) {

        list.innerHTML =
            "<p>No media files found.</p>";

        return;
    }

    media.forEach(item => {

        const card =
            document.createElement("div");

        card.className = "media-card";

        const icon =
            item.mediaType === "Audio"
                ? "🎵"
                : "🎬";

        card.innerHTML = `
            <div class="media-info">

                <span class="media-icon">
                    ${icon}
                </span>

                <div>
                    <strong>
                        ${item.title}
                    </strong>

                    <small>
                        ${item.mediaType}
                    </small>
                </div>

            </div>

            <button
                class="play-button"
                onclick='playMedia(${JSON.stringify(item)})'>

                ▶ Play

            </button>
        `;

        list.appendChild(card);
    });
}


// ==========================================
// SEARCH MEDIA
// ==========================================

async function searchMedia() {

    const query =
        document
            .getElementById("searchInput")
            .value
            .trim();

    // If search box is empty,
    // show all media again.
    if (query === "") {

        loadMedia("all");

        return;
    }

    try {

        const response =
            await fetch(
                `/api/media/search?q=${encodeURIComponent(query)}`
            );

        if (!response.ok) {
            throw new Error("Search failed.");
        }

        const media =
            await response.json();

        displayMedia(media);

    } catch (error) {

        console.error(error);

        document.getElementById("mediaList").innerHTML =
            "<p>Unable to search media.</p>";
    }
}


// ==========================================
// PLAY MEDIA
// ==========================================

function playMedia(media) {

    currentMedia = media;

    const source =
        `/api/media/play/${encodeURIComponent(media.id)}`;

    document.getElementById("nowPlaying").innerHTML = `
        <h2>${media.title}</h2>
        <p>${media.mediaType}</p>
    `;

    const container =
        document.getElementById("playerContainer");


    // ======================================
    // AUDIO PLAYER
    // ======================================

    if (media.mediaType === "Audio") {

        container.innerHTML = `

            <div class="audio-player">

                <div class="audio-icon">
                    🎵
                </div>

                <h3>
                    ${media.title}
                </h3>

                <audio
                    controls
                    autoplay>

                    <source
                        src="${source}"
                        type="audio/mpeg">

                    Your browser does not support audio.

                </audio>

            </div>
        `;
    }


    // ======================================
    // VIDEO PLAYER
    // ======================================

    else {

        container.innerHTML = `

            <video
                controls
                autoplay
                class="video-player">

                <source
                    src="${source}"
                    type="video/mp4">

                Your browser does not support video.

            </video>

        `;
    }
}


// ==========================================
// LOAD ALL MEDIA WHEN PAGE OPENS
// ==========================================

// Legacy page only, skip when its markup is absent.
if (document.getElementById("mediaList") && document.getElementById("playerContainer")) {
    loadMedia();
}