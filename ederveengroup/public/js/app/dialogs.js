// EderveenGroup client: dialogs
import { onKey } from './palette.js';
import { $, $$, esc, h } from './util.js';

// In-site replacement for confirm()/prompt(): themed, animated and keyboard friendly.
// Resolves to true/false, or to the entered text (null when cancelled) when `input` is given.
function dialog({ title, message = '', icon: ic = 'sparkle', confirm = 'OK', cancel = 'Cancel', danger = false, input = null }) {
    return new Promise(resolve => {
        const before = document.activeElement;
        const back = h(`<div class="modal-back dlg-back"><div class="dlg${danger ? ' danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
            <div class="dlg-icon">${icon(ic)}</div>
            <h2 id="dlg-title">${esc(title)}</h2>
            ${message ? `<p>${esc(message)}</p>` : ''}
            ${input ? `<input class="input dlg-input" type="${input.type || 'text'}" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}" spellcheck="false" autocomplete="off">` : ''}
            <div class="dlg-actions"><button class="btn" data-dlg="no">${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-dlg="yes">${esc(confirm)}</button></div>
        </div></div>`);
        document.body.append(back);
        const box = $('.dlg', back);
        const field = $('.dlg-input', back);
        const buttons = $$('[data-dlg]', back);
        const finish = ok => {
            if (back.classList.contains('closing')) return;
            let value = true;
            if (field) {
                value = field.value.trim();
                if (ok && (!value || value === (input.value || '').trim() && input.value === 'https://')) {
                    box.classList.remove('nudge');
                    void box.offsetWidth;
                    box.classList.add('nudge');
                    return field.focus();
                }
            }
            back.classList.add('closing');
            document.removeEventListener('keydown', onKey, true);
            setTimeout(() => back.remove(), 240);
            if (before && before.focus) before.focus({ preventScroll: true });
            resolve(ok ? value : field ? null : false);
        };
        const onKey = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            } else if (e.key === 'Enter' && e.target === field) {
                e.preventDefault();
                finish(true);
            } else if (e.key === 'Tab') {
                // keep focus inside the dialog
                const items = [field, ...buttons].filter(Boolean);
                const i = items.indexOf(document.activeElement);
                e.preventDefault();
                items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
            }
        };
        document.addEventListener('keydown', onKey, true);
        back.addEventListener('click', e => {
            if (e.target === back) return finish(false);
            const b = e.target.closest('[data-dlg]');
            if (b) finish(b.dataset.dlg === 'yes');
        });
        requestAnimationFrame(() => {
            if (field) {
                field.focus();
                field.select();
            } else buttons[danger ? 0 : 1].focus(); // destructive: Enter should not delete by accident
        });
    });
}
const askConfirm = opts => dialog(opts);
const askText = opts => dialog({ ...opts, input: opts.input || {} });

// dialogs steal focus from rich-text editors, so remember the caret and put it back
const saveSelection = () => {
    const sel = getSelection();
    return sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
};
const restoreSelection = (editor, range) => {
    editor.focus();
    if (!range) return;
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};

export { askConfirm, askText, dialog, restoreSelection, saveSelection };
