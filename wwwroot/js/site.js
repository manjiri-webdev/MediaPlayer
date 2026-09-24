// Theme manager with light, dark and system options.
(function () {
    var select = document.getElementById("themeSelect");
    var mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function resolveTheme(mode) {
        if (mode === "system") {
            return mediaQuery.matches ? "dark" : "light";
        }
        return mode;
    }

    function applyTheme(mode) {
        var resolved = resolveTheme(mode);
        document.documentElement.setAttribute("data-theme", resolved);
        try {
            localStorage.setItem("app-theme", mode);
        } catch (e) { }
        if (select && select.value !== mode) {
            select.value = mode;
        }
    }

    var initial = "system";
    try {
        initial = localStorage.getItem("app-theme") || "system";
    } catch (e) { }

    applyTheme(initial);

    if (select) {
        select.addEventListener("change", function (event) {
            applyTheme(event.target.value);
        });
    }

    mediaQuery.addEventListener("change", function () {
        var current = "system";
        try {
            current = localStorage.getItem("app-theme") || "system";
        } catch (e) { }
        if (current === "system") {
            applyTheme("system");
        }
    });
})();

// Star ratings backed by Supabase, injected without touching player code.
(function () {
    var SUPABASE_URL = "https://zmrxxngmeacfcbkjfxtw.supabase.co";
    var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptcnh4bmdtZWFjZmNia2pmeHR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDIzMzUsImV4cCI6MjEwNTQ3ODMzNX0.T2vtbVX0tcZvulJK3SDh9PvLESW-V6xmW_UW_Y5UOEE";
    var CLIENT_KEY = "mediaPlayerClientId";
    var avgCache = {};
    var pending = {};

    function clientId() {
        try {
            if (typeof getClientId === "function") return getClientId();
        } catch (e) { }
        var id = null;
        try {
            id = localStorage.getItem(CLIENT_KEY);
            if (!id) {
                id = "client-" + Date.now() + "-" + Math.random().toString(36).slice(2);
                localStorage.setItem(CLIENT_KEY, id);
            }
        } catch (e) { id = "anonymous"; }
        return id;
    }

    function baseHeaders() {
        return { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
    }

    function fetchAverage(mediaId) {
        if (avgCache[mediaId]) return Promise.resolve(avgCache[mediaId]);
        if (pending[mediaId]) return pending[mediaId];
        var task = fetch(SUPABASE_URL + "/rest/v1/ratings?media_id=eq." + encodeURIComponent(mediaId) + "&select=stars", { headers: baseHeaders() })
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (rows) {
                var total = 0;
                rows.forEach(function (row) { total += Number(row.stars) || 0; });
                avgCache[mediaId] = { average: rows.length ? total / rows.length : 0, count: rows.length };
                delete pending[mediaId];
                return avgCache[mediaId];
            })
            .catch(function () { delete pending[mediaId]; return { average: 0, count: 0 }; });
        pending[mediaId] = task;
        return task;
    }

    function submitRating(media, stars) {
        var payload = { media_id: media.id, media_type: media.type, title: media.title, stars: stars, client_id: clientId() };
        var extra = { "Prefer": "return=minimal" };
        var headers = baseHeaders();
        Object.keys(extra).forEach(function (key) { headers[key] = extra[key]; });
        return fetch(SUPABASE_URL + "/rest/v1/ratings", { method: "POST", headers: headers, body: JSON.stringify(payload) })
            .then(function () { delete avgCache[media.id]; refreshAllWidgets(media.id); })
            .catch(function (err) { console.warn("Rating could not be saved:", err); });
    }

    function fetchOwnRating(mediaId) {
        var url = SUPABASE_URL + "/rest/v1/ratings?media_id=eq." + encodeURIComponent(mediaId) +
            "&client_id=eq." + encodeURIComponent(clientId()) + "&select=stars&order=created_at.desc&limit=1";
        return fetch(url, { headers: baseHeaders() })
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (rows) { return rows.length ? Number(rows[0].stars) || 0 : 0; })
            .catch(function () { return 0; });
    }

    function findMedia(title, type) {
        var name = (title || "").trim();
        if (!name) return null;
        var pools = [];
        try { if (typeof allMediaItems !== "undefined" && Array.isArray(allMediaItems)) pools.push({ list: allMediaItems, kind: "normal" }); } catch (e) { }
        try { if (typeof videoItems !== "undefined" && Array.isArray(videoItems)) pools.push({ list: videoItems, kind: "video" }); } catch (e) { }
        try { if (typeof audioItems !== "undefined" && Array.isArray(audioItems)) pools.push({ list: audioItems, kind: "audio" }); } catch (e) { }
        var fallback = null;
        for (var p = 0; p < pools.length; p++) {
            var list = pools[p].list;
            var kind = pools[p].kind;
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                if (!item || !item.title || String(item.title).trim() !== name) continue;
                var mediaType = item.type || item.mediaType || (kind === "audio" ? "Audio" : "Video");
                var hit = { id: item.id, title: String(item.title).trim(), type: mediaType };
                if (!hit.id) continue;
                if (type && mediaType === type) return hit;
                if (!fallback) fallback = hit;
            }
        }
        return fallback;
    }

    function paintStars(starsEl, value) {
        var buttons = starsEl.querySelectorAll(".rating-star");
        var lit = Math.round(value);
        buttons.forEach(function (btn, idx) {
            if (idx < lit) btn.classList.add("lit");
            else btn.classList.remove("lit");
        });
    }

    function refreshWidget(wrap) {
        var media = wrap._ratingMedia;
        if (!media) return;
        var starsEl = wrap.querySelector(".rating-stars");
        var metaEl = wrap.querySelector(".rating-meta");
        var ownValueEl = wrap.querySelector(".rating-own-value");
        var inputEl = wrap.querySelector(".rating-input");
        Promise.all([fetchAverage(media.id), fetchOwnRating(media.id)]).then(function (parts) {
            var result = parts[0];
            var own = parts[1];
            if (starsEl) paintStars(starsEl, own > 0 ? own : result.average);
            if (metaEl) metaEl.textContent = result.count > 0 ? "Avg " + result.average.toFixed(1) + " (" + result.count + ")" : "No ratings yet";
            if (ownValueEl) ownValueEl.textContent = own > 0 ? String(Math.round(own * 10) / 10) : "-";
            if (inputEl && document.activeElement !== inputEl) inputEl.value = own > 0 ? own : "";
        });
    }

    function applyOwnRating(wrap, media, value) {
        var starsEl = wrap.querySelector(".rating-stars");
        var ownValueEl = wrap.querySelector(".rating-own-value");
        var inputEl = wrap.querySelector(".rating-input");
        if (starsEl) paintStars(starsEl, value);
        if (ownValueEl) ownValueEl.textContent = String(value);
        if (inputEl) inputEl.value = value;
        submitRating(media, value);
    }

    function refreshAllWidgets(mediaId) {
        var nodes = document.querySelectorAll('[data-rating-for="' + mediaId + '"]');
        nodes.forEach(function (node) { refreshWidget(node); });
    }

    function buildWidget(media) {
        var wrap = document.createElement("div");
        wrap.className = "rating-widget";
        wrap.setAttribute("data-rating-for", media.id);
        wrap._ratingMedia = media;
        wrap.addEventListener("click", function (ev) { ev.stopPropagation(); });

        var stars = document.createElement("div");
        stars.className = "rating-stars";
        for (var i = 1; i <= 5; i++) {
            (function (value) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "rating-star";
                btn.textContent = "★";
                btn.setAttribute("aria-label", "Rate " + value + " stars");
                btn.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    applyOwnRating(wrap, media, value);
                });
                stars.appendChild(btn);
            })(i);
        }

        var meta = document.createElement("small");
        meta.className = "rating-meta muted";
        meta.textContent = "Loading rating...";

        var ownRow = document.createElement("div");
        ownRow.className = "rating-own";
        ownRow.innerHTML = '<span>You: <b class="rating-own-value">-</b></span>';
        var input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "5";
        input.step = "0.1";
        input.className = "rating-input";
        input.setAttribute("aria-label", "Type your rating");
        input.addEventListener("click", function (ev) { ev.stopPropagation(); });
        input.addEventListener("change", function () {
            var value = parseFloat(input.value);
            if (isNaN(value)) return;
            if (value < 0) value = 0;
            if (value > 5) value = 5;
            applyOwnRating(wrap, media, Math.round(value * 10) / 10);
        });
        ownRow.appendChild(input);

        wrap.appendChild(stars);
        wrap.appendChild(meta);
        wrap.appendChild(ownRow);
        refreshWidget(wrap);
        return wrap;
    }

    function mountInGrid(gridId, cardClass, fixedType, appendToCard) {
        var grid = document.getElementById(gridId);
        if (!grid) return;
        var cards = grid.getElementsByClassName(cardClass);
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.getAttribute("data-rating-mounted")) continue;
            if (card.closest && card.closest("#ratingsGrid")) continue;
            var titleEl = card.querySelector("strong");
            if (!titleEl) continue;
            var media = findMedia(titleEl.textContent, fixedType);
            if (!media || !media.id) continue;
            card.setAttribute("data-rating-mounted", "1");
            var widget = buildWidget(media);
            if (appendToCard) {
                card.appendChild(widget);
            } else {
                var first = card.querySelector("div");
                (first || card).appendChild(widget);
            }
        }
    }

    function mountCardRatings() {
        mountInGrid("homeMediaGrid", "media-card-item", null, true);
        mountInGrid("videoLibraryGrid", "media-card-item", "Video", true);
        mountInGrid("audioQueueList", "audio-row-item", "Audio", false);
    }

    function ensurePlayerSlots() {
        var artist = document.getElementById("audioPlayerArtist");
        if (artist && !document.getElementById("audioRatingSlot")) {
            var slot = document.createElement("div");
            slot.id = "audioRatingSlot";
            slot.className = "player-rating-slot";
            artist.parentNode.insertBefore(slot, artist.nextSibling);
        }
        var meta = document.getElementById("videoDisplayMeta");
        if (meta && !document.getElementById("videoRatingSlot")) {
            var videoSlot = document.createElement("div");
            videoSlot.id = "videoRatingSlot";
            videoSlot.className = "player-rating-slot player-rating-left";
            meta.parentNode.insertBefore(videoSlot, meta.nextSibling);
        }
    }

    function syncPlayerSlots() {
        ensurePlayerSlots();
        var audioTitle = document.getElementById("audioPlayerTitle");
        var audioSlot = document.getElementById("audioRatingSlot");
        if (audioTitle && audioSlot) {
            var audioKey = audioTitle.textContent.trim();
            if (audioSlot.getAttribute("data-rating-title") !== audioKey) {
                audioSlot.innerHTML = "";
                audioSlot.setAttribute("data-rating-title", audioKey);
                var audioMedia = findMedia(audioKey, "Audio");
                if (audioMedia && audioMedia.id) audioSlot.appendChild(buildWidget(audioMedia));
            }
        }
        var videoTitle = document.getElementById("videoDisplayTitle");
        var videoSlot = document.getElementById("videoRatingSlot");
        if (videoTitle && videoSlot) {
            var videoKey = videoTitle.textContent.trim();
            if (videoSlot.getAttribute("data-rating-title") !== videoKey) {
                videoSlot.innerHTML = "";
                videoSlot.setAttribute("data-rating-title", videoKey);
                var videoMedia = findMedia(videoKey, "Video");
                if (videoMedia && videoMedia.id) videoSlot.appendChild(buildWidget(videoMedia));
            }
        }
    }

    function syncRatings() {
        mountCardRatings();
        syncPlayerSlots();
    }

    document.addEventListener("DOMContentLoaded", function () {
        syncRatings();
        if (document.body && typeof MutationObserver === "function") {
            new MutationObserver(syncRatings).observe(document.body, { childList: true, subtree: true, characterData: true });
        }
    });
})();

// Deep link into Home sections, e.g. "/?section=audio".
(function () {
    function openSection() {
        var section = null;
        try { section = new URLSearchParams(window.location.search).get("section"); } catch (e) { }
        var valid = ["home", "audio", "video", "playlists", "favorites", "recentlyPlayed"];
        if (!section || valid.indexOf(section) < 0) return;
        if (!document.getElementById("pageHome")) return;
        try {
            if (typeof showPage === "function") {
                setTimeout(function () { showPage(section); }, 80);
            }
        } catch (e) { }
    }
    document.addEventListener("DOMContentLoaded", openSection);
})();
