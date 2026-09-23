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
