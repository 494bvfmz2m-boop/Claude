// EderveenGroup service worker. It makes the app installable, loads the app's own files
// instantly from a local cache, and shows a friendly page when there's no connection.
// It never stores mail or anything else from /api/: that only ever lives on the server.
const VERSION = '%V%';
const CACHE = `eg-shell-${VERSION}`;
const BASE = '%BASE%';
const ASSETS = %ASSETS%;

self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('eg-shell-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || url.pathname.startsWith(`${BASE}api/`)) return;
    // pages always come from the network (they depend on your session); offline gets a notice
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(offlinePage));
        return;
    }
    // versioned files never change, so the cached copy is always right
    if (url.searchParams.has('v')) {
        event.respondWith(
            caches.match(req).then(
                hit =>
                    hit ||
                    fetch(req).then(res => {
                        if (res.ok && res.type === 'basic') {
                            const copy = res.clone();
                            caches.open(CACHE).then(cache => cache.put(req, copy));
                        }
                        return res;
                    })
            )
        );
    }
});

function offlinePage() {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="15"><title>Offline · EderveenGroup</title><style>
:root { color-scheme: dark; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(60rem 40rem at 70% -10%, #1b2a4d, transparent 60%), #0b0d12; color: #e8ecf4; font: 15px/1.6 system-ui, -apple-system, Segoe UI, sans-serif; text-align: center; }
main { max-width: 380px; padding: 32px; animation: up .6s cubic-bezier(.2,.8,.2,1) both; }
@keyframes up { from { opacity: 0; transform: translateY(14px); } }
.ring { width: 76px; height: 76px; margin: 0 auto 22px; border-radius: 50%; display: grid; place-items: center; background: #4c8dff1f; box-shadow: inset 0 0 0 1px #4c8dff55, 0 0 60px -10px #4c8dff; }
.ring svg { width: 34px; height: 34px; stroke: #8fb6ff; }
h1 { font: 400 30px/1.2 Georgia, serif; margin: 0 0 8px; }
p { color: #9aa4b8; margin: 0 0 24px; }
a { display: inline-block; padding: 10px 18px; border-radius: 11px; background: #4c8dff; color: #fff; text-decoration: none; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { main { animation: none; } }
</style></head><body><main><div class="ring"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/></svg></div>
<h1>You're offline</h1><p>EderveenGroup will reconnect as soon as your connection is back. This page retries on its own.</p><a href="${BASE}">Try again</a></main></body></html>`;
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:" } });
}
