// EderveenGroup client: zero
import { $, h } from './util.js';

const ZERO_LINES = ['Nothing left. Go do something great.', 'Clean slate. Enjoy it.', 'Every thread tied up.', 'Inbox handled. Coffee earned.'];
function inboxZero() {
    return `<div class="empty zero"><div>
        <svg class="zero-art" viewBox="0 0 200 140" fill="none" aria-hidden="true">
            <defs><linearGradient id="zg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
            <circle class="sun" cx="100" cy="92" r="34" fill="url(#zg)"/>
            <g class="rays" stroke="currentColor" stroke-width="1" stroke-linecap="round">${Array.from({ length: 9 }, (_, i) => {
                const a = Math.PI + (i * Math.PI) / 8;
                return `<line x1="${100 + Math.cos(a) * 46}" y1="${92 + Math.sin(a) * 46}" x2="${100 + Math.cos(a) * 58}" y2="${92 + Math.sin(a) * 58}" style="animation-delay:${i * 60}ms"/>`;
            }).join('')}</g>
            <path d="M20 92h160" stroke="currentColor" stroke-width="1" opacity=".5"/><path d="M50 104h100M75 116h50" stroke="currentColor" stroke-width="1" opacity=".25"/>
        </svg>
        <h3>Inbox zero.</h3><p>${ZERO_LINES[Math.floor(Math.random() * ZERO_LINES.length)]}</p></div></div>`;
}

function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = h('<canvas class="confetti"></canvas>');
    document.body.append(c);
    const dpr = devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4c8dff';
    const colors = [accent, '#ffffff', '#a5c8ff', '#22c3ee'];
    const box = $('#messages').getBoundingClientRect();
    const ox = box.left + box.width / 2, oy = box.top + box.height / 2.4;
    const parts = Array.from({ length: 110 }, () => {
        const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
        return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 2 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[(Math.random() * colors.length) | 0], life: 1 };
    });
    const tick = () => {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        let alive = 0;
        for (const p of parts) {
            p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.009;
            if (p.life <= 0) continue;
            alive++;
            ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); ctx.restore();
        }
        if (alive) requestAnimationFrame(tick);
        else c.remove();
    };
    requestAnimationFrame(tick);
}

export { ZERO_LINES, confetti, inboxZero };
