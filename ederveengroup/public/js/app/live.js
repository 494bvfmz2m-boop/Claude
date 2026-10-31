// EderveenGroup client: live
import { loadFolders, openFolder } from './folders.js';
import { loadMessages } from './list.js';
import { folderInfo, state } from './state.js';
import { $, debounce, toast } from './util.js';

let es = null;
function connectLive() {
    if (!window.EventSource) return;
    es = new EventSource('api/events');
    const dot = $('#live-dot');
    const text = $('#live-text');
    es.addEventListener('ready', () => {
        dot.classList.add('on');
        text.textContent = 'Live';
    });
    es.addEventListener('unavailable', () => {
        es.close();
        dot.classList.remove('on');
        text.textContent = 'Polling';
        setTimeout(connectLive, 60000);
    });
    es.addEventListener('signedout', () => {
        es.close();
        location.replace('login?signedout=1');
    });
    es.onerror = () => {
        dot.classList.remove('on');
        text.textContent = 'Reconnecting…';
    };
    es.addEventListener('snooze', e => {
        const { woke } = JSON.parse(e.data || '{}');
        toast(`${woke} snoozed conversation${woke > 1 ? 's are' : ' is'} back`, { action: 'View', onAction: () => openFolder('INBOX') });
        loadFolders();
        if (state.folder === 'INBOX') loadMessages({ quiet: true });
    });
    es.addEventListener('mailbox', debounce(async e => {
        const evt = JSON.parse(e.data || '{}');
        const before = (folderInfo('INBOX') || {}).unseen || 0;
        await loadFolders();
        const after = (folderInfo('INBOX') || {}).unseen || 0;
        if (state.folder === 'INBOX' && state.page === 0 && !state.query) loadMessages({ quiet: true });
        if (evt.type === 'exists' && after > before) {
            toast(`${after - before} new message${after - before > 1 ? 's' : ''}`, { action: state.folder === 'INBOX' ? null : 'View', onAction: () => openFolder('INBOX') });
            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                new Notification('EderveenGroup', { body: `${after - before} new message${after - before > 1 ? 's' : ''}`, icon: 'favicon.svg' });
            }
        }
    }, 400));
}

export { connectLive, es };
