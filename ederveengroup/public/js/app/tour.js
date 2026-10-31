// EderveenGroup client: tour
// A short first-run walkthrough: a spotlight glides from one part of the app to the next.
import { saveSettings } from './look.js';
import { state } from './state.js';
import { $, calm, esc, h, visibleRect } from './util.js';

const STEPS = [
    { title: 'Welcome to EderveenGroup', text: 'Your Purelymail inbox, faster and nicer. Here’s a 20-second tour. You can skip any time with Esc.' },
    { target: '#folders', title: 'Your folders', text: 'Inbox, Sent, Archive and your own folders. Drag a message onto a folder to move it.' },
    { target: '#menu-btn', title: 'Folders & settings', text: 'Tap here for your folders, settings, theme and sign-out.' },
    { target: '#messages', title: 'Conversations', text: 'Replies are grouped into one row. Swipe a row to archive or delete it, or on a keyboard press J and K to move, E to archive, S to star.' },
    { target: '.search', title: 'Search like a pro', text: 'Try from:ava, has:attachment, is:unread or before:2026-01-01. Matches in other folders show up too.' },
    { target: '#compose-btn, #fab', title: 'Write', text: 'Press C anywhere. Paste images straight in, pick a signature, or start from a template.' },
    { target: '#palette-btn', title: 'Everything, one shortcut', text: 'Ctrl K opens the command palette: jump to folders, change the theme, find any setting.' },
    { target: '#settings-btn', title: 'Make it yours', text: 'Signatures, templates, your photo, accent colour, two-step verification and signed-in devices all live in Settings.' }
];

let running = null;
// first match that's actually on screen (e.g. the floating compose button on phones)
const find = sel => [...document.querySelectorAll(sel)].find(el => visibleRect(el));

function startTour({ force = false } = {}) {
    if (running || (!force && state.settings.tourDone)) return;
    // only steps whose target is on screen (the sidebar is hidden on phones)
    const steps = STEPS.filter(s => !s.target || find(s.target));
    let i = 0;
    const root = h(`<div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div class="tour-spot"></div>
        <div class="tour-card"><div class="tour-dots">${steps.map(() => '<i></i>').join('')}</div>
            <h3 id="tour-title"></h3><p></p>
            <div class="tour-actions"><button class="btn btn-ghost" data-t="skip">Skip</button><span class="spacer"></span><button class="btn" data-t="back">Back</button><button class="btn btn-primary" data-t="next">Next</button></div></div></div>`);
    document.body.append(root);
    const spot = $('.tour-spot', root);
    const card = $('.tour-card', root);
    const before = document.activeElement;

    const place = () => {
        const s = steps[i];
        const r = s.target && visibleRect(find(s.target));
        const pad = 8;
        if (r) {
            const w = r.width + pad * 2, hgt = r.height + pad * 2;
            spot.style.cssText = `--x:${r.left - pad}px;--y:${r.top - pad}px;--w:${w}px;--h:${hgt}px`;
            spot.classList.remove('center');
        } else {
            spot.style.cssText = `--x:${innerWidth / 2}px;--y:${innerHeight / 2}px;--w:0px;--h:0px`;
            spot.classList.add('center');
        }
        // the card sits beside the highlight, wherever there's room
        const cw = Math.min(340, innerWidth - 32);
        const ch = card.offsetHeight || 190;
        let x = innerWidth / 2 - cw / 2, y = innerHeight / 2 - ch / 2;
        if (r) {
            if (r.right + 24 + cw < innerWidth) (x = r.right + 24), (y = r.top);
            else if (r.left - 24 - cw > 0) (x = r.left - 24 - cw), (y = r.top);
            else if (r.bottom + 24 + ch < innerHeight) (y = r.bottom + 24), (x = r.left);
            else y = Math.max(16, r.top - 24 - ch);
        }
        card.style.width = `${cw}px`;
        card.style.transform = `translate(${Math.round(Math.max(16, Math.min(x, innerWidth - cw - 16)))}px, ${Math.round(Math.max(16, Math.min(y, innerHeight - ch - 16)))}px)`;
    };
    const draw = () => {
        const s = steps[i];
        $('h3', card).textContent = s.title;
        $('p', card).innerHTML = esc(s.text);
        [...$('.tour-dots', card).children].forEach((d, n) => d.classList.toggle('on', n === i));
        $('[data-t=back]', card).hidden = i === 0;
        $('[data-t=next]', card).textContent = i === steps.length - 1 ? 'Done' : i === 0 ? 'Show me' : 'Next';
        card.classList.remove('swap');
        if (!calm) {
            void card.offsetWidth;
            card.classList.add('swap');
        }
        place();
        // first placement jumps into position; after that the spotlight glides
        if (!root.classList.contains('ready')) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));
        $('[data-t=next]', card).focus({ preventScroll: true });
    };
    const finish = () => {
        root.classList.add('out');
        setTimeout(() => root.remove(), calm ? 0 : 320);
        removeEventListener('resize', place);
        document.removeEventListener('keydown', onKey, true);
        running = null;
        if (before && before.focus) before.focus({ preventScroll: true });
        if (!state.settings.tourDone) saveSettings({ tourDone: true });
    };
    const go = d => {
        if (i + d >= steps.length) return finish();
        i = Math.max(0, i + d);
        draw();
    };
    const onKey = e => {
        if (e.key === 'Escape') finish();
        else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key !== 'Tab') return;
        else {
            // keep focus inside the tour card
            const items = [...card.querySelectorAll('button:not([hidden])')];
            const at = items.indexOf(document.activeElement);
            items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
        e.preventDefault();
        e.stopPropagation();
    };
    card.addEventListener('click', e => {
        const b = e.target.closest('[data-t]');
        if (!b) return;
        if (b.dataset.t === 'skip') finish();
        else go(b.dataset.t === 'next' ? 1 : -1);
    });
    root.addEventListener('click', e => e.target === root && go(1));
    addEventListener('resize', place);
    document.addEventListener('keydown', onKey, true);
    running = { finish };
    requestAnimationFrame(draw);
}

export { startTour };
