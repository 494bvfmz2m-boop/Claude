// EderveenGroup client: chrome
import { composer, openComposer } from './composer.js';
import { applyLook, saveSettings } from './look.js';
import { openPalette } from './palette.js';
import { openSettings } from './settings.js';
import { state } from './state.js';
import { $, api, avatar, h } from './util.js';

function toggleTheme(e) {
    const cur = document.documentElement.dataset.theme;
    const apply = () => saveSettings({ theme: cur === 'light' ? 'dark' : 'light' });
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();
    const x = e && e.clientX ? e.clientX : innerWidth - 40;
    const y = e && e.clientY ? e.clientY : 40;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('theme-swap');
    const t = document.startViewTransition(() => {
        Object.assign(state.settings, { theme: cur === 'light' ? 'dark' : 'light' });
        applyLook();
    });
    t.ready.catch(() => {});
    t.ready.then(() =>
        document.documentElement.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' })
    );
    t.finished.catch(() => {}).then(() => document.documentElement.classList.remove('theme-swap'));
    apply();
}
async function logout() {
    try {
        await api('api/logout', { method: 'POST' });
    } finally {
        location.replace('login');
    }
}

$('#compose-btn').onclick = () => openComposer('new');
$('#fab').onclick = () => openComposer('new');
$('#theme-btn').onclick = e => toggleTheme(e);
$('#settings-btn').onclick = () => openSettings('general');
$('#palette-btn').onclick = openPalette;
$('#logout-btn').onclick = logout;
$('#menu-btn').onclick = () => $('#app').classList.toggle('nav-open');
$('#app').addEventListener('click', e => {
    if ($('#app').classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('#menu-btn')) $('#app').classList.remove('nav-open');
});
window.addEventListener('beforeunload', e => {
    if (composer && composer.dirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => state.settings && state.settings.theme === 'system' && applyLook());

function refreshMe() {
    $('#me-email').textContent = state.settings.displayName || state.me.email;
    const el = $('#me-avatar');
    const fresh = h(avatar({ address: state.me.email, name: state.settings.displayName }, 'sm'));
    fresh.id = 'me-avatar';
    el.replaceWith(fresh);
}
$('.me').addEventListener('click', () => openSettings('profile'));

// ink ripple on buttons, folders and chips
document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.btn, .folder, .chip, .w-stats button, .menu button, .palette li');
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const box = document.createElement('span');
    box.className = 'ripple-box';
    const dot = document.createElement('span');
    const size = Math.max(r.width, r.height) * 2.2;
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    box.append(dot);
    el.append(box);
    setTimeout(() => box.remove(), 650);
});

export { logout, refreshMe, toggleTheme };
