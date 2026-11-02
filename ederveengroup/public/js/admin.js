// The Admin app: requests, people, and who may use EderveenGroup. Only for ADMIN_EMAILS.
(function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ic = n => window.icon(n);
    let main = $('#ad-main'); // replaced per section, so old listeners go with it
    // every request says clearly what went wrong, and gives up after 25 seconds
    const call = async (url, opts = {}) => {
        let res;
        try {
            res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' }, signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined });
        } catch (err) {
            throw new Error(err && err.name === 'TimeoutError' ? `The server didn’t answer in time (${url}).` : `Couldn’t reach the server (${url}). Check your connection; an ad blocker or privacy extension can also stop this.`);
        }
        if (res.status === 401) location.replace('/login?next=%2Fadmin%2F');
        const type = res.headers.get('content-type') || '';
        const data = type.includes('json') ? await res.json().catch(() => ({})) : {};
        if (!res.ok) throw new Error(`${data.error || 'Something went wrong'} (the server answered ${res.status} for ${url})`);
        if (!type.includes('json')) throw new Error(`The server sent a page instead of data for ${url} (status ${res.status}). Something between your browser and EderveenGroup changed the answer.`);
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
                <div class="ad-row"><div><b>Sign in with Microsoft</b><small>Outlook.com, Hotmail and Microsoft 365</small></div>${provider('microsoft') ? '<span class="ad-ok">On</span>' : '<a class="btn btn-primary" href="/admin/#/signin">Set up</a>'}</div>
                <div class="ad-row"><div><b>Sign in with Google</b><small>Gmail and Google Workspace</small></div>${provider('google') ? '<span class="ad-ok">On</span>' : '<a class="btn btn-primary" href="/admin/#/signin">Set up</a>'}</div>
                <div class="ad-row"><div><b>Who may use Microsoft / Google</b><small>${o.settings.oauthPolicy === 'anyone' ? 'Anyone with an account' : 'Only approved addresses and domains'}</small></div><a class="btn" href="/admin/#/access">Change</a></div>
                <div class="ad-row"><div><b>Storage</b><small>${o.database === 'mysql' ? 'MySQL / MariaDB database' : 'Files in the data folder'}</small></div><span class="ad-ok">${o.database === 'mysql' ? 'Database' : 'Files'}</span></div>
                <div class="ad-row"><div><b>Admins</b><small>${o.admins.map(esc).join(', ')}</small></div><a class="btn" href="/admin/#/people">People</a></div>
            </section>
            <section class="ad-card"><h2>Recent activity</h2><div class="ad-log" id="ad-recent"><p class="ad-muted">Loading…</p></div><a class="btn btn-ghost" href="/admin/#/activity">See all activity</a></section>`;
        call('/api/admin/activity')
            .then(list => {
                const el = $('#ad-recent', main);
                if (!el) return;
                el.innerHTML = list.length
                    ? list.slice(0, 6).map(e => `<div class="ad-ev ${e.kind === 'admin' ? 'admin' : e.ok ? 'ok' : 'bad'}"><span class="ad-ev-ic">${ic(e.kind === 'admin' ? 'shield' : e.ok ? 'check' : 'alert')}</span><div><b>${esc(e.kind === 'admin' ? e.text : e.email)}</b><small>${e.kind === 'admin' ? `by ${esc(e.by)}` : e.ok ? 'Signed in' : 'Sign-in failed'}</small></div><time>${esc(ago(e.t))}</time></div>`).join('')
                    : '<p class="ad-muted">Nothing yet.</p>';
            })
            .catch(() => {});
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
                    <div class="lbl"><b>${esc(p.name || p.email)}${p.username ? ` <span class="ad-handle">@${esc(p.username)}</span>` : ''}${p.role !== 'member' ? ` <span class="ad-role">${p.role === 'owner' ? 'Owner' : 'Admin'}</span>` : ''}${p.blocked ? ' <span class="ad-role bad">Blocked</span>' : ''}${p.you ? ' <span class="ad-handle">(you)</span>' : ''}</b>
                        <small>${esc(p.email)} · ${esc(SIGNIN[p.signIn] || p.signIn)} · last seen ${esc(ago(p.lastSeen))}</small>
                        <span class="ad-tags">${p.twofa ? `<i class="t-ok">${ic('lock')}2FA</i>` : ''}${p.devices ? `<i>${p.devices} device${p.devices === 1 ? '' : 's'}</i>` : ''}${p.profile !== 'none' ? `<i class="${p.profile === 'hidden' ? 't-bad' : ''}">Profile ${p.profile}</i>` : ''}${p.failedWeek ? `<i class="t-bad">${p.failedWeek} failed</i>` : ''}</span></div>
                    <div class="ad-person-acts">
                        ${p.username && p.profile === 'public' ? `<a class="btn btn-ghost" href="/profile/#/${esc(p.username)}" target="_blank" rel="noopener">${ic('external')}<span>Card</span></a>` : ''}
                        ${p.profile === 'public' || p.profile === 'hidden' ? `<button class="btn btn-ghost" data-hide="${p.profile === 'hidden' ? '0' : '1'}">${p.profile === 'hidden' ? 'Unhide card' : 'Hide card'}</button>` : ''}
                        ${p.devices && !p.you ? `<button class="btn btn-ghost" data-signout>Sign out</button>` : ''}
                        ${p.role !== 'owner' && !p.you && !p.blocked ? `<button class="btn btn-ghost" data-role="${p.role === 'admin' ? '0' : '1'}">${p.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>` : ''}
                        ${p.role !== 'owner' && !p.you ? `<button class="btn ${p.blocked ? '' : 'btn-danger'}" data-block="${p.blocked ? '0' : '1'}">${p.blocked ? 'Unblock' : 'Block'}</button>` : ''}</div></div>`).join('')
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
            const role = e.target.closest('[data-role]');
            if (role) {
                const on = role.dataset.role === '1';
                if (on && !(await ask({ title: `Make ${p.name || p.email} an admin?`, text: 'They can accept requests, manage people, change sign-in and see the activity log.', ok: 'Make admin' }))) return;
                try {
                    p.role = (await call(`/api/admin/people/${encodeURIComponent(p.email)}/role`, { method: 'POST', body: JSON.stringify({ admin: on }) })).role;
                    draw();
                    toast(on ? `${p.email} is an admin now` : `${p.email} is no longer an admin`);
                } catch (err) {
                    toast(err.message, true);
                }
            }
            const block = e.target.closest('[data-block]');
            if (block) {
                const on = block.dataset.block === '1';
                if (on && !(await ask({ title: `Block ${p.name || p.email}?`, text: 'They’re signed out everywhere and can’t sign in again until you unblock them. Their mail itself isn’t touched.', ok: 'Block', danger: true }))) return;
                try {
                    await call(`/api/admin/people/${encodeURIComponent(p.email)}/block`, { method: 'POST', body: JSON.stringify({ blocked: on }) });
                    p.blocked = on;
                    if (on) (p.devices = 0), (p.role = 'member');
                    draw();
                    toast(on ? `${p.email} is blocked` : `${p.email} can sign in again`);
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
                <p class="ad-muted">${settings.oauthPolicy === 'anyone' ? 'Anyone with a Microsoft or Google account can sign in.' : 'Others who sign in with Microsoft or Google show up under Requests.'} ${o.providers.length ? '' : 'Neither is switched on yet: <a href="/admin/#/signin">set them up in Sign-in</a>.'}</p>
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

    /* ---------- sign-in: switch on Microsoft / Google by pasting the app's keys ---------- */
    const LOGOS = {
        microsoft: '<svg viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>',
        google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>'
    };
    const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text} ${ic('external')}</a>`;
    const copyField = (value, label) => `<span class="si-copy"><code>${esc(value)}</code><button type="button" class="btn" data-copy="${esc(value)}" aria-label="Copy ${esc(label)}">${ic('copy')}<span>Copy</span></button></span>`;
    const STEPS = {
        microsoft: p => [
            `Open ${ext('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', 'App registrations')} and sign in with any Microsoft account. (If it asks you to create a directory or a free Azure account, do that: it costs nothing.)`,
            'Click <b>New registration</b>. Name: <b>EderveenGroup</b>. Supported account types: <b>Accounts in any organizational directory and personal Microsoft accounts</b>.',
            `Redirect URI: choose <b>Web</b> and paste ${copyField(p.redirectUri, 'redirect URI')} Then click <b>Register</b>.`,
            'On the page that opens, copy the <b>Application (client) ID</b> into the first box below.',
            'Go to <b>Certificates &amp; secrets</b> → <b>New client secret</b> → expires in 24 months → <b>Add</b>. Copy the <b>Value</b> (not the Secret ID) into the second box below. It’s only shown once.',
            'Go to <b>API permissions</b> → <b>Add a permission</b> → <b>Microsoft Graph</b> → <b>Delegated permissions</b>. Tick <b>offline_access</b>, <b>openid</b>, <b>email</b>, <b>profile</b>, <b>IMAP.AccessAsUser.All</b> and <b>SMTP.Send</b>, then <b>Add permissions</b>.'
        ],
        google: p => [
            `Open the ${ext('https://console.cloud.google.com/projectcreate', 'Google Cloud console')} and create a project called <b>EderveenGroup</b>.`,
            `Switch on the ${ext('https://console.cloud.google.com/apis/library/gmail.googleapis.com', 'Gmail API')} for that project (click <b>Enable</b>).`,
            `Open ${ext('https://console.cloud.google.com/auth/overview', 'Google Auth Platform')} → <b>Get started</b>: app name <b>EderveenGroup</b>, your email, audience <b>External</b>. Under <b>Audience</b>, add the Gmail addresses that may sign in as <b>test users</b>. Under <b>Data access</b>, add the scope <b>https://mail.google.com/</b>.`,
            `Under <b>Clients</b> → <b>Create client</b>: type <b>Web application</b>, and under <b>Authorized redirect URIs</b> add ${copyField(p.redirectUri, 'redirect URI')}`,
            'Click <b>Create</b>, then copy the <b>Client ID</b> and <b>Client secret</b> into the boxes below.'
        ]
    };
    const NOTES = {
        microsoft: 'Outlook.com and Hotmail users need IMAP turned on (Outlook.com → Settings → Mail → Forwarding and IMAP); the sign-in page tells them if it’s off. Microsoft 365 organisations must allow IMAP and Authenticated SMTP.',
        google: 'While the Google app is in “Testing”, only the test users you add can sign in, and Google asks them to sign in again every 7 days. That’s fine for family or a small team.'
    };
    async function signin() {
        const list = await call('/api/admin/signin');
        main.innerHTML = `<h1>Sign-in</h1><p class="ad-sub">Let people sign in with their Microsoft or Google account. Mail then works without their password ever reaching this server.</p>
            ${list.map(p => `<section class="ad-card si-card" data-id="${p.id}">
                <div class="si-head"><span class="si-logo">${LOGOS[p.id]}</span><div><h2>Sign in with ${esc(p.name)}</h2><small>${p.id === 'microsoft' ? 'Outlook.com, Hotmail, Live and Microsoft 365' : 'Gmail and Google Workspace'}</small></div>
                    ${p.ready ? `<span class="ad-ok">${ic('check')} On</span>` : '<span class="ad-off">Not set up</span>'}</div>
                ${p.source === 'env'
                    ? `<p class="ad-muted">Switched on by the server’s environment variables (${p.id === 'microsoft' ? 'MICROSOFT_CLIENT_ID' : 'GOOGLE_CLIENT_ID'}). To change it, edit them in Coolify.</p>`
                    : `<details class="si-guide"${p.ready ? '' : ' open'}><summary>${p.ready ? 'How it was set up' : `Set it up (about 5 minutes)`}</summary><ol class="si-steps">${STEPS[p.id](p).map(x => `<li>${x}</li>`).join('')}</ol></details>
                    <form class="si-form" novalidate>
                        <label class="pf-field"><span>${p.id === 'microsoft' ? 'Application (client) ID' : 'Client ID'}</span><input class="input" name="clientId" value="${esc(p.clientId)}" placeholder="${p.id === 'microsoft' ? '1a2b3c4d-5e6f-7a8b-9c0d-…' : '123456789-abc….apps.googleusercontent.com'}" autocomplete="off" spellcheck="false"></label>
                        <label class="pf-field"><span>${p.id === 'microsoft' ? 'Client secret (its Value)' : 'Client secret'}</span><input class="input" name="clientSecret" type="password" placeholder="${p.secretSaved ? `Saved, ends in …${esc(p.secretHint)}. Paste a new one to replace it.` : 'Paste the secret'}" autocomplete="new-password" spellcheck="false"></label>
                        ${p.id === 'microsoft' ? `<details class="si-adv"><summary>Advanced</summary><label class="pf-field"><span>Directory (tenant)</span><input class="input" name="tenant" value="${esc(p.tenant)}" spellcheck="false"><small class="ad-muted">Leave it on <b>common</b> for everyone. Your tenant ID or domain allows only your own organisation.</small></label></details>` : ''}
                        <div class="form-error hidden" role="alert"></div>
                        <div class="si-acts">${p.secretSaved ? '<button type="button" class="btn btn-danger" data-clear>Switch off</button>' : ''}<span class="spacer"></span><button class="btn btn-primary" type="submit">${ic('check')}<span>${p.ready ? 'Save' : 'Save and switch on'}</span></button></div>
                    </form>`}
                <p class="ad-muted si-note">${NOTES[p.id]}</p>
                <label class="si-show"><input type="checkbox" data-show ${p.hidden ? '' : 'checked'}> Show the button on the sign-in page${p.ready ? '' : ' (until it’s set up, it explains that it isn’t switched on yet)'}</label>
            </section>`).join('')}`;
        $$('[data-copy]', main).forEach(b =>
            b.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(b.dataset.copy);
                    toast('Copied');
                } catch {
                    const r = document.createRange();
                    r.selectNodeContents(b.previousElementSibling);
                    getSelection().removeAllRanges();
                    getSelection().addRange(r);
                }
            })
        );
        $$('.si-card', main).forEach(card => {
            const id = card.dataset.id;
            const hidden = () => !$('[data-show]', card).checked;
            const form = $('.si-form', card);
            if (form) {
                form.addEventListener('submit', async e => {
                    e.preventDefault();
                    const err = $('.form-error', form);
                    err.classList.add('hidden');
                    const body = { clientId: form.clientId.value, clientSecret: form.clientSecret.value, hidden: hidden() };
                    if (form.tenant) body.tenant = form.tenant.value;
                    try {
                        const p = await call(`/api/admin/signin/${id}`, { method: 'PUT', body: JSON.stringify(body) });
                        toast(`Sign in with ${p.name} is on`);
                        signin();
                    } catch (x) {
                        err.textContent = x.message;
                        err.classList.remove('hidden');
                    }
                });
                $('[data-clear]', form)?.addEventListener('click', async () => {
                    if (!(await ask({ title: 'Switch this sign-in off?', text: 'People who signed in this way will have to sign in another way. You can paste the keys again later.', ok: 'Switch off', danger: true }))) return;
                    await call(`/api/admin/signin/${id}`, { method: 'DELETE' });
                    signin();
                });
            }
            $('[data-show]', card).addEventListener('change', async () => {
                try {
                    await call(`/api/admin/signin/${id}`, { method: 'PUT', body: JSON.stringify({ hidden: hidden() }) });
                    toast(hidden() ? 'Hidden on the sign-in page' : 'Shown on the sign-in page');
                } catch (x) {
                    toast(x.message, true);
                }
            });
        });
    }

    /* ---------- AI: auto editing with Claude, on the owner's own API key ---------- */
    // how to get a key, per service
    const AI_GUIDE = {
        claude: ['Go to <b>console.anthropic.com</b> and sign in (or make an account).', 'Under <b>Billing</b>, add some credit. Auto edits are paid per use from that balance (separate from a Claude.ai subscription).', 'Under <b>API keys</b>, choose <b>Create key</b>, name it “EderveenGroup”, and copy it (it starts with <code>sk-ant-</code>).'],
        gemini: ['Go to <b>aistudio.google.com/apikey</b> and sign in with a Google account.', 'Choose <b>Create API key</b> and copy it (it starts with <code>AIza</code>).', 'The free tier has daily limits; for more, turn on billing for its Google Cloud project.'],
        groq: ['Go to <b>console.groq.com/keys</b> and sign in.', 'Choose <b>Create API Key</b> and copy it (it starts with <code>gsk_</code>).', 'Groq is very fast, but its vision models look at only a few pictures at a time, so video edits use fewer frames.'],
        openai: ['Go to <b>platform.openai.com/api-keys</b> and sign in.', 'Under <b>Billing</b>, add some credit (separate from a ChatGPT subscription).', 'Choose <b>Create new secret key</b> and copy it.'],
        openrouter: ['Go to <b>openrouter.ai/keys</b> and sign in.', 'Add credits, then choose <b>Create key</b> and copy it.', 'Pick a model below that can look at images (vision).'],
        mistral: ['Go to <b>console.mistral.ai</b> → <b>API keys</b> and sign in.', 'Choose <b>Create new key</b> and copy it.', 'Pick a model below that can look at images.'],
        xai: ['Go to <b>console.x.ai</b> and sign in.', 'Under <b>API keys</b>, create a key and copy it (it starts with <code>xai-</code>).', 'Pick a Grok model below that can look at images.'],
        custom: ['Any service that speaks the OpenAI API works: Together, DeepSeek, Fireworks, a company proxy, or one on your own computer.', 'For <b>Ollama</b> use the address <code>http://localhost:11434/v1</code>, for <b>LM Studio</b> <code>http://localhost:1234/v1</code>, and type any word as the key.', 'Pick a model that can look at images (vision).']
    };
    let aiShown = null; // the service whose settings are open
    async function aiTab() {
        const s = await call('/api/admin/ai');
        const n = v => Number(v || 0).toLocaleString();
        const id = aiShown && s.providers.some(p => p.id === aiShown) ? aiShown : s.active;
        const p = s.providers.find(x => x.id === id);
        const active = s.providers.find(x => x.id === s.active);
        const inUse = active.configured ? `<b>${esc(active.name)}</b> · ${esc(active.id === 'claude' ? (s.models.find(m => m.id === active.model) || { name: active.model }).name.split(' (')[0] : active.model || 'no model picked')}` : 'nothing yet (add a key below)';
        const status = p.configured ? (p.source === 'env' ? `Set on the server (${esc(p.env)}), ends in …${esc(p.hint)}` : `Saved, ends in …${esc(p.hint)}${p.savedBy ? ` · by ${esc(p.savedBy)}` : ''}${p.savedAt ? ` · ${esc(new Date(p.savedAt).toLocaleDateString())}` : ''}`) : 'Not set up yet';
        main.innerHTML = `<h1>AI</h1><p class="ad-sub">Auto editing in the Photo Editor and the Video Editor. Only admins see it. It runs on your own API key, and that service bills it.</p>
            <section class="ad-card"><h2>Service</h2><p class="ad-muted">In use for auto editing: ${inUse}. Pick a service to set it up; each keeps its own key.</p>
                <div class="ai-provs">${s.providers.map(x => `<button class="ai-prov${x.id === id ? ' on' : ''}" data-prov="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.custom ? 'OpenAI-compatible' : x.by)}</small>${x.id === s.active && x.configured ? `<i class="ad-ok">${ic('check')} In use</i>` : x.configured ? '<i class="ad-off">Key saved</i>' : ''}</button>`).join('')}</div></section>
            <section class="ad-card"><div class="si-head"><span class="si-logo ai-logo">${ic('zap')}</span><div><h2>${esc(p.name)} API key</h2><small>${status}</small></div>${p.configured ? (p.id === s.active ? `<span class="ad-ok">${ic('check')} In use</span>` : '<span class="ad-off">Ready</span>') : '<span class="ad-off">Off</span>'}</div>
                ${p.source === 'env' ? `<p class="ad-muted">To change it, edit ${esc(p.env)} in Coolify.</p>` : `<details class="si-guide"${p.configured ? '' : ' open'}><summary>Get a key</summary><ol class="si-steps">${AI_GUIDE[p.id].map(x => `<li>${x}</li>`).join('')}<li>Paste it below and save. It’s stored encrypted and never shown again.</li></ol></details>`}
                <form class="si-form" id="aiform" novalidate>
                    ${p.custom ? `<label class="pf-field"><span>Address of the service’s API</span><input class="input" name="baseUrl" value="${esc(p.baseUrl)}" placeholder="https://api.example.com/v1" spellcheck="false" autocomplete="off"></label>` : ''}
                    ${p.source === 'env' ? '' : `<label class="pf-field"><span>API key</span><input class="input" name="apiKey" type="password" placeholder="${p.configured ? `Saved, ends in …${esc(p.hint)}. Paste a new one to replace it.` : esc(p.keyHint || 'Paste the key')}" autocomplete="new-password" spellcheck="false"></label>`}
                    <div class="form-error hidden" role="alert"></div>
                    <div class="si-acts">${p.configured && p.source !== 'env' ? '<button type="button" class="btn btn-danger" data-clear>Remove key</button>' : ''}<span class="spacer"></span>${p.configured ? `<button type="button" class="btn" data-test>${ic('zap')}<span>Test</span></button>` : ''}${p.source === 'env' && !p.custom ? '' : `<button class="btn btn-primary" type="submit">${ic('check')}<span>Save</span></button>`}</div>
                </form>
                ${p.configured && p.id !== s.active ? `<div class="ai-use-this"><span>${esc(p.name)} is ready.</span><button class="btn btn-primary" data-activate>${ic('check')}<span>Use ${esc(p.name)} for auto editing</span></button></div>` : ''}
            </section>
            <section class="ad-card"><h2>Model</h2>${
                p.id === 'claude'
                    ? `<p class="ad-muted">Which Claude makes the edits. Opus gives the best edits; the others are quicker and cost less.</p><div class="ai-models">${s.models.map(m => `<label class="ai-model"><input type="radio" name="model" value="${m.id}"${m.id === p.model ? ' checked' : ''}><span><b>${esc(m.name.split(' (')[0])}</b><small>${esc((m.name.match(/\((.*)\)/) || [])[1] || '')}</small></span></label>`).join('')}</div>`
                    : `<p class="ad-muted">The model must be able to look at pictures (vision). ${p.defaultModel ? `Suggested: <code>${esc(p.defaultModel)}</code>. ` : ''}${p.configured ? 'Load models shows what your key can use.' : 'Add the key first to see what it can use.'}</p>
                        <div class="ai-modelrow"><input class="input" id="aimodel" list="aimodels" value="${esc(p.model)}" placeholder="model name" spellcheck="false" autocomplete="off"><datalist id="aimodels"></datalist>${p.configured ? `<button class="btn" data-load>${ic('refresh')}<span>Load models</span></button>` : ''}<button class="btn btn-primary" data-savemodel>${ic('check')}<span>Save</span></button></div>
                        <p class="ad-muted" id="aimodelnote"></p>`
            }
                <label class="ai-frames"><span>Pictures per video auto edit</span><input class="input" type="number" min="1" max="90" id="aiframes" value="${p.maxImages}"><small>Frames from your clips that ${esc(p.name)} looks at. More gives better edits but costs more; some services take only a few.</small></label></section>
            <section class="ad-card"><h2>This month</h2><div class="ad-tiles ai-use"><div class="ad-tile"><b>${n(s.usage.requests)}</b><span>auto edits and tests</span></div><div class="ad-tile"><b>${n(s.usage.input)}</b><span>tokens sent (frames, photos)</span></div><div class="ad-tile"><b>${n(s.usage.output)}</b><span>tokens answered</span></div></div><p class="ad-muted">Counted for every service together. The exact cost is on each service’s own site, under usage or billing.</p></section>`;
        const put = body => call('/api/admin/ai', { method: 'PUT', body: JSON.stringify({ provider: id, ...body }) });
        $$('[data-prov]', main).forEach(b =>
            b.addEventListener('click', () => {
                aiShown = b.dataset.prov;
                aiTab();
            })
        );
        const form = $('#aiform', main);
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const err = $('.form-error', form);
            err.classList.add('hidden');
            const body = {};
            if (form.baseUrl) body.baseUrl = form.baseUrl.value;
            if (form.apiKey && form.apiKey.value.trim()) body.apiKey = form.apiKey.value;
            if (!Object.keys(body).length) return (err.textContent = 'Paste the key first.'), err.classList.remove('hidden');
            try {
                const r = await put(body);
                toast(r.active === id ? `Saved. Auto editing uses ${p.name}.` : 'Saved.');
                aiTab();
            } catch (x) {
                err.textContent = x.message;
                err.classList.remove('hidden');
            }
        });
        $('[data-clear]', main)?.addEventListener('click', async () => {
            if (!(await ask({ title: `Remove the ${p.name} API key?`, text: id === s.active ? 'Auto editing switches off until you add a key again.' : 'You can add it again any time.', ok: 'Remove', danger: true }))) return;
            await call(`/api/admin/ai?provider=${encodeURIComponent(id)}`, { method: 'DELETE' });
            aiTab();
        });
        $('[data-test]', main)?.addEventListener('click', async e => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
                const r = await call('/api/admin/ai/test', { method: 'POST', body: JSON.stringify({ provider: id }) });
                toast(`It works: ${r.model} answered “${r.reply}”`);
            } catch (x) {
                toast(x.message, true);
            }
            b.disabled = false;
        });
        $('[data-activate]', main)?.addEventListener('click', async () => {
            try {
                await put({ active: true });
                toast(`Auto editing now uses ${p.name}`);
                aiTab();
            } catch (x) {
                toast(x.message, true);
            }
        });
        $$('[name=model]', main).forEach(r =>
            r.addEventListener('change', async () => {
                try {
                    await put({ model: r.value });
                    toast('Model saved');
                } catch (x) {
                    toast(x.message, true);
                }
            })
        );
        $('[data-load]', main)?.addEventListener('click', async e => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
                const r = await call(`/api/admin/ai/models?provider=${encodeURIComponent(id)}`);
                $('#aimodels', main).innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join('');
                $('#aimodelnote', main).textContent = r.models.length ? `${r.models.length} models found. Click the box to pick one, or type to search.` : 'The service listed no models. Type the name instead.';
                $('#aimodel', main).focus();
            } catch (x) {
                toast(x.message, true);
            }
            b.disabled = false;
        });
        $('[data-savemodel]', main)?.addEventListener('click', async () => {
            try {
                await put({ model: $('#aimodel', main).value.trim() });
                toast('Model saved');
                aiTab();
            } catch (x) {
                toast(x.message, true);
            }
        });
        $('#aiframes', main).addEventListener('change', async e => {
            try {
                await put({ maxImages: +e.target.value });
                toast('Saved');
            } catch (x) {
                toast(x.message, true);
            }
        });
    }

    /* ---------- activity: sign-ins and admin actions ---------- */
    async function activity() {
        let kind = '';
        main.innerHTML = `<h1>Activity</h1><p class="ad-sub">Every sign-in on EderveenGroup, and what admins changed.</p>
            <div class="seg ad-kind" id="ad-kind"><button data-k="" class="on">Everything</button><button data-k="signin">Sign-ins</button><button data-k="failed">Failed</button><button data-k="admin">Admin changes</button></div>
            <div class="ad-log" id="ad-log"><div class="pf-loading"><div class="spinner"></div></div></div>`;
        const METHOD = { password: 'password', 'trusted-device': 'password (trusted device)', '2fa': 'two-step code', totp: 'two-step code', recovery: 'recovery code', google: 'Google', microsoft: 'Microsoft', 'microsoft-work': 'Microsoft 365' };
        const REASON = { 'wrong-password': 'wrong password', 'wrong-code': 'wrong code', locked: 'too many tries', blocked: 'account blocked', 'no-imap': 'mailbox refused' };
        const draw = async () => {
            const list = await call(`/api/admin/activity${kind ? `?kind=${kind}` : ''}`);
            $('#ad-log', main).innerHTML = list.length
                ? list.map((e, i) => {
                      const when = new Date(e.t);
                      const time = `<time title="${esc(when.toLocaleString())}">${esc(ago(e.t))}</time>`;
                      if (e.kind === 'admin') return `<div class="ad-ev admin" style="animation-delay:${Math.min(i, 20) * 15}ms"><span class="ad-ev-ic">${ic('shield')}</span><div><b>${esc(e.text)}</b><small>by ${esc(e.by)}</small></div>${time}</div>`;
                      return `<div class="ad-ev ${e.ok ? 'ok' : 'bad'}" style="animation-delay:${Math.min(i, 20) * 15}ms"><span class="ad-ev-ic">${ic(e.ok ? 'check' : 'alert')}</span><div><b>${esc(e.email)}</b><small>${e.ok ? 'Signed in' : `Sign-in failed (${esc(REASON[e.reason] || e.reason || 'refused')})`} with ${esc(METHOD[e.method] || e.method || 'password')}${e.device ? ` · ${esc(e.device)}` : ''}${e.ip ? ` · ${esc(e.ip)}` : ''}</small></div>${time}</div>`;
                  }).join('')
                : `<div class="empty-note">${ic('sparkle')}<span>Nothing here yet.</span></div>`;
        };
        $('#ad-kind', main).addEventListener('click', e => {
            const b = e.target.closest('[data-k]');
            if (!b) return;
            kind = b.dataset.k;
            $$('#ad-kind button', main).forEach(x => x.classList.toggle('on', x === b));
            draw();
        });
        await draw();
    }

    /* ---------- news: posts on everyone's dashboard ---------- */
    async function news() {
        const list = await call('/api/admin/news');
        main.innerHTML = `<h1>News</h1><p class="ad-sub">Short posts everyone sees at the top of their dashboard.</p>
            <form class="ad-card ad-news-form" id="ad-news">
                <label class="pf-field"><span>Title</span><input class="input" name="title" maxlength="120" placeholder="The mail server is down for maintenance on Saturday"></label>
                <label class="pf-field"><span>Message</span><textarea class="input" name="body" rows="4" maxlength="2000" placeholder="A few more words, if needed"></textarea></label>
                <div class="si-acts"><label class="pf-field ad-days"><span>Show it for</span><select class="input" name="days"><option value="3">3 days</option><option value="7" selected>a week</option><option value="30">a month</option><option value="0">until I take it down</option></select></label><span class="spacer"></span><button class="btn btn-primary">${ic('send')}<span>Post</span></button></div>
            </form>
            <div class="ad-newslist">${list.length ? list.map(n => `<div class="ad-card ad-newsitem" data-id="${esc(n.id)}"><div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<small>${esc(n.by)} · ${esc(ago(n.at))}${n.until ? (n.until > Date.now() ? ` · shown until ${esc(new Date(n.until).toLocaleDateString())}` : ' · no longer shown') : ''}</small></div><button class="btn btn-danger" data-del>Take down</button></div>`).join('') : '<p class="ad-muted">Nothing posted yet.</p>'}</div>`;
        $('#ad-news', main).addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.target;
            try {
                await call('/api/admin/news', { method: 'POST', body: JSON.stringify({ title: f.title.value, body: f.body.value, days: Number(f.days.value) }) });
                toast('Posted. Everyone sees it on their dashboard.');
                news();
            } catch (err) {
                toast(err.message, true);
            }
        });
        $$('[data-del]', main).forEach(b =>
            b.addEventListener('click', async () => {
                if (!(await ask({ title: 'Take this post down?', text: 'It disappears from everyone’s dashboard.', ok: 'Take down', danger: true }))) return;
                await call(`/api/admin/news/${b.closest('[data-id]').dataset.id}`, { method: 'DELETE' });
                news();
            })
        );
    }

    /* ---------- apps: which apps everyone gets ---------- */
    const APP_NAMES = { photoedit: 'Photo Editor', videoedit: 'Video Editor', notes: 'Notes', tasks: 'Tasks', contacts: 'Contacts', calendar: 'Calendar', files: 'Files', photos: 'Photos', docs: 'Docs', slides: 'Slides', sheets: 'Spreadsheets', forms: 'Forms', chat: 'Chat', planner: 'Planner', whiteboard: 'Whiteboard' };
    async function apps() {
        const { pages, off } = await call('/api/admin/apps');
        main.innerHTML = `<h1>Apps</h1><p class="ad-sub">Switch apps off that you don’t use. They disappear from everyone’s dashboard; nobody’s data is deleted.</p>
            <section class="ad-card ad-apps">${pages.map(a => `<label class="ad-app"><img src="icons/apps/${a}.svg" alt=""><span><b>${esc(APP_NAMES[a] || a)}</b><small>${off.includes(a) ? 'Off' : 'On for everyone'}</small></span><input type="checkbox" class="ad-toggle" data-app="${a}" ${off.includes(a) ? '' : 'checked'}></label>`).join('')}
            <p class="ad-muted">Mail, Profile and Admin are always on.</p></section>`;
        $$('[data-app]', main).forEach(t =>
            t.addEventListener('change', async () => {
                const offNow = $$('[data-app]', main).filter(x => !x.checked).map(x => x.dataset.app);
                try {
                    await call('/api/admin/apps', { method: 'PUT', body: JSON.stringify({ off: offNow }) });
                    t.closest('.ad-app').querySelector('small').textContent = t.checked ? 'On for everyone' : 'Off';
                    toast(`${APP_NAMES[t.dataset.app]} is ${t.checked ? 'on' : 'off'}`);
                } catch (err) {
                    t.checked = !t.checked;
                    toast(err.message, true);
                }
            })
        );
    }

    /* ---------- address: #/, #/requests, #/people, #/access, #/signin, #/activity, #/news, #/apps ---------- */
    const TABS = { overview, requests, people, access, signin, activity, news, apps, ai: aiTab };
    let first = true;
    async function route() {
        const tab = TABS[location.hash.replace(/^#\/?/, '')] ? location.hash.replace(/^#\/?/, '') : 'overview';
        $$('#ad-nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
        // the page arrives with the overview already in it: keep showing that until the full one is ready
        const keep = first && tab === 'overview' && $('h1', main);
        first = false;
        const fresh = main.cloneNode(false);
        if (keep) [...main.childNodes].filter(n => !(n.classList && n.classList.contains('ad-stuck'))).forEach(n => fresh.append(n.cloneNode(true)));
        main.replaceWith(fresh);
        main = fresh;
        const mine = main;
        if (!keep) main.innerHTML = '<div class="pf-loading ad-loading"><div class="spinner"></div><span>Loading…</span></div>';
        // never a silent blank: after a while, say it's still waiting
        const slow = setTimeout(() => {
            if (main !== mine || !$('.ad-loading', mine)) return;
            mine.innerHTML = `<div class="pf-empty"><h1>Still loading…</h1><p>The server hasn’t answered yet. It may be busy, or something between your browser and EderveenGroup is holding the request.</p><button class="btn btn-primary" data-retry>Try again</button></div>`;
        }, 10000);
        try {
            await TABS[tab]();
        } catch (e) {
            if (main === mine) showError(e);
        } finally {
            clearTimeout(slow);
        }
        const h = $('h1', main);
        document.title = `${h ? h.textContent : 'Admin'} · Admin · EderveenGroup`;
    }
    function showError(e) {
        const message = (e && e.message) || String(e);
        main.innerHTML = `<div class="pf-empty ad-error"><h1>Couldn’t load this</h1><p>${esc(message)}</p><button class="btn btn-primary" data-retry>Try again</button></div>`;
        // and tell the server, so it shows up in its log too
        fetch('/api/admin/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-EG': '1' }, body: JSON.stringify({ message, where: location.hash || '#/' }) }).catch(() => {});
    }
    document.addEventListener('click', e => e.target.closest('[data-retry]') && route());
    // a mistake in this page shows up here instead of leaving it empty
    addEventListener('error', e => !main.textContent.trim() && showError(e.error || e.message));
    addEventListener('unhandledrejection', e => !main.textContent.trim() && showError(e.reason));
    addEventListener('hashchange', route);
    route();
})();
