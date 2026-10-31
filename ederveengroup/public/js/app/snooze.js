// EderveenGroup client: snooze
import { dropFromList } from './actions.js';
import { loadFolders } from './folders.js';
import { loadMessages } from './list.js';
import { showMenu } from './menus.js';
import { specialPath, state } from './state.js';
import { $, api, h, toast } from './util.js';

let snoozeIndex = new Map();

function fmtUntil(ts) {
    const d = new Date(ts);
    const now = new Date();
    const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return t;
    const tm = new Date(now);
    tm.setDate(now.getDate() + 1);
    if (d.toDateString() === tm.toDateString()) return `Tomorrow ${t}`;
    return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${t}`;
}
function snoozeOptions() {
    const at = (days, hour) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(hour, 0, 0, 0);
        return d;
    };
    const now = new Date();
    const later = new Date(now.getTime() + 3 * 36e5);
    later.setMinutes(0, 0, 0);
    const sat = at((6 - now.getDay() + 7) % 7 || 7, 9);
    const mon = at((8 - now.getDay()) % 7 || 7, 8);
    const opts = [];
    if (now.getHours() < 18) opts.push({ icon: 'coffee', label: 'Later today', when: later });
    opts.push({ icon: 'sunrise', label: 'Tomorrow', when: at(1, 8) });
    if (now.getDay() >= 1 && now.getDay() <= 4) opts.push({ icon: 'sparkle', label: 'This weekend', when: sat });
    opts.push({ icon: 'calendar', label: 'Next week', when: mon });
    return opts;
}
function snoozeMenu(x, y, uids) {
    const items = snoozeOptions().map(o => ({ icon: o.icon, label: o.label, hint: fmtUntil(o.when), run: () => snooze(uids, o.when) }));
    items.push('-', { icon: 'clock', label: 'Pick date & time…', run: () => pickSnoozeTime(uids) });
    showMenu(x, y, items);
}
function pickSnoozeTime(uids) {
    const d = new Date(Date.now() + 864e5);
    d.setHours(9, 0, 0, 0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const back = h(`<div class="modal-back"><div class="modal snooze-pick"><div class="modal-head"><h2>Snooze until</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
        <div class="modal-body"><input class="input" type="datetime-local" value="${local}"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-ok>${icon('clock')} Snooze</button></div></div></div></div>`);
    document.body.append(back);
    back.addEventListener('click', e => {
        if (e.target === back || e.target.closest('[data-close]')) back.remove();
        if (e.target.closest('[data-ok]')) {
            const when = new Date($('input', back).value);
            if (!(when > new Date())) return toast('Pick a time in the future', { error: true });
            back.remove();
            snooze(uids, when);
        }
    });
    $('input', back).focus();
}
async function snooze(uids, when) {
    const from = state.folder;
    dropFromList(uids, specialPath('\\Snoozed'));
    try {
        await api('api/messages/snooze', { method: 'POST', body: { folder: from, uids, until: when.toISOString() } });
        toast(`Snoozed until ${fmtUntil(when)}`);
        loadFolders();
    } catch (e) {
        toast(e.message, { error: true });
        loadMessages({ quiet: true });
    }
}
async function loadSnoozeIndex() {
    try {
        snoozeIndex = new Map((await api('api/snoozes')).map(s => [s.messageId, s]));
    } catch {
        // labels are optional
    }
}

export { fmtUntil, loadSnoozeIndex, pickSnoozeTime, snooze, snoozeIndex, snoozeMenu, snoozeOptions };
