// Widgets: EderveenGroup on the iPhone home screen and lock screen, through Scriptable (a free app
// that makes widgets from a short script). This page shows a preview with your own things, hands
// you the script (with your private feed address in it), and can replace that address.
(function () {
    const { $, esc, ic, call, toast, ask } = window.EG;
    const root = $('#widgets');
    const tz = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    })();
    let d = null; // what the widget shows
    let script = ''; // the Scriptable script, ready to copy
    let size = 'medium';
    let param = '';

    /* ---------- the preview: the same layout as the script draws ---------- */
    const dateOf = day => new Date(`${day}T12:00:00`);
    const addDays = (day, n) => {
        const t = dateOf(day);
        t.setDate(t.getDate() + n);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    };
    const fmt = (day, opts) => new Intl.DateTimeFormat('en-GB', opts).format(dateOf(day));
    const dayLabel = (day, long) => {
        if (!long && day === d.date) return 'Today';
        if (!long && day === addDays(d.date, 1)) return 'Tomorrow';
        return long ? fmt(day, { weekday: 'short', day: 'numeric', month: 'short' }) : fmt(day, { weekday: 'short' });
    };
    const due = () => d.tasks.today + d.tasks.overdue;
    const sym = name => `<span class="wg-sym">${ic(name)}</span>`;
    const head = label => `<div class="wg-head"><i></i><span>${esc(label)}</span></div>`;
    const counts = compact => `<div class="wg-counts${compact ? ' compact' : ''}">${d.mail ? `<span>${sym('mail')}${d.mail.unread}</span>` : ''}<span class="${d.tasks.overdue ? 'late' : ''}">${sym('check')}${due()}</span>${!compact && d.chat != null ? `<span>${sym('reply')}${d.chat}</span>` : ''}${!compact && d.planner ? `<span>${sym('grid')}${d.planner}</span>` : ''}</div>`;
    const when = e => `${e.day === d.date ? '' : `${dayLabel(e.day)} `}${e.allDay ? 'All day' : e.at}`;
    const agenda = max => (d.events.length ? d.events.slice(0, max).map(e => `<div class="wg-ev"><b style="background:${esc(e.color)}"></b><small>${esc(when(e))}</small><span>${esc(e.title)}</span></div>`).join('') + (d.events.length > max ? `<small class="wg-more">+${d.events.length - max} more</small>` : '') : '<p class="wg-none">Nothing planned this week</p>');
    const tasks = max => (d.tasks.list.length ? d.tasks.list.slice(0, max).map(t => `<div class="wg-task${t.late ? ' late' : ''}"><i></i><span>${esc(t.text)}</span></div>`).join('') : `<p class="wg-none ok">${d.tasks.open ? 'Nothing due' : 'All done'}</p>`);
    const mailBig = () => `<div class="wg-big">${sym('mail')}<b>${d.mail ? d.mail.unread : '–'}</b></div><p class="wg-none">${d.mail ? (d.mail.unread === 1 ? 'unread message' : 'unread messages') : 'Open Mail once to count'}</p>`;
    const next = () => d.events.find(e => !e.allDay) || d.events[0];
    function widget() {
        if (size === 'small') {
            const n = next();
            const body = param === 'mail' ? mailBig() : param === 'tasks' ? `<p class="wg-sec">Tasks · ${due()} due</p>${tasks(3)}` : n ? `<p class="wg-when">${esc(when(n))}</p><p class="wg-title">${esc(n.title)}</p>${n.location ? `<p class="wg-loc">${esc(n.location)}</p>` : ''}` : '<p class="wg-title dim">Nothing planned</p>';
            return `<div class="wg wg-small">${head(dayLabel(d.date, true))}<div class="wg-body">${body}</div>${counts(true)}</div>`;
        }
        if (size === 'medium') {
            const left = param === 'tasks' ? tasks(4) : param === 'mail' ? mailBig() : agenda(4);
            return `<div class="wg wg-medium">${head(`${dayLabel(d.date, true)} · ${d.name}`)}<div class="wg-cols"><div>${left}</div>${param ? '' : `<div class="wg-right"><p class="wg-sec">Tasks</p>${tasks(3)}</div>`}</div>${counts(false)}</div>`;
        }
        if (size === 'large') {
            return `<div class="wg wg-large">${head(`${dayLabel(d.date, true)} · ${d.name}`)}<div class="wg-body">${param === 'tasks' || param === 'mail' ? '' : `<p class="wg-sec">Agenda</p>${agenda(param === 'agenda' ? 11 : 7)}`}${param === 'agenda' || param === 'mail' ? '' : `<p class="wg-sec">Tasks · ${due()} due</p>${tasks(param === 'tasks' ? 10 : 4)}`}${param === 'mail' ? mailBig() : ''}</div>${d.news && d.news.title && !param ? `<p class="wg-news">${sym('bell')}${esc(d.news.title)}</p>` : ''}${counts(false)}</div>`;
        }
        // lock screen: one colour, drawn by iOS
        const n = next();
        const bits = `${d.mail ? `${d.mail.unread} unread · ` : ''}${due()} tasks`;
        const todayNext = d.events.find(e => !e.allDay && e.day === d.date);
        const inline = param === 'mail' && d.mail ? `${d.mail.unread} unread` : todayNext && param !== 'tasks' ? `${todayNext.at} ${todayNext.title}` : `${due()} tasks due${d.mail ? ` · ${d.mail.unread} unread` : ''}`;
        return `<div class="wg-lock"><p class="wg-clock">${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</p><p class="wg-inline">${esc(inline)}</p>
            <div class="wg-lockrow"><div class="wg-circ">${sym(param === 'tasks' || !d.mail ? 'check' : 'mail')}<b>${param === 'tasks' || !d.mail ? due() : d.mail.unread}</b></div>
            <div class="wg-rect">${param === 'tasks' ? `<b>${due()} tasks due</b>${d.tasks.list.slice(0, 2).map(t => `<span>${esc(t.text)}</span>`).join('')}` : `<small>${n ? esc(when(n)) : ''}</small><b>${n ? esc(n.title) : 'Nothing planned'}</b><span>${esc(bits)}</span>`}</div></div></div>`;
    }

    /* ---------- the page ---------- */
    function draw() {
        root.innerHTML = `<div class="wgp">
            <div class="ea-head"><h1>Widgets</h1></div>
            <p class="wg-lead">Your day on your iPhone’s home screen and lock screen: what’s next in your agenda, tasks that are due, and how much mail and chat is waiting. Tap the widget to open EderveenGroup.</p>
            <section class="wg-show">
                <div class="seg" id="wg-size" role="tablist" aria-label="Size">${[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['lock', 'Lock screen']].map(([k, l]) => `<button data-size="${k}" class="${size === k ? 'on' : ''}" role="tab" aria-selected="${size === k}">${l}</button>`).join('')}</div>
                <div class="wg-stage">${widget()}</div>
                <div class="pe-chips wg-params" aria-label="What it shows">${[['', 'Everything'], ['agenda', 'Agenda'], ['tasks', 'Tasks'], ['mail', 'Mail']].map(([k, l]) => `<button class="pe-chip${param === k ? ' on' : ''}" data-param="${k}">${l}</button>`).join('')}</div>
                <p class="cp-muted">This is your widget with your things, right now.${param ? ` To show only ${param}, type <code>${param}</code> under Parameter when you edit the widget.` : ''}</p>
            </section>
            <section class="wg-steps">
                <h2>Set it up on your iPhone</h2>
                <ol>
                    <li><b>Get Scriptable</b>, a free app that makes widgets.<div class="wg-acts"><a class="btn" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener">${ic('download')}<span>Scriptable in the App Store</span></a></div></li>
                    <li><b>Copy your widget script.</b> Easiest on the iPhone itself: open this page there.<div class="wg-acts"><button class="btn btn-primary" data-copy>${ic('copy')}<span>Copy the script</span></button><a class="btn btn-ghost" href="/api/widget/script?download=1" download="EderveenGroup.js">${ic('file')}<span>Download it</span></a></div></li>
                    <li><b>Paste it into Scriptable:</b> open Scriptable, tap <b>+</b>, paste, tap the name at the top and call it <code>EderveenGroup</code>, then tap <b>Done</b>. Tap ▶ to see it.</li>
                    <li><b>Put it on your home screen:</b> hold an empty spot → <b>Edit</b> → <b>Add Widget</b> → <b>Scriptable</b> → pick a size → <b>Add Widget</b>. Hold the new widget → <b>Edit Widget</b> → Script: <b>EderveenGroup</b>.</li>
                    <li><b>Lock screen</b> (if you like): hold the lock screen → <b>Customize</b> → <b>Lock Screen</b> → tap the space for widgets → <b>Scriptable</b>, then tap the widget and choose <b>EderveenGroup</b>.</li>
                </ol>
                <p class="cp-muted">Widgets refresh when iOS lets them, usually every 15 to 30 minutes. The mail count is the one from the last time EderveenGroup looked at your inbox (when you last used Mail here).</p>
            </section>
            <section class="wg-private">
                <h2>Your private link</h2>
                <p>The script has a private address in it. It only shows your agenda, tasks and counts, and nothing can be changed with it, but don’t share the script. If it gets out, make a new link: widgets with the old one stop working, and you copy the script again.</p>
                <button class="btn btn-danger" data-renew>${ic('refresh')}<span>Make a new link</span></button>
            </section>
        </div>`;
    }
    root.addEventListener('click', async e => {
        const s = e.target.closest('[data-size]');
        if (s) {
            size = s.dataset.size;
            return draw();
        }
        const p = e.target.closest('[data-param]');
        if (p) {
            param = p.dataset.param;
            return draw();
        }
        if (e.target.closest('[data-copy]')) {
            // straight from the tap, so Safari allows it
            try {
                await navigator.clipboard.writeText(script);
                toast('Copied. Now open Scriptable and paste it into a new script.');
            } catch {
                showScript();
            }
            return;
        }
        if (e.target.closest('[data-renew]')) {
            if (!(await ask({ title: 'Make a new link?', text: 'Widgets that use the old link stop working. Copy the script again afterwards and paste it over the old one in Scriptable.', ok: 'Make a new link', danger: true }))) return;
            await call('/api/widget', { method: 'POST' });
            script = await fetchScript();
            toast('New link made. Copy the script again.');
        }
    });
    // when the browser won't copy: show it to select by hand
    function showScript() {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop wg-copybox" role="dialog" aria-modal="true"><h2>Your widget script</h2><p class="cp-muted">Select all of it and copy it.</p><textarea class="input" readonly rows="10">${esc(script)}</textarea><div class="pf-crop-acts"><button class="btn btn-primary" data-x>Done</button></div></div>`;
        document.body.append(back);
        const ta = $('textarea', back);
        ta.focus();
        ta.select();
        $('[data-x]', back).onclick = () => back.remove();
    }
    async function fetchScript() {
        const res = await fetch('/api/widget/script', { headers: { 'X-EG': '1' } });
        if (!res.ok) throw new Error('Couldn’t make your widget script');
        return res.text();
    }

    Promise.all([call(`/api/widget?tz=${encodeURIComponent(tz)}`), fetchScript()])
        .then(([r, s]) => {
            d = r.preview;
            script = s;
            draw();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load widgets</h1><p>${esc(e.message)}</p></div>`));
})();
