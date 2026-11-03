// Widgets: a gallery of widgets for the iPhone home screen and lock screen, through Scriptable (a
// free app that makes widgets from a short script). Every card is a live preview made by the real
// script (scriptable-emu.js runs it here), with your own things in it, and a button to copy it.
(function () {
    const { $, $$, esc, ic, call, toast, ask } = window.EG;
    const root = $('#widgets');
    let kinds = [];
    const chosen = {}; // kind → size shown
    const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large', lock: 'Lock screen' };

    function page() {
        const groups = [...new Set(kinds.map(k => k.group))];
        root.innerHTML = `<div class="wgp">
            <div class="ea-head"><h1>Widgets</h1></div>
            <p class="wg-lead">Fun widgets for your iPhone’s home screen and lock screen, with your own agenda, tasks, notes and photos in them. Every preview below is live. Pick one, copy its script into Scriptable, and add it, as many as you like.</p>
            <details class="wg-how" id="wg-how">
                <summary>${ic('sparkle')}<span>How to add a widget (2 minutes)</span></summary>
                <ol>
                    <li><b>Get Scriptable</b>, a free app that makes widgets. <a class="btn" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener">${ic('download')}<span>Scriptable in the App Store</span></a></li>
                    <li><b>Copy a widget’s script</b> with its <b>Copy</b> button below. Easiest on the iPhone itself: open this page there.</li>
                    <li><b>Paste it into Scriptable:</b> open Scriptable, tap <b>+</b>, paste, tap the name at the top and give it the name shown on the card (like <code>EG Calendar</code>), then tap <b>Done</b>. Tap ▶ to see it.</li>
                    <li><b>Put it on your home screen:</b> hold an empty spot → <b>Edit</b> → <b>Add Widget</b> → <b>Scriptable</b> → pick a size → <b>Add Widget</b>. Hold the new widget → <b>Edit Widget</b> → Script: the name you gave it.</li>
                    <li><b>Lock screen:</b> hold the lock screen → <b>Customize</b> → <b>Lock Screen</b> → tap the space for widgets → <b>Scriptable</b>, then tap the widget and pick the script.</li>
                </ol>
                <p class="cp-muted">Widgets refresh when iOS lets them, usually every 15 to 30 minutes (the Next up timer ticks every second by itself). The mail count is the one from the last time you used Mail here. Weather comes straight from Open-Meteo on your phone, for where you are.</p>
            </details>
            ${groups.map(g => `<h2 class="ea-sec">${esc(g)}</h2><div class="wg-grid">${kinds.filter(k => k.group === g).map(card).join('')}</div>`).join('')}
            <section class="wg-private">
                <h2>Your private link</h2>
                <p>Every script has the same private address in it. It only reads (agenda, tasks, notes, counts and the Memories photo) and nothing can be changed with it, but don’t share your scripts. If one gets out, make a new link: widgets with the old one stop working, and you copy their scripts again.</p>
                <button class="btn btn-danger" data-renew>${ic('refresh')}<span>Make a new link</span></button>
            </section>
        </div>`;
        for (const k of kinds) preview(k.id);
        try {
            if (!localStorage.getItem('eg-widgets-seen')) $('#wg-how').open = true;
            localStorage.setItem('eg-widgets-seen', '1');
        } catch {
            $('#wg-how').open = true;
        }
    }
    function card(k) {
        const size = chosen[k.id] || (k.id === 'quote' || k.id === 'memories' ? 'small' : 'medium');
        chosen[k.id] = size;
        return `<article class="wgc" data-kind="${k.id}">
            <div class="wgc-stage" data-stage="${k.id}"><div class="spinner"></div></div>
            <div class="wgc-info">
                <h3>${esc(k.name)}</h3>
                <p>${esc(k.blurb)}</p>
                <div class="seg wgc-sizes" role="tablist" aria-label="Size">${k.sizes.map(s => `<button data-size="${s}" class="${s === size ? 'on' : ''}" role="tab" aria-selected="${s === size}">${SIZE_NAMES[s]}</button>`).join('')}</div>
                <div class="wgc-acts"><button class="btn btn-primary" data-copy="${k.id}">${ic('copy')}<span>Copy</span></button><a class="btn btn-ghost" href="/api/widget/script?kind=${k.id}&download=1" download>${ic('file')}<span>Download</span></a></div>
                <p class="wgc-name">Name it <code>${esc(k.script)}</code> in Scriptable.${k.param !== 'nothing to set' ? ` Parameter: ${esc(k.param)}.` : ''}</p>
            </div>
        </article>`;
    }
    // fit a widget into its card (a medium one is wider than a phone's card)
    function fit(stage, el) {
        const w = parseFloat(el.style.width);
        const h = parseFloat(el.style.height);
        const room = stage.clientWidth - 24;
        const k = Math.min(1, room / w);
        const box = document.createElement('div');
        box.className = 'wgc-fit';
        box.style.width = `${w * k}px`;
        box.style.height = `${h * k}px`;
        el.style.transform = `scale(${k})`;
        box.append(el);
        return box;
    }
    async function preview(id) {
        const stage = $(`[data-stage="${id}"]`);
        if (!stage) return;
        const size = chosen[id];
        try {
            if (size === 'lock') {
                const [rect, circ, line] = await Promise.all(['accessoryRectangular', 'accessoryCircular', 'accessoryInline'].map(f => window.EGScriptable.render(id, f)));
                const lock = document.createElement('div');
                lock.className = 'wg-lockscreen';
                const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date());
                lock.innerHTML = `<div class="wg-lock-line"></div><p class="wg-lock-time">${time}</p><div class="wg-lock-row"></div>`;
                lock.firstChild.append(line);
                lock.lastChild.append(circ, rect);
                stage.replaceChildren(lock);
            } else {
                const el = await window.EGScriptable.render(id, size);
                stage.replaceChildren(fit(stage, el));
            }
        } catch (e) {
            stage.innerHTML = `<p class="cp-muted">Couldn’t draw this preview: ${esc(e.message)}</p>`;
        }
    }

    root.addEventListener('click', async e => {
        const s = e.target.closest('[data-size]');
        if (s) {
            const id = s.closest('[data-kind]').dataset.kind;
            chosen[id] = s.dataset.size;
            $$(`[data-kind="${id}"] [data-size]`).forEach(b => (b.classList.toggle('on', b === s), b.setAttribute('aria-selected', b === s)));
            return preview(id);
        }
        const c = e.target.closest('[data-copy]');
        if (c) {
            const k = kinds.find(x => x.id === c.dataset.copy);
            const text = (window.EGWidgetSources || {})[k.id] || '';
            // straight from the tap, so Safari allows it
            try {
                await navigator.clipboard.writeText(text);
                toast(`Copied. In Scriptable: +, paste, and name it “${k.script}”.`);
            } catch {
                showScript(k, text);
            }
            return;
        }
        if (e.target.closest('[data-renew]')) {
            if (!(await ask({ title: 'Make a new link?', text: 'Widgets that use the old link stop working. Copy their scripts again afterwards and paste them over the old ones in Scriptable.', ok: 'Make a new link', danger: true }))) return;
            await call('/api/widget', { method: 'POST' });
            await loadScripts();
            page();
            toast('New link made. Copy your widgets’ scripts again.');
        }
    });
    // when the browser won't copy: show it to select by hand
    function showScript(k, text) {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop wg-copybox" role="dialog" aria-modal="true"><h2>${esc(k.name)} script</h2><p class="cp-muted">Select all of it, copy it, and paste it into a new script in Scriptable called “${esc(k.script)}”.</p><textarea class="input" readonly rows="10">${esc(text)}</textarea><div class="pf-crop-acts"><button class="btn btn-primary" data-x>Done</button></div></div>`;
        document.body.append(back);
        const ta = $('textarea', back);
        ta.focus();
        ta.select();
        $('[data-x]', back).onclick = () => back.remove();
    }
    // the scripts, as functions for the previews and as text for Copy
    function loadScripts() {
        return new Promise((resolve, reject) => {
            $$('script[data-widget-scripts]').forEach(x => x.remove());
            const s = document.createElement('script');
            s.src = `/api/widget/previews.js?t=${Date.now()}`;
            s.dataset.widgetScripts = '1';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Couldn’t load the widgets'));
            document.head.append(s);
        });
    }

    Promise.all([call('/api/widget'), loadScripts()])
        .then(([r]) => {
            kinds = r.kinds;
            page();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load widgets</h1><p>${esc(e.message)}</p></div>`));
})();
