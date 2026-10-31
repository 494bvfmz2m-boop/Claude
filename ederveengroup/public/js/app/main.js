// EderveenGroup client: main
import { refreshMe } from './chrome.js';
import { loadFolders, openFolder, renderFolders } from './folders.js';
import { loadMessages } from './list.js';
import { connectLive } from './live.js';
import { applyLook } from './look.js';
import './phone.js';
import { openMessage, showEmptyReader } from './reader.js';
import { folderOf, parse, queryOf, remember, start as startRouter, sync, titleFor } from './router.js';
import { closeSettings, openSettings } from './settings.js';
import { state } from './state.js';
import { startTour } from './tour.js';
import { $, api, glide, qs, toast } from './util.js';

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
    showEmptyReader({ quiet: true });
    const started = performance.now();
    // the address says what to show; the inbox can load alongside the folder list, anything
    // else needs the folder list first (to turn the address into a folder)
    const route = parse();
    const folders = loadFolders();
    const plainInbox = !route.search && !route.folderId && (!route.slug || route.slug === 'inbox');
    const messages = plainInbox
        ? loadMessages()
        : folders.then(() => {
              state.folder = folderOf(route) || 'INBOX';
              state.query = queryOf(route) || '';
              $('#search').value = state.query;
              renderFolders();
              return loadMessages();
          });
    $('#folders').classList.add('intro');
    // leave the splash as soon as folders arrive (or after 1.4 s at most), once the logo has drawn
    await Promise.race([folders, new Promise(r => setTimeout(r, 1400))]);
    await new Promise(r => setTimeout(r, Math.max(0, 850 - (performance.now() - started))));
    const splash = $('#splash');
    if (splash) {
        splash.classList.add('out');
        document.body.classList.add('app-in'); // the app comes into focus as the splash leaves
        setTimeout(() => splash.remove(), 600);
        setTimeout(() => document.body.classList.remove('app-in'), 1400);
    }
    setTimeout(() => $('#folders').classList.remove('intro'), 1800);
    await Promise.allSettled([folders, messages]);
    startRouter({
        async folder(path, query) {
            if (query) {
                state.folder = path;
                state.query = query;
                $('#search').value = query;
                renderFolders();
                await loadMessages();
            } else openFolder(path);
        },
        message: openLink,
        closeMessage() {
            $('#app').dataset.view = 'list';
            showEmptyReader();
        },
        settings: openSettings,
        closeSettings
    });
    if (route.settings) openSettings(route.settings);
    else if (route.link) openLink(route.link);
    document.title = titleFor();
    connectLive();
    setInterval(loadFolders, 120000);
    if (!state.settings.tourDone) setTimeout(() => startTour(), 700);
    else if (state.me.admin && state.me.pendingRequests && !route.settings)
        setTimeout(() => toast(`${state.me.pendingRequests} ${state.me.pendingRequests === 1 ? 'person wants' : 'people want'} to add their mail`, { action: 'Review', onAction: () => openSettings('admin'), duration: 9000 }), 1500);
    registerWorker();
})();

// a conversation from its address: in the loaded list, or asked from the server
async function openLink(link) {
    const listed = state.messages.find(m => m.link === link);
    if (listed) return listed.uid === state.openUid ? null : openMessage(listed.uid);
    try {
        const { uid } = await api('api/link?' + qs({ folder: state.folder, t: link }));
        remember(uid, link);
        if (uid !== state.openUid) await openMessage(uid);
    } catch {
        toast('That conversation isn’t here any more', { error: true });
        sync({ replace: true });
    }
}

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
