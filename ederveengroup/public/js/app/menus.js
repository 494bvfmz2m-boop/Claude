// EderveenGroup client: menus
import { $, esc, h } from './util.js';

function showMenu(x, y, items) {
    closeMenu();
    const menu = h('<div class="menu" id="menu"></div>');
    items.forEach(it => {
        if (it === '-') return menu.append(document.createElement('hr'));
        const b = h(`<button class="${it.danger ? 'danger' : ''}">${icon(it.icon)}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`);
        b.onclick = () => {
            closeMenu();
            it.run();
        };
        menu.append(b);
    });
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }));
}
function closeMenu() {
    const m = $('#menu');
    if (m) m.remove();
}

export { closeMenu, showMenu };
