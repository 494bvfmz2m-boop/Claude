// The EderveenGroup hub: your apps in one place. New apps are added to APPS.
(function () {
    const BASE = new URL(document.baseURI).pathname; // the mail app, e.g. "/mail/"
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const api = async (path, opts = {}) => {
        const res = await fetch(path, { ...opts, headers: { 'X-EG': '1', 'Content-Type': 'application/json' } });
        if (res.status === 401) {
            location.replace('/login');
            throw new Error('signed out');
        }
        return res.json();
    };

    const APPS = [
        { id: 'mail', name: 'Mail', icon: 'mail', href: `${BASE}inbox`, blurb: 'Your inbox, conversations and everything you sent.', tint: 'linear-gradient(140deg, #4c8dff, #7b5cff)' },
        { id: 'profile', name: 'Profile', icon: 'user', href: '/profile/', blurb: 'Your contact card, ready to share with a link.', tint: 'linear-gradient(140deg, #22d3ee, #4c8dff)' },
        { id: 'admin', name: 'Admin', icon: 'shield', href: '/admin/', blurb: 'Requests, people and who may sign in.', tint: 'linear-gradient(140deg, #af52de, #ff5e8a)', admin: true }
    ];

    function greeting(name) {
        const h = new Date().getHours();
        const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
        return `${part}${name ? `, ${name.split(' ')[0]}` : ''}`;
    }

    function render(me) {
        const name = (me.settings && me.settings.displayName) || '';
        $('hub-greet').textContent = greeting(name || (me.username ? me.username : ''));
        $('hub-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        $('hub-name').textContent = name || (me.username ? `@${me.username}` : me.email);
        $('hub-handle').textContent = name && me.username ? `@${me.username}` : me.email;
        $('hub-email').textContent = me.email;
        const initials = (name || me.email).replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
        $('hub-avatar').innerHTML = esc(initials) + (me.photo ? `<img class="av-img ok" alt="" src="api/avatar?email=${encodeURIComponent(me.email)}&v=${me.photo}">` : '');
        const apps = APPS.filter(a => !a.admin || me.admin);
        $('hub-apps').innerHTML =
            apps.map((a, i) => `<a class="hub-app" href="${esc(a.href)}" data-app="${a.id}" style="--i:${i}">
                <span class="hub-icon" style="background:${a.tint}">${window.icon(a.icon)}</span>
                <span class="hub-text"><b>${esc(a.name)}</b><small>${esc(a.blurb)}</small></span>
                <span class="hub-stat" data-stat="${a.id}"></span>
                <span class="hub-go">${window.icon('right')}</span></a>`).join('') +
            `<div class="hub-app soon" style="--i:${apps.length}"><span class="hub-icon">${window.icon('sparkle')}</span><span class="hub-text"><b>More apps</b><small>New EderveenGroup apps will show up here.</small></span></div>`;
        if (me.username) $('hub-apps').querySelector('[data-stat=profile]').textContent = `@${me.username}`;
        if (me.admin) {
            const el = $('hub-apps').querySelector('[data-stat=admin]');
            if (me.pendingRequests) {
                el.innerHTML = `<i>${me.pendingRequests}</i> waiting`;
                el.closest('.hub-app').dataset.count = me.pendingRequests;
            } else el.textContent = 'All handled';
        }
        // unread mail, filled in when the mail server answers
        api('api/folders')
            .then(folders => {
                const inbox = (folders || []).find(f => f.specialUse === '\\Inbox' || f.path === 'INBOX');
                const el = $('hub-apps').querySelector('[data-stat=mail]');
                if (inbox && el) el.innerHTML = inbox.unseen ? `<i>${inbox.unseen}</i> unread` : 'All read';
                if (inbox && inbox.unseen && el) el.closest('.hub-app').dataset.count = inbox.unseen > 99 ? '99+' : inbox.unseen; // the badge on phones
            })
            .catch(() => {});
    }

    api('api/me').then(render).catch(() => {});

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
