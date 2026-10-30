// Applies the cached look before first paint so there is no flash.
(function () {
    var root = document.documentElement;
    // Pick dark or light text for whatever accent the user chose.
    window.egApplyAccent = function (hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return;
        var n = parseInt(m[1], 16);
        var lin = function (c) {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        var L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
        root.style.setProperty('--accent', '#' + m[1]);
        root.style.setProperty('--on-accent', L > 0.36 ? '#17130b' : '#ffffff');
    };
    try {
        var t = JSON.parse(localStorage.getItem('eg.look') || '{}');
        if (t.theme === 'light' || t.theme === 'dark') root.dataset.theme = t.theme;
        else root.dataset.theme = t.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        if (t.accent) window.egApplyAccent(t.accent);
        if (t.density) root.dataset.density = t.density;
    } catch (e) {
        root.dataset.theme = 'dark';
    }
})();
