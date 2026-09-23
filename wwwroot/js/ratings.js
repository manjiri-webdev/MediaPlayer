// Top Rated page: lists media sorted by Supabase average rating.
(function () {
    var SUPABASE_URL = "https://zmrxxngmeacfcbkjfxtw.supabase.co";
    var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptcnh4bmdtZWFjZmNia2pmeHR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDIzMzUsImV4cCI6MjEwNTQ3ODMzNX0.T2vtbVX0tcZvulJK3SDh9PvLESW-V6xmW_UW_Y5UOEE";
    var CLIENT_KEY = "mediaPlayerClientId";

    function clientId() {
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

    function loadMedia() {
        return Promise.all([fetch("/api/media/audio"), fetch("/api/video")]).then(function (results) {
            return Promise.all(results.map(function (res) { return res.ok ? res.json() : []; }));
        }).then(function (parts) {
            var audio = (parts[0] || []).map(function (a) {
                return { id: a.id, title: a.title, type: "Audio", streamUrl: "/api/media/play/" + encodeURIComponent(a.id) };
            });
            var video = (parts[1] || []).map(function (v) {
                return { id: v.id, title: v.title, type: "Video", streamUrl: "/api/video/play/" + encodeURIComponent(v.id) };
            });
            return audio.concat(video);
        });
    }

    function loadAverages() {
        return fetch(SUPABASE_URL + "/rest/v1/ratings?select=media_id,stars", { headers: baseHeaders() })
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (rows) {
                var map = {};
                rows.forEach(function (row) {
                    if (!map[row.media_id]) map[row.media_id] = { total: 0, count: 0 };
                    map[row.media_id].total += Number(row.stars) || 0;
                    map[row.media_id].count += 1;
                });
                return map;
            })
            .catch(function () { return {}; });
    }

    function submitRating(media, stars, onDone) {
        var payload = { media_id: media.id, media_type: media.type, title: media.title, stars: stars, client_id: clientId() };
        var headers = baseHeaders();
        headers["Prefer"] = "return=minimal";
        fetch(SUPABASE_URL + "/rest/v1/ratings", { method: "POST", headers: headers, body: JSON.stringify(payload) })
            .then(function () { onDone(); })
            .catch(function (err) { console.warn("Rating could not be saved:", err); });
    }

    function paintStars(starsEl, value) {
        var buttons = starsEl.querySelectorAll(".rating-star");
        var lit = Math.round(value);
        buttons.forEach(function (btn, idx) {
            if (idx < lit) btn.classList.add("lit");
            else btn.classList.remove("lit");
        });
    }

    function fetchOwnRating(mediaId) {
        var url = SUPABASE_URL + "/rest/v1/ratings?media_id=eq." + encodeURIComponent(mediaId) +
            "&client_id=eq." + encodeURIComponent(clientId()) + "&select=stars&order=created_at.desc&limit=1";
        return fetch(url, { headers: baseHeaders() })
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (rows) { return rows.length ? Number(rows[0].stars) || 0 : 0; })
            .catch(function () { return 0; });
    }

    function buildCard(media, average, count) {
        var card = document.createElement("div");
        card.className = "media-card-item";
        card.style.cursor = "default";
        card.setAttribute("data-title", media.title.toLowerCase());

        var isVideo = media.type === "Video";
        var thumb = isVideo
            ? '<video src="' + media.streamUrl + '#t=1" preload="metadata" muted></video>'
            : "<span>🎵</span>";

        card.innerHTML =
            '<div class="card-thumb-box">' + thumb + "</div>" +
            '<div style="margin-top: 8px;"><strong></strong>' +
            '<div style="margin-top: 4px;"><small class="muted">' + (isVideo ? "🎬 Video" : "🎵 Audio") + "</small></div></div>";
        card.querySelector("strong").textContent = media.title;

        var widget = document.createElement("div");
        widget.className = "rating-widget";

        var stars = document.createElement("div");
        stars.className = "rating-stars";
        var starButtons = [];
        for (var i = 1; i <= 5; i++) {
            (function (value) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "rating-star";
                btn.textContent = "★";
                btn.setAttribute("aria-label", "Rate " + value + " stars");
                btn.addEventListener("click", function () {
                    paintStars(stars, value);
                    ownValue.textContent = String(value);
                    numberInput.value = value;
                    submitRating(media, value, function () { render(); });
                });
                starButtons.push(btn);
                stars.appendChild(btn);
            })(i);
        }

        var meta = document.createElement("small");
        meta.className = "rating-meta muted";
        meta.textContent = count > 0 ? "Avg " + average.toFixed(1) + " (" + count + ")" : "No ratings yet";

        var ownRow = document.createElement("div");
        ownRow.className = "rating-own";
        ownRow.innerHTML = "<span>You: <b>-</b></span>";
        var ownValue = ownRow.querySelector("b");
        ownValue.className = "rating-own-value";
        var numberInput = document.createElement("input");
        numberInput.type = "number";
        numberInput.min = "0";
        numberInput.max = "5";
        numberInput.step = "0.1";
        numberInput.className = "rating-input";
        numberInput.setAttribute("aria-label", "Type your rating");
        numberInput.addEventListener("change", function () {
            var value = parseFloat(numberInput.value);
            if (isNaN(value)) return;
            if (value < 0) value = 0;
            if (value > 5) value = 5;
            value = Math.round(value * 10) / 10;
            paintStars(stars, value);
            ownValue.textContent = String(value);
            submitRating(media, value, function () { render(); });
        });
        ownRow.appendChild(numberInput);

        widget.appendChild(stars);
        widget.appendChild(meta);
        widget.appendChild(ownRow);
        paintStars(stars, average);
        fetchOwnRating(media.id).then(function (own) {
            if (own > 0) {
                paintStars(stars, own);
                ownValue.textContent = String(Math.round(own * 10) / 10);
                numberInput.value = own;
            }
        });
        card.appendChild(widget);
        return card;
    }

    function render() {
        var grid = document.getElementById("ratingsGrid");
        if (!grid) return;
        Promise.all([loadMedia(), loadAverages()]).then(function (parts) {
            var items = parts[0];
            var averages = parts[1];
            items.forEach(function (item) {
                var entry = averages[item.id] || { total: 0, count: 0 };
                item.average = entry.count > 0 ? entry.total / entry.count : 0;
                item.votes = entry.count;
            });
            items.sort(function (a, b) { return b.average - a.average || b.votes - a.votes; });
            grid.innerHTML = "";
            if (!items.length) {
                grid.innerHTML = "<p>No media found.</p>";
                return;
            }
            items.forEach(function (item) {
                grid.appendChild(buildCard(item, item.average, item.votes));
            });
        }).catch(function (err) {
            console.error(err);
            grid.innerHTML = "<p>Could not load ratings.</p>";
        });
    }

    document.addEventListener("DOMContentLoaded", render);
})();

function filterRatings(query) {
    var grid = document.getElementById("ratingsGrid");
    if (!grid) return;
    var q = (query || "").toLowerCase().trim();
    var cards = grid.getElementsByClassName("media-card-item");
    for (var i = 0; i < cards.length; i++) {
        var title = cards[i].getAttribute("data-title") || "";
        cards[i].style.display = (!q || title.indexOf(q) !== -1) ? "" : "none";
    }
}
