// EderveenGroup client: folders
import { moveTo } from './actions.js';
import { askConfirm, askText } from './dialogs.js';
import { loadMessages, renderGreeting, renderList, renderTitle } from './list.js';
import { showMenu } from './menus.js';
import { renderWelcome, showEmptyReader } from './reader.js';
import { FOLDER_ICONS, folderInfo, state } from './state.js';
import { $, $$, api, caught, esc, glide, qs, toast } from './util.js';

async function loadFolders() {
    try {
        state.folders = await api('api/folders');
    } catch (e) {
        return toast(e.message, { error: true });
    }
    renderFolders();
}

const lastCounts = new Map();
function renderFolders() {
    const special = state.folders.filter(f => f.specialUse);
    const custom = state.folders.filter(f => !f.specialUse);
    const row = f => {
        const unread = ['\\Drafts', '\\Snoozed'].includes(f.specialUse) ? f.messages : f.unseen;
        const showUnread = unread && !['\\Sent', '\\Trash', '\\Archive'].includes(f.specialUse);
        const depth = f.delimiter ? f.path.split(f.delimiter).length - 1 : 0;
        return `<button class="folder${f.path === state.folder ? ' active' : ''}"${f.path === state.folder ? ' aria-current="page"' : ''} data-path="${esc(f.path)}" style="${depth ? `padding-left:${12 + depth * 16}px` : ''}">
            ${icon(FOLDER_ICONS[f.specialUse] || 'folder')}<span class="name">${esc(f.name)}</span>
            ${showUnread ? `<span class="count${['\\Drafts', '\\Snoozed'].includes(f.specialUse) ? '' : ' unread'}">${unread}</span>` : ''}</button>`;
    };
    $('#folders').innerHTML =
        special.map(row).join('') +
        `<div class="folder-section">Folders<button id="new-folder" title="New folder">${icon('plus')}</button></div>` +
        custom.map(row).join('');
    glide($('#folders'), $('#folders .folder.active'));
    renderTitle();
    if (caught && performance.now() - caught.t < 600) $(`#folders .folder[data-path="${CSS.escape(caught.path)}"]`)?.classList.add('catch');
    // bump a badge when its unread count goes up
    $$('#folders .folder').forEach((el, i) => {
        el.style.setProperty('--i', i);
        const f = folderInfo(el.dataset.path);
        const prev = lastCounts.get(f.path);
        if (prev !== undefined && f.unseen > prev) el.querySelector('.count')?.classList.add('bump');
        lastCounts.set(f.path, f.unseen);
    });
    const inbox = state.folders.find(f => f.path === 'INBOX');
    const n = inbox ? inbox.unseen : 0;
    if (state.me) {
        renderGreeting();
        if (!state.openUid && $('.welcome')) renderWelcome();
    }
    document.title = `${n ? `(${n}) ` : ''}${folderInfo(state.folder).name} · EderveenGroup`;
}

$('#folders').addEventListener('click', e => {
    if (e.target.closest('#new-folder')) return newFolder();
    const btn = e.target.closest('.folder');
    if (btn) openFolder(btn.dataset.path);
});
$('#folders').addEventListener('contextmenu', e => {
    const btn = e.target.closest('.folder');
    if (!btn) return;
    e.preventDefault();
    const f = folderInfo(btn.dataset.path);
    const items = [{ icon: 'mailOpen', label: 'Mark all read', run: () => markAllRead(f.path) }];
    if (['\\Trash', '\\Junk'].includes(f.specialUse)) items.push({ icon: 'trash', label: `Empty ${f.name}`, danger: true, run: () => emptyFolder(f) });
    if (!f.specialUse) items.push({ icon: 'trash', label: 'Delete folder', danger: true, run: () => deleteFolder(f) });
    showMenu(e.clientX, e.clientY, items);
});

// drag messages onto folders
$('#folders').addEventListener('dragover', e => {
    const btn = e.target.closest('.folder');
    if (!btn || btn.dataset.path === state.folder) return;
    e.preventDefault();
    $$('.folder.drop-target').forEach(x => x !== btn && x.classList.remove('drop-target'));
    btn.classList.add('drop-target');
});
$('#folders').addEventListener('dragleave', e => {
    const btn = e.target.closest('.folder');
    if (btn && !btn.contains(e.relatedTarget)) btn.classList.remove('drop-target');
});
$('#folders').addEventListener('drop', e => {
    const btn = e.target.closest('.folder');
    $$('.folder.drop-target').forEach(x => x.classList.remove('drop-target'));
    if (!btn) return;
    e.preventDefault();
    const uids = JSON.parse(e.dataTransfer.getData('application/x-eg') || '[]');
    if (uids.length) moveTo(uids, btn.dataset.path);
});

async function newFolder() {
    const name = await askText({ title: 'New folder', message: 'What should it be called?', icon: 'folder', confirm: 'Create folder', input: { placeholder: 'e.g. Projects' } });
    if (!name) return;
    try {
        await api('api/folders', { method: 'POST', body: { name } });
        toast(`Created “${name}”`);
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
    }
}
async function deleteFolder(f) {
    if (!(await askConfirm({ title: `Delete “${f.name}”?`, message: 'The folder and every message in it will be deleted for good.', icon: 'trash', confirm: 'Delete folder', danger: true }))) return;
    try {
        await api('api/folders?' + qs({ folder: f.path }), { method: 'DELETE' });
        if (state.folder === f.path) openFolder('INBOX');
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
    }
}
async function emptyFolder(f) {
    if (!(await askConfirm({ title: `Empty ${f.name}?`, message: 'Every message in it will be deleted for good. This can’t be undone.', icon: 'trash', confirm: `Empty ${f.name}`, danger: true }))) return;
    try {
        await api('api/folders/empty', { method: 'POST', body: { folder: f.path } });
        toast(`${f.name} emptied`);
        loadFolders();
        if (state.folder === f.path) loadMessages();
    } catch (e) {
        toast(e.message, { error: true });
    }
}
async function markAllRead(path) {
    try {
        const list = path === state.folder ? state.messages : [];
        const uids = list.filter(m => !m.flags.includes('\\Seen')).map(m => m.uid);
        if (path !== state.folder) {
            const r = await api('api/messages?' + qs({ folder: path, filter: 'unread' }));
            uids.push(...r.messages.map(m => m.uid));
        }
        if (!uids.length) return toast('Nothing unread here');
        await api('api/messages/flags', { method: 'POST', body: { folder: path, uids, add: ['\\Seen'] } });
        list.forEach(m => m.flags.includes('\\Seen') || m.flags.push('\\Seen'));
        renderList();
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
    }
}

function openFolder(path, { keepSearch = false } = {}) {
    const order = state.folders.map(f => f.path);
    $('#messages').style.setProperty('--dir', order.indexOf(path) < order.indexOf(state.folder) ? '-1' : '1');
    state.folder = path;
    state.page = 0;
    state.focusUid = null;
    if (!keepSearch) {
        state.query = '';
        $('#search').value = '';
    }
    state.checked.clear();
    $('#app').classList.remove('nav-open');
    $('#app').dataset.view = 'list';
    renderFolders();
    loadMessages();
    showEmptyReader();
}

export { deleteFolder, emptyFolder, lastCounts, loadFolders, markAllRead, newFolder, openFolder, renderFolders };
