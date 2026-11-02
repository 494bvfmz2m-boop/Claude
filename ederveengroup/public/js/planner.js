// Planner: boards with columns and cards, like Microsoft Planner or Trello. Drag cards between
// columns; open one for its labels, due date, checklist, who's on it and notes. Share a board
// to plan together.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, hue, initials, phone, typing: textBox, undoKey, undoable } = window.EG;
    const root = $('#planner');
    const LABELS = [['green', '#2fb36a'], ['yellow', '#e8b500'], ['orange', '#f08a24'], ['red', '#e5484d'], ['purple', '#9b5de5'], ['blue', '#3b82f6']];
    const COLOR = Object.fromEntries(LABELS);
    const BGS = { aurora: 'Aurora', ocean: 'Ocean', sunset: 'Sunset', forest: 'Forest', berry: 'Berry', slate: 'Slate', plain: 'Plain' };
    const TEMPLATES = {
        blank: { name: 'Blank board', title: '', cols: ['To do', 'Doing', 'Done'] },
        project: { name: 'Project', title: 'Project plan', cols: ['Ideas', 'To do', 'In progress', 'Waiting', 'Done'] },
        week: { name: 'Week planner', title: 'This week', cols: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'] },
        trip: { name: 'Trip', title: 'Our trip', cols: ['To book', 'To pack', 'To do there', 'Done'] }
    };
    const uid = () => Math.random().toString(36).slice(2, 10);
    let list = [];
    let open = null; // { id, title, body: { bg, labels, cols }, … }
    let me = '';
    let myName = '';
    let people = [];
    let filter = '';
    let onlyMine = false;
    let dirty = false;
    const today = () => new Date().toISOString().slice(0, 10);
    const personOf = email => people.find(p => p.email === email) || { email, name: email === me ? myName || 'You' : email.split('@')[0], username: '' };
    const av = (email, cls = '') => {
        const p = personOf(email);
        return `<span class="pl-av ${cls}" style="--h:${hue(email)}" title="${esc(p.name || p.username || email)}">${esc(initials(p.name || p.username || email))}</span>`;
    };
    const dueBadge = c => {
        if (!c.due) return '';
        const d = new Date(`${c.due}T12:00:00`);
        const label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        const cls = c.done ? 'done' : c.due < today() ? 'late' : c.due === today() ? 'today' : c.due <= new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) ? 'soon' : '';
        return `<span class="pl-due ${cls}" title="Due ${esc(d.toLocaleDateString())}">${ic(c.done ? 'check' : 'clock')}${esc(label)}</span>`;
    };

    /* ---------- the start screen ---------- */
    function gallery() {
        open = null;
        document.body.classList.remove('pl-office');
        const mine = list.filter(d => d.mine);
        const shared = list.filter(d => !d.mine);
        const card = d => `<button class="pl-card bg-${esc((d.cover || 'aurora').split('|')[0])}" data-id="${esc(d.id)}"><span class="pl-thumb"><i></i><i></i><i></i></span><b>${d.share !== 'private' ? ic('globe') : ''}${esc(d.title || 'Untitled board')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Planner</h1></div>
            <div class="pl-new">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="pl-card bg-${k === 'blank' ? 'plain' : k === 'project' ? 'aurora' : k === 'week' ? 'ocean' : 'sunset'}" data-new="${k}"><span class="pl-thumb">${k === 'blank' ? ic('plus') : t.cols.slice(0, 4).map(() => '<i></i>').join('')}</span><b>${t.name}</b><small>${esc(t.cols.join(' · '))}</small></button>`).join('')}</div>
            ${mine.length ? `<h2 class="ea-sec">My boards</h2><div class="pl-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with me</h2><div class="pl-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : '<p class="cp-muted dw-hint">Plan a project, a move or a holiday on a board: a card for every job, moved along as it gets done. Share a board and plan it together.</p>'}
        </div>`;
        history.replaceState(null, '', location.pathname);
    }
    async function create(kind) {
        const t = TEMPLATES[kind] || TEMPLATES.blank;
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'board', title: t.title, body: { bg: kind === 'blank' ? 'aurora' : kind === 'week' ? 'ocean' : kind === 'trip' ? 'sunset' : 'aurora', cols: t.cols.map(name => ({ id: uid(), name, cards: [] })) } } });
        list.unshift(d);
        await select(d.id);
        if (!t.title) setTimeout(() => $('#name')?.focus(), 50);
    }
    async function select(id) {
        if (dirty) await saveNow();
        try {
            open = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        history.replaceState(null, '', `${location.pathname}#${id}`);
        hist.reset();
        board();
    }

    /* ---------- a board ---------- */
    function board() {
        document.body.classList.add('pl-office');
        const ro = !open.canEdit;
        root.innerHTML = `<div class="pl bg-${esc(open.body.bg)}">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All boards" aria-label="All boards">${ic('left')}</button>
                <span class="of-app pl-app">${ic('grid')}</span>
                <input class="of-name" id="name" value="${esc(open.title)}" placeholder="Untitled board" ${ro ? 'readonly' : ''} aria-label="Board name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                <label class="pl-filter">${ic('search')}<input id="filter" placeholder="Filter cards" value="${esc(filter)}" aria-label="Filter cards"></label>
                <button class="btn pl-mine${onlyMine ? ' on' : ''}" id="mine" title="Only cards I’m on">${ic('user')}<span>Mine</span></button>
                ${open.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can see it</option><option value="edit">Everyone can edit it</option></select>' : ''}
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            ${ro ? `<div class="of-ro">${ic('eye')} Read only · by ${esc(open.ownerName)}.</div>` : ''}
            <div class="pl-cols" id="cols"></div>
        </div>`;
        if ($('#share')) $('#share').value = open.share;
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            list = await call('/api/docs?kind=board');
            gallery();
        };
        $('#name').addEventListener('input', () => {
            open.title = $('#name').value;
            changed();
        });
        $('#filter').oninput = e => {
            filter = e.target.value.trim().toLowerCase();
            drawCols();
        };
        $('#mine').onclick = () => {
            onlyMine = !onlyMine;
            $('#mine').classList.toggle('on', onlyMine);
            drawCols();
        };
        $('#more').onclick = e => moreMenu(e.currentTarget);
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${open.id}`, { method: 'PATCH', body: { share: e.target.value } });
            open.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone on EderveenGroup can see and edit it' : 'Everyone on EderveenGroup can see it');
        });
        drawCols();
    }
    function cardHtml(c) {
        const checks = c.check.length ? `<span class="pl-badge${c.check.every(i => i.done) ? ' ok' : ''}">${ic('check')}${c.check.filter(i => i.done).length}/${c.check.length}</span>` : '';
        return `<div class="pl-cardx${c.done ? ' is-done' : ''}" data-card="${esc(c.id)}" tabindex="0">
            ${c.labels.length ? `<div class="pl-labels">${c.labels.map(l => `<i style="background:${COLOR[l]}" title="${esc(open.body.labels[l] || l)}"></i>`).join('')}</div>` : ''}
            <div class="pl-ctitle">${c.done ? `<span class="pl-tick">${ic('check')}</span>` : ''}${esc(c.title)}</div>
            ${c.due || checks || c.desc || c.who.length ? `<div class="pl-cfoot">${dueBadge(c)}${checks}${c.desc ? `<span class="pl-badge" title="Has notes">${ic('note')}</span>` : ''}<span class="spacer"></span>${c.who.slice(0, 3).map(e => av(e, 'sm')).join('')}</div>` : ''}
        </div>`;
    }
    const visible = c => (!filter || `${c.title} ${c.desc} ${c.labels.map(l => open.body.labels[l] || l).join(' ')}`.toLowerCase().includes(filter)) && (!onlyMine || c.who.includes(me));
    function drawCols() {
        const ro = !open.canEdit;
        const el = $('#cols');
        const x = el.scrollLeft;
        el.innerHTML =
            open.body.cols
                .map(col => {
                    const cards = col.cards.filter(visible);
                    return `<section class="pl-col" data-col="${esc(col.id)}">
                <header class="pl-chead"><input class="pl-cname" value="${esc(col.name)}" maxlength="80" ${ro ? 'readonly' : ''} aria-label="Column name"><span class="pl-count">${col.cards.length}</span>${ro ? '' : `<button class="icon-btn" data-colmenu aria-label="Column menu">${ic('more')}</button>`}</header>
                <div class="pl-list" data-list="${esc(col.id)}">${cards.map(cardHtml).join('')}</div>
                ${ro ? '' : `<div class="pl-add" data-addto="${esc(col.id)}"><button class="pl-addbtn">${ic('plus')}<span>Add a card</span></button></div>`}
            </section>`;
                })
                .join('') + (ro ? '' : `<button class="pl-newcol" id="newcol">${ic('plus')}<span>Add a column</span></button>`);
        el.scrollLeft = x;
    }

    /* ---------- editing on the board ---------- */
    const colOf = id => open.body.cols.find(c => c.id === id);
    const findCard = id => {
        for (const col of open.body.cols) {
            const i = col.cards.findIndex(c => c.id === id);
            if (i >= 0) return { col, i, card: col.cards[i] };
        }
        return null;
    };
    root.addEventListener('click', e => {
        if (!open) {
            const c = e.target.closest('.pl-card');
            if (c && c.dataset.new) create(c.dataset.new);
            else if (c) select(c.dataset.id);
            return;
        }
        if (justDragged) return;
        const card = e.target.closest('[data-card]');
        if (card) return cardDialog(card.dataset.card);
        if (!open.canEdit) return;
        const addbtn = e.target.closest('.pl-addbtn');
        if (addbtn) return addCardBox(addbtn.closest('[data-addto]'));
        if (e.target.closest('#newcol')) {
            open.body.cols.push({ id: uid(), name: 'New column', cards: [] });
            changed();
            drawCols();
            const inputs = $$('.pl-cname');
            inputs[inputs.length - 1].select();
            $('#cols').scrollLeft = $('#cols').scrollWidth;
            return;
        }
        const cm = e.target.closest('[data-colmenu]');
        if (cm) return colMenu(cm, colOf(cm.closest('[data-col]').dataset.col));
    });
    root.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('[data-card]')) cardDialog(e.target.dataset.card);
        if (e.key === 'Enter' && e.target.matches('.pl-cname')) e.target.blur();
    });
    root.addEventListener('change', e => {
        if (!e.target.matches('.pl-cname')) return;
        const col = colOf(e.target.closest('[data-col]').dataset.col);
        col.name = e.target.value.trim() || 'Untitled';
        changed();
    });
    function addCardBox(box) {
        box.innerHTML = '<textarea class="pl-newcard" rows="2" placeholder="What needs doing? (Enter adds it)" maxlength="300"></textarea><div class="pl-addacts"><button class="btn btn-primary" data-ok>Add card</button><button class="icon-btn" data-x aria-label="Cancel">' + ic('x') + '</button></div>';
        const t = $('textarea', box);
        t.focus();
        const col = colOf(box.dataset.addto);
        const add = () => {
            const title = t.value.trim();
            if (!title) return;
            col.cards.push({ id: uid(), title, desc: '', due: '', labels: [], check: [], who: [], done: false, created: Date.now() });
            changed();
            t.value = '';
            const listEl = $(`[data-list="${col.id}"]`);
            listEl.insertAdjacentHTML('beforeend', cardHtml(col.cards[col.cards.length - 1]));
            $(`[data-col="${col.id}"] .pl-count`).textContent = col.cards.length;
            listEl.scrollTop = listEl.scrollHeight;
        };
        const close = () => (box.innerHTML = `<button class="pl-addbtn">${ic('plus')}<span>Add a card</span></button>`);
        t.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), add());
            if (e.key === 'Escape') close();
        });
        t.addEventListener('blur', () => setTimeout(() => !box.contains(document.activeElement) && !t.value.trim() && close(), 150));
        $('[data-ok]', box).onmousedown = e => (e.preventDefault(), add());
        $('[data-x]', box).onclick = close;
    }
    function colMenu(anchor, col) {
        const i = open.body.cols.indexOf(col);
        menu(anchor, [
            ['plus', 'Add a card', () => addCardBox($(`[data-addto="${col.id}"]`))],
            ['left', 'Move left', () => (i > 0 && (open.body.cols.splice(i, 1), open.body.cols.splice(i - 1, 0, col), changed(), drawCols()))],
            ['right', 'Move right', () => (i < open.body.cols.length - 1 && (open.body.cols.splice(i, 1), open.body.cols.splice(i + 1, 0, col), changed(), drawCols()))],
            ['check', 'Mark all cards done', () => (col.cards.forEach(c => (c.done = true)), changed(), drawCols())],
            ['trash', 'Delete column', async () => {
                if (col.cards.length && !(await ask({ title: `Delete “${col.name}”?`, text: `Its ${col.cards.length} card${col.cards.length === 1 ? '' : 's'} go too.`, ok: 'Delete', danger: true }))) return;
                open.body.cols.splice(i, 1);
                changed();
                drawCols();
            }, true]
        ]);
    }

    /* ---------- dragging cards (mouse, pen, or a long press on a phone) ---------- */
    let drag = null;
    let justDragged = false;
    root.addEventListener('pointerdown', e => {
        const el = e.target.closest('[data-card]');
        if (!el || !open || !open.canEdit || e.button) return;
        drag = { el, id: el.dataset.card, sx: e.clientX, sy: e.clientY, on: false, touch: e.pointerType === 'touch', pid: e.pointerId };
        if (drag.touch) drag.timer = setTimeout(() => drag && start(e.clientX, e.clientY), 380);
    });
    function start(x, y) {
        const r = drag.el.getBoundingClientRect();
        drag.on = true;
        drag.dx = x - r.left;
        drag.dy = y - r.top;
        drag.ghost = drag.el.cloneNode(true);
        drag.ghost.classList.add('pl-ghost');
        drag.ghost.style.width = `${r.width}px`;
        document.body.append(drag.ghost);
        drag.el.classList.add('pl-holder');
        if (navigator.vibrate) navigator.vibrate(10);
        move(x, y);
    }
    function move(x, y) {
        drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy}px) rotate(2.5deg)`;
        drag.ghost.style.display = 'none';
        const under = document.elementFromPoint(x, y);
        drag.ghost.style.display = '';
        const listEl = under && (under.closest('[data-list]') || (under.closest('[data-col]') && under.closest('[data-col]').querySelector('[data-list]')));
        if (!listEl) return;
        const after = [...listEl.querySelectorAll('[data-card]:not(.pl-holder)')].find(c => {
            const r = c.getBoundingClientRect();
            return y < r.top + r.height / 2;
        });
        if (after) listEl.insertBefore(drag.el, after);
        else listEl.append(drag.el);
        // near the edges, the board scrolls along
        const cols = $('#cols');
        const cr = cols.getBoundingClientRect();
        if (x > cr.right - 50) cols.scrollLeft += 14;
        else if (x < cr.left + 50) cols.scrollLeft -= 14;
    }
    addEventListener('pointermove', e => {
        if (!drag) return;
        if (!drag.on) {
            const far = Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6;
            if (drag.touch) {
                if (far) (clearTimeout(drag.timer), (drag = null)); // a swipe scrolls instead
                return;
            }
            if (!far) return;
            start(e.clientX, e.clientY);
        }
        e.preventDefault();
        move(e.clientX, e.clientY);
    }, { passive: false });
    addEventListener('touchmove', e => drag && drag.on && e.preventDefault(), { passive: false });
    addEventListener('pointerup', () => {
        if (!drag) return;
        clearTimeout(drag.timer);
        const d = drag;
        drag = null;
        if (!d.on) return;
        d.ghost.remove();
        d.el.classList.remove('pl-holder');
        // the new place, read back from where the card was dropped
        const listEl = d.el.closest('[data-list]');
        const to = colOf(listEl.dataset.list);
        const from = findCard(d.id);
        const card = from.card;
        from.col.cards.splice(from.i, 1);
        const ids = [...listEl.querySelectorAll('[data-card]')].map(c => c.dataset.card);
        const before = ids.slice(ids.indexOf(d.id) + 1).find(id => to.cards.some(c => c.id === id));
        const at = before ? to.cards.findIndex(c => c.id === before) : to.cards.length;
        to.cards.splice(at, 0, card);
        // dropped in a column called Done: done
        if (/^(done|klaar|gedaan|finished|complete)/i.test(to.name.trim()) && !card.done) card.done = true;
        changed();
        drawCols();
        justDragged = true;
        setTimeout(() => (justDragged = false), 50);
    });

    /* ---------- a card, opened ---------- */
    function cardDialog(id) {
        const found = findCard(id);
        if (!found) return;
        const { card } = found;
        const ro = !open.canEdit;
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop pl-dialog" role="dialog" aria-modal="true" aria-label="Card">
            <div class="pl-drow"><label class="pl-donebox" title="Done"><input type="checkbox" id="cdone"${card.done ? ' checked' : ''}${ro ? ' disabled' : ''}><span>${ic('check')}</span></label><textarea class="pl-dtitle" id="ctitle" rows="1" maxlength="300" ${ro ? 'readonly' : ''}>${esc(card.title)}</textarea><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></div>
            <p class="pl-in">in <select class="input" id="ccol" ${ro ? 'disabled' : ''}>${open.body.cols.map(c => `<option value="${esc(c.id)}"${c.id === found.col.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></p>
            <div class="pl-dgrid">
                <div><h4>Labels</h4><div class="pl-dlabels">${LABELS.map(([l, c]) => `<button class="pl-lab${card.labels.includes(l) ? ' on' : ''}" data-lab="${l}" style="--c:${c}" ${ro ? 'disabled' : ''}>${esc(open.body.labels[l] || '')}</button>`).join('')}${ro ? '' : `<button class="pl-labname" data-names>${ic('pen')}<span>Name labels</span></button>`}</div></div>
                <div><h4>Due</h4><input class="input" type="date" id="cdue" value="${esc(card.due)}" ${ro ? 'readonly' : ''}></div>
                <div><h4>People</h4><div class="pl-who" id="cwho"></div></div>
            </div>
            <h4>Notes</h4><textarea class="input pl-desc" id="cdesc" rows="4" placeholder="Add more detail…" maxlength="8000" ${ro ? 'readonly' : ''}>${esc(card.desc)}</textarea>
            <h4>Checklist <small id="cprog"></small></h4><div class="pl-check" id="ccheck"></div>
            ${ro ? '' : `<div class="pl-dfoot"><small>Added ${esc(new Date(card.created).toLocaleDateString())}</small><span class="spacer"></span><button class="btn" data-copy>${ic('copy')}<span>Copy</span></button><button class="btn btn-ghost danger" data-del>${ic('trash')}<span>Delete card</span></button></div>`}
        </div>`;
        document.body.append(back);
        const grow = t => ((t.style.height = 'auto'), (t.style.height = `${t.scrollHeight}px`));
        grow($('#ctitle', back));
        const save = () => {
            changed();
            const el = $(`[data-card="${card.id}"]`);
            if (el) el.outerHTML = cardHtml(card);
        };
        const drawWho = () => {
            $('#cwho', back).innerHTML = card.who.map(e => `<span class="pl-person">${av(e)}<span>${esc(personOf(e).name || personOf(e).username || e)}</span>${ro ? '' : `<button data-unwho="${esc(e)}" aria-label="Remove">${ic('x')}</button>`}</span>`).join('') + (ro ? '' : `<button class="pl-addwho" data-addwho>${ic('plus')}<span>Add</span></button>`);
        };
        const drawCheck = () => {
            const done = card.check.filter(i => i.done).length;
            $('#cprog', back).textContent = card.check.length ? `${done} of ${card.check.length}` : '';
            $('#ccheck', back).innerHTML =
                (card.check.length ? `<div class="pl-prog"><i style="width:${(done / card.check.length) * 100}%"></i></div>` : '') +
                card.check.map(i => `<label class="pl-item${i.done ? ' done' : ''}"><input type="checkbox" data-ci="${esc(i.id)}"${i.done ? ' checked' : ''}${ro ? ' disabled' : ''}><span>${esc(i.t)}</span>${ro ? '' : `<button data-delci="${esc(i.id)}" aria-label="Remove">${ic('x')}</button>`}</label>`).join('') +
                (ro ? '' : '<input class="input pl-newitem" id="cnewitem" placeholder="Add an item (Enter)" maxlength="300">');
        };
        drawWho();
        drawCheck();
        const close = () => {
            back.remove();
            removeEventListener('keydown', onKey, true);
        };
        const onKey = e => e.key === 'Escape' && !e.target.closest('.fl-pop') && (e.stopPropagation(), close());
        addEventListener('keydown', onKey, true);
        back.addEventListener('click', async e => {
            if (e.target === back || e.target.closest('[data-close]')) return close();
            if (ro) return;
            const lab = e.target.closest('[data-lab]');
            if (lab) {
                const l = lab.dataset.lab;
                card.labels = card.labels.includes(l) ? card.labels.filter(x => x !== l) : [...card.labels, l];
                lab.classList.toggle('on');
                return save();
            }
            if (e.target.closest('[data-names]')) {
                const names = await labelNames();
                if (names) {
                    open.body.labels = names;
                    $$('[data-lab]', back).forEach(b => (b.textContent = names[b.dataset.lab] || ''));
                    changed();
                    drawCols();
                }
                return;
            }
            const un = e.target.closest('[data-unwho]');
            if (un) {
                card.who = card.who.filter(x => x !== un.dataset.unwho);
                drawWho();
                return save();
            }
            const add = e.target.closest('[data-addwho]');
            if (add) {
                const choices = [{ email: me, name: `Me${myName ? ` (${myName})` : ''}` }, ...people].filter(p => !card.who.includes(p.email));
                if (!choices.length) return toast('Everyone is already on this card');
                menu(add, choices.map(p => ['user', p.name || `@${p.username}`, () => {
                    card.who.push(p.email);
                    drawWho();
                    save();
                }]));
                return;
            }
            const del = e.target.closest('[data-delci]');
            if (del) {
                card.check = card.check.filter(i => i.id !== del.dataset.delci);
                drawCheck();
                return save();
            }
            if (e.target.closest('[data-copy]')) {
                const { col, i } = findCard(card.id);
                col.cards.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(card)), id: uid(), title: `${card.title} (copy)`, created: Date.now() });
                changed();
                drawCols();
                close();
                return toast('Card copied');
            }
            if (e.target.closest('[data-del]')) {
                if (!(await ask({ title: 'Delete this card?', text: 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                const { col, i } = findCard(card.id);
                col.cards.splice(i, 1);
                changed();
                drawCols();
                close();
            }
        });
        back.addEventListener('change', e => {
            if (ro) return;
            if (e.target.id === 'cdone') card.done = e.target.checked;
            else if (e.target.id === 'cdue') card.due = e.target.value;
            else if (e.target.id === 'ccol') {
                const { col, i } = findCard(card.id);
                col.cards.splice(i, 1);
                colOf(e.target.value).cards.push(card);
                drawCols();
            } else if (e.target.dataset.ci) {
                const it = card.check.find(i => i.id === e.target.dataset.ci);
                it.done = e.target.checked;
                drawCheck();
            } else return;
            save();
        });
        back.addEventListener('input', e => {
            if (ro) return;
            if (e.target.id === 'ctitle') {
                grow(e.target);
                card.title = e.target.value.replace(/\n/g, ' ').trim() || 'Untitled card';
            } else if (e.target.id === 'cdesc') card.desc = e.target.value;
            else return;
            save();
        });
        back.addEventListener('keydown', e => {
            if (e.target.id === 'ctitle' && e.key === 'Enter') e.preventDefault();
            if (e.target.id === 'cnewitem' && e.key === 'Enter' && e.target.value.trim()) {
                card.check.push({ id: uid(), t: e.target.value.trim(), done: false });
                drawCheck();
                save();
                $('#cnewitem', back).focus();
            }
        });
        if (!ro && !phone()) $('#ctitle', back).focus();
    }
    function labelNames() {
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'pf-crop-back';
            back.style.zIndex = 96;
            back.innerHTML = `<div class="pf-crop pl-names" role="dialog" aria-modal="true"><h2>Label names</h2><p class="cp-muted">For everyone on this board.</p>${LABELS.map(([l, c]) => `<label class="pl-nrow"><i style="background:${c}"></i><input class="input" data-l="${l}" maxlength="40" placeholder="${l[0].toUpperCase() + l.slice(1)}" value="${esc(open.body.labels[l] || '')}"></label>`).join('')}<div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div></div>`;
            document.body.append(back);
            const done = v => (back.remove(), resolve(v));
            $('[data-x]', back).onclick = () => done(null);
            $('[data-ok]', back).onclick = () => done(Object.fromEntries($$('[data-l]', back).map(i => [i.dataset.l, i.value.trim()])));
            $('[data-l]', back).focus();
        });
    }
    function menu(anchor, items) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.style.zIndex = 97;
        pop.innerHTML = items.map(([icon, label, , danger], i) => `<button data-i="${i}" class="${danger ? 'danger' : ''}">${ic(icon)}<span>${esc(label)}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(r.bottom + 4, innerHeight - pop.offsetHeight - 8)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            pop.remove();
            removeEventListener('pointerdown', off, true);
            items[+b.dataset.i][2]();
        });
    }
    function moreMenu(anchor) {
        menu(anchor, [
            ...(open.canEdit ? Object.entries(BGS).map(([k, l]) => ['palette', `Background: ${l}`, () => {
                open.body.bg = k;
                $('.pl').className = `pl bg-${k}`;
                changed();
            }]) : []),
            ['copy', 'Make a copy', async () => {
                if (dirty) await saveNow();
                const c = await call(`/api/docs/${open.id}/copy`, { method: 'POST', body: {} });
                list.unshift(c);
                select(c.id);
                toast('A copy of your own');
            }],
            ...(open.mine ? [['trash', 'Delete board', async () => {
                if (!(await ask({ title: 'Delete this board?', text: open.share !== 'private' ? 'Everyone it’s shared with loses it too. This can’t be undone.' : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${open.id}`, { method: 'DELETE' });
                dirty = false;
                list = list.filter(x => x.id !== open.id);
                gallery();
            }, true]] : [])
        ]);
    }

    /* ---------- undo (Ctrl Z, Ctrl Y), saving, and others' changes ---------- */
    const hist = undoable(
        () => ({ title: open.title, body: open.body }),
        s => {
            open.title = s.title;
            open.body = s.body;
        }
    );
    function undoRedo(which) {
        if (!(which === 'undo' ? hist.undo() : hist.redo())) return;
        const x = $('#cols') ? $('#cols').scrollLeft : 0;
        board();
        if ($('#cols')) $('#cols').scrollLeft = x;
        changed();
    }
    addEventListener('keydown', e => {
        const u = undoKey(e);
        if (!u || !open || !open.canEdit || textBox(e) || $('.pf-crop-back') || drag) return;
        e.preventDefault();
        undoRedo(u);
    });
    function changed() {
        if (!open || !open.canEdit) return;
        hist.note();
        dirty = true;
        $('#saved') && ($('#saved').textContent = 'Saving…');
        save();
    }
    async function saveNow() {
        if (!open || !dirty) return;
        dirty = false;
        const d = open;
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: (d.title || '').trim(), body: d.body, version: d.version } });
            d.version = r.version;
            if ($('#saved') && open === d) $('#saved').textContent = 'Saved';
        } catch (e) {
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
            // someone else changed it: show theirs
            if (/changed this/.test(e.message)) select(d.id);
            else dirty = true;
        }
    }
    const save = debounce(saveNow, 700);
    addEventListener('beforeunload', () => dirty && saveNow());
    // a shared board: pick up what others changed, when nothing is being edited here
    setInterval(async () => {
        if (!open || open.share === 'private' || dirty || drag || document.visibilityState !== 'visible' || $('.pf-crop-back')) return;
        try {
            const fresh = await call(`/api/docs/${open.id}`);
            if (fresh.version !== open.version && !dirty) {
                open = fresh;
                hist.reset();
                drawCols();
            }
        } catch {
            // offline for a moment
        }
    }, 15000);

    Promise.all([call('/api/docs?kind=board'), call('/api/profile'), call('/api/chat/people').catch(() => [])])
        .then(([r, prof, ppl]) => {
            list = r;
            me = prof.account;
            myName = (prof.profile && prof.profile.name) || '';
            people = ppl;
            const want = location.hash.slice(1);
            if (want && list.some(d => d.id === want)) select(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your boards</h1><p>${esc(e.message)}</p></div>`));
})();
