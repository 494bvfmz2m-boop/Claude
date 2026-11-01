// Calendar: your appointments and deadlines, with a subscription address for your phone.
(function () {
    const { $, $$, esc, ic, call, toast, ask, id: newId, phone } = window.EG;
    const root = $('#calendar');
    const COLORS = ['', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple'];
    const REPEATS = [['', 'Never'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
    let events = [];
    let view = sessionGet('cal-view') || 'month';
    let cursor = firstOfMonth(new Date()); // the month on screen
    let selected = iso(new Date()); // the day picked in the month

    function sessionGet(k) {
        try {
            return localStorage.getItem(k);
        } catch {
            return null;
        }
    }
    function sessionSet(k, v) {
        try {
            localStorage.setItem(k, v);
        } catch {
            // private mode: fine
        }
    }
    function iso(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function firstOfMonth(d) {
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const parse = day => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
    const addDays = (day, n) => {
        const d = parse(day);
        d.setDate(d.getDate() + n);
        return iso(d);
    };
    const today = () => iso(new Date());
    const hhmm = t => {
        const d = new Date(2000, 0, 1, +t.slice(11, 13), +t.slice(14, 16));
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };
    const dayName = (day, opts) => parse(day).toLocaleDateString(undefined, opts);

    // does a (possibly repeating, possibly multi-day) event happen on this day? (same rules as the server)
    function occursOn(ev, day) {
        const first = ev.start.slice(0, 10);
        if (day < first) return false;
        const span = Math.round((parse((ev.end || ev.start).slice(0, 10)) - parse(first)) / 864e5);
        const f = parse(first);
        for (let back = 0; back <= span; back++) {
            const sd = addDays(day, -back);
            if (sd < first) break;
            if (ev.until && sd > ev.until) continue;
            const s = parse(sd);
            const hit = {
                '': sd === first,
                daily: true,
                weekdays: s.getDay() > 0 && s.getDay() < 6,
                weekly: s.getDay() === f.getDay(),
                monthly: s.getDate() === f.getDate(),
                yearly: s.getDate() === f.getDate() && s.getMonth() === f.getMonth()
            }[ev.repeat || ''];
            if (hit) return true;
        }
        return false;
    }
    const onDay = day =>
        events
            .filter(e => occursOn(e, day))
            .sort((a, b) => (b.allDay - a.allDay) || (a.allDay ? 0 : a.start.slice(11).localeCompare(b.start.slice(11))) || a.title.localeCompare(b.title));
    const when = (e, day) => {
        if (e.allDay) return 'All day';
        const multi = e.start.slice(0, 10) !== e.end.slice(0, 10);
        if (multi && day && day !== e.start.slice(0, 10)) return day === e.end.slice(0, 10) ? `Until ${hhmm(e.end)}` : 'All day';
        return `${hhmm(e.start)} – ${hhmm(e.end)}`;
    };

    root.innerHTML = `<div class="cal">
        <div class="ea-head cal-head">
            <h1 id="title"></h1>
            <div class="cal-tools">
                <button class="btn" id="today">Today</button>
                <span class="cal-nav"><button class="icon-btn" id="prev" aria-label="Previous">${ic('left')}</button><button class="icon-btn" id="next" aria-label="Next">${ic('right')}</button></span>
                <div class="seg cal-view" role="tablist"><button data-view="month">Month</button><button data-view="agenda">Agenda</button></div>
                <button class="icon-btn" id="sub" aria-label="Subscribe on your phone" title="Show it in your phone’s calendar">${ic('phone')}</button>
                <button class="btn btn-primary" id="new">${ic('plus')}<span>New event</span></button>
            </div>
        </div>
        <div id="body"></div>
    </div>`;
    const body = $('#body');

    function draw() {
        $$('.cal-view button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
        $('#title').innerHTML = view === 'month'
            ? `${esc(cursor.toLocaleDateString(undefined, { month: 'long' }))} <span>${cursor.getFullYear()}</span>`
            : 'Coming up';
        $('.cal-nav').hidden = view !== 'month';
        if (view === 'month') month();
        else agenda();
    }

    function month() {
        // six weeks, starting on the Monday on or before the 1st
        const first = iso(cursor);
        const lead = (parse(first).getDay() + 6) % 7;
        const start = addDays(first, -lead);
        const t = today();
        const names = [...Array(7)].map((_, i) => dayName(addDays(start, i), { weekday: phone() ? 'narrow' : 'short' }));
        let cells = '';
        for (let i = 0; i < 42; i++) {
            const day = addDays(start, i);
            const evs = onDay(day);
            const out = day.slice(0, 7) !== first.slice(0, 7);
            const shown = evs.slice(0, 3);
            cells += `<button class="cal-day${out ? ' out' : ''}${day === t ? ' today' : ''}${day === selected ? ' sel' : ''}" data-day="${day}" aria-label="${esc(dayName(day, { weekday: 'long', month: 'long', day: 'numeric' }))}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}">
                <span class="n">${+day.slice(8)}</span>
                <span class="cal-evs">${shown.map(e => `<span class="cal-chip${e.allDay ? ' all' : ''}" data-color="${esc(e.color)}">${e.allDay ? '' : `<time>${esc(hhmm(e.start))}</time>`}${esc(e.title)}</span>`).join('')}${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} more</span>` : ''}</span>
                <span class="cal-dots">${evs.slice(0, 4).map(e => `<i data-color="${esc(e.color)}"></i>`).join('')}</span>
            </button>`;
        }
        body.innerHTML = `<div class="cal-month">
            <div class="cal-grid-wrap"><div class="cal-week">${names.map(n => `<span>${esc(n)}</span>`).join('')}</div><div class="cal-grid" id="grid">${cells}</div></div>
            <aside class="cal-side" id="side"></aside>
        </div>`;
        side();
    }

    function side() {
        const evs = onDay(selected);
        $('#side').innerHTML = `<h2>${esc(dayName(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}${selected === today() ? ' <em>Today</em>' : ''}</h2>
            ${evs.length ? `<div class="cal-list">${evs.map(e => row(e, selected)).join('')}</div>` : `<div class="ea-empty">${ic('calendar')}<p>Nothing planned.</p></div>`}
            <button class="btn btn-ghost cal-add" data-new="${selected}">${ic('plus')}<span>Add on this day</span></button>`;
    }

    function row(e, day) {
        return `<button class="cal-row" data-id="${esc(e.id)}" data-color="${esc(e.color)}">
            <span class="cal-when">${esc(when(e, day))}</span>
            <span class="cal-what"><b>${esc(e.title)}</b>${e.location ? `<small>${ic('pin')}${esc(e.location)}</small>` : ''}${e.repeat ? `<small>${ic('refresh')}${esc(REPEATS.find(r => r[0] === e.repeat)[1])}</small>` : ''}</span>
        </button>`;
    }

    function agenda() {
        const t = today();
        let html = '';
        let count = 0;
        for (let i = 0; i < 120 && count < 80; i++) {
            const day = addDays(t, i);
            const evs = onDay(day);
            if (!evs.length) continue;
            count += evs.length;
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName(day, { weekday: 'long', day: 'numeric', month: 'long' });
            html += `<section class="cal-agenda-day"><h2 class="ea-sec">${esc(label)}</h2><div class="cal-list">${evs.map(e => row(e, day)).join('')}</div></section>`;
        }
        body.innerHTML = `<div class="cal-agenda">${html || `<div class="ea-empty big">${ic('calendar')}<p>Nothing planned for the next few months. Add an event with the button above.</p></div>`}</div>`;
    }

    /* ---------- the event editor (a sheet) ---------- */
    function sheet(e, day) {
        const fresh = !e;
        const d = day || selected || today();
        const hour = new Date().getHours() + 1;
        const ev = e
            ? { ...e }
            : { id: newId(), title: '', allDay: false, start: `${d}T${String(Math.min(hour, 23)).padStart(2, '0')}:00`, end: '', repeat: '', until: '', location: '', note: '', color: '' };
        if (!ev.end) ev.end = ev.allDay ? ev.start : `${ev.start.slice(0, 11)}${String(Math.min(+ev.start.slice(11, 13) + 1, 23)).padStart(2, '0')}:${ev.start.slice(14, 16)}`;
        const back = document.createElement('div');
        back.className = 'ea-sheet-back';
        back.innerHTML = `<form class="ea-sheet cal-form" role="dialog" aria-modal="true" aria-label="${fresh ? 'New event' : 'Edit event'}" novalidate>
            <div class="nt-bar"><button type="button" class="btn btn-ghost" data-x>Cancel</button><b class="ea-sheet-title">${fresh ? 'New event' : 'Event'}</b><button class="btn btn-primary" type="submit">${ic('check')}<span>Save</span></button></div>
            <div class="ea-sheet-body">
                <input class="cal-title-in" name="title" placeholder="Title" maxlength="140" value="${esc(ev.title)}" required>
                <input class="input" name="location" placeholder="Location" maxlength="200" value="${esc(ev.location)}">
                <div class="cal-fieldset">
                    <label class="cal-switch"><span>All day</span><input type="checkbox" name="allDay" ${ev.allDay ? 'checked' : ''}></label>
                    <label class="cal-when-row"><span>Starts</span><input class="input" type="date" name="sd" value="${ev.start.slice(0, 10)}"><input class="input" type="time" name="st" value="${ev.allDay ? '09:00' : ev.start.slice(11, 16)}"></label>
                    <label class="cal-when-row"><span>Ends</span><input class="input" type="date" name="ed" value="${ev.end.slice(0, 10)}"><input class="input" type="time" name="et" value="${ev.allDay ? '10:00' : ev.end.slice(11, 16)}"></label>
                    <label class="cal-when-row"><span>Repeat</span><select class="input" name="repeat">${REPEATS.map(([v, l]) => `<option value="${v}" ${ev.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                    <label class="cal-when-row cal-until"><span>Until</span><input class="input" type="date" name="until" value="${esc(ev.until)}"><small>Leave empty to keep repeating</small></label>
                </div>
                <div class="nt-colors cal-colors" role="group" aria-label="Colour">${COLORS.map(c => `<button type="button" class="nt-dot${ev.color === c ? ' on' : ''}" data-c="${c}" aria-label="${c || 'Default colour'}"></button>`).join('')}</div>
                <textarea class="input" name="note" rows="4" placeholder="Notes" maxlength="4000">${esc(ev.note)}</textarea>
                <div class="form-error hidden" role="alert"></div>
                ${fresh ? '' : `<button type="button" class="btn btn-ghost ct-delete" data-del>${ic('trash')}<span>Delete event</span></button>`}
            </div>
        </form>`;
        document.body.append(back);
        document.body.classList.add('sheet-open');
        const f = $('form', back);
        let color = ev.color;
        const sync = () => {
            const all = f.allDay.checked;
            f.st.hidden = f.et.hidden = all;
            $('.cal-until', f).hidden = !f.repeat.value;
        };
        sync();
        f.allDay.onchange = sync;
        f.repeat.onchange = sync;
        // moving the start moves the end along with it
        let length = parse(ev.end.slice(0, 10)) - parse(ev.start.slice(0, 10));
        f.sd.onchange = () => {
            if (f.sd.value) f.ed.value = addDays(f.sd.value, Math.round(length / 864e5));
        };
        f.ed.onchange = () => (length = parse(f.ed.value) - parse(f.sd.value));
        f.st.onchange = () => {
            const [h, m] = f.st.value.split(':').map(Number);
            if (f.sd.value === f.ed.value && f.et.value <= f.st.value) f.et.value = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
        $$('.nt-dot', f).forEach(b =>
            b.addEventListener('click', () => {
                color = b.dataset.c;
                $$('.nt-dot', f).forEach(x => x.classList.toggle('on', x === b));
            })
        );
        const onKey = e2 => e2.key === 'Escape' && close();
        const close = () => {
            removeEventListener('keydown', onKey);
            back.classList.add('out');
            document.body.classList.remove('sheet-open');
            setTimeout(() => back.remove(), 260);
        };
        $('[data-x]', f).onclick = close;
        back.addEventListener('click', e2 => e2.target === back && close());
        addEventListener('keydown', onKey);
        f.addEventListener('submit', async e2 => {
            e2.preventDefault();
            const all = f.allDay.checked;
            const body2 = {
                title: f.title.value,
                allDay: all,
                start: all ? f.sd.value : `${f.sd.value}T${f.st.value}`,
                end: all ? f.ed.value : `${f.ed.value}T${f.et.value}`,
                repeat: f.repeat.value,
                until: f.repeat.value ? f.until.value : '',
                location: f.location.value,
                note: f.note.value,
                color
            };
            try {
                const saved = await call(`/api/apps/calendar/${ev.id}`, { method: 'PUT', body: body2 });
                events = events.filter(x => x.id !== saved.id).concat(saved);
                selected = saved.start.slice(0, 10);
                if (view === 'month' && selected.slice(0, 7) !== iso(cursor).slice(0, 7)) cursor = firstOfMonth(parse(selected));
                close();
                draw();
                toast(fresh ? 'Event added' : 'Saved');
            } catch (err) {
                const box = $('.form-error', f);
                box.textContent = err.message;
                box.classList.remove('hidden');
            }
        });
        $('[data-del]', f)?.addEventListener('click', async () => {
            if (!(await ask({ title: 'Delete this event?', text: ev.repeat ? `${ev.title} (every time it repeats)` : ev.title, ok: 'Delete', danger: true }))) return;
            try {
                await call(`/api/apps/calendar/${ev.id}`, { method: 'DELETE' });
                const gone = events.find(x => x.id === ev.id);
                events = events.filter(x => x.id !== ev.id);
                close();
                draw();
                toast('Event deleted', { action: 'Undo', onAction: async () => {
                    const back2 = await call(`/api/apps/calendar/${gone.id}`, { method: 'PUT', body: gone });
                    events.push(back2);
                    draw();
                } });
            } catch (err) {
                toast(err.message, { bad: true });
            }
        });
        setTimeout(() => (fresh ? f.title : $('[data-x]', f)).focus({ preventScroll: true }), 50);
    }

    /* ---------- subscribe on your phone ---------- */
    async function subscribe() {
        const { url } = await call('/api/calendar/feed');
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        const webcal = url.replace(/^https?:/, 'webcal:');
        back.innerHTML = `<div class="pf-crop ad-ask cal-subscribe" role="dialog" aria-modal="true"><h2>See it on your phone</h2>
            <p>Add this private address to your phone’s calendar (iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar; Google Calendar: Other calendars → From URL; Outlook: Add calendar → Subscribe from web). It updates by itself.</p>
            <div class="si-copy"><code>${esc(url)}</code><button class="btn" data-copy>${ic('copy')}<span>Copy</span></button></div>
            <p class="ad-muted">Anyone with this address can see your events. If it gets out, make a new one and the old one stops working.</p>
            <div class="pf-crop-acts"><button class="btn btn-ghost" data-reset>New address</button><span class="spacer"></span><a class="btn" href="${esc(webcal)}">Open in calendar app</a><button class="btn btn-primary" data-x>Done</button></div></div>`;
        document.body.append(back);
        const close = () => {
            back.classList.add('out');
            setTimeout(() => back.remove(), 250);
        };
        $('[data-x]', back).onclick = close;
        back.addEventListener('click', e => e.target === back && close());
        back.addEventListener('keydown', e => e.key === 'Escape' && close());
        $('[data-copy]', back).onclick = async () => {
            try {
                await navigator.clipboard.writeText($('code', back).textContent);
                toast('Copied');
            } catch {
                toast('Select the address and copy it', { bad: true });
            }
        };
        $('[data-reset]', back).onclick = async () => {
            if (!(await ask({ title: 'Make a new address?', text: 'Phones using the old one stop getting updates until you add the new one.', ok: 'New address' }))) return;
            const r = await call('/api/calendar/feed', { method: 'POST', body: {} });
            $('code', back).textContent = r.url;
            $('a.btn', back).href = r.url.replace(/^https?:/, 'webcal:');
            toast('New address made');
        };
        $('[data-x]', back).focus();
    }

    /* ---------- wiring ---------- */
    $('#prev').onclick = () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        draw();
    };
    $('#next').onclick = () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        draw();
    };
    $('#today').onclick = () => {
        cursor = firstOfMonth(new Date());
        selected = today();
        draw();
    };
    $('.cal-view').addEventListener('click', e => {
        const b = e.target.closest('[data-view]');
        if (!b) return;
        view = b.dataset.view;
        sessionSet('cal-view', view);
        draw();
    });
    $('#new').onclick = () => sheet(null, view === 'month' ? selected : today());
    $('#sub').onclick = () => subscribe().catch(err => toast(err.message, { bad: true }));
    body.addEventListener('click', e => {
        const r = e.target.closest('.cal-row');
        if (r) return sheet(events.find(x => x.id === r.dataset.id), r.closest('.cal-side') ? selected : null);
        const n = e.target.closest('[data-new]');
        if (n) return sheet(null, n.dataset.new);
        const d = e.target.closest('.cal-day');
        if (!d) return;
        if (d.dataset.day === selected && !phone()) return sheet(null, selected); // a second click on the same day adds an event
        selected = d.dataset.day;
        if (d.classList.contains('out')) {
            cursor = firstOfMonth(parse(selected));
            return draw();
        }
        $$('.cal-day.sel').forEach(x => x.classList.remove('sel'));
        d.classList.add('sel');
        side();
    });
    // swipe between months on a phone
    let sx = null;
    body.addEventListener('touchstart', e => (sx = e.touches[0].clientX), { passive: true });
    body.addEventListener('touchend', e => {
        if (sx == null || view !== 'month') return;
        const dx = e.changedTouches[0].clientX - sx;
        sx = null;
        if (Math.abs(dx) > 60 && e.target.closest('.cal-grid')) (dx < 0 ? $('#next') : $('#prev')).click();
    });
    addEventListener('keydown', e => {
        if (document.querySelector('.ea-sheet-back, .pf-crop-back') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        if (e.key === 'n' || e.key === 'c') (e.preventDefault(), $('#new').click());
        else if (e.key === 't') $('#today').click();
        else if (e.key === 'ArrowLeft' && view === 'month') $('#prev').click();
        else if (e.key === 'ArrowRight' && view === 'month') $('#next').click();
    });

    call('/api/apps/calendar')
        .then(r => {
            events = r.items;
            draw();
            if (location.hash === '#new') {
                history.replaceState(null, '', location.pathname);
                sheet(null, today());
            }
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your calendar</h1><p>${esc(e.message)}</p></div>`));
})();
