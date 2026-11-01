// The EderveenGroup dashboard: today at a glance, quick actions, and every app by category.
// New apps are added to APPS (and shown once their page exists on the server).
(function () {
    const BASE = new URL(document.baseURI).pathname; // the mail app, e.g. "/mail/"
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ic = n => window.icon(n);
    const api = async (path, opts = {}) => {
        const res = await fetch(path, { ...opts, headers: { 'X-EG': '1', 'Content-Type': 'application/json' } });
        if (res.status === 401) {
            location.replace('/login');
            throw new Error('signed out');
        }
        if (!res.ok) throw new Error('failed');
        return res.json();
    };
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const clock = `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const hhmm = t => new Date(2000, 0, 1, +t.slice(0, 2), +t.slice(3, 5)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const size = n => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB` : `${(n / 1073741824).toFixed(1)} GB`);
    const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

    const CATEGORIES = [
        ['communicate', 'Communicate'],
        ['plan', 'Plan'],
        ['create', 'Create'],
        ['store', 'Store'],
        ['you', 'You']
    ];
    const APPS = [
        { id: 'mail', name: 'Mail', cat: 'communicate', href: `${BASE}inbox`, blurb: 'Your inbox and everything you sent.' },
        { id: 'chat', name: 'Chat', cat: 'communicate', href: '/chat/', blurb: 'Talk with people on EderveenGroup.' },
        { id: 'contacts', name: 'Contacts', cat: 'communicate', href: '/contacts/', blurb: 'Your address book, and everyone here.' },
        { id: 'calendar', name: 'Calendar', cat: 'plan', href: '/calendar/', blurb: 'Appointments and deadlines.' },
        { id: 'tasks', name: 'Tasks', cat: 'plan', href: '/tasks/', blurb: 'To-dos and projects, with due dates.' },
        { id: 'notes', name: 'Notes', cat: 'create', href: '/notes/', blurb: 'Quick notes, saved as you type.' },
        { id: 'docs', name: 'Docs', cat: 'create', href: '/docs/', blurb: 'Documents, guides and how-tos.' },
        { id: 'slides', name: 'Slides', cat: 'create', href: '/slides/', blurb: 'Presentations you can show anywhere.' },
        { id: 'files', name: 'Files', cat: 'store', href: '/files/', blurb: 'Documents and photos, with share links.' },
        { id: 'profile', name: 'Profile', cat: 'you', href: '/profile/', blurb: 'Your contact card, shared with a link.' },
        { id: 'admin', name: 'Admin', cat: 'you', href: '/admin/', blurb: 'People, sign-in and settings.', admin: true }
    ];
    // the Calendar icon shows today's date, like on a phone
    const calendarIcon = () => `<svg class="app-ic" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="cr"><rect width="100" height="100" rx="23"/></clipPath><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#eef0f4"/></linearGradient></defs><g clip-path="url(#cr)"><rect width="100" height="100" fill="url(#cg)"/></g>
        <text x="50" y="30" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing=".5" fill="#ff3b30">${esc(now.toLocaleDateString(undefined, { weekday: 'short' }).replace('.', '').toUpperCase().slice(0, 3))}</text>
        <text x="50" y="79" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="50" font-weight="300" fill="#1c1c1e">${now.getDate()}</text></svg>`;
    const appIcon = a => (a.id === 'calendar' ? calendarIcon() : `<img class="app-ic" src="icons/apps/${a.id}.svg" alt="" width="56" height="56">`);

    function greeting(name) {
        const h = now.getHours();
        const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
        return `${part}${name ? `, ${name.split(' ')[0]}` : ''}`;
    }

    let me = null;
    let pages = null; // which app pages exist (from the server)
    let sum = {};

    function header() {
        const name = (me.settings && me.settings.displayName) || '';
        $('hub-greet').textContent = greeting(name || me.username || '');
        $('hub-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        $('hub-name').textContent = name || (me.username ? `@${me.username}` : me.email);
        $('hub-handle').textContent = name && me.username ? `@${me.username}` : me.email;
        $('hub-email').textContent = me.email;
        const initials = (name || me.email).replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
        $('hub-avatar').innerHTML = esc(initials) + (me.photo ? `<img class="av-img ok" alt="" src="api/avatar?email=${encodeURIComponent(me.email)}&v=${me.photo}">` : '');
        const has = id => !pages || pages.includes(id);
        const quick = [
            ['mail', 'pen', 'Message', `${BASE}inbox?compose=new`],
            ['calendar', 'calendar', 'Event', '/calendar/#new'],
            ['tasks', 'check', 'Task', '/tasks/#new'],
            ['notes', 'note', 'Note', '/notes/#new'],
            ['docs', 'file', 'Doc', '/docs/#new']
        ].filter(([id]) => id === 'mail' || has(id));
        $('hub-quick').innerHTML = quick.map(([, icon, label, href], i) => `<a class="hub-q" href="${esc(href)}" style="--i:${i}">${ic(icon)}<span>${esc(label)}</span></a>`).join('');
    }

    let drawn = '';
    function apps() {
        const shown = APPS.filter(a => (!a.admin || me.admin) && (!pages || ['mail', 'profile', 'admin'].includes(a.id) || pages.includes(a.id)));
        // draw the grid once; later only the numbers change (redrawing would replay the entrance)
        const key = shown.map(a => a.id).join();
        if (key === drawn) return stats();
        $('hub-apps').classList.toggle('settled', !!drawn);
        drawn = key;
        let i = 0;
        $('hub-apps').innerHTML = CATEGORIES.map(([cat, label]) => {
            const list = shown.filter(a => a.cat === cat);
            if (!list.length) return '';
            return `<section class="hub-cat"><h2>${esc(label)}</h2><nav class="hub-apps" aria-label="${esc(label)}">${list
                .map(a => `<a class="hub-app" href="${esc(a.href)}" data-app="${a.id}" style="--i:${i++}">
                    <span class="hub-icon">${appIcon(a)}</span>
                    <span class="hub-text"><b>${esc(a.name)}</b><small>${esc(a.blurb)}</small></span>
                    <span class="hub-stat" data-stat="${a.id}"></span></a>`)
                .join('')}</nav></section>`;
        }).join('');
        stats();
    }

    // a line under each app: what's waiting there
    function stat(id, html, count) {
        const el = document.querySelector(`[data-stat="${id}"]`);
        if (!el) return;
        el.innerHTML = html;
        if (count) el.closest('.hub-app').dataset.count = count > 99 ? '99+' : count;
        else delete el.closest('.hub-app').dataset.count;
    }
    function stats() {
        if (me.username) stat('profile', esc(`@${me.username}`));
        if (me.admin) stat('admin', me.pendingRequests ? `<i>${me.pendingRequests}</i> waiting` : 'All handled', me.pendingRequests);
        if (sum.calendar) stat('calendar', sum.calendar.today ? `<i>${sum.calendar.today}</i> today` : 'Nothing today');
        if (sum.tasks) {
            const due = sum.tasks.today + sum.tasks.overdue;
            stat('tasks', due ? `<i>${due}</i> due${sum.tasks.overdue ? `, ${sum.tasks.overdue} late` : ''}` : sum.tasks.open ? `${sum.tasks.open} to do` : 'All done', due);
        }
        if (sum.notes != null) stat('notes', sum.notes ? plural(sum.notes, 'note') : 'No notes yet');
        if (sum.contacts != null) stat('contacts', sum.contacts ? plural(sum.contacts, 'contact') : 'Add your first');
        if (sum.files) stat('files', sum.files.count ? `${plural(sum.files.count, 'file')} · ${size(sum.files.used)}` : 'No files yet');
        if (sum.docs != null) stat('docs', sum.docs ? plural(sum.docs, 'doc') : 'No docs yet');
        if (sum.slides != null) stat('slides', sum.slides ? plural(sum.slides, 'deck') : 'No decks yet');
        if (sum.chat != null) stat('chat', sum.chat ? `<i>${sum.chat}</i> unread` : 'All read', sum.chat);
        if (sum.mail != null) stat('mail', sum.mail ? `<i>${sum.mail}</i> unread` : 'All read', sum.mail);
    }

    /* ---------- today: agenda, tasks, mail, news ---------- */
    let tasks = [];
    function today_() {
        const cards = [];
        if (sum.news && sum.news.length) {
            cards.push(`<article class="hub-card hub-news"><header><h3>${ic('bell')} News</h3>${me.admin ? '<a href="/admin/#/news">Post</a>' : ''}</header>${sum.news
                .slice(0, 2)
                .map(n => `<div class="hub-news-item"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${esc(n.by)} · ${esc(new Date(n.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</small></div>`)
                .join('')}</article>`);
        }
        if (!pages || pages.includes('calendar')) {
            const evs = (sum.calendar && sum.calendar.items) || [];
            cards.push(`<article class="hub-card"><header><h3>${ic('calendar')} Today</h3><a href="/calendar/">Calendar</a></header>${evs.length
                ? `<ul class="hub-agenda">${evs.map(e => `<li data-color="${esc(e.color)}"><time>${e.allDay ? 'All day' : esc(hhmm(e.at))}</time><span>${esc(e.title)}${e.location ? `<small>${esc(e.location)}</small>` : ''}</span></li>`).join('')}</ul>`
                : `<p class="hub-empty">Nothing planned today.</p><a class="hub-link" href="/calendar/#new">${ic('plus')} Add an event</a>`}</article>`);
        }
        if (!pages || pages.includes('tasks')) {
            const due = tasks.filter(t => !t.done && ((t.due && t.due <= today) || t.starred)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
            cards.push(`<article class="hub-card"><header><h3>${ic('check')} To do</h3><a href="/tasks/">Tasks</a></header>${due.length
                ? `<ul class="hub-tasks">${due.map(t => `<li data-id="${esc(t.id)}"><button class="hub-check" aria-label="Done: ${esc(t.text)}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg></button><span>${esc(t.text)}${t.due && t.due < today ? '<small class="late">Late</small>' : t.due === today ? '<small>Today</small>' : ''}</span></li>`).join('')}</ul>`
                : `<p class="hub-empty">${tasks.some(t => !t.done) ? 'Nothing due today.' : 'All done.'}</p><a class="hub-link" href="/tasks/#new">${ic('plus')} Add a task</a>`}</article>`);
        }
        cards.push(`<article class="hub-card" id="hub-mail"><header><h3>${ic('mail')} Mail</h3><a href="${BASE}inbox">Inbox</a></header><p class="hub-empty">Checking your inbox…</p></article>`);
        $('hub-today').innerHTML = cards.join('');
        mailCard();
    }
    let mailList = null;
    function mailCard() {
        const el = $('hub-mail');
        if (!el || !mailList) return;
        const body = mailList.length
            ? `<ul class="hub-mail">${mailList.slice(0, 4).map(m => `<li><a href="${BASE}inbox/${encodeURIComponent(m.link)}"><b>${esc((m.from[0] && (m.from[0].name || m.from[0].address)) || 'Someone')}</b><span>${esc(m.subject || '(no subject)')}</span></a></li>`).join('')}</ul>`
            : '<p class="hub-empty">No unread mail. Nice.</p>';
        el.innerHTML = `<header><h3>${ic('mail')} Mail${sum.mail ? ` <i>${sum.mail}</i>` : ''}</h3><a href="${BASE}inbox">Inbox</a></header>${body}`;
    }
    $('hub-today').addEventListener('click', async e => {
        const b = e.target.closest('.hub-check');
        if (!b) return;
        const li = b.closest('li');
        const t = tasks.find(x => x.id === li.dataset.id);
        li.classList.add('done');
        try {
            await api(`/api/apps/tasks/${t.id}`, { method: 'PUT', body: JSON.stringify({ ...t, done: true, doneAt: Date.now() }) });
            t.done = true;
            setTimeout(() => {
                if (sum.tasks) {
                    sum.tasks.open--;
                    if (t.due === today) sum.tasks.today--;
                    else if (t.due && t.due < today) sum.tasks.overdue--;
                }
                today_();
                stats();
            }, 600);
        } catch {
            li.classList.remove('done');
        }
    });

    api('api/me')
        .then(m => {
            me = m;
            header();
            apps();
            today_();
            return Promise.allSettled([
                api(`/api/apps-summary?today=${today}&now=${encodeURIComponent(clock)}`).then(s => {
                    sum = { ...sum, ...s };
                    pages = s.pages || null;
                }),
                api('/api/apps/tasks').then(r => (tasks = r.items)),
                // unread mail, when the mail server answers
                api('api/folders').then(folders => {
                    const inbox = (folders || []).find(f => f.specialUse === '\\Inbox' || f.path === 'INBOX');
                    sum.mail = inbox ? inbox.unseen || 0 : 0;
                    return inbox && inbox.unseen ? api('api/messages?folder=INBOX&filter=unread').then(r => (mailList = r.messages || [])) : (mailList = []);
                })
            ]);
        })
        .then(() => {
            header();
            apps();
            today_();
        })
        .catch(() => {});

    $('hub-logout').addEventListener('click', async () => {
        try {
            await api('api/logout', { method: 'POST', body: '{}' });
        } finally {
            location.replace('/login');
        }
    });

    // installable app (Windows, Mac, Android, iPhone): one worker for the whole site
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => new URL(r.scope).pathname !== '/' && r.unregister())).catch(() => {});
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
})();
