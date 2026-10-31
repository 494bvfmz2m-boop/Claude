// Profile: everyone's contact card at /profile/#/username, and your own editor at /profile/#/edit.
(function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ic = name => window.icon(name);
    const main = $('#pf');
    const nav = $('#pf-nav');
    const MAIL = new URL(document.baseURI).pathname; // the mail app (photos live there)

    const call = async (url, opts = {}) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
        return data;
    };
    const LINKS = [
        ['linkedin', 'LinkedIn'],
        ['x', 'X'],
        ['instagram', 'Instagram'],
        ['github', 'GitHub'],
        ['tiktok', 'TikTok'],
        ['youtube', 'YouTube']
    ];
    const initials = s => (String(s || '?').replace(/[^\p{L} ]/gu, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
    const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

    let me = null; // your own profile, when signed in
    const loadMe = () => (me ? Promise.resolve(me) : call('/api/profile').then(r => (me = r)));

    /* ---------- the card ---------- */
    function card(v, { preview = false } = {}) {
        const name = v.name || v.username || 'Your name';
        const photo = v.photoUrl || (v.photo ? `/api/profiles/${encodeURIComponent(v.username)}/photo?v=${v.photo}` : '');
        const role = [v.headline, v.company].filter(Boolean).join(' · ');
        const site = v.website ? new URL(v.website).hostname.replace(/^www\./, '') : '';
        const acts = [
            v.email && `<a class="pf-act" href="mailto:${esc(v.email)}">${ic('mail')}<span>Email</span></a>`,
            v.phone && `<a class="pf-act" href="tel:${esc(v.phone.replace(/[^\d+]/g, ''))}">${ic('call')}<span>Call</span></a>`,
            v.website && `<a class="pf-act" href="${esc(v.website)}" target="_blank" rel="noopener noreferrer">${ic('globe')}<span>Website</span></a>`
        ].filter(Boolean);
        const links = LINKS.filter(([k]) => v.links && v.links[k]).map(([k, label]) => `<a class="pf-link" href="${esc(v.links[k])}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${ic(k)}</a>`);
        return `<article class="pf-card${preview ? ' preview' : ''}" style="--h:${hue(v.username || name)}">
            <div class="pf-cover" aria-hidden="true"><span></span><span></span></div>
            <div class="pf-avatar">${photo ? `<img alt="" src="${esc(photo)}">` : `<span>${esc(initials(name))}</span>`}</div>
            <h1 class="pf-name">${esc(name)}</h1>
            ${v.username ? `<p class="pf-handle">@${esc(v.username)}</p>` : ''}
            ${role ? `<p class="pf-role">${ic('briefcase')}${esc(role)}</p>` : ''}
            ${v.location ? `<p class="pf-loc">${ic('pin')}${esc(v.location)}</p>` : ''}
            ${v.bio ? `<p class="pf-bio">${esc(v.bio)}</p>` : ''}
            ${acts.length ? `<div class="pf-actions">${acts.join('')}</div>` : ''}
            ${links.length ? `<div class="pf-links">${links.join('')}</div>` : ''}
            ${preview ? '' : `<div class="pf-cta">
                <a class="btn btn-primary" href="/api/profiles/${encodeURIComponent(v.username)}/vcard">${ic('contact')}<span>Save contact</span></a>
                <button class="btn" data-share>${ic('share')}<span>Share</span></button>
                <button class="btn pf-qr-btn" data-qr aria-label="Show QR code" title="QR code">${ic('qr')}</button>
            </div>
            <div class="pf-qr" hidden><img alt="QR code for this profile" src="/api/profiles/${encodeURIComponent(v.username)}/qr.svg"><small>Scan to open this profile</small></div>`}
        </article>`;
    }

    /* ---------- someone's public card ---------- */
    async function showCard(username) {
        main.innerHTML = '<div class="pf-loading"><div class="spinner"></div></div>';
        let v;
        try {
            v = await call(`/api/profiles/${encodeURIComponent(username)}`);
        } catch (e) {
            document.title = 'Profile · EderveenGroup';
            main.innerHTML = `<div class="pf-empty"><div class="pf-empty-icon">${ic('user')}</div><h1>${e.status === 404 ? 'No profile here' : 'Couldn’t load this profile'}</h1>
                <p>${e.status === 404 ? `Nobody is using <b>@${esc(username)}</b> yet, or their profile is private.` : esc(e.message)}</p><a class="btn btn-primary" href="/profile/#/edit"><span>Make your own profile</span></a></div>`;
            return;
        }
        document.title = `${v.name || '@' + v.username} · EderveenGroup`;
        main.innerHTML = card(v) + '<p class="pf-foot">An EderveenGroup profile · <a href="/profile/#/edit">Make your own</a></p>';
        const mineP = loadMe().then(m => m.username === v.username).catch(() => false);
        // (links are absolute: the page's <base> points at the mail app)
        mineP.then(mine => mine && $('.pf-cta', main).insertAdjacentHTML('beforeend', `<a class="btn" href="/profile/#/edit">${ic('pen')}<span>Edit</span></a>`));
        $('[data-share]', main).onclick = async () => {
            try {
                if (navigator.share) return await navigator.share({ title: v.name || v.username, url: v.url });
                await navigator.clipboard.writeText(v.url);
                flash('Link copied');
            } catch {
                // share sheet closed
            }
        };
        $('[data-qr]', main).onclick = () => {
            const q = $('.pf-qr', main);
            q.hidden = !q.hidden;
            if (!q.hidden) q.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
    }

    function flash(text) {
        const t = document.createElement('div');
        t.className = 'pf-toast';
        t.textContent = text;
        document.body.append(t);
        setTimeout(() => t.classList.add('out'), 1800);
        setTimeout(() => t.remove(), 2300);
    }

    /* ---------- your editor ---------- */
    async function showEditor() {
        main.innerHTML = '<div class="pf-loading"><div class="spinner"></div></div>';
        let data;
        try {
            data = await loadMe();
        } catch (e) {
            if (e.status === 401) return location.replace(`/login?next=${encodeURIComponent('/profile/')}`);
            main.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your profile</h1><p>${esc(e.message)}</p></div>`;
            return;
        }
        if (!data.username) return location.replace(`/welcome?next=${encodeURIComponent('/profile/')}`);
        document.title = 'Your profile · EderveenGroup';
        const p = data.profile;
        const field = (key, label, extra = '') => `<label class="pf-field"><span>${label}</span><input class="input" name="${key}" value="${esc(p[key] || '')}" ${extra}></label>`;
        main.innerHTML = `<div class="pf-editor">
            <form class="pf-form" id="pf-form" novalidate>
                <h1>Your profile</h1>
                <p class="pf-intro">${data.created && p.visible !== false ? 'Live' : 'Not shared yet'} at <a id="pf-url" href="/profile/#/${esc(data.username)}">${esc(location.host)}/profile/#/<b>${esc(data.username)}</b></a></p>
                <div class="form-error hidden" id="pf-err" role="alert"></div>
                <section class="pf-group"><h2>About you</h2>
                    <label class="pf-field"><span>Username</span><div class="uname"><i>@</i><input class="input" name="username" value="${esc(data.username)}" maxlength="30" spellcheck="false" autocapitalize="none"><b class="uname-state" aria-hidden="true"></b></div><small class="pf-note" id="uname-note"></small></label>
                    ${field('name', 'Name', 'maxlength="80" autocomplete="name"')}
                    ${field('headline', 'What you do', 'maxlength="100" placeholder="Product designer"')}
                    ${field('company', 'Company', 'maxlength="100" autocomplete="organization"')}
                    ${field('location', 'Location', 'maxlength="100" placeholder="Amsterdam, NL"')}
                    <label class="pf-field"><span>Bio <i class="pf-count" id="bio-count"></i></span><textarea class="input" name="bio" rows="3" maxlength="500" placeholder="A line or two about you">${esc(p.bio || '')}</textarea></label>
                    <div class="pf-photo"><span class="pf-photo-av">${data.photo ? `<img alt="" src="${MAIL}api/avatar?email=${encodeURIComponent(data.account)}&v=${data.photo}">` : esc(initials(p.name || data.username))}</span><div><b>Photo</b><small>Your EderveenGroup photo. <a href="${MAIL}settings/profile">Change it</a></small></div></div>
                </section>
                <section class="pf-group"><h2>How to reach you</h2>
                    ${field('email', 'Email', 'type="email" maxlength="254" autocomplete="email"')}
                    <label class="pf-switch"><span>Show my email on my profile</span><span class="switch"><input type="checkbox" name="showEmail" ${p.showEmail !== false ? 'checked' : ''}><span></span></span></label>
                    ${field('phone', 'Phone', 'type="tel" maxlength="40" autocomplete="tel" placeholder="+31 6 12345678"')}
                    ${field('website', 'Website', 'type="url" maxlength="300" placeholder="yoursite.com"')}
                </section>
                <section class="pf-group"><h2>Links</h2>
                    ${LINKS.map(([k, label]) => `<label class="pf-field pf-social"><span>${ic(k)}${label}</span><input class="input" name="link-${k}" value="${esc((p.links || {})[k] || '')}" placeholder="@handle or link" maxlength="300" spellcheck="false" autocapitalize="none"></label>`).join('')}
                </section>
                <section class="pf-group"><h2>Who can see it</h2>
                    <label class="pf-switch"><span>Public profile<small>Anyone with the link can see your card and save your contact details.</small></span><span class="switch"><input type="checkbox" name="visible" ${p.visible !== false ? 'checked' : ''}><span></span></span></label>
                </section>
                <div class="pf-save"><button class="btn btn-primary" type="submit"><span>Save profile</span></button><a class="btn" href="/profile/#/${esc(data.username)}"><span>View my card</span></a></div>
            </form>
            <aside class="pf-preview" aria-label="Preview"><p class="pf-preview-label">Preview</p><div id="pf-live"></div></aside>
        </div>`;
        const form = $('#pf-form');
        const read = () => {
            const f = Object.fromEntries(new FormData(form));
            return {
                username: String(f.username || '').trim().toLowerCase().replace(/^@/, ''),
                name: f.name, headline: f.headline, company: f.company, location: f.location, bio: f.bio,
                email: f.email, showEmail: !!form.showEmail.checked, phone: f.phone, website: f.website,
                visible: !!form.visible.checked,
                links: Object.fromEntries(LINKS.map(([k]) => [k, f[`link-${k}`]]).filter(([, x]) => x))
            };
        };
        const live = () => {
            const v = read();
            let site = '';
            try {
                site = v.website ? new URL(/^https?:/i.test(v.website) ? v.website : `https://${v.website}`).href : '';
            } catch {
                site = '';
            }
            const links = Object.fromEntries(Object.entries(v.links).map(([k, x]) => [k, /^https?:/i.test(x) ? x : 'https://example.com']));
            $('#pf-live').innerHTML = card({ ...v, email: v.showEmail ? v.email : '', website: site, links, photoUrl: data.photo ? `${MAIL}api/avatar?email=${encodeURIComponent(data.account)}&v=${data.photo}` : '' }, { preview: true });
            $('#bio-count').textContent = `${(v.bio || '').length}/500`;
        };
        form.addEventListener('input', live);
        live();

        // username: same checks as the welcome step
        const uInput = form.username;
        const uBox = uInput.closest('.uname');
        const note = $('#uname-note');
        let seq = 0;
        let okName = true;
        uInput.addEventListener('input', () => {
            const name = uInput.value.trim().toLowerCase().replace(/^@/, '');
            const mine = ++seq;
            if (name === data.username) {
                uBox.dataset.state = '';
                note.textContent = '';
                okName = true;
                return;
            }
            uBox.dataset.state = 'checking';
            okName = false;
            setTimeout(async () => {
                if (mine !== seq) return;
                try {
                    const r = await call(`/api/username/check?u=${encodeURIComponent(name)}`);
                    if (mine !== seq) return;
                    okName = r.available;
                    uBox.dataset.state = r.available ? 'ok' : 'bad';
                    note.textContent = r.available ? `Available. Your old link stops working when you save.` : `${r.reason}${r.suggestions && r.suggestions.length ? `. Free: ${r.suggestions.map(s => '@' + s).join(', ')}` : ''}`;
                } catch (e) {
                    uBox.dataset.state = 'bad';
                    note.textContent = e.message;
                }
            }, 280);
        });

        form.addEventListener('submit', async e => {
            e.preventDefault();
            const err = $('#pf-err');
            err.classList.add('hidden');
            const v = read();
            const btn = $('button[type=submit]', form);
            if (!okName) {
                err.textContent = 'Pick a username that’s available first';
                err.classList.remove('hidden');
                return uInput.focus();
            }
            btn.disabled = true;
            btn.classList.add('busy');
            try {
                if (v.username !== data.username) {
                    await call('/api/username', { method: 'POST', body: JSON.stringify({ username: v.username }) });
                    data.username = v.username;
                }
                const saved = await call('/api/profile', { method: 'PUT', body: JSON.stringify(v) });
                me = { ...data, profile: saved.profile, created: true };
                btn.querySelector('span').textContent = 'Saved';
                btn.classList.add('saved');
                $('#pf-url').innerHTML = `${esc(location.host)}/profile/#/<b>${esc(data.username)}</b>`;
                $('#pf-url').setAttribute('href', `/profile/#/${data.username}`);
                $('.pf-save a', form).setAttribute('href', `/profile/#/${data.username}`); // follows a rename
                $('.pf-intro').firstChild.textContent = v.visible ? 'Live at ' : 'Private. Saved for ';
                flash(v.visible ? 'Profile saved and live' : 'Saved (private)');
                setTimeout(() => {
                    btn.querySelector('span').textContent = 'Save profile';
                    btn.classList.remove('saved');
                }, 1800);
            } catch (e2) {
                err.textContent = e2.message;
                err.classList.remove('hidden');
                err.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } finally {
                btn.disabled = false;
                btn.classList.remove('busy');
            }
        });
    }

    /* ---------- address: #/edit (or nothing) is your editor, #/name is someone's card ---------- */
    function route() {
        const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).trim().toLowerCase().replace(/^@/, '');
        nav.innerHTML = `<a class="btn btn-ghost" href="/">${ic('left')}<span>Apps</span></a>${h && h !== 'edit' ? `<a class="btn btn-ghost" href="/profile/#/edit">${ic('user')}<span>My profile</span></a>` : ''}`;
        main.classList.remove('enter');
        void main.offsetWidth;
        main.classList.add('enter');
        if (!h || h === 'edit') return showEditor();
        showCard(h);
    }
    addEventListener('hashchange', route);
    route();
})();
