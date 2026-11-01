// The Admin app: requests, people, and who may use EderveenGroup. Only for ADMIN_EMAILS.
(function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ic = n => window.icon(n);
    let main = $('#ad-main'); // replaced per section, so old listeners go with it
    const call = async (url, opts = {}) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' } });
        if (res.status === 401) location.replace('/login?next=%2Fadmin%2F');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    };
    const ago = t => {
        if (!t) return 'never';
        const d = Date.now() - t;
        if (d < 90e3) return 'just now';
        if (d < 3600e3) return `${Math.round(d / 60e3)} min ago`;
        if (d < 864e5) return `${Math.round(d / 3600e3)} h ago`;
        if (d < 30 * 864e5) return `${Math.round(d / 864e5)} d ago`;
        return new Date(t).toLocaleDateString();
    };
    const SIGNIN = { password: 'Password', google: 'Google', microsoft: 'Microsoft', 'microsoft-work': 'Microsoft 365' };
    const srv = x => `${esc(x.host)}:${x.port} · ${x.security === 'tls' ? 'SSL/TLS' : 'STARTTLS'}`;
    const initials = s => (String(s || '?').replace(/[^\p{L} ]/gu, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
    const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    const av = (name, email) => `<span class="ad-av" style="--h:${hue(email)}">${esc(initials(name || email))}</span>`;

    function toast(text, bad) {
        const t = document.createElement('div');
        t.className = 'pf-toast' + (bad ? ' bad' : '');
        t.textContent = text;
        document.body.append(t);
        setTimeout(() => t.classList.add('out'), 2600);
        setTimeout(() => t.remove(), 3100);
    }
    // an in-page confirm, optionally asking for a line of text
    function ask({ title, text, ok = 'OK', danger = false, input = null }) {
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'pf-crop-back';
            back.innerHTML = `<div class="pf-crop ad-ask" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p>
                ${input ? `<input class="input" placeholder="${esc(input)}">` : ''}
                <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${esc(ok)}</button></div></div>`;
            document.body.append(back);
            const done = v => {
                back.classList.add('out');
                setTimeout(() => back.remove(), 250);
                resolve(v);
            };
            $('[data-x]', back).onclick = () => done(null);
            $('[data-ok]', back).onclick = () => done(input ? $('input', back).value.trim() : true);
            back.addEventListener('click', e => e.target === back && done(null));
            back.addEventListener('keydown', e => e.key === 'Escape' && done(null));
            ($('input', back) || $('[data-ok]', back)).focus();
        });
    }
    const setPending = n => {
        const el = $('#ad-pending');
        el.hidden = !n;
        el.textContent = n || '';
    };

    /* ---------- overview ---------- */
    async function overview() {
        const o = await call('/api/admin/overview');
        setPending(o.pending);
        const tile = (n, label, href, icon) => `<a class="ad-tile" ${href ? `href="/admin/${href}"` : ''}>${ic(icon)}<b>${n}</b><span>${label}</span></a>`;
        const signIns = Object.entries(o.signIns).map(([k, n]) => `<span class="ad-chip">${esc(SIGNIN[k] || k)} <b>${n}</b></span>`).join('') || '<span class="ad-muted">No one yet</span>';
        const provider = id => o.providers.some(p => p.id === id);
        main.innerHTML = `<h1>Overview</h1><p class="ad-sub">Everything about your EderveenGroup at a glance.</p>
            <div class="ad-tiles">
                ${tile(o.people, 'people', '#/people', 'user')}
                ${tile(o.activeWeek, 'active this week', '#/people', 'zap')}
                ${tile(o.pending, o.pending === 1 ? 'request waiting' : 'requests waiting', '#/requests', 'inbox')}
                ${tile(o.publicProfiles, 'public profiles', '#/people', 'globe')}
                ${tile(o.twofa, 'use two-step', '#/people', 'lock')}
                ${tile(o.failedWeek, 'failed sign-ins this week', '#/people', 'alert')}
            </div>
            <section class="ad-card"><h2>How people sign in</h2><div class="ad-chips">${signIns}</div></section>
            <section class="ad-card"><h2>Setup</h2>
                <div class="ad-row"><div><b>Sign in with Microsoft</b><small>Outlook.com, Hotmail and Microsoft 365</small></div>${provider('microsoft') ? '<span class="ad-ok">On</span>' : '<span class="ad-off">Not set up</span>'}</div>
                <div class="ad-row"><div><b>Sign in with Google</b><small>Gmail and Google Workspace</small></div>${provider('google') ? '<span class="ad-ok">On</span>' : '<span class="ad-off">Not set up</span>'}</div>
                <div class="ad-row"><div><b>Who may use Microsoft / Google</b><small>${o.settings.oauthPolicy === 'anyone' ? 'Anyone with an account' : 'Only approved addresses and domains'}</small></div><a class="btn" href="/admin/#/access">Change</a></div>
                <div class="ad-row"><div><b>Storage</b><small>${o.database === 'mysql' ? 'MySQL / MariaDB database' : 'Files in the data folder'}</small></div><span class="ad-ok">${o.database === 'mysql' ? 'Database' : 'Files'}</span></div>
                <div class="ad-row"><div><b>Admins</b><small>${o.admins.map(esc).join(', ')}</small></div></div>
            </section>`;
    }

    /* ---------- requests ---------- */
    async function requests() {
        const list = await call('/api/admin/requests');
        const pending = list.filter(r => r.status === 'pending');
        const decided = list.filter(r => r.status !== 'pending').slice(0, 30);
        setPending(pending.length);
        const domain = e => e.split('@')[1];
        main.innerHTML = `<h1>Requests</h1><p class="ad-sub">People who asked to use EderveenGroup. Accepting lets them in right away and emails them from your address.</p>
            <div class="req-list">${pending.length ? pending.map((r, i) => `<div class="req" data-id="${esc(r.id)}" style="animation-delay:${i * 50}ms">
                <div class="req-head">${av(r.name, r.email)}<div class="lbl"><b>${esc(r.name || r.email)}</b><small>${esc(r.email)} · ${esc(ago(r.createdAt))}${r.device ? ` · ${esc(r.device)}` : ''}</small></div>
                    ${r.provider ? `<span class="badge ok">${ic('check')} Signed in with ${esc(SIGNIN[r.provider] || r.provider)}</span>` : r.verified ? `<span class="badge ok">${ic('check')} Settings work</span>` : ''}</div>
                ${r.provider ? '' : `<dl class="req-srv"><dt>IMAP</dt><dd>${srv(r.imap)}</dd><dt>SMTP</dt><dd>${srv(r.smtp)}</dd><dt>Login</dt><dd>${r.login === 'local' ? 'Part before the @' : 'Full email address'}</dd></dl>`}
                ${r.note ? `<p class="req-note">“${esc(r.note)}”</p>` : ''}
                <div class="req-actions"><div class="seg" data-scope><button data-v="address" class="on">Only ${esc(r.email)}</button><button data-v="domain">Everyone @${esc(domain(r.email))}</button></div>
                    <span class="spacer"></span><button class="btn btn-danger" data-reject>Reject</button><button class="btn btn-primary" data-accept>${ic('check')} Accept</button></div></div>`).join('') : `<div class="empty-note">${ic('sparkle')}<span>No open requests. People can ask at <b>${esc(location.host)}/mail/request</b>, or by signing in with Microsoft or Google.</span></div>`}</div>
            ${decided.length ? `<h2 class="ad-h2">Decided</h2><ol class="act-list">${decided.map(r => `<li class="${r.status === 'accepted' ? 'ok' : 'bad'}"><span class="act-dot">${ic(r.status === 'accepted' ? 'check' : 'x')}</span><div class="lbl"><b>${esc(r.name || r.email)} · ${r.status}${r.scope === 'domain' ? ` (everyone @${esc(domain(r.email))})` : ''}</b><small>${esc(r.email)}${r.decidedBy ? ` · by ${esc(r.decidedBy)}` : ''}${r.reason ? ` · “${esc(r.reason)}”` : ''}</small></div><time>${esc(ago(r.decidedAt))}</time></li>`).join('')}</ol>` : ''}`;
        $$('.req [data-scope]', main).forEach(seg =>
            seg.addEventListener('click', e => {
                const b = e.target.closest('button');
                if (b) $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
            })
        );
        $$('.req', main).forEach(card => {
            const r = pending.find(x => x.id === card.dataset.id);
            const finish = (ok, out) => {
                card.classList.add(ok ? 'accepted' : 'rejected');
                toast(out.emailed ? `${ok ? 'Accepted' : 'Rejected'}. ${r.email} has been emailed.` : `${ok ? 'Accepted' : 'Rejected'}, but the email couldn’t be sent: ${out.emailError}`, !out.emailed);
                setTimeout(requests, 900);
            };
            $('[data-accept]', card).onclick = async () => {
                const scope = $('[data-scope] .on', card).dataset.v;
                if (!(await ask({ title: `Accept ${r.name || r.email}?`, text: `${scope === 'domain' ? `Everyone @${domain(r.email)}` : r.email} can use EderveenGroup from now on. They’ll get an email from you.`, ok: 'Accept & email' }))) return;
                try {
                    finish(true, await call(`/api/admin/requests/${encodeURIComponent(r.id)}/accept`, { method: 'POST', body: JSON.stringify({ scope }) }));
                } catch (e) {
                    toast(e.message, true);
                }
            };
            $('[data-reject]', card).onclick = async () => {
                const reason = await ask({ title: `Reject ${r.name || r.email}?`, text: 'They’ll get an email saying it wasn’t accepted.', ok: 'Reject & email', danger: true, input: 'Reason (optional)' });
                if (reason === null) return;
                try {
                    finish(false, await call(`/api/admin/requests/${encodeURIComponent(r.id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }));
                } catch (e) {
                    toast(e.message, true);
                }
            };
        });
    }

    /* ---------- people ---------- */
    async function people() {
        const list = await call('/api/admin/people');
        let q = '';
        const draw = () => {
            const shown = list.filter(p => !q || [p.email, p.username, p.name].some(x => String(x || '').toLowerCase().includes(q)));
            $('#ad-people', main).innerHTML = shown.length
                ? shown.map((p, i) => `<div class="ad-person" data-email="${esc(p.email)}" style="animation-delay:${Math.min(i, 12) * 30}ms">
                    ${av(p.name, p.email)}
                    <div class="lbl"><b>${esc(p.name || p.email)}${p.username ? ` <span class="ad-handle">@${esc(p.username)}</span>` : ''}</b>
                        <small>${esc(p.email)} · ${esc(SIGNIN[p.signIn] || p.signIn)} · last seen ${esc(ago(p.lastSeen))}</small>
                        <span class="ad-tags">${p.twofa ? `<i class="t-ok">${ic('lock')}2FA</i>` : ''}${p.devices ? `<i>${p.devices} device${p.devices === 1 ? '' : 's'}</i>` : ''}${p.profile !== 'none' ? `<i class="${p.profile === 'hidden' ? 't-bad' : ''}">Profile ${p.profile}</i>` : ''}${p.failedWeek ? `<i class="t-bad">${p.failedWeek} failed</i>` : ''}</span></div>
                    <div class="ad-person-acts">
                        ${p.username && p.profile === 'public' ? `<a class="btn btn-ghost" href="/profile/#/${esc(p.username)}" target="_blank" rel="noopener">${ic('external')}<span>Card</span></a>` : ''}
                        ${p.profile === 'public' || p.profile === 'hidden' ? `<button class="btn btn-ghost" data-hide="${p.profile === 'hidden' ? '0' : '1'}">${p.profile === 'hidden' ? 'Unhide card' : 'Hide card'}</button>` : ''}
                        ${p.devices ? `<button class="btn btn-danger" data-signout>Sign out</button>` : ''}</div></div>`).join('')
                : '<p class="ad-muted">Nobody matches that.</p>';
        };
        main.innerHTML = `<h1>People</h1><p class="ad-sub">${list.length} ${list.length === 1 ? 'person has' : 'people have'} an EderveenGroup account.</p>
            <div class="ad-search">${ic('search')}<input class="input" placeholder="Search by name, email or username" aria-label="Search people"></div>
            <div class="ad-people" id="ad-people"></div>`;
        $('.ad-search input', main).addEventListener('input', e => {
            q = e.target.value.trim().toLowerCase();
            draw();
        });
        main.addEventListener('click', async e => {
            const row = e.target.closest('.ad-person');
            if (!row) return;
            const p = list.find(x => x.email === row.dataset.email);
            if (e.target.closest('[data-signout]')) {
                if (!(await ask({ title: `Sign out ${p.name || p.email}?`, text: 'Every device they’re signed in on is signed out right away.', ok: 'Sign out', danger: true }))) return;
                try {
                    await call(`/api/admin/people/${encodeURIComponent(p.email)}/signout`, { method: 'POST', body: '{}' });
                    p.devices = 0;
                    draw();
                    toast(`${p.email} was signed out everywhere`);
                } catch (err) {
                    toast(err.message, true);
                }
            }
            const hide = e.target.closest('[data-hide]');
            if (hide) {
                const on = hide.dataset.hide === '1';
                if (on && !(await ask({ title: 'Hide this profile card?', text: 'Nobody can open it until you unhide it. They can still edit it.', ok: 'Hide card', danger: true }))) return;
                try {
                    await call(`/api/admin/people/${encodeURIComponent(p.email)}/profile`, { method: 'POST', body: JSON.stringify({ hidden: on }) });
                    p.profile = on ? 'hidden' : 'public';
                    draw();
                } catch (err) {
                    toast(err.message, true);
                }
            }
        }, { once: false });
        draw();
    }

    /* ---------- access ---------- */
    async function access() {
        const [settings, allowed, servers, o] = await Promise.all([call('/api/admin/settings'), call('/api/admin/allowed'), call('/api/admin/servers'), call('/api/admin/overview')]);
        main.innerHTML = `<h1>Access</h1><p class="ad-sub">Who can use EderveenGroup, and which mail servers they use.</p>
            <section class="ad-card"><h2>Sign in with Microsoft / Google</h2>
                <div class="seg ad-policy" id="ad-policy"><button data-v="approved" class="${settings.oauthPolicy !== 'anyone' ? 'on' : ''}">Only approved</button><button data-v="anyone" class="${settings.oauthPolicy === 'anyone' ? 'on' : ''}">Anyone</button></div>
                <p class="ad-muted">${settings.oauthPolicy === 'anyone' ? 'Anyone with a Microsoft or Google account can sign in.' : 'Others who sign in with Microsoft or Google show up under Requests.'} ${o.providers.length ? '' : 'Neither is set up yet: see the README.'}</p>
                <form class="ad-add" id="ad-allow"><input class="input" placeholder="ava@gmail.com or @company.com" aria-label="Address or domain"><button class="btn btn-primary">${ic('plus')}<span>Allow</span></button></form>
                <div class="srv-list">${allowed.length ? allowed.map(a => `<div class="row" data-key="${esc(a.key)}"><div class="lbl"><b>${esc(a.key.startsWith('@') ? `Everyone ${a.key}` : a.key)}</b><small>${a.provider ? `${esc(SIGNIN[a.provider] || a.provider)} · ` : ''}added ${esc(ago(a.addedAt))}${a.addedBy ? ` by ${esc(a.addedBy)}` : ''}</small></div><button class="btn btn-danger" data-unallow>Remove</button></div>`).join('') : '<p class="ad-muted">No one approved yet.</p>'}</div>
            </section>
            <section class="ad-card"><h2>Other mail servers</h2>
                <p class="ad-muted">Mailboxes that aren’t on Purelymail, Microsoft or Google, added from requests.</p>
                <div class="srv-list">${servers.length ? servers.map(a => `<div class="row" data-key="${esc(a.key)}"><div class="lbl"><b>${esc(a.key.startsWith('@') ? `Everyone ${a.key}` : a.key)}</b><small>${srv(a.imap)} · ${srv(a.smtp)} · added ${esc(ago(a.addedAt))}</small></div><button class="btn btn-danger" data-remove>Remove</button></div>`).join('') : '<p class="ad-muted">None yet. Everyone else signs in with Purelymail.</p>'}</div>
            </section>`;
        $('#ad-policy').addEventListener('click', async e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.v === 'anyone' && !(await ask({ title: 'Let anyone sign in?', text: 'Anyone with a Microsoft or Google account will be able to use EderveenGroup without asking.', ok: 'Let anyone in' }))) return;
            await call('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ oauthPolicy: b.dataset.v }) });
            toast(b.dataset.v === 'anyone' ? 'Anyone can sign in now' : 'Only approved people can sign in');
            access();
        });
        $('#ad-allow').addEventListener('submit', async e => {
            e.preventDefault();
            const key = $('#ad-allow input').value.trim();
            try {
                await call('/api/admin/allowed', { method: 'POST', body: JSON.stringify({ key }) });
                toast(`${key} can sign in now`);
                access();
            } catch (err) {
                toast(err.message, true);
            }
        });
        $$('[data-unallow], [data-remove]', main).forEach(b =>
            b.addEventListener('click', async () => {
                const key = b.closest('.row').dataset.key;
                const server = b.hasAttribute('data-remove');
                if (!(await ask({ title: `Remove ${key}?`, text: server ? 'They won’t be able to sign in any more. Their mail stays on their own server.' : 'They won’t be able to sign in with Microsoft or Google any more (unless anyone may).', ok: 'Remove', danger: true }))) return;
                try {
                    await call(`/api/admin/${server ? 'servers' : 'allowed'}/${encodeURIComponent(key)}`, { method: 'DELETE' });
                    access();
                } catch (err) {
                    toast(err.message, true);
                }
            })
        );
    }

    /* ---------- address: #/, #/requests, #/people, #/access ---------- */
    const TABS = { overview, requests, people, access };
    async function route() {
        const tab = TABS[location.hash.replace(/^#\/?/, '')] ? location.hash.replace(/^#\/?/, '') : 'overview';
        $$('#ad-nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
        const fresh = main.cloneNode(false);
        main.replaceWith(fresh);
        main = fresh;
        main.innerHTML = '<div class="pf-loading"><div class="spinner"></div></div>';
        main.classList.add('enter');
        try {
            await TABS[tab]();
        } catch (e) {
            main.innerHTML = `<div class="pf-empty"><h1>Couldn’t load this</h1><p>${esc(e.message)}</p></div>`;
        }
        const h = $('h1', main);
        document.title = `${h ? h.textContent : 'Admin'} · Admin · EderveenGroup`;
    }
    addEventListener('hashchange', route);
    route();
})();
