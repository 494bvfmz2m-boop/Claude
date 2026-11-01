// Contacts: your address book, plus everyone on EderveenGroup with a public profile.
(function () {
    const { $, $$, esc, ic, call, toast, ask, id: newId, debounce, hue, initials } = window.EG;
    const root = $('#contacts');
    const MAIL = new URL(document.baseURI).pathname;
    let contacts = [];
    let people = [];
    let tab = 'mine';
    let open = null;
    let editing = false;
    let q = '';

    const nameOf = c => c.name || (c.emails && c.emails[0]) || 'No name';
    const av = (c, big) => `<span class="ct-av${big ? ' big' : ''}" style="--h:${hue(c.username || nameOf(c))}">${c.photoUrl ? `<img alt="" src="${esc(c.photoUrl)}">` : esc(initials(nameOf(c)))}</span>`;
    const composeLink = (email, name) => `${MAIL}inbox?compose=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}`;

    root.innerHTML = `<div class="ea-split contacts">
        <aside class="ea-list" aria-label="Contacts">
            <div class="ea-head"><h1>Contacts</h1><button class="btn btn-primary" id="new">${ic('plus')}<span>Add</span></button></div>
            <div class="seg ct-tabs" role="tablist"><button data-tab="mine" class="on">My contacts</button><button data-tab="people">EderveenGroup</button></div>
            <div class="ad-search">${ic('search')}<input class="input" id="q" placeholder="Search" aria-label="Search contacts"></div>
            <div id="list" class="ct-list"></div>
            <div class="ct-tools" id="tools"><button class="btn btn-ghost" id="import">${ic('mail')}<span>Add people I’ve emailed</span></button><button class="btn btn-ghost" id="export">${ic('download')}<span>Export (.vcf)</span></button></div>
        </aside>
        <section class="ea-detail" id="detail" aria-label="Contact"></section>
    </div>`;
    const list = $('#list');
    const detail = $('#detail');

    /* ---------- the list ---------- */
    function drawList() {
        $('#tools').hidden = tab !== 'mine';
        if (tab === 'people') return drawPeople();
        const shown = contacts
            .filter(c => !q || [c.name, c.company, ...(c.emails || []), c.phone, c.username].join(' ').toLowerCase().includes(q))
            .sort((a, b) => (b.favorite - a.favorite) || nameOf(a).localeCompare(nameOf(b)));
        let letter = null;
        list.innerHTML = shown.length
            ? shown.map(c => {
                  const l = c.favorite ? '★' : (nameOf(c)[0] || '#').toUpperCase();
                  const head = l !== letter ? `<h2 class="ea-sec">${l === '★' ? 'Favourites' : esc(l)}</h2>` : '';
                  letter = l;
                  return `${head}<button class="ct-row${open && open.id === c.id ? ' on' : ''}" data-id="${esc(c.id)}">${av(c)}<span><b>${esc(nameOf(c))}</b><small>${esc(c.company || (c.emails || [])[0] || c.phone || '')}</small></span></button>`;
              }).join('')
            : `<div class="ea-empty">${ic('book')}<p>${q ? 'Nobody matches that.' : 'No contacts yet. Add someone, or bring in the people you’ve emailed.'}</p></div>`;
    }

    const loadPeople = debounce(async () => {
        try {
            people = await call(`/api/directory?q=${encodeURIComponent(q)}`);
            if (tab === 'people') drawPeople();
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }, 250);
    function drawPeople() {
        list.innerHTML = people.length
            ? people.map(p => `<button class="ct-row${open && open.username === p.username && !open.id ? ' on' : ''}" data-user="${esc(p.username)}">${av({ ...p, photoUrl: p.photo ? `/api/profiles/${encodeURIComponent(p.username)}/photo?v=${p.photo}` : '' })}<span><b>${esc(p.name || '@' + p.username)}</b><small>@${esc(p.username)}${p.headline ? ` · ${esc(p.headline)}` : ''}</small></span></button>`).join('')
            : `<div class="ea-empty">${ic('user')}<p>${q ? 'Nobody on EderveenGroup matches that.' : 'Nobody has a public profile yet.'}</p></div>`;
    }

    /* ---------- one contact ---------- */
    function drawDetail() {
        document.body.classList.toggle('ea-open', !!open);
        if (!open) {
            detail.innerHTML = `<div class="ea-empty big">${ic('book')}<p>Pick someone to see their details.</p></div>`;
            return;
        }
        if (editing) return drawEditor();
        const c = open;
        const saved = !!c.id;
        const emails = c.emails || [];
        detail.innerHTML = `<div class="ct-card">
            <div class="nt-bar"><button class="btn btn-ghost ea-back" id="back">${ic('left')}<span>Contacts</span></button><span class="spacer"></span>
                ${saved ? `<button class="icon-btn${c.favorite ? ' active' : ''}" id="fav" aria-label="${c.favorite ? 'Remove from favourites' : 'Add to favourites'}">${ic('star')}</button><button class="btn" id="edit">${ic('pen')}<span>Edit</span></button>` : `<button class="btn btn-primary" id="save-person">${ic('plus')}<span>Add to my contacts</span></button>`}</div>
            <div class="ct-top">${av(c, true)}<h2>${esc(nameOf(c))}</h2>${c.headline || c.company ? `<p>${esc([c.headline, c.company].filter(Boolean).join(' · '))}</p>` : ''}${c.username ? `<a class="ct-user" href="/profile/#/${esc(c.username)}">@${esc(c.username)} ${ic('external')}</a>` : ''}</div>
            <div class="pf-actions">${emails[0] ? `<a class="pf-act" href="${esc(composeLink(emails[0], c.name))}">${ic('mail')}<span>Email</span></a>` : ''}${c.phone ? `<a class="pf-act" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${ic('call')}<span>Call</span></a>` : ''}${c.username ? `<a class="pf-act" href="/profile/#/${esc(c.username)}">${ic('user')}<span>Profile</span></a>` : ''}</div>
            <dl class="ct-fields">
                ${emails.map((e, i) => `<dt>${i ? 'Email' : 'Email'}</dt><dd><a href="${esc(composeLink(e, c.name))}">${esc(e)}</a></dd>`).join('')}
                ${c.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></dd>` : ''}
                ${c.company ? `<dt>Company</dt><dd>${esc(c.company)}</dd>` : ''}
                ${c.note ? `<dt>Note</dt><dd class="ct-note">${esc(c.note)}</dd>` : ''}
            </dl>
            ${saved ? `<button class="btn btn-ghost ct-delete" id="del">${ic('trash')}<span>Delete contact</span></button>` : ''}
        </div>`;
        $('#back').onclick = () => select(null);
        if (saved) {
            $('#edit').onclick = () => ((editing = true), drawDetail());
            $('#fav').onclick = async () => {
                c.favorite = !c.favorite;
                drawDetail();
                drawList();
                await save(c).catch(e => toast(e.message, { bad: true }));
            };
            $('#del').onclick = async () => {
                if (!(await ask({ title: `Delete ${nameOf(c)}?`, ok: 'Delete', danger: true }))) return;
                contacts = contacts.filter(x => x !== c);
                select(null);
                try {
                    await call(`/api/apps/contacts/${c.id}`, { method: 'DELETE' });
                    toast('Contact deleted', { action: 'Undo', onAction: async () => (contacts.push(c), await save(c), drawList()) });
                } catch (e) {
                    toast(e.message, { bad: true });
                }
            };
        } else {
            $('#save-person').onclick = async () => {
                const existing = contacts.find(x => x.username === c.username);
                if (existing) return (tab = 'mine', $$('.ct-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'mine')), select(existing));
                const fresh = { id: newId(), name: c.name, emails: c.email ? [c.email] : [], phone: c.phone || '', company: c.company || '', note: c.headline || '', username: c.username, favorite: false };
                try {
                    await save(fresh);
                    contacts.push(fresh);
                    toast(`${nameOf(fresh)} added to your contacts`);
                    tab = 'mine';
                    $$('.ct-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'mine'));
                    select(fresh);
                } catch (e) {
                    toast(e.message, { bad: true });
                }
            };
        }
    }

    function drawEditor() {
        const c = open;
        const f = (k, label, v, extra = '') => `<label class="pf-field"><span>${label}</span><input class="input" name="${k}" value="${esc(v || '')}" ${extra}></label>`;
        detail.innerHTML = `<form class="ct-card ct-form" id="form" novalidate>
            <div class="nt-bar"><button type="button" class="btn btn-ghost" id="cancel">Cancel</button><span class="spacer"></span><button class="btn btn-primary" type="submit">${ic('check')}<span>Save</span></button></div>
            <div class="form-error hidden" id="err" role="alert"></div>
            ${f('name', 'Name', c.name, 'maxlength="100" autocomplete="off"')}
            ${f('email0', 'Email', (c.emails || [])[0], 'type="email" maxlength="254"')}
            ${f('email1', 'Second email', (c.emails || [])[1], 'type="email" maxlength="254"')}
            ${f('phone', 'Phone', c.phone, 'type="tel" maxlength="40"')}
            ${f('company', 'Company', c.company, 'maxlength="100"')}
            ${f('username', 'EderveenGroup username', c.username, 'maxlength="30" placeholder="optional" autocapitalize="none" spellcheck="false"')}
            <label class="pf-field"><span>Note</span><textarea class="input" name="note" rows="4" maxlength="2000">${esc(c.note || '')}</textarea></label>
        </form>`;
        const form = $('#form');
        $('#cancel').onclick = () => {
            editing = false;
            if (!c.createdAt) select(null);
            else drawDetail();
        };
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(form));
            const next = { ...c, name: v.name.trim(), emails: [v.email0, v.email1].map(x => x.trim()).filter(Boolean), phone: v.phone.trim(), company: v.company.trim(), username: v.username.trim().replace(/^@/, ''), note: v.note };
            try {
                await save(next);
                Object.assign(c, next);
                if (!contacts.includes(c)) contacts.push(c);
                editing = false;
                drawList();
                drawDetail();
                toast('Saved');
            } catch (err) {
                $('#err').textContent = err.message;
                $('#err').classList.remove('hidden');
            }
        });
        form.name.focus();
    }

    async function save(c) {
        const s = await call(`/api/apps/contacts/${c.id}`, { method: 'PUT', body: { name: c.name, emails: c.emails, phone: c.phone, company: c.company, note: c.note, username: c.username, favorite: c.favorite } });
        Object.assign(c, s);
    }
    function select(c) {
        open = c;
        editing = false;
        drawList();
        drawDetail();
    }

    /* ---------- vCard export (all your contacts in one file) ---------- */
    function vcards() {
        const e = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
        return contacts.map(c => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${e(nameOf(c))}`, `N:${e(c.name)};;;;`, ...(c.emails || []).map(m => `EMAIL;TYPE=INTERNET:${e(m)}`), c.phone && `TEL:${e(c.phone)}`, c.company && `ORG:${e(c.company)}`, c.note && `NOTE:${e(c.note)}`, c.username && `URL:${location.origin}/profile/#/${c.username}`, 'END:VCARD'].filter(Boolean).join('\r\n')).join('\r\n') + '\r\n';
    }

    /* ---------- events ---------- */
    $('#new').onclick = () => {
        tab = 'mine';
        $$('.ct-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'mine'));
        open = { id: newId(), name: '', emails: [], phone: '', company: '', note: '', username: '', favorite: false };
        editing = true;
        drawList();
        drawDetail();
    };
    $('.ct-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (!b || b.dataset.tab === tab) return;
        tab = b.dataset.tab;
        $$('.ct-tabs button').forEach(x => x.classList.toggle('on', x === b));
        $('#q').placeholder = tab === 'people' ? 'Search people on EderveenGroup' : 'Search';
        if (tab === 'people') loadPeople();
        drawList();
    });
    list.addEventListener('click', e => {
        const r = e.target.closest('.ct-row');
        if (!r) return;
        if (r.dataset.id) return select(contacts.find(c => c.id === r.dataset.id));
        const p = people.find(x => x.username === r.dataset.user);
        const mine = contacts.find(c => c.username === p.username);
        select(mine || { ...p, emails: p.email ? [p.email] : [], photoUrl: p.photo ? `/api/profiles/${encodeURIComponent(p.username)}/photo?v=${p.photo}` : '' });
    });
    $('#q').addEventListener('input', e => {
        q = e.target.value.trim().toLowerCase();
        if (tab === 'people') loadPeople();
        else drawList();
    });
    $('#import').onclick = async () => {
        try {
            const r = await call('/api/apps/contacts/import', { method: 'POST', body: {} });
            contacts = (await call('/api/apps/contacts')).items;
            drawList();
            toast(r.added ? `Added ${r.added} ${r.added === 1 ? 'person' : 'people'} you’ve emailed` : r.known ? 'Everyone you’ve emailed is already here' : 'No one yet. People you read or send mail to show up here.');
        } catch (e) {
            toast(e.message, { bad: true });
        }
    };
    $('#export').onclick = () => {
        if (!contacts.length) return toast('No contacts to export yet');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([vcards()], { type: 'text/vcard' }));
        a.download = 'ederveengroup-contacts.vcf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    call('/api/apps/contacts')
        .then(r => {
            contacts = r.items;
            drawList();
            drawDetail();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your contacts</h1><p>${esc(e.message)}</p></div>`));
})();
