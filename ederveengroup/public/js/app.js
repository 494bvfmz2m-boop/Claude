/* EderveenGroup client */
(function () {
    'use strict';

    /* ================= helpers ================= */

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const debounce = (fn, ms) => {
        let t;
        return (...a) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...a), ms);
        };
    };
    const h = html => {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    };

    async function api(path, opts = {}) {
        const init = { method: opts.method || 'GET', headers: { 'X-EG': '1' } };
        if (opts.form) init.body = opts.form;
        else if (opts.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }
        const res = await fetch(path, init);
        if (res.status === 401) {
            location.replace('/login');
            throw new Error('Signed out');
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
    }
    const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

    function toast(text, { error = false, action, onAction, duration = 4000 } = {}) {
        const el = h(`<div class="toast${error ? ' error' : ''}"><span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}${duration ? `<i class="bar" style="animation-duration:${duration}ms"></i>` : ''}</div>`);
        const close = () => {
            el.style.transition = '.2s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            setTimeout(() => el.remove(), 200);
        };
        if (action) {
            $('button', el).onclick = () => {
                close();
                onAction && onAction();
            };
        }
        $('#toasts').append(el);
        if (duration) setTimeout(close, duration);
        return { el, close };
    }

    function fmtDate(iso, long) {
        const d = new Date(iso);
        const now = new Date();
        if (long) return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return 'Yesterday';
        if (now - d < 6 * 864e5) return d.toLocaleDateString(undefined, { weekday: 'short' });
        if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return d.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' });
    }
    const fmtSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

    function hue(str) {
        let x = 0;
        for (const c of String(str).toLowerCase()) x = (x * 31 + c.charCodeAt(0)) >>> 0;
        return x % 360;
    }
    function avatar(person, size = '') {
        const label = (person && (person.name || person.address)) || '?';
        const parts = label.replace(/["'<>]/g, '').split(/[\s._@-]+/).filter(Boolean);
        const initials = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
        const hh = hue((person && person.address) || label);
        return `<div class="avatar ${size}" style="--h:${hh}">${esc(initials)}</div>`;
    }
    const personName = p => (p ? p.name || p.address : '');
    const fmtAddr = p => (p.name ? `${p.name} <${p.address}>` : p.address);
    const fmtAddrList = list => list.map(fmtAddr).join(', ');

    /* ================= state ================= */

    const state = {
        me: null,
        settings: null,
        folders: [],
        folder: 'INBOX',
        page: 0,
        total: 0,
        pageSize: 50,
        query: '',
        filter: '',
        messages: [],
        openUid: null,
        current: null, // full message open in reader
        checked: new Set(),
        lastChecked: null,
        allowImagesFor: new Set()
    };

    const FOLDER_ICONS = { '\\Inbox': 'inbox', '\\Sent': 'send', '\\Drafts': 'draft', '\\Trash': 'trash', '\\Junk': 'junk', '\\Archive': 'archive', '\\Flagged': 'star', '\\All': 'mail' };
    const folderInfo = path => state.folders.find(f => f.path === path) || { path, name: path };
    const specialPath = use => (state.folders.find(f => f.specialUse === use) || {}).path;
    const isDrafts = () => folderInfo(state.folder).specialUse === '\\Drafts';
    const isSentLike = () => ['\\Sent', '\\Drafts'].includes(folderInfo(state.folder).specialUse);

    /* ================= look & feel ================= */

    function applyLook() {
        const s = state.settings;
        const root = document.documentElement;
        const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
        root.dataset.theme = theme;
        root.dataset.density = s.density;
        window.egApplyAccent(s.accent);
        $('meta[name=theme-color]').content = theme === 'light' ? '#f1efea' : '#09090b';
        $('#theme-btn').innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
        try {
            localStorage.setItem('eg.look', JSON.stringify({ theme: s.theme, accent: s.accent, density: s.density }));
        } catch {
            // private mode
        }
    }

    const saveSettings = async patch => {
        Object.assign(state.settings, patch);
        applyLook();
        try {
            state.settings = await api('/api/settings', { method: 'PUT', body: patch });
        } catch (e) {
            toast(e.message, { error: true });
        }
    };

    /* ================= folders ================= */

    async function loadFolders() {
        try {
            state.folders = await api('/api/folders');
        } catch (e) {
            return toast(e.message, { error: true });
        }
        renderFolders();
    }

    function renderFolders() {
        const special = state.folders.filter(f => f.specialUse);
        const custom = state.folders.filter(f => !f.specialUse);
        const row = f => {
            const unread = f.specialUse === '\\Drafts' ? f.messages : f.unseen;
            const showUnread = unread && !['\\Sent', '\\Trash', '\\Archive'].includes(f.specialUse);
            const depth = f.delimiter ? f.path.split(f.delimiter).length - 1 : 0;
            return `<button class="folder${f.path === state.folder ? ' active' : ''}" data-path="${esc(f.path)}" style="${depth ? `padding-left:${12 + depth * 16}px` : ''}">
                ${icon(FOLDER_ICONS[f.specialUse] || 'folder')}<span class="name">${esc(f.name)}</span>
                ${showUnread ? `<span class="count${f.specialUse === '\\Drafts' ? '' : ' unread'}">${unread}</span>` : ''}</button>`;
        };
        $('#folders').innerHTML =
            special.map(row).join('') +
            `<div class="folder-section">Folders<button id="new-folder" title="New folder">${icon('plus')}</button></div>` +
            custom.map(row).join('');
        const inbox = state.folders.find(f => f.path === 'INBOX');
        const n = inbox ? inbox.unseen : 0;
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
        const name = prompt('New folder name');
        if (!name) return;
        try {
            await api('/api/folders', { method: 'POST', body: { name } });
            toast(`Created “${name}”`);
            loadFolders();
        } catch (e) {
            toast(e.message, { error: true });
        }
    }
    async function deleteFolder(f) {
        if (!confirm(`Delete the folder “${f.name}” and everything in it?`)) return;
        try {
            await api('/api/folders?' + qs({ folder: f.path }), { method: 'DELETE' });
            if (state.folder === f.path) openFolder('INBOX');
            loadFolders();
        } catch (e) {
            toast(e.message, { error: true });
        }
    }
    async function emptyFolder(f) {
        if (!confirm(`Permanently delete every message in ${f.name}?`)) return;
        try {
            await api('/api/folders/empty', { method: 'POST', body: { folder: f.path } });
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
                const r = await api('/api/messages?' + qs({ folder: path, filter: 'unread' }));
                uids.push(...r.messages.map(m => m.uid));
            }
            if (!uids.length) return toast('Nothing unread here');
            await api('/api/messages/flags', { method: 'POST', body: { folder: path, uids, add: ['\\Seen'] } });
            list.forEach(m => m.flags.includes('\\Seen') || m.flags.push('\\Seen'));
            renderList();
            loadFolders();
        } catch (e) {
            toast(e.message, { error: true });
        }
    }

    function openFolder(path) {
        state.folder = path;
        state.page = 0;
        state.query = '';
        $('#search').value = '';
        state.checked.clear();
        $('#app').classList.remove('nav-open');
        $('#app').dataset.view = 'list';
        renderFolders();
        loadMessages();
        showEmptyReader();
    }

    /* ================= message list ================= */

    // Lists are cached per view and shown instantly, then refreshed in the background.
    const listCache = new Map();
    const listKey = () => [state.folder, state.page, state.query, state.filter].join('\u0000');

    let listToken = 0;
    async function loadMessages({ quiet = false } = {}) {
        const token = ++listToken;
        const info = folderInfo(state.folder);
        $('#folder-title').innerHTML = esc(state.query ? `Search` : info.name) + (state.query ? `<span class="sub">“${esc(state.query)}”</span>` : '');
        const cached = listCache.get(listKey());
        if (cached && !quiet) {
            state.messages = cached.messages;
            state.total = cached.total;
            renderList(true);
            quiet = true;
        } else if (!quiet) {
            $('#messages').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="skeleton" style="opacity:${1 - i * 0.1}"><div class="b" style="width:36px;height:36px;border-radius:50%"></div><div style="flex:1"><div class="b" style="height:11px;width:38%;margin:4px 0 9px"></div><div class="b" style="height:10px;width:82%;margin-bottom:7px"></div><div class="b" style="height:10px;width:58%"></div></div></div>`).join('');
        }
        try {
            const r = await api('/api/messages?' + qs({ folder: state.folder, page: state.page, q: state.query, filter: state.filter }));
            if (token !== listToken) return;
            state.messages = r.messages;
            state.total = r.total;
            state.pageSize = r.pageSize;
            renderList(!quiet);
        } catch (e) {
            if (token !== listToken) return;
            $('#messages').innerHTML = `<div class="empty"><div><div class="big">${icon('junk')}</div><h3>Couldn’t load mail</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div></div>`;
            $('#retry').onclick = () => loadMessages();
        }
    }

    function renderList(animate = false) {
        const list = $('#messages');
        listCache.set(listKey(), { messages: state.messages, total: state.total });
        const start = state.page * state.pageSize;
        $('#range').textContent = state.total ? `${start + 1}–${Math.min(start + state.messages.length, state.total)} of ${state.total.toLocaleString()}` : '';
        $('#prev-page').disabled = state.page === 0;
        $('#next-page').disabled = start + state.messages.length >= state.total;
        if (!state.messages.length) {
            const zero = state.query || state.filter
                ? ['search', 'Nothing matches', 'Try a different search or filter.']
                : ['sparkle', 'All caught up', 'Nothing here. Enjoy the quiet.'];
            list.innerHTML = `<div class="empty"><div><div class="big">${icon(zero[0])}</div><h3>${zero[1]}</h3><p>${zero[2]}</p></div></div>`;
            updateBulk();
            return;
        }
        const showTo = isSentLike();
        list.innerHTML = state.messages
            .map((m, i) => {
                const unread = !m.flags.includes('\\Seen');
                const starred = m.flags.includes('\\Flagged');
                const who = showTo ? m.to[0] : m.from[0];
                const whoText = showTo ? `To: ${m.to.map(personName).join(', ') || '(no recipients)'}` : personName(who) || '(unknown)';
                return `<div class="msg${animate ? ' enter' : ''}${unread ? ' unread' : ''}${m.uid === state.openUid ? ' selected' : ''}${state.checked.has(m.uid) ? ' checked' : ''}" data-uid="${m.uid}" draggable="true"${animate ? ` style="animation-delay:${Math.min(i, 14) * 22}ms"` : ''}>
                    <div class="sel-toggle" title="Select">${state.checked.has(m.uid) ? `<div class="avatar check">${icon('check')}</div>` : avatar(who)}</div>
                    <div class="msg-body">
                        <div class="msg-top"><span class="msg-from">${esc(whoText)}</span>
                            <span class="msg-meta">${m.flags.includes('\\Answered') ? icon('reply') : ''}${m.hasAttachments ? icon('clip') : ''}</span>
                            <span class="msg-date">${fmtDate(m.date)}</span></div>
                        <div class="msg-top"><div class="msg-subject" style="flex:1">${esc(m.subject || '(no subject)')}</div>
                            <button class="star-btn${starred ? ' on' : ''}" title="Star (S)">${icon('star')}</button></div>
                        <div class="msg-preview">${esc(m.preview)}</div>
                    </div></div>`;
            })
            .join('');
        updateBulk();
    }

    $('#messages').addEventListener('click', e => {
        const row = e.target.closest('.msg');
        if (!row) return;
        const uid = Number(row.dataset.uid);
        if (e.target.closest('.star-btn')) return toggleStar([uid]);
        if (e.target.closest('.sel-toggle') || e.metaKey || e.ctrlKey || e.shiftKey) return toggleCheck(uid, e.shiftKey);
        openMessage(uid);
    });
    $('#messages').addEventListener('dragstart', e => {
        const row = e.target.closest('.msg');
        if (!row) return;
        const uid = Number(row.dataset.uid);
        const uids = state.checked.has(uid) ? [...state.checked] : [uid];
        e.dataTransfer.setData('application/x-eg', JSON.stringify(uids));
        e.dataTransfer.effectAllowed = 'move';
        const ghost = h(`<div class="toast" style="position:fixed;top:-100px">${icon('mail')} Move ${uids.length} message${uids.length > 1 ? 's' : ''}</div>`);
        document.body.append(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);
        setTimeout(() => ghost.remove());
    });
    $('#messages').addEventListener('contextmenu', e => {
        const row = e.target.closest('.msg');
        if (!row) return;
        e.preventDefault();
        const uid = Number(row.dataset.uid);
        const m = state.messages.find(x => x.uid === uid);
        const uids = state.checked.has(uid) ? [...state.checked] : [uid];
        const read = m.flags.includes('\\Seen');
        showMenu(e.clientX, e.clientY, [
            { icon: 'reply', label: 'Reply', run: () => withMessage(uid, msg => openComposer('reply', msg)) },
            { icon: 'forward', label: 'Forward', run: () => withMessage(uid, msg => openComposer('forward', msg)) },
            '-',
            { icon: read ? 'mail' : 'mailOpen', label: read ? 'Mark unread' : 'Mark read', run: () => setSeen(uids, !read) },
            { icon: 'star', label: m.flags.includes('\\Flagged') ? 'Unstar' : 'Star', run: () => toggleStar(uids) },
            { icon: 'archive', label: 'Archive', run: () => archive(uids) },
            { icon: 'folder', label: 'Move to…', run: () => pickFolder(e.clientX, e.clientY, uids) },
            { icon: 'junk', label: 'Report spam', run: () => moveTo(uids, '\\Junk') },
            '-',
            { icon: 'trash', label: 'Delete', danger: true, run: () => remove(uids) }
        ]);
    });

    function toggleCheck(uid, range) {
        if (range && state.lastChecked != null) {
            const ids = state.messages.map(m => m.uid);
            const [a, b] = [ids.indexOf(state.lastChecked), ids.indexOf(uid)].sort((x, y) => x - y);
            ids.slice(a, b + 1).forEach(id => state.checked.add(id));
        } else if (state.checked.has(uid)) state.checked.delete(uid);
        else state.checked.add(uid);
        state.lastChecked = uid;
        renderList();
    }
    function updateBulk() {
        const n = state.checked.size;
        $('#bulk').classList.toggle('hidden', !n);
        $('#bulk-count').textContent = `${n} selected`;
    }
    $('#bulk-clear').onclick = () => {
        state.checked.clear();
        renderList();
    };
    $('#bulk').addEventListener('click', e => {
        const b = e.target.closest('[data-bulk]');
        if (!b) return;
        const uids = [...state.checked];
        const act = b.dataset.bulk;
        if (act === 'read') setSeen(uids, true);
        if (act === 'unread') setSeen(uids, false);
        if (act === 'star') toggleStar(uids);
        if (act === 'archive') archive(uids);
        if (act === 'delete') remove(uids);
        if (act === 'move') {
            const r = b.getBoundingClientRect();
            pickFolder(r.left, r.bottom + 4, uids);
        }
    });

    $('#prev-page').onclick = () => {
        if (state.page > 0) {
            state.page--;
            loadMessages();
        }
    };
    $('#next-page').onclick = () => {
        state.page++;
        loadMessages();
    };
    $('#refresh-btn').onclick = () => {
        loadFolders();
        loadMessages();
    };
    $('#chips').addEventListener('click', e => {
        const c = e.target.closest('.chip');
        if (!c) return;
        $$('.chip').forEach(x => x.classList.toggle('active', x === c));
        state.filter = c.dataset.filter;
        state.page = 0;
        loadMessages();
    });
    $('#search').addEventListener(
        'input',
        debounce(e => {
            state.query = e.target.value.trim();
            state.page = 0;
            loadMessages();
        }, 350)
    );

    /* ================= message actions ================= */

    function patchLocal(uids, fn) {
        state.messages.filter(m => uids.includes(m.uid)).forEach(fn);
        if (state.current && uids.includes(state.current.uid)) fn(state.current);
    }
    const addFlag = (m, f) => m.flags.includes(f) || m.flags.push(f);
    const dropFlag = (m, f) => (m.flags = m.flags.filter(x => x !== f));

    async function setFlags(uids, add, remove) {
        try {
            await api('/api/messages/flags', { method: 'POST', body: { folder: state.folder, uids, add, remove } });
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
        if (state.current && uids.includes(state.current.uid)) renderReaderBar();
        await setFlags(uids, allStarred ? [] : ['\\Flagged'], allStarred ? ['\\Flagged'] : []);
    }

    function dropFromList(uids) {
        const idx = state.messages.findIndex(m => uids.includes(m.uid));
        state.messages = state.messages.filter(m => !uids.includes(m.uid));
        state.total = Math.max(0, state.total - uids.length);
        uids.forEach(u => state.checked.delete(u));
        if (state.openUid && uids.includes(state.openUid)) {
            const next = state.messages[Math.min(idx, state.messages.length - 1)];
            if (next && matchMedia('(min-width: 761px)').matches) openMessage(next.uid);
            else {
                showEmptyReader();
                $('#app').dataset.view = 'list';
            }
        }
        renderList();
    }

    async function moveTo(uids, target, label) {
        const from = state.folder;
        dropFromList(uids);
        try {
            const r = await api('/api/messages/move', { method: 'POST', body: { folder: from, uids, to: target } });
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
        if (inTrash && !confirm(`Permanently delete ${uids.length} message${uids.length > 1 ? 's' : ''}?`)) return;
        dropFromList(uids);
        try {
            const r = await api('/api/messages/delete', { method: 'POST', body: { folder: from, uids } });
            if (r.movedTo) {
                toast(`Moved to Trash`, {
                    action: 'Undo',
                    onAction: async () => {
                        // pull the newest matching uids back out of Trash
                        const t = await api('/api/messages?' + qs({ folder: r.movedTo }));
                        const back = t.messages.slice(0, uids.length).map(m => m.uid);
                        await api('/api/messages/move', { method: 'POST', body: { folder: r.movedTo, uids: back, to: from } });
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

    /* ================= menus ================= */

    function showMenu(x, y, items) {
        closeMenu();
        const menu = h('<div class="menu" id="menu"></div>');
        items.forEach(it => {
            if (it === '-') return menu.append(document.createElement('hr'));
            const b = h(`<button class="${it.danger ? 'danger' : ''}">${icon(it.icon)}<span>${esc(it.label)}</span></button>`);
            b.onclick = () => {
                closeMenu();
                it.run();
            };
            menu.append(b);
        });
        document.body.append(menu);
        const r = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
        setTimeout(() => document.addEventListener('click', closeMenu, { once: true }));
    }
    function closeMenu() {
        const m = $('#menu');
        if (m) m.remove();
    }

    /* ================= reader ================= */

    function showEmptyReader() {
        state.openUid = null;
        state.current = null;
        $('#reader').innerHTML = `<div class="empty"><div><div class="big">${icon('mail')}</div><h3>Nothing selected</h3><p>Select a conversation to read it here.<br>Press <kbd>C</kbd> to write, <kbd>?</kbd> for shortcuts.</p></div></div>`;
        $$('.msg.selected').forEach(x => x.classList.remove('selected'));
    }

    // Full messages are fetched with peek=1 (never marks read) so hovering can prefetch them.
    const msgCache = new Map();
    function fetchMessage(folder, uid) {
        const key = `${folder}\u0000${uid}`;
        if (!msgCache.has(key)) {
            const p = api('/api/message?' + qs({ folder, uid, peek: 1 }));
            p.catch(() => msgCache.delete(key));
            msgCache.set(key, p);
            if (msgCache.size > 80) msgCache.delete(msgCache.keys().next().value);
        }
        return msgCache.get(key);
    }
    let hoverTimer;
    $('#messages').addEventListener('mouseover', e => {
        const row = e.target.closest('.msg');
        clearTimeout(hoverTimer);
        if (row && !isDrafts()) hoverTimer = setTimeout(() => fetchMessage(state.folder, Number(row.dataset.uid)), 90);
    });

    async function withMessage(uid, fn) {
        try {
            fn(state.current && state.current.uid === uid ? state.current : await fetchMessage(state.folder, uid));
        } catch (e) {
            toast(e.message, { error: true });
        }
    }

    let readToken = 0;
    async function openMessage(uid) {
        const token = ++readToken;
        state.openUid = uid;
        $$('.msg').forEach(x => x.classList.toggle('selected', Number(x.dataset.uid) === uid));
        const row = $(`.msg[data-uid="${uid}"]`);
        if (row) row.scrollIntoView({ block: 'nearest' });
        if (isDrafts()) {
            try {
                const msg = await api('/api/message?' + qs({ folder: state.folder, uid, peek: 1 }));
                openComposer('draft', msg);
            } catch (e) {
                toast(e.message, { error: true });
            }
            return;
        }
        $('#app').dataset.view = 'reader';
        const folder = state.folder;
        const slow = setTimeout(() => token === readToken && ($('#reader').innerHTML = `<div class="empty"><div class="spinner"></div></div>`), 160);
        try {
            const msg = await fetchMessage(folder, uid);
            clearTimeout(slow);
            if (token !== readToken) return;
            state.current = msg;
            const listed = state.messages.find(m => m.uid === uid);
            if (listed) msg.flags = [...listed.flags];
            if (!msg.flags.includes('\\Seen')) {
                msg.flags.push('\\Seen');
                api('/api/messages/flags', { method: 'POST', body: { folder, uids: [uid], add: ['\\Seen'] } }).catch(() => {});
            }
            if (listed && !listed.flags.includes('\\Seen')) {
                listed.flags.push('\\Seen');
                $(`.msg[data-uid="${uid}"]`)?.classList.remove('unread');
                const f = folderInfo(state.folder);
                if (f.unseen) {
                    f.unseen--;
                    renderFolders();
                }
            }
            renderReader();
        } catch (e) {
            clearTimeout(slow);
            if (token !== readToken) return;
            $('#reader').innerHTML = `<div class="empty"><div><div class="big">${icon('junk')}</div><h3>Couldn’t open that one</h3><p>${esc(e.message)}</p></div></div>`;
        }
    }

    function renderReaderBar() {
        const m = state.current;
        const bar = $('.reader-bar');
        if (!bar || !m) return;
        const starred = m.flags.includes('\\Flagged');
        $('[data-act=star]', bar).classList.toggle('active', starred);
        $('[data-act=star]', bar).innerHTML = icon('star').replace('fill="none"', starred ? 'fill="currentColor"' : 'fill="none"');
    }

    function renderReader() {
        const m = state.current;
        const from = m.from[0] || { address: '' };
        const remoteOk = state.settings.loadRemoteImages || state.allowImagesFor.has(from.address.toLowerCase()) || state.allowImagesFor.has(`${m.folder}:${m.uid}`);
        const recipients = [...m.to, ...m.cc];
        $('#reader').innerHTML = `
            <div class="reader-bar">
                <button class="icon-btn back-btn" data-act="back" data-tip="Back">${icon('left')}</button>
                <button class="icon-btn" data-act="archive" data-tip="Archive (E)">${icon('archive')}</button>
                <button class="icon-btn" data-act="junk" data-tip="Spam">${icon('junk')}</button>
                <button class="icon-btn" data-act="delete" data-tip="Delete (#)">${icon('trash')}</button>
                <span class="sep"></span>
                <button class="icon-btn" data-act="unread" data-tip="Mark unread (U)">${icon('mail')}</button>
                <button class="icon-btn" data-act="star" data-tip="Star (S)">${icon('star')}</button>
                <button class="icon-btn" data-act="move" data-tip="Move to…">${icon('folder')}</button>
                <span class="spacer"></span>
                <button class="icon-btn" data-act="reply" data-tip="Reply (R)">${icon('reply')}</button>
                <button class="icon-btn" data-act="replyAll" data-tip="Reply all (A)">${icon('replyAll')}</button>
                <button class="icon-btn" data-act="forward" data-tip="Forward (F)">${icon('forward')}</button>
                <button class="icon-btn" data-act="more" data-tip="More">${icon('more')}</button>
            </div>
            <div class="reader-scroll"><div class="reader-content">
                <h1>${esc(m.subject || '(no subject)')}</h1>
                <div class="sender">
                    ${avatar(from, 'lg')}
                    <div class="info">
                        <div><span class="name">${esc(from.name || from.address)}</span>${from.name ? `<span class="addr">&lt;${esc(from.address)}&gt;</span>` : ''}</div>
                        <div class="to" data-act="details">to ${esc(recipients.map(p => (p.address.toLowerCase() === state.me.email ? 'me' : personName(p))).join(', ') || 'undisclosed recipients')} ${icon('down')}</div>
                        <dl class="details hidden">
                            <dt>From</dt><dd>${esc(fmtAddrList(m.from))}</dd>
                            ${m.replyTo.length ? `<dt>Reply-To</dt><dd>${esc(fmtAddrList(m.replyTo))}</dd>` : ''}
                            <dt>To</dt><dd>${esc(fmtAddrList(m.to)) || '—'}</dd>
                            ${m.cc.length ? `<dt>Cc</dt><dd>${esc(fmtAddrList(m.cc))}</dd>` : ''}
                            ${m.bcc.length ? `<dt>Bcc</dt><dd>${esc(fmtAddrList(m.bcc))}</dd>` : ''}
                            <dt>Date</dt><dd>${esc(fmtDate(m.date, true))}</dd>
                        </dl>
                    </div>
                    <div class="when">${esc(fmtDate(m.date, true))}</div>
                </div>
                ${m.hasRemoteImages && !remoteOk ? `<div class="banner">${icon('image')}<span>Remote images are hidden to protect your privacy.</span><button data-act="images">Show images</button><button data-act="images-always" style="margin-left:4px">Always from sender</button></div>` : ''}
                ${m.unsubscribe ? `<div class="banner" style="background:var(--bg-2);border-color:var(--border)">${icon('unsubscribe')}<span>This looks like a mailing list.</span><button data-act="unsubscribe">Unsubscribe</button></div>` : ''}
                <div id="body-host"></div>
                ${m.attachments.length ? `<div class="attachments">${m.attachments.map(a => attachmentCard(m, a)).join('')}</div>` : ''}
                <div class="quick-reply">
                    <button class="btn" data-act="reply">${icon('reply')} Reply</button>
                    ${recipients.length + m.from.length > 2 ? `<button class="btn" data-act="replyAll">${icon('replyAll')} Reply all</button>` : ''}
                    <button class="btn" data-act="forward">${icon('forward')} Forward</button>
                </div>
            </div></div>`;
        renderReaderBar();
        renderBody(m, remoteOk);
    }

    function attachmentCard(m, a) {
        const ext = (a.filename.split('.').pop() || 'file').slice(0, 4);
        const href = '/api/attachment?' + qs({ folder: m.folder, uid: m.uid, idx: a.idx });
        return `<a class="att" href="${href}" target="_blank" rel="noopener"><span class="ext">${esc(ext)}</span><span class="meta"><b>${esc(a.filename)}</b><small>${fmtSize(a.size)}</small></span>
            <span class="icon-btn" data-download="${esc(href + '&download=1')}" title="Download">${icon('download')}</span></a>`;
    }

    function renderBody(m, remoteOk) {
        const host = $('#body-host');
        if (!m.html) {
            const linked = esc(m.text).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
            host.innerHTML = `<div class="body-text">${linked || '<span style="color:var(--text-3)">(empty message)</span>'}</div>`;
            return;
        }
        const csp = `default-src 'none'; img-src data: cid:${remoteOk ? ' https: http:' : ''}; style-src 'unsafe-inline'; font-src data:${remoteOk ? ' https:' : ''}`;
        const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
            <style>html,body{margin:0}body{padding:20px;font:14.5px/1.55 -apple-system,'Segoe UI',Roboto,Inter,sans-serif;color:#1d1d2b;background:#fff;word-wrap:break-word;overflow-wrap:anywhere}
            img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}blockquote{border-left:3px solid #ccc;margin:8px 0;padding-left:12px;color:#555}a{color:#7a5a1f}${remoteOk ? '' : 'img[src^="http:"],img[src^="https:"]{visibility:hidden}'}</style></head><body>${m.html}</body></html>`;
        const frame = h('<iframe class="body-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Message body"></iframe>');
        frame.srcdoc = doc;
        host.replaceChildren(frame);
        frame.addEventListener('load', () => {
            const d = frame.contentDocument;
            if (!d) return;
            const fit = () => (frame.style.height = d.documentElement.scrollHeight + 'px');
            fit();
            new ResizeObserver(fit).observe(d.body);
            $$('img', d).forEach(img => img.addEventListener('load', fit));
            // keyboard shortcuts keep working while the iframe has focus
            d.addEventListener('keydown', e => onKey(e));
        });
    }

    $('#reader').addEventListener('click', e => {
        const dl = e.target.closest('[data-download]');
        if (dl) {
            e.preventDefault();
            location.href = dl.dataset.download;
            return;
        }
        const b = e.target.closest('[data-act]');
        if (!b || !state.current) return;
        const m = state.current;
        const uid = m.uid;
        switch (b.dataset.act) {
            case 'back':
                $('#app').dataset.view = 'list';
                break;
            case 'archive':
                archive([uid]);
                break;
            case 'junk':
                moveTo([uid], '\\Junk', 'Spam');
                break;
            case 'delete':
                remove([uid]);
                break;
            case 'unread':
                setSeen([uid], false);
                showEmptyReader();
                $('#app').dataset.view = 'list';
                break;
            case 'star':
                toggleStar([uid]);
                break;
            case 'move': {
                const r = b.getBoundingClientRect();
                pickFolder(r.left, r.bottom + 4, [uid]);
                break;
            }
            case 'reply':
            case 'replyAll':
            case 'forward':
                openComposer(b.dataset.act, m);
                break;
            case 'details':
                $('.details').classList.toggle('hidden');
                break;
            case 'images':
                state.allowImagesFor.add(`${m.folder}:${m.uid}`);
                renderReader();
                break;
            case 'images-always':
                state.allowImagesFor.add((m.from[0] || {}).address.toLowerCase());
                saveTrustedSenders();
                renderReader();
                break;
            case 'unsubscribe':
                if (/^https?:/i.test(m.unsubscribe)) window.open(m.unsubscribe, '_blank', 'noopener');
                else {
                    const addr = m.unsubscribe.replace(/^mailto:/i, '').split('?')[0];
                    openComposer('new', null, { to: [{ name: '', address: addr }], subject: 'Unsubscribe' });
                }
                break;
            case 'more': {
                const r = b.getBoundingClientRect();
                showMenu(r.left - 160, r.bottom + 4, [
                    { icon: 'code', label: 'View original', run: () => window.open('/api/message/raw?' + qs({ folder: m.folder, uid }), '_blank', 'noopener') },
                    { icon: 'download', label: 'Download .eml', run: () => (location.href = '/api/message/raw?' + qs({ folder: m.folder, uid, download: 1 })) },
                    { icon: 'image', label: 'Print', run: () => printMessage(m) }
                ]);
                break;
            }
        }
    });

    function saveTrustedSenders() {
        try {
            localStorage.setItem('eg.trusted', JSON.stringify([...state.allowImagesFor].filter(x => x.includes('@'))));
        } catch {
            // ignore
        }
    }

    function printMessage(m) {
        const frame = $('.body-frame');
        if (frame && frame.contentWindow) return frame.contentWindow.print();
        window.print();
    }

    /* ================= composer ================= */

    let composer = null;

    const SIG_NONE = '';
    function signatureHtml(id) {
        const s = state.settings.signatures.find(x => x.id === id);
        return s ? s.html : '';
    }

    function cleanQuoted(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        $$('style,script,link,meta,title', doc).forEach(n => n.remove());
        if (!state.settings.loadRemoteImages) $$('img', doc).forEach(img => /^https?:/i.test(img.getAttribute('src') || '') && img.remove());
        return doc.body.innerHTML;
    }
    function quotedBody(m) {
        return m.html ? cleanQuoted(m.html) : esc(m.text).replace(/\n/g, '<br>');
    }

    function openComposer(mode, m, preset = {}) {
        // only one composer at a time: park the current one in Drafts
        if (composer && !composer.sending) composer.close({ save: true });
        const me = state.me.email.toLowerCase();
        const notMe = list => list.filter(p => p.address.toLowerCase() !== me);
        const uniq = list => {
            const seen = new Set();
            return list.filter(p => {
                const k = p.address.toLowerCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        };

        let to = preset.to || [];
        let cc = [];
        let bcc = [];
        let subject = preset.subject || '';
        let quote = '';
        let meta = {};
        let sigId = state.settings.defaultSignature || SIG_NONE;

        if (m && (mode === 'reply' || mode === 'replyAll')) {
            const fromMe = (m.from[0] || {}).address?.toLowerCase() === me;
            const primary = fromMe ? m.to : m.replyTo.length ? m.replyTo : m.from;
            to = mode === 'replyAll' ? uniq(notMe([...primary, ...(fromMe ? [] : m.to)])) : primary;
            if (mode === 'replyAll') cc = uniq(notMe(m.cc)).filter(p => !to.some(t => t.address.toLowerCase() === p.address.toLowerCase()));
            subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
            quote = `<br><div class="pm-quote">On ${esc(fmtDate(m.date, true))}, ${esc(fmtAddr(m.from[0] || { address: '' }))} wrote:<blockquote>${quotedBody(m)}</blockquote></div>`;
            meta = { inReplyTo: m.messageId, references: [...m.references, m.messageId].filter(Boolean).join(' '), answeredUid: m.uid, answeredFolder: m.folder };
            sigId = state.settings.replySignature || state.settings.defaultSignature || SIG_NONE;
        } else if (m && mode === 'forward') {
            subject = /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`;
            quote = `<br><div class="pm-quote">---------- Forwarded message ---------<br>From: ${esc(fmtAddrList(m.from))}<br>Date: ${esc(fmtDate(m.date, true))}<br>Subject: ${esc(m.subject)}<br>To: ${esc(fmtAddrList(m.to))}${m.cc.length ? `<br>Cc: ${esc(fmtAddrList(m.cc))}` : ''}<br><br>${quotedBody(m)}</div>`;
            meta = m.attachments.length ? { forwardFolder: m.folder, forwardUid: m.uid } : {};
            sigId = state.settings.replySignature || state.settings.defaultSignature || SIG_NONE;
        } else if (m && mode === 'draft') {
            to = m.to;
            cc = m.cc;
            bcc = m.bcc;
            subject = m.subject;
            meta = { draftUid: m.uid, ...(m.attachments.length ? { forwardFolder: m.folder, forwardUid: m.uid } : {}) };
        }

        let body;
        if (mode === 'draft') body = m.html ? cleanQuoted(m.html) : esc(m.text).replace(/\n/g, '<br>');
        else {
            const sig = signatureHtml(sigId);
            body = `<div><br></div>${sig ? `<br><div class="pm-signature">${sig}</div>` : ''}${quote}`;
        }

        const title = { reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }[mode] || 'New message';
        const el = h(`<div class="composer">
            <div class="composer-head"><b>${esc(subject || title)}</b><span class="status"></span>
                <button class="icon-btn" data-c="min" title="Minimize">${icon('minimize')}</button>
                <button class="icon-btn" data-c="max" title="Full screen">${icon('maximize')}</button>
                <button class="icon-btn" data-c="close" title="Close (saves draft)">${icon('x')}</button></div>
            <div class="c-field" data-field="to"><label>To</label><div class="recips"></div><div class="toggles"><button data-c="show-cc">Cc</button><button data-c="show-bcc">Bcc</button></div></div>
            <div class="c-field hidden" data-field="cc"><label>Cc</label><div class="recips"></div></div>
            <div class="c-field hidden" data-field="bcc"><label>Bcc</label><div class="recips"></div></div>
            <div class="c-field"><label>Subject</label><input class="plain" data-c="subject" value="${esc(subject)}" placeholder="What’s this about?"></div>
            <div class="toolbar">
                <button class="icon-btn" data-cmd="bold" title="Bold (Ctrl B)">${icon('bold')}</button>
                <button class="icon-btn" data-cmd="italic" title="Italic (Ctrl I)">${icon('italic')}</button>
                <button class="icon-btn" data-cmd="underline" title="Underline (Ctrl U)">${icon('underline')}</button>
                <button class="icon-btn" data-cmd="strikeThrough" title="Strikethrough">${icon('strike')}</button>
                <span class="sep"></span>
                <select data-c="size" title="Text size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="5">Large</option><option value="6">Huge</option></select>
                <label class="icon-btn" title="Text color" style="cursor:pointer">${icon('palette')}<input type="color" data-c="color" style="position:absolute;opacity:0;width:0;height:0"></label>
                <span class="sep"></span>
                <button class="icon-btn" data-cmd="insertUnorderedList" title="Bulleted list">${icon('list')}</button>
                <button class="icon-btn" data-cmd="insertOrderedList" title="Numbered list">${icon('listOl')}</button>
                <button class="icon-btn" data-cmd="quote" title="Quote">${icon('quote')}</button>
                <button class="icon-btn" data-cmd="link" title="Link (Ctrl K)">${icon('link')}</button>
                <button class="icon-btn" data-cmd="removeFormat" title="Clear formatting">${icon('eraser')}</button>
            </div>
            <div class="editor" contenteditable="true" data-placeholder="Write your message…">${body}</div>
            <div class="c-attachments"></div>
            <div class="composer-foot">
                <button class="btn btn-primary send-btn" data-c="send" title="Send (Ctrl Enter)">${icon('send')} Send</button>
                <label class="icon-btn" title="Attach files" style="cursor:pointer">${icon('clip')}<input type="file" multiple data-c="files" hidden></label>
                <select data-c="sig" title="Signature"><option value="">No signature</option>${state.settings.signatures.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
                <span class="spacer"></span>
                <button class="icon-btn" data-c="discard" title="Discard">${icon('trash')}</button>
            </div></div>`);
        document.body.append(el);

        const editor = $('.editor', el);
        const files = [];
        const c = {
            el,
            mode,
            dirty: false,
            meta,
            fields: {},
        };
        composer = c;
        $('[data-c=sig]', el).value = state.settings.signatures.some(s => s.id === sigId) ? sigId : '';

        // recipients
        ['to', 'cc', 'bcc'].forEach(name => (c.fields[name] = recipientField($(`[data-field=${name}] .recips`, el), () => (c.dirty = true))));
        c.fields.to.set(to);
        c.fields.cc.set(cc);
        c.fields.bcc.set(bcc);
        if (cc.length) $('[data-field=cc]', el).classList.remove('hidden');
        if (bcc.length) $('[data-field=bcc]', el).classList.remove('hidden');

        const renderFiles = () => {
            const orig = meta.forwardUid && m ? m.attachments : [];
            $('.c-attachments', el).innerHTML =
                orig.map(a => `<span class="c-att" title="Included from original">${icon('clip')}${esc(a.filename)} <small style="color:var(--text-3)">${fmtSize(a.size)}</small></span>`).join('') +
                files.map((f, i) => `<span class="c-att">${icon('clip')}${esc(f.name)} <small style="color:var(--text-3)">${fmtSize(f.size)}</small><button class="icon-btn" style="width:22px;height:22px" data-rm="${i}">${icon('x')}</button></span>`).join('');
        };
        const addFiles = list => {
            for (const f of list) {
                if (f.size > 25 * 1024 * 1024) toast(`${f.name} is over 25 MB`, { error: true });
                else files.push(f);
            }
            c.dirty = true;
            renderFiles();
        };
        renderFiles();
        $('.c-attachments', el).addEventListener('click', e => {
            const b = e.target.closest('[data-rm]');
            if (b) {
                files.splice(Number(b.dataset.rm), 1);
                renderFiles();
            }
        });
        $('[data-c=files]', el).addEventListener('change', e => {
            addFiles(e.target.files);
            e.target.value = '';
        });

        // drag & drop files
        let dragDepth = 0;
        el.addEventListener('dragenter', e => {
            if (![...e.dataTransfer.types].includes('Files')) return;
            if (dragDepth++ === 0) el.append(h('<div class="drop-hint">Drop to attach</div>'));
        });
        el.addEventListener('dragleave', () => {
            if (--dragDepth <= 0) {
                dragDepth = 0;
                $('.drop-hint', el)?.remove();
            }
        });
        el.addEventListener('dragover', e => [...e.dataTransfer.types].includes('Files') && e.preventDefault());
        el.addEventListener('drop', e => {
            dragDepth = 0;
            $('.drop-hint', el)?.remove();
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            addFiles(e.dataTransfer.files);
        });

        // formatting
        const exec = (cmd, val) => {
            editor.focus();
            document.execCommand(cmd, false, val);
            c.dirty = true;
        };
        $('.toolbar', el).addEventListener('mousedown', e => e.target.closest('[data-cmd]') && e.preventDefault());
        $('.toolbar', el).addEventListener('click', e => {
            const b = e.target.closest('[data-cmd]');
            if (!b) return;
            const cmd = b.dataset.cmd;
            if (cmd === 'link') {
                const url = prompt('Link URL', 'https://');
                if (url && url !== 'https://') exec('createLink', /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);
            } else if (cmd === 'quote') exec('formatBlock', 'blockquote');
            else exec(cmd);
        });
        $('[data-c=size]', el).addEventListener('change', e => {
            if (e.target.value) exec('fontSize', e.target.value);
            e.target.value = '';
        });
        $('[data-c=color]', el).addEventListener('input', e => exec('foreColor', e.target.value));

        // signature swap
        $('[data-c=sig]', el).addEventListener('change', e => {
            const html = signatureHtml(e.target.value);
            let block = $('.pm-signature', editor);
            if (!html) {
                if (block) {
                    if (block.previousElementSibling && block.previousElementSibling.tagName === 'BR') block.previousElementSibling.remove();
                    block.remove();
                }
                return;
            }
            if (!block) {
                block = h('<div class="pm-signature"></div>');
                const q = $('.pm-quote', editor);
                if (q) q.before(document.createElement('br'), block);
                else editor.append(document.createElement('br'), block);
            }
            block.innerHTML = html;
            c.dirty = true;
        });

        const subjectInput = $('[data-c=subject]', el);
        subjectInput.addEventListener('input', () => {
            c.dirty = true;
            $('.composer-head b', el).textContent = subjectInput.value || title;
        });
        editor.addEventListener('input', () => (c.dirty = true));
        editor.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                $('[data-cmd=link]', el).click();
            }
        });
        el.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                send();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveDraft(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                c.close({ save: true });
            }
            e.stopPropagation();
        });

        function formData() {
            const fd = new FormData();
            fd.append('to', c.fields.to.value());
            fd.append('cc', c.fields.cc.value());
            fd.append('bcc', c.fields.bcc.value());
            fd.append('subject', subjectInput.value);
            fd.append('html', editor.innerHTML);
            Object.entries(c.meta).forEach(([k, v]) => v != null && fd.append(k, v));
            files.forEach(f => fd.append('attachments', f, f.name));
            return fd;
        }

        async function saveDraft(announce) {
            const status = $('.status', el);
            status.textContent = 'Saving…';
            try {
                const r = await api('/api/drafts', { method: 'POST', form: formData() });
                c.meta.draftUid = r.uid || null;
                c.dirty = false;
                status.textContent = 'Draft saved';
                if (announce) toast('Draft saved');
                if (isDrafts()) loadMessages({ quiet: true });
                loadFolders();
                return true;
            } catch (e) {
                status.textContent = '';
                toast(`Couldn’t save draft: ${e.message}`, { error: true });
                return false;
            }
        }
        const autosave = debounce(() => composer === c && c.dirty && !c.sending && saveDraft(false), 20000);
        el.addEventListener('input', autosave);

        c.close = ({ save } = {}) => {
            if (composer === c) composer = null;
            $('.composer-backdrop')?.remove();
            el.remove();
            // detached nodes are still readable, so the draft can be saved after removal
            if (save && c.dirty && !c.sending) saveDraft(false).then(ok => ok && toast('Saved to Drafts'));
        };

        async function send() {
            if (c.fields.to.pending()) c.fields.to.commit();
            if (c.fields.cc.pending()) c.fields.cc.commit();
            if (c.fields.bcc.pending()) c.fields.bcc.commit();
            const all = [...c.fields.to.list(), ...c.fields.cc.list(), ...c.fields.bcc.list()];
            if (!all.length) {
                toast('Add at least one recipient', { error: true });
                return c.fields.to.focus();
            }
            if (all.some(p => !validEmail(p.address))) return toast('One of the addresses looks off', { error: true });
            if (!subjectInput.value.trim() && !confirm('Send without a subject?')) return;
            const lower = (editor.innerText + subjectInput.value).toLowerCase();
            if (/\b(attached|attachment|enclosed)\b/.test(lower.split('wrote:')[0]) && !files.length && !c.meta.forwardUid && !confirm('You mentioned an attachment but didn’t attach anything. Send anyway?')) return;

            const fd = formData();
            c.sending = true;
            el.classList.add('hidden');
            $('.composer-backdrop')?.remove();
            const delay = (state.settings.undoSendSeconds || 0) * 1000;
            let cancelled = false;
            const go = async () => {
                if (cancelled) return;
                const t = toast('Sending…', { duration: 0 });
                try {
                    await api('/api/send', { method: 'POST', form: fd });
                    t.close();
                    toast('Message sent', { duration: 3000 });
                    if (composer === c) composer = null;
                    el.remove();
                    loadFolders();
                    if (isSentLike()) loadMessages({ quiet: true });
                    if (c.meta.answeredUid) {
                        patchLocal([c.meta.answeredUid], x => addFlag(x, '\\Answered'));
                        renderList();
                    }
                } catch (e) {
                    t.close();
                    c.sending = false;
                    el.classList.remove('hidden');
                    toast(`Not sent: ${e.message}`, { error: true, duration: 7000 });
                }
            };
            if (delay) {
                toast('Sending…', {
                    action: 'Undo',
                    duration: delay,
                    onAction: () => {
                        cancelled = true;
                        c.sending = false;
                        el.classList.remove('hidden');
                        editor.focus();
                    }
                });
                setTimeout(go, delay);
            } else go();
        }

        el.addEventListener('click', e => {
            const b = e.target.closest('[data-c]');
            if (!b) {
                if (e.target.closest('.composer-head') && el.classList.contains('minimized')) el.classList.remove('minimized');
                return;
            }
            switch (b.dataset.c) {
                case 'min':
                    el.classList.toggle('minimized');
                    el.classList.remove('maximized');
                    $('.composer-backdrop')?.remove();
                    break;
                case 'max':
                    el.classList.toggle('maximized');
                    el.classList.remove('minimized');
                    if (el.classList.contains('maximized')) {
                        const back = h('<div class="composer-backdrop"></div>');
                        back.onclick = () => $('[data-c=max]', el).click();
                        el.before(back);
                    } else $('.composer-backdrop')?.remove();
                    break;
                case 'close':
                    e.stopPropagation();
                    c.close({ save: true });
                    break;
                case 'discard':
                    if (c.meta.draftUid) {
                        api('/api/messages/delete', { method: 'POST', body: { folder: specialPath('\\Drafts') || 'Drafts', uids: [c.meta.draftUid] } }).then(() => {
                            loadFolders();
                            if (isDrafts()) loadMessages({ quiet: true });
                        });
                    }
                    c.dirty = false;
                    c.close();
                    toast('Draft discarded');
                    break;
                case 'show-cc':
                    $('[data-field=cc]', el).classList.remove('hidden');
                    c.fields.cc.focus();
                    break;
                case 'show-bcc':
                    $('[data-field=bcc]', el).classList.remove('hidden');
                    c.fields.bcc.focus();
                    break;
                case 'send':
                    send();
                    break;
            }
        });

        if (mode === 'new' && !to.length) c.fields.to.focus();
        else {
            editor.focus();
            const range = document.createRange();
            range.setStart(editor, 0);
            range.collapse(true);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
        }
        return c;
    }

    const validEmail = a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);

    function recipientField(box, onChange) {
        let people = [];
        const input = h('<input type="text" autocomplete="off" spellcheck="false">');
        let sugg = null;
        let suggItems = [];
        let suggIdx = 0;

        const render = () => {
            $$('.recip', box).forEach(x => x.remove());
            people.forEach((p, i) => {
                const chip = h(`<span class="recip${validEmail(p.address) ? '' : ' invalid'}" title="${esc(p.address)}">${esc(p.name || p.address)}<button type="button" data-i="${i}">${icon('x')}</button></span>`);
                box.insertBefore(chip, input);
            });
        };
        const add = list => {
            for (const p of list) if (p.address && !people.some(x => x.address.toLowerCase() === p.address.toLowerCase())) people.push(p);
            render();
            onChange();
        };
        const parse = text =>
            text
                .split(/[,;\n]+/)
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => {
                    const mm = s.match(/^(.*?)\s*<([^>]+)>$/);
                    return mm ? { name: mm[1].replace(/^"|"$/g, '').trim(), address: mm[2].trim() } : { name: '', address: s };
                });
        const commit = () => {
            if (input.value.trim()) add(parse(input.value));
            input.value = '';
            hideSugg();
        };
        const hideSugg = () => {
            sugg?.remove();
            sugg = null;
        };
        const showSugg = debounce(async () => {
            const q = input.value.trim();
            if (!q) return hideSugg();
            let list = [];
            try {
                list = await api('/api/contacts?' + qs({ q }));
            } catch {
                return;
            }
            list = list.filter(p => !people.some(x => x.address === p.address));
            if (!list.length || input.value.trim() !== q) return hideSugg();
            suggItems = list;
            suggIdx = 0;
            hideSugg();
            sugg = h('<div class="suggest"></div>');
            list.forEach((p, i) => {
                const b = h(`<button type="button" class="${i === 0 ? 'on' : ''}">${avatar(p, 'sm')}<span><b>${esc(p.name || p.address)}</b><small>${esc(p.address)}</small></span></button>`);
                b.onmousedown = e => {
                    e.preventDefault();
                    input.value = '';
                    add([p]);
                    hideSugg();
                };
                sugg.append(b);
            });
            box.parentElement.append(sugg);
        }, 150);

        box.append(input);
        box.addEventListener('click', e => {
            const b = e.target.closest('button[data-i]');
            if (b) {
                people.splice(Number(b.dataset.i), 1);
                render();
                onChange();
            }
            input.focus();
        });
        input.addEventListener('input', () => {
            if (/[,;]/.test(input.value)) commit();
            else showSugg();
        });
        input.addEventListener('paste', e => {
            const text = e.clipboardData.getData('text');
            if (/[,;\n]/.test(text) || /@/.test(text)) {
                e.preventDefault();
                add(parse(text));
            }
        });
        input.addEventListener('keydown', e => {
            if (sugg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                suggIdx = (suggIdx + (e.key === 'ArrowDown' ? 1 : -1) + suggItems.length) % suggItems.length;
                $$('button', sugg).forEach((b, i) => b.classList.toggle('on', i === suggIdx));
            } else if ((e.key === 'Enter' || e.key === 'Tab') && sugg) {
                e.preventDefault();
                input.value = '';
                add([suggItems[suggIdx]]);
                hideSugg();
            } else if (e.key === 'Enter' || (e.key === 'Tab' && input.value.trim())) {
                if (input.value.trim()) {
                    e.preventDefault();
                    commit();
                }
            } else if (e.key === 'Backspace' && !input.value && people.length) {
                people.pop();
                render();
                onChange();
            } else if (e.key === 'Escape' && sugg) {
                e.stopPropagation();
                hideSugg();
            }
        });
        input.addEventListener('blur', () => setTimeout(commit, 120));

        return {
            set: list => {
                people = [...list];
                render();
            },
            list: () => people,
            value: () => people.map(p => (p.name ? `"${p.name.replace(/"/g, '')}" <${p.address}>` : p.address)).join(', '),
            pending: () => !!input.value.trim(),
            commit,
            focus: () => input.focus()
        };
    }

    /* ================= settings ================= */

    const SIG_TEMPLATES = {
        Minimal: name => `<div>— ${esc(name)}</div>`,
        Professional: (name, email) =>
            `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333"><tr><td style="padding-right:14px;border-right:3px solid ${state.settings.accent}"><b style="font-size:15px;color:${state.settings.accent}">${esc(name)}</b><br><span style="color:#777">Your title · EderveenGroup</span></td><td style="padding-left:14px;line-height:1.6"><a href="mailto:${esc(email)}" style="color:${state.settings.accent};text-decoration:none">${esc(email)}</a><br><span style="color:#777">+1 (555) 000-0000</span></td></tr></table>`,
        Executive: (name, email) =>
            `<div style="font-family:Georgia,'Times New Roman',serif"><div style="font-size:18px;color:${state.settings.accent}">${esc(name)}</div><div style="font-family:Arial,sans-serif;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;margin-top:2px">EderveenGroup</div><div style="font-family:Arial,sans-serif;font-size:12px;margin-top:8px"><a href="mailto:${esc(email)}" style="color:#8a8a8a;text-decoration:none">${esc(email)}</a></div></div>`
    };

    function openSettings(tab = 'general') {
        const s = state.settings;
        const back = h(`<div class="modal-back"><div class="modal" role="dialog" aria-label="Settings">
            <div class="modal-head"><h2>Settings</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
            <div class="settings">
                <nav>
                    <button data-tab="general">${icon('settings')} General</button>
                    <button data-tab="look">${icon('palette')} Appearance</button>
                    <button data-tab="sigs">${icon('signature')} Signatures</button>
                    <button data-tab="keys">${icon('keyboard')} Shortcuts</button>
                    <button data-tab="account">${icon('user')} Account</button>
                </nav>
                <section></section>
            </div></div></div>`);
        document.body.append(back);
        let section = $('section', back);
        const close = () => {
            back.remove();
            document.removeEventListener('keydown', onEsc, true);
        };
        const onEsc = e => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        };
        document.addEventListener('keydown', onEsc, true);
        back.addEventListener('click', e => (e.target === back || e.target.closest('[data-close]')) && close());

        const tabs = {
            general() {
                section.innerHTML = `<h3>General</h3><p class="hint">How your inbox behaves.</p>
                    <div class="row"><div class="lbl"><b>Display name</b><small>Shown to people you email</small></div><input class="input" data-s="displayName" value="${esc(s.displayName)}" placeholder="Your name"></div>
                    <div class="row"><div class="lbl"><b>Undo send</b><small>Grace period before mail actually leaves</small></div>
                        <div class="seg" data-seg="undoSendSeconds">${[0, 5, 10, 20].map(n => `<button data-v="${n}" class="${s.undoSendSeconds === n ? 'on' : ''}">${n ? n + 's' : 'Off'}</button>`).join('')}</div></div>
                    <div class="row"><div class="lbl"><b>Load remote images</b><small>Off blocks tracking pixels until you allow them</small></div><label class="switch"><input type="checkbox" data-s="loadRemoteImages" ${s.loadRemoteImages ? 'checked' : ''}><span></span></label></div>
                    <div class="row"><div class="lbl"><b>Save a copy to Sent</b><small>Turn off if Purelymail already saves outgoing mail for you</small></div><label class="switch"><input type="checkbox" data-s="saveSentCopy" ${s.saveSentCopy ? 'checked' : ''}><span></span></label></div>
                    <div class="row"><div class="lbl"><b>Desktop notifications</b><small>Get pinged when new mail lands</small></div><button class="btn" data-notify>${'Notification' in window && Notification.permission === 'granted' ? icon('check') + ' Enabled' : icon('bell') + ' Enable'}</button></div>`;
                $('[data-s=displayName]', section).addEventListener('change', e => saveSettings({ displayName: e.target.value.trim() }));
                $$('input[type=checkbox][data-s]', section).forEach(i => i.addEventListener('change', () => saveSettings({ [i.dataset.s]: i.checked })));
                $('[data-notify]', section).onclick = async e => {
                    if (!('Notification' in window)) return toast('Notifications aren’t supported here', { error: true });
                    const p = await Notification.requestPermission();
                    e.target.closest('button').innerHTML = p === 'granted' ? icon('check') + ' Enabled' : icon('bell') + ' Blocked';
                };
            },
            look() {
                const accents = ['#c9a66b', '#d0784a', '#e26d8f', '#8b7cf6', '#5b7cfa', '#3fae8c', '#a3a3ad', '#e5484d'];
                section.innerHTML = `<h3>Appearance</h3><p class="hint">Make it yours.</p>
                    <div class="row"><div class="lbl"><b>Theme</b></div><div class="seg" data-seg="theme">${['dark', 'light', 'system'].map(t => `<button data-v="${t}" class="${s.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
                    <div class="row"><div class="lbl"><b>Accent color</b></div><div class="swatches">${accents.map(a => `<button class="swatch${s.accent === a ? ' on' : ''}" data-accent="${a}" style="background:${a}" aria-label="${a}"></button>`).join('')}<label class="swatch swatch-custom${accents.includes(s.accent) ? '' : ' on'}" title="Custom"><input type="color" value="${esc(s.accent)}"></label></div></div>
                    <div class="row"><div class="lbl"><b>Density</b><small>Compact hides previews</small></div><div class="seg" data-seg="density">${['comfortable', 'compact'].map(t => `<button data-v="${t}" class="${s.density === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>`;
                section.addEventListener('click', e => {
                    const sw = e.target.closest('[data-accent]');
                    if (sw) {
                        $$('.swatch', section).forEach(x => x.classList.toggle('on', x === sw));
                        saveSettings({ accent: sw.dataset.accent });
                    }
                });
                $('.swatch-custom input', section).addEventListener('input', debounce(e => {
                    $$('.swatch', section).forEach(x => x.classList.toggle('on', x.classList.contains('swatch-custom')));
                    saveSettings({ accent: e.target.value });
                }, 120));
            },
            sigs() {
                let sigs = s.signatures.map(x => ({ ...x }));
                let defaultSig = s.defaultSignature;
                let replySig = s.replySignature;
                const draw = () => {
                    section.innerHTML = `<h3>Signatures</h3><p class="hint">Create as many as you like and pick defaults. They’re added automatically and you can switch them while composing.</p>
                        <div class="sig-templates"><button class="btn" data-new="">${icon('plus')} Blank</button>${Object.keys(SIG_TEMPLATES).map(k => `<button class="btn" data-new="${k}">${icon('sparkle')} ${k}</button>`).join('')}</div>
                        <div class="sig-list">${sigs.length ? '' : `<div class="empty" style="height:auto;padding:30px;border:1px dashed var(--border-strong);border-radius:14px"><div><div class="big">${icon('signature')}</div><h3>No signatures yet</h3><p>Start from a template above.</p></div></div>`}</div>
                        ${sigs.length ? `<div class="sig-pickers">
                            <label class="field"><span>For new emails</span><select class="select" data-pick="default"><option value="">None</option>${sigs.map(x => `<option value="${esc(x.id)}" ${x.id === defaultSig ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
                            <label class="field"><span>For replies &amp; forwards</span><select class="select" data-pick="reply"><option value="">Same as new</option>${sigs.map(x => `<option value="${esc(x.id)}" ${x.id === replySig ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>` : ''}
                        <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" data-save>${icon('check')} Save signatures</button></div>`;
                    const list = $('.sig-list', section);
                    sigs.forEach((sig, i) => {
                        const card = h(`<div class="sig-card"><div class="sig-card-head"><input value="${esc(sig.name)}" aria-label="Signature name">
                            <button class="icon-btn" data-del title="Delete">${icon('trash')}</button></div>
                            <div class="toolbar"><button class="icon-btn" data-cmd="bold">${icon('bold')}</button><button class="icon-btn" data-cmd="italic">${icon('italic')}</button><button class="icon-btn" data-cmd="underline">${icon('underline')}</button>
                            <label class="icon-btn" title="Text color" style="cursor:pointer">${icon('palette')}<input type="color" style="position:absolute;opacity:0;width:0;height:0"></label>
                            <button class="icon-btn" data-cmd="link">${icon('link')}</button><button class="icon-btn" data-cmd="image" title="Image from URL">${icon('image')}</button><span class="sep"></span><button class="icon-btn" data-cmd="html" title="Edit HTML">${icon('code')}</button></div>
                            <div class="sig-editor" contenteditable="true">${sig.html}</div></div>`);
                        const ed = $('.sig-editor', card);
                        $('input', card).addEventListener('input', e => (sig.name = e.target.value));
                        ed.addEventListener('input', () => (sig.html = ed.innerHTML));
                        $('[data-del]', card).onclick = () => {
                            sigs.splice(i, 1);
                            if (defaultSig === sig.id) defaultSig = null;
                            if (replySig === sig.id) replySig = null;
                            draw();
                        };
                        $('.toolbar', card).addEventListener('mousedown', e => e.target.closest('[data-cmd]') && e.preventDefault());
                        $('input[type=color]', card).addEventListener('input', e => {
                            ed.focus();
                            document.execCommand('foreColor', false, e.target.value);
                            sig.html = ed.innerHTML;
                        });
                        $('.toolbar', card).addEventListener('click', e => {
                            const b = e.target.closest('[data-cmd]');
                            if (!b) return;
                            const cmd = b.dataset.cmd;
                            if (cmd === 'html') {
                                if (ed.dataset.raw) {
                                    ed.innerHTML = ed.textContent;
                                    delete ed.dataset.raw;
                                    ed.style.fontFamily = '';
                                } else {
                                    ed.textContent = ed.innerHTML;
                                    ed.dataset.raw = '1';
                                    ed.style.fontFamily = 'ui-monospace,monospace';
                                    ed.style.whiteSpace = 'pre-wrap';
                                    return;
                                }
                                ed.style.whiteSpace = '';
                            } else {
                                ed.focus();
                                if (cmd === 'link') {
                                    const url = prompt('Link URL', 'https://');
                                    if (url) document.execCommand('createLink', false, url);
                                } else if (cmd === 'image') {
                                    const url = prompt('Image URL (https://…)');
                                    if (url && /^https:\/\//i.test(url)) document.execCommand('insertHTML', false, `<img src="${esc(url)}" alt="" style="max-width:240px;height:auto">`);
                                } else document.execCommand(cmd);
                            }
                            sig.html = ed.innerHTML;
                        });
                        list.append(card);
                    });
                    section.querySelector('[data-pick=default]')?.addEventListener('change', e => (defaultSig = e.target.value || null));
                    section.querySelector('[data-pick=reply]')?.addEventListener('change', e => (replySig = e.target.value || null));
                    $$('[data-new]', section).forEach(b => (b.onclick = () => {
                        const name = s.displayName || state.me.email.split('@')[0];
                        const t = b.dataset.new;
                        const sig = { id: Math.random().toString(36).slice(2, 10), name: t || `Signature ${sigs.length + 1}`, html: t ? SIG_TEMPLATES[t](name, state.me.email) : '<div><br></div>' };
                        sigs.push(sig);
                        if (!defaultSig) defaultSig = sig.id;
                        draw();
                        $$('.sig-editor', section).pop().focus();
                    }));
                    $('[data-save]', section).onclick = async () => {
                        $$('.sig-editor[data-raw]', section).forEach(ed => ed.closest('.sig-card').querySelector('[data-cmd=html]').click());
                        await saveSettings({ signatures: sigs, defaultSignature: defaultSig, replySignature: replySig });
                        toast('Signatures saved ✨');
                        sigs = state.settings.signatures.map(x => ({ ...x }));
                        draw();
                    };
                };
                draw();
            },
            keys() {
                section.innerHTML = `<h3>Keyboard shortcuts</h3><p class="hint">Fly through your inbox.</p><div class="shortcuts">${SHORTCUTS.map(([k, d]) => `<div><span>${d}</span><span>${k.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ')}</span></div>`).join('')}</div>`;
            },
            account() {
                section.innerHTML = `<h3>Account</h3><p class="hint">Connected to Purelymail over IMAP (993) and SMTP (465), both SSL/TLS.</p>
                    <div class="row"><div class="lbl"><b>Signed in as</b><small>${esc(state.me.email)}</small></div>${avatar({ address: state.me.email, name: s.displayName })}</div>
                    <div class="row"><div class="lbl"><b>Session</b><small>Stays signed in until ${esc(fmtDate(state.me.sessionExpires, true))}</small></div>${icon('lock')}</div>
                    <div class="row"><div class="lbl"><b>Sign out</b><small>Clears the session cookie on this device</small></div><button class="btn btn-danger" data-logout>${icon('logout')} Sign out</button></div>`;
                $('[data-logout]', section).onclick = logout;
            }
        };

        $('nav', back).addEventListener('click', e => {
            const b = e.target.closest('[data-tab]');
            if (b) show(b.dataset.tab);
        });
        function show(name) {
            $$('nav button', back).forEach(b => b.classList.toggle('active', b.dataset.tab === name));
            // fresh element per tab so listeners from the previous tab don't pile up
            const fresh = section.cloneNode(false);
            section.replaceWith(fresh);
            section = fresh;
            section.addEventListener('click', e => {
                const b = e.target.closest('.seg button');
                if (!b) return;
                const seg = b.parentElement;
                $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
                const key = seg.dataset.seg;
                saveSettings({ [key]: key === 'undoSendSeconds' ? Number(b.dataset.v) : b.dataset.v });
            });
            tabs[name]();
        }
        show(tab);
    }

    /* ================= palette & shortcuts ================= */

    const SHORTCUTS = [
        ['C', 'Compose'],
        ['/', 'Search'],
        ['J', 'Next message'],
        ['K', 'Previous message'],
        ['R', 'Reply'],
        ['A', 'Reply all'],
        ['F', 'Forward'],
        ['E', 'Archive'],
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
            { icon: 'moon', label: 'Toggle dark / light', run: toggleTheme },
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

    /* ================= live updates ================= */

    let es = null;
    function connectLive() {
        if (!window.EventSource) return;
        es = new EventSource('/api/events');
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
        es.onerror = () => {
            dot.classList.remove('on');
            text.textContent = 'Reconnecting…';
        };
        es.addEventListener('mailbox', debounce(async e => {
            const evt = JSON.parse(e.data || '{}');
            const before = (folderInfo('INBOX') || {}).unseen || 0;
            await loadFolders();
            const after = (folderInfo('INBOX') || {}).unseen || 0;
            if (state.folder === 'INBOX' && state.page === 0 && !state.query) loadMessages({ quiet: true });
            if (evt.type === 'exists' && after > before) {
                toast(`${after - before} new message${after - before > 1 ? 's' : ''}`, { action: state.folder === 'INBOX' ? null : 'View', onAction: () => openFolder('INBOX') });
                if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                    new Notification('EderveenGroup', { body: `${after - before} new message${after - before > 1 ? 's' : ''}`, icon: '/favicon.svg' });
                }
            }
        }, 400));
    }

    /* ================= chrome ================= */

    function toggleTheme() {
        const cur = document.documentElement.dataset.theme;
        saveSettings({ theme: cur === 'light' ? 'dark' : 'light' });
    }
    async function logout() {
        try {
            await api('/api/logout', { method: 'POST' });
        } finally {
            location.replace('/login');
        }
    }

    $('#compose-btn').onclick = () => openComposer('new');
    $('#fab').onclick = () => openComposer('new');
    $('#theme-btn').onclick = toggleTheme;
    $('#settings-btn').onclick = () => openSettings('general');
    $('#palette-btn').onclick = openPalette;
    $('#logout-btn').onclick = logout;
    $('#menu-btn').onclick = () => $('#app').classList.toggle('nav-open');
    $('#app').addEventListener('click', e => {
        if ($('#app').classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('#menu-btn')) $('#app').classList.remove('nav-open');
    });
    window.addEventListener('beforeunload', e => {
        if (composer && composer.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => state.settings && state.settings.theme === 'system' && applyLook());

    /* ================= boot ================= */

    (async function init() {
        try {
            const me = await api('/api/me');
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
        $('#me-email').textContent = state.settings.displayName || state.me.email;
        $('#me-avatar').outerHTML = avatar({ address: state.me.email, name: state.settings.displayName }, 'sm');
        showEmptyReader();
        await loadFolders();
        loadMessages();
        connectLive();
        setInterval(loadFolders, 120000);
    })();
})();
