// EderveenGroup client: actions
import { askConfirm } from './dialogs.js';
import { loadFolders } from './folders.js';
import { loadMessages, renderList, threads } from './list.js';
import { showMenu } from './menus.js';
import { openMessage, renderReaderBar, showEmptyReader } from './reader.js';
import { FOLDER_ICONS, folderInfo, specialPath, state } from './state.js';
import { $, api, flyToFolder, qs, toast } from './util.js';
import { confetti } from './zero.js';

function patchLocal(uids, fn) {
    state.messages.filter(m => uids.includes(m.uid)).forEach(fn);
    if (state.current && uids.includes(state.current.uid)) fn(state.current);
}
const addFlag = (m, f) => m.flags.includes(f) || m.flags.push(f);
const dropFlag = (m, f) => (m.flags = m.flags.filter(x => x !== f));

async function setFlags(uids, add, remove) {
    try {
        await api('api/messages/flags', { method: 'POST', body: { folder: state.folder, uids, add, remove } });
    } catch (e) {
        toast(e.message, { error: true });
        loadMessages({ quiet: true });
    }
}
async function setSeen(uids, seen) {
    patchLocal(uids, m => (seen ? addFlag(m, '\\Seen') : dropFlag(m, '\\Seen')));
    renderList();
    await setFlags(uids, seen ? ['\\Seen'] : [], seen ? [] : ['\\Seen']);
    loadFolders();
}
async function toggleStar(uids) {
    const allStarred = uids.every(u => {
        const m = state.messages.find(x => x.uid === u) || state.current;
        return m && m.flags.includes('\\Flagged');
    });
    patchLocal(uids, m => (allStarred ? dropFlag(m, '\\Flagged') : addFlag(m, '\\Flagged')));
    renderList();
    if (!allStarred) uids.forEach(u => $(`.msg[data-uid="${u}"] .star-btn`)?.classList.add('burst'));
    if (state.current && uids.includes(state.current.uid)) renderReaderBar();
    await setFlags(uids, allStarred ? [] : ['\\Flagged'], allStarred ? ['\\Flagged'] : []);
}

function dropFromList(uids, toPath) {
    flyToFolder(uids.map(u => $(`.msg[data-uid="${u}"]`)).filter(Boolean), toPath);
    // rows (conversations) before the change, to know which one comes next
    const order = threads.map(t => t.uid);
    const removedRows = new Set(threads.filter(t => t.messages.every(m => uids.includes(m.uid))).map(t => t.uid));
    const idx = order.findIndex(u => removedRows.has(u));
    state.messages = state.messages.filter(m => !uids.includes(m.uid));
    state.total = Math.max(0, state.total - uids.length);
    uids.forEach(u => state.checked.delete(u));
    if (!state.messages.length && state.folder === 'INBOX' && !state.query && !state.filter && state.page === 0 && state.total === 0) setTimeout(confetti, 120);
    if (state.openUid && uids.includes(state.openUid)) {
        const remaining = order.filter(u => !removedRows.has(u));
        const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)];
        const wide = matchMedia('(min-width: 761px)').matches;
        if (next && state.settings.afterAction !== 'list' && (wide || state.settings.readingPane === 'off')) openMessage(next);
        else {
            showEmptyReader();
            $('#app').dataset.view = 'list';
        }
    }
    // let the removed rows slide out and collapse before re-rendering
    const rows = uids.map(u => $(`.msg[data-uid="${u}"]`)).filter(Boolean);
    if (rows.length && rows.length <= 40 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        rows.forEach((r, n) => {
            r.style.height = r.offsetHeight + 'px';
            r.style.animationDelay = `${Math.min(n, 10) * 18}ms`;
            r.classList.add('out');
        });
        setTimeout(() => renderList(), 300 + Math.min(rows.length, 10) * 18);
    } else renderList();
}

async function moveTo(uids, target, label) {
    const from = state.folder;
    dropFromList(uids, target.startsWith('\\') ? specialPath(target) : target);
    try {
        const r = await api('api/messages/move', { method: 'POST', body: { folder: from, uids, to: target } });
        const name = label || folderInfo(r.movedTo).name;
        toast(`${uids.length > 1 ? `${uids.length} conversations` : 'Conversation'} moved to ${name}`);
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
        loadMessages({ quiet: true });
    }
}
const archive = uids => {
    if (folderInfo(state.folder).specialUse === '\\Archive') return toast('Already archived');
    moveTo(uids, '\\Archive', 'Archive');
};
async function remove(uids) {
    const from = state.folder;
    const inTrash = folderInfo(from).specialUse === '\\Trash';
    if (inTrash && !(await askConfirm({ title: 'Delete forever?', message: `${uids.length > 1 ? `These ${uids.length} messages` : 'This message'} will be gone for good.`, icon: 'trash', confirm: 'Delete forever', danger: true }))) return;
    dropFromList(uids, inTrash ? null : specialPath('\\Trash'));
    try {
        const r = await api('api/messages/delete', { method: 'POST', body: { folder: from, uids } });
        if (r.movedTo) {
            toast(`Moved to Trash`, {
                action: 'Undo',
                onAction: async () => {
                    // pull the newest matching uids back out of Trash
                    const t = await api('api/messages?' + qs({ folder: r.movedTo }));
                    const back = t.messages.slice(0, uids.length).map(m => m.uid);
                    await api('api/messages/move', { method: 'POST', body: { folder: r.movedTo, uids: back, to: from } });
                    loadFolders();
                    if (state.folder === from) loadMessages({ quiet: true });
                }
            });
        } else toast('Deleted forever');
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
        loadMessages({ quiet: true });
    }
}

function pickFolder(x, y, uids) {
    const targets = state.folders.filter(f => f.path !== state.folder && f.specialUse !== '\\Drafts');
    showMenu(x, y, targets.map(f => ({ icon: FOLDER_ICONS[f.specialUse] || 'folder', label: f.name, run: () => moveTo(uids, f.path) })));
}

export { addFlag, archive, dropFlag, dropFromList, moveTo, patchLocal, pickFolder, remove, setFlags, setSeen, toggleStar };
