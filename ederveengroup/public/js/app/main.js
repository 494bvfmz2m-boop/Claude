// EderveenGroup client: main
import { refreshMe } from './chrome.js';
import { loadFolders } from './folders.js';
import { loadMessages } from './list.js';
import { connectLive } from './live.js';
import { applyLook } from './look.js';
import { showEmptyReader } from './reader.js';
import { openSettings } from './settings.js';
import { state } from './state.js';
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
})();
