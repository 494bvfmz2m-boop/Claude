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
                <p>${e.status === 404 ? `Nobody is using <b>@${esc(username)}</b> yet, or their profile is private.` : esc(e.message)}</p></div>`;
            return;
        }
        document.title = `${v.name || '@' + v.username} · EderveenGroup`;
        main.innerHTML = card(v) + `<a class="pf-mark" href="/" aria-label="EderveenGroup"><span class="brand-mark">${window.brandMark()}</span><span>EderveenGroup</span></a>`;
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

    /* ---------- crop a photo to a circle: drag to move, slide to zoom ---------- */
    function cropPhoto(file) {
        return new Promise(resolve => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onerror = () => {
                URL.revokeObjectURL(url);
                flash('That file isn’t an image');
                resolve(null);
            };
            img.onload = () => {
                const SIZE = 260;
                const back = document.createElement('div');
                back.className = 'pf-crop-back';
                back.innerHTML = `<div class="pf-crop" role="dialog" aria-modal="true" aria-label="Crop photo"><h2>Position your photo</h2>
                    <div class="pf-crop-view"><canvas width="${SIZE * 2}" height="${SIZE * 2}"></canvas></div>
                    <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
                    <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>Use photo</button></div></div>`;
                document.body.append(back);
                const cv = $('canvas', back);
                const g = cv.getContext('2d');
                const base = Math.max((SIZE * 2) / img.width, (SIZE * 2) / img.height);
                let zoom = 1, x = 0, y = 0;
                const clamp = () => {
                    const w = img.width * base * zoom, h = img.height * base * zoom;
                    x = Math.min(0, Math.max(SIZE * 2 - w, x));
                    y = Math.min(0, Math.max(SIZE * 2 - h, y));
                };
                const draw = () => {
                    clamp();
                    g.clearRect(0, 0, cv.width, cv.height);
                    g.drawImage(img, x, y, img.width * base * zoom, img.height * base * zoom);
                };
                x = (SIZE * 2 - img.width * base) / 2;
                y = (SIZE * 2 - img.height * base) / 2;
                draw();
                let drag = null;
                cv.addEventListener('pointerdown', e => {
                    drag = { x: e.clientX, y: e.clientY, ox: x, oy: y };
                    cv.setPointerCapture(e.pointerId);
                });
                cv.addEventListener('pointermove', e => {
                    if (!drag) return;
                    const k = cv.width / cv.getBoundingClientRect().width;
                    x = drag.ox + (e.clientX - drag.x) * k;
                    y = drag.oy + (e.clientY - drag.y) * k;
                    draw();
                });
                cv.addEventListener('pointerup', () => (drag = null));
                $('input', back).addEventListener('input', e => {
                    // zoom around the middle
                    const c = SIZE, z = Number(e.target.value);
                    x = c - ((c - x) * z) / zoom;
                    y = c - ((c - y) * z) / zoom;
                    zoom = z;
                    draw();
                });
                const done = value => {
                    URL.revokeObjectURL(url);
                    back.classList.add('out');
                    setTimeout(() => back.remove(), 250);
                    resolve(value);
                };
                $('[data-x]', back).onclick = () => done(null);
                back.addEventListener('click', e => e.target === back && done(null));
                $('[data-ok]', back).onclick = () => {
                    const out = document.createElement('canvas');
                    out.width = out.height = 512;
                    out.getContext('2d').drawImage(cv, 0, 0, 512, 512);
                    done(out.toDataURL('image/jpeg', 0.88));
                };
            };
            img.src = url;
        });
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
                    <div class="pf-photo"><span class="pf-photo-av" id="pf-photo-av"></span>
                        <div class="pf-photo-body"><b>Photo on your card</b>
                            <div class="seg pf-photo-seg" id="pf-photo-mode">
                                <button type="button" data-v="card">Own photo</button><button type="button" data-v="account">Mail photo</button><button type="button" data-v="none">None</button></div>
                            <div class="pf-photo-acts"><label class="btn"><input type="file" accept="image/png,image/jpeg,image/webp" id="pf-photo-file" hidden>${ic('image')}<span>Upload a photo</span></label><button type="button" class="btn btn-ghost hidden" id="pf-photo-remove">Remove</button></div>
                            <small id="pf-photo-hint"></small></div></div>
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
        const accountPhoto = data.photo ? `${MAIL}api/avatar?email=${encodeURIComponent(data.account)}&v=${data.photo}` : '';
        let cardPhoto = data.cardPhoto ? `/api/profile/photo?v=${data.cardPhoto}` : '';
        let photoMode = p.photoMode || 'account';
        const photoUrl = () => (photoMode === 'card' ? cardPhoto : photoMode === 'account' ? accountPhoto : '');
        function drawPhoto() {
            const url = photoUrl();
            $('#pf-photo-av').innerHTML = url ? `<img alt="" src="${esc(url)}">` : esc(initials(form.name.value || data.username));
            $$('#pf-photo-mode button').forEach(b => {
                b.classList.toggle('on', b.dataset.v === photoMode);
                b.disabled = b.dataset.v === 'card' && !cardPhoto;
            });
            $('#pf-photo-remove').classList.toggle('hidden', !cardPhoto);
            $('#pf-photo-hint').innerHTML =
                photoMode === 'card' ? 'Only on your card. Your mail photo stays as it is.'
                : photoMode === 'account' ? (accountPhoto ? `The same photo as in Mail. <a href="${MAIL}settings/profile">Change it there</a>` : `You haven’t set a mail photo. <a href="${MAIL}settings/profile">Add one</a> or upload one just for your card.`)
                : 'Your card shows your initials.';
        }
        $('#pf-photo-mode').addEventListener('click', e => {
            const b = e.target.closest('button[data-v]');
            if (!b || b.disabled) return;
            photoMode = b.dataset.v;
            drawPhoto();
            live();
        });
        $('#pf-photo-file').addEventListener('change', async e => {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            const dataUrl = await cropPhoto(file);
            if (!dataUrl) return;
            try {
                const r = await call('/api/profile/photo', { method: 'PUT', body: JSON.stringify({ dataUrl }) });
                cardPhoto = `/api/profile/photo?v=${r.cardPhoto}`;
                photoMode = 'card';
                data.cardPhoto = r.cardPhoto;
                drawPhoto();
                live();
                flash('Photo saved');
            } catch (err) {
                flash(err.message);
            }
        });
        $('#pf-photo-remove').addEventListener('click', async () => {
            try {
                await call('/api/profile/photo', { method: 'DELETE' });
                cardPhoto = '';
                data.cardPhoto = null;
                if (photoMode === 'card') photoMode = 'account';
                drawPhoto();
                live();
            } catch (err) {
                flash(err.message);
            }
        });
        const read = () => {
            const f = Object.fromEntries(new FormData(form));
            return {
                username: String(f.username || '').trim().toLowerCase().replace(/^@/, ''),
                name: f.name, headline: f.headline, company: f.company, location: f.location, bio: f.bio,
                email: f.email, showEmail: !!form.showEmail.checked, phone: f.phone, website: f.website,
                visible: !!form.visible.checked,
                photoMode,
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
            $('#pf-live').innerHTML = card({ ...v, email: v.showEmail ? v.email : '', website: site, links, photoUrl: photoUrl() }, { preview: true });
            $('#bio-count').textContent = `${(v.bio || '').length}/500`;
        };
        form.addEventListener('input', live);
        drawPhoto();
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
        const editing = !h || h === 'edit';
        // a public card stands on its own: no app navigation around it
        document.body.classList.toggle('pf-public', !editing);
        nav.innerHTML = editing ? `<a class="btn btn-ghost" href="/">${ic('left')}<span>Apps</span></a>` : '';
        main.classList.remove('enter');
        void main.offsetWidth;
        main.classList.add('enter');
        if (!h || h === 'edit') return showEditor();
        showCard(h);
    }
    addEventListener('hashchange', route);
    route();
})();
