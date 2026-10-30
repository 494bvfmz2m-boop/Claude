// Applies the cached theme before first paint so there is no flash.
(function () {
    try {
        var t = JSON.parse(localStorage.getItem('pm.look') || '{}');
        var root = document.documentElement;
        if (t.theme === 'light' || t.theme === 'dark') root.dataset.theme = t.theme;
        else if (t.theme === 'system' || !t.theme) root.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        if (t.accent) root.style.setProperty('--accent', t.accent);
        if (t.density) root.dataset.density = t.density;
    } catch (e) {
        document.documentElement.dataset.theme = 'dark';
    }
})();
