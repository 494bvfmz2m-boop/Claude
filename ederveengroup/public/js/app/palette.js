// EderveenGroup client: palette
import { archive, remove, setSeen, toggleStar } from './actions.js';
import { logout, toggleTheme } from './chrome.js';
import { composer, openComposer } from './composer.js';
import { openFolder } from './folders.js';
import { loadMessages, renderList, toggleCheck } from './list.js';
import { openMessage, showEmptyReader } from './reader.js';
import { openSettings } from './settings.js';
import { snoozeMenu } from './snooze.js';
import { FOLDER_ICONS, state } from './state.js';
import { $, esc, glide, h } from './util.js';

const SHORTCUTS = [
    ['C', 'Compose'],
    ['/', 'Search'],
    ['J', 'Next message'],
    ['K', 'Previous message'],
    ['R', 'Reply'],
    ['A', 'Reply all'],
    ['F', 'Forward'],
    ['E', 'Archive'],
    ['B', 'Snooze'],
    ['#', 'Delete'],
    ['S', 'Star / unstar'],
    ['U', 'Mark unread'],
    ['X', 'Select message'],
    ['Shift I', 'Mark read'],
    ['Ctrl K', 'Command palette'],
    ['Ctrl Enter', 'Send (in composer)'],
    ['Ctrl S', 'Save draft'],
    ['Esc', 'Close / back'],
    ['?', 'Show shortcuts']
];

function openPalette() {
    if ($('.palette')) return;
    const cmds = [
        { icon: 'pen', label: 'Compose new message', key: 'C', run: () => openComposer('new') },
        { icon: 'search', label: 'Search mail', key: '/', run: () => $('#search').focus() },
        { icon: 'refresh', label: 'Refresh', run: () => $('#refresh-btn').click() },
        ...state.folders.map(f => ({ icon: FOLDER_ICONS[f.specialUse] || 'folder', label: `Go to ${f.name}`, run: () => openFolder(f.path) })),
        { icon: 'moon', label: 'Toggle dark / light', run: () => toggleTheme() },
        ...(state.openUid ? [{ icon: 'clock', label: 'Snooze this conversation', key: 'B', run: () => snoozeMenu(innerWidth / 2 - 120, innerHeight / 3, [state.openUid]) }] : []),
        { icon: 'signature', label: 'Edit signatures', run: () => openSettings('sigs') },
        { icon: 'palette', label: 'Appearance', run: () => openSettings('look') },
        { icon: 'settings', label: 'Settings', run: () => openSettings('general') },
        { icon: 'keyboard', label: 'Keyboard shortcuts', key: '?', run: () => openSettings('keys') },
        { icon: 'logout', label: 'Sign out', run: logout }
    ];
    const back = h(`<div class="modal-back"><div class="modal palette"><input placeholder="Type a command…" aria-label="Command"><ul></ul></div></div>`);
    document.body.append(back);
    const input = $('input', back);
    const ul = $('ul', back);
    let shown = cmds;
    let idx = 0;
    const draw = () => {
        ul.innerHTML = shown.map((c, i) => `<li class="${i === idx ? 'on' : ''}" data-i="${i}">${icon(c.icon)}${esc(c.label)}${c.key ? `<kbd>${c.key}</kbd>` : ''}</li>`).join('') || '<li>No matches</li>';
        glide(ul, $('li.on', ul));
        $('li.on', ul)?.scrollIntoView({ block: 'nearest' });
    };
    const close = () => back.remove();
    const run = c => {
        close();
        c && c.run && c.run();
    };
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        shown = cmds.filter(c => q.split(/\s+/).every(w => c.label.toLowerCase().includes(w)));
        idx = 0;
        draw();
    });
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') idx = Math.min(idx + 1, shown.length - 1);
        else if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
        else if (e.key === 'Enter') return run(shown[idx]);
        else if (e.key === 'Escape') return close();
        else return;
        e.preventDefault();
        draw();
    });
    ul.addEventListener('click', e => {
        const li = e.target.closest('li[data-i]');
        if (li) run(shown[Number(li.dataset.i)]);
    });
    back.addEventListener('click', e => e.target === back && close());
    draw();
    input.focus();
}

function moveFocus(delta) {
    if (!state.messages.length) return;
    let i = state.messages.findIndex(m => m.uid === state.openUid);
    i = i < 0 ? 0 : Math.max(0, Math.min(state.messages.length - 1, i + delta));
    openMessage(state.messages[i].uid);
}

function onKey(e) {
    if (e.defaultPrevented) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') {
        e.preventDefault();
        return openPalette();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        if (k === 'Escape' && t.id === 'search') {
            t.value = '';
            t.blur();
            if (state.query) {
                state.query = '';
                loadMessages();
            }
        }
        return;
    }
    if ($('.modal-back')) return;
    const cur = state.openUid;
    const targets = state.checked.size ? [...state.checked] : cur ? [cur] : [];
    const map = {
        c: () => openComposer('new'),
        '/': () => $('#search').focus(),
        j: () => moveFocus(1),
        k: () => moveFocus(-1),
        ArrowDown: () => moveFocus(1),
        ArrowUp: () => moveFocus(-1),
        r: () => state.current && openComposer('reply', state.current),
        a: () => state.current && openComposer('replyAll', state.current),
        f: () => state.current && openComposer('forward', state.current),
        e: () => targets.length && archive(targets),
        b: () => {
            if (!targets.length) return;
            const r = ($(`.msg[data-uid="${targets[0]}"]`) || $('#messages')).getBoundingClientRect();
            snoozeMenu(Math.max(16, r.right - 300), r.top + 20, targets);
        },
        '#': () => targets.length && remove(targets),
        Delete: () => targets.length && remove(targets),
        s: () => targets.length && toggleStar(targets),
        u: () => {
            if (!targets.length) return;
            setSeen(targets, false);
            if (cur && targets.includes(cur)) showEmptyReader();
        },
        I: () => targets.length && setSeen(targets, true),
        x: () => cur && toggleCheck(cur),
        '?': () => openSettings('keys'),
        Escape: () => {
            if (composer && !composer.el.classList.contains('minimized')) return composer.el.classList.add('minimized');
            if (state.checked.size) {
                state.checked.clear();
                return renderList();
            }
            $('#app').dataset.view = 'list';
            $('#app').classList.remove('nav-open');
        }
    };
    const fn = map[k];
    if (fn) {
        e.preventDefault();
        fn();
    }
}
document.addEventListener('keydown', onKey);

export { SHORTCUTS, moveFocus, onKey, openPalette };
