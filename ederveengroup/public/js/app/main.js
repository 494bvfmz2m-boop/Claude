// EderveenGroup client: main
import { refreshMe } from './chrome.js';
import { loadFolders } from './folders.js';
import { loadMessages } from './list.js';
import { connectLive } from './live.js';
import { applyLook } from './look.js';
import { showEmptyReader } from './reader.js';
import { openSettings } from './settings.js';
import { state } from './state.js';
import { startTour } from './tour.js';
import { $, api, glide, toast } from './util.js';

(async function init() {
    try {
        const me = await api('api/me');
        state.me = me;
        state.settings = me.settings;
    } catch {
        return;
    }
    try {
        JSON.parse(localStorage.getItem('eg.trusted') || '[]').forEach(a => state.allowImagesFor.add(a));
    } catch {
        // ignore
    }
    applyLook();
    refreshMe();
    glide($('#chips'), $('.chip.active'));
    try {
        const left = sessionStorage.getItem('eg.recoveryLeft');
        if (left !== null) {
            sessionStorage.removeItem('eg.recoveryLeft');
            setTimeout(() => toast(`You used a recovery code. ${left} left.`, { action: 'Get new ones', onAction: () => openSettings('security'), duration: 9000 }), 1200);
        }
    } catch {
        // storage unavailable
    }
    showEmptyReader();
    const started = performance.now();
    // folders and the inbox load side by side; the inbox needs nothing from the folder list
    const folders = loadFolders();
    const messages = loadMessages();
    $('#folders').classList.add('intro');
    // leave the splash as soon as folders arrive (or after 1.4 s at most), once the logo has drawn
    await Promise.race([folders, new Promise(r => setTimeout(r, 1400))]);
    await new Promise(r => setTimeout(r, Math.max(0, 850 - (performance.now() - started))));
    const splash = $('#splash');
    if (splash) {
        splash.classList.add('out');
        setTimeout(() => splash.remove(), 600);
    }
    setTimeout(() => $('#folders').classList.remove('intro'), 1800);
    await Promise.allSettled([folders, messages]);
    connectLive();
    setInterval(loadFolders, 120000);
    if (!state.settings.tourDone) setTimeout(() => startTour(), 700);
    registerWorker();
})();

// lost connection: say so once, and catch up as soon as it's back
let offlineToast = null;
addEventListener('offline', () => {
    offlineToast = offlineToast || toast('You’re offline. Changes will wait until you’re back.', { error: true, duration: 0 });
});
addEventListener('online', () => {
    offlineToast?.close();
    offlineToast = null;
    toast('Back online');
    loadFolders();
    loadMessages({ quiet: true });
});

// installable app + instant start; a new deploy announces itself
function registerWorker() {
    if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost')) return;
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) toast('EderveenGroup was updated', { action: 'Reload', onAction: () => location.reload(), duration: 0 });
        hadController = true;
    });
    navigator.serviceWorker
        .register('sw.js', { scope: './' })
        .then(reg => setInterval(() => reg.update().catch(() => {}), 3600e3))
        .catch(() => {});
}
