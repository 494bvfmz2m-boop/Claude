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
    // phones get the Apple-style look (light unless chosen otherwise); computers Midnight aurora
    // (inside a pop-up on this site, like Jarvis's, look at the page around it)
    var host = window;
    try {
        if (window.parent !== window && window.parent.matchMedia) host = window.parent;
    } catch (e) {
        host = window;
    }
    var phone = host.matchMedia('(max-width: 760px)').matches;
    root.dataset.device = phone ? 'phone' : 'desk';
    try {
        var t = JSON.parse(localStorage.getItem('eg.look') || '{}');
        var chosen = phone ? t.phoneTheme || 'light' : t.theme || 'dark';
        root.dataset.theme = chosen === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : chosen;
        if (t.accent) window.egApplyAccent(t.accent);
        if (t.density) root.dataset.density = t.density;
    } catch (e) {
        root.dataset.theme = phone ? 'light' : 'dark';
    }

    // Motion. Each app plays its own entrance when it first opens (html.m-intro), not on every later
    // update: the class goes once the page has its content and the entrance has had time to play.
    root.classList.add('m-intro');
    var started = Date.now();
    (function settle() {
        var loading = document.readyState === 'loading' || document.querySelector('main > .pf-loading, main > .spinner, .ea > .pf-loading');
        if (!loading || Date.now() - started > 8000) return setTimeout(function () {
            root.classList.remove('m-intro');
        }, 2200);
        setTimeout(settle, 120);
    })();
    // Page to page: tell the transition which way we're going (into an app, back to the dashboard,
    // or in from the sign-in page), so it can zoom in, out, or open up. The page we leave notes where
    // it was; the page we arrive on reads it.
    addEventListener('pageswap', function (e) {
        if (!e.viewTransition) return;
        try {
            sessionStorage.setItem('eg-from', location.pathname);
        } catch (x) {
            /* private window: just the plain glide */
        }
    });
    addEventListener('pagereveal', function (e) {
        var from = '';
        try {
            from = sessionStorage.getItem('eg-from') || '';
            sessionStorage.removeItem('eg-from');
        } catch (x) {
            from = '';
        }
        if (!e.viewTransition || !e.viewTransition.types) return;
        var to = location.pathname;
        var type = /^\/(login|welcome)/.test(from) ? 'eg-signin' : to === '/' && from && from !== '/' ? 'eg-back' : from === '/' && to !== '/' ? 'eg-open' : '';
        if (type) e.viewTransition.types.add(type);
    });
})();
