// EderveenGroup widget, for Scriptable (a free iPhone app: scriptable.app)
//
// Home screen: hold an empty spot → Edit → Add Widget → Scriptable → pick a size → Add Widget.
// Then hold the new widget → Edit Widget → Script: EderveenGroup.
// Lock screen: hold the lock screen → Customize → Lock Screen → tap the widget area → Scriptable.
// Parameter (optional, in Edit Widget): agenda, tasks or mail to show only that.
//
// This script has a private link to your agenda, tasks and counts in it: don't share it.
// Made on EderveenGroup → Widgets, where you can also make a new link (this one then stops working).

const FEED = '__FEED__';
const SITE = '__SITE__';

const C = {
    top: new Color('#16203d'),
    bottom: new Color('#06080f'),
    text: new Color('#f3f6ff'),
    dim: new Color('#c7d0e6', 0.78),
    faint: new Color('#c7d0e6', 0.5),
    accent: new Color('#6ea8ff'),
    late: new Color('#ff8f8f'),
    good: new Color('#7ee2b8')
};
let family = config.widgetFamily || 'medium';
const param = String(args.widgetParameter || '').trim().toLowerCase();

/* ---------- the data: fresh from EderveenGroup, or the last copy when offline ---------- */
async function load() {
    const fm = FileManager.local();
    const file = fm.joinPath(fm.cacheDirectory(), 'ederveengroup-widget.json');
    let tz = 'UTC';
    try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
        tz = 'UTC';
    }
    try {
        const req = new Request(`${FEED}?tz=${encodeURIComponent(tz)}`);
        req.timeoutInterval = 20;
        const data = await req.loadJSON();
        const code = req.response && req.response.statusCode;
        if (code !== 200) return { error: (data && data.error) || `EderveenGroup answered ${code}.` };
        fm.writeString(file, JSON.stringify(data));
        return data;
    } catch (e) {
        if (fm.fileExists(file)) {
            const old = JSON.parse(fm.readString(file));
            old.offline = true;
            return old;
        }
        return { error: 'Can’t reach EderveenGroup right now.' };
    }
}

/* ---------- little helpers ---------- */
const dateOf = day => new Date(`${day}T12:00:00`);
const pad = n => String(n).padStart(2, '0');
function addDays(day, n) {
    const t = dateOf(day);
    t.setDate(t.getDate() + n);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
function fmt(date, pattern) {
    const f = new DateFormatter();
    f.locale = 'en_GB';
    f.dateFormat = pattern;
    return f.string(date);
}
function dayLabel(day, d, long) {
    if (!long && day === d.date) return 'Today';
    if (!long && day === addDays(d.date, 1)) return 'Tomorrow';
    return fmt(dateOf(day), long ? 'EEE d MMM' : 'EEE');
}
function font(size, weight) {
    if (weight === 'bold') return Font.boldSystemFont(size);
    if (weight === 'semibold') return Font.semiboldSystemFont(size);
    if (weight === 'medium') return Font.mediumSystemFont(size);
    return Font.systemFont(size);
}
function text(stack, value, size, color, weight, lines = 1) {
    const t = stack.addText(String(value));
    t.font = font(size, weight);
    t.textColor = color || C.text;
    t.lineLimit = lines;
    t.minimumScaleFactor = 0.75;
    return t;
}
function icon(stack, name, size, color) {
    const sym = SFSymbol.named(name);
    if (!sym) return null;
    sym.applyFont(Font.systemFont(size));
    const img = stack.addImage(sym.image);
    img.imageSize = new Size(size, size);
    img.tintColor = color || C.accent;
    return img;
}
const tappable = () => family === 'medium' || family === 'large' || family === 'extraLarge';

/* ---------- pieces ---------- */
function base(url) {
    const w = new ListWidget();
    const g = new LinearGradient();
    g.colors = [C.top, C.bottom];
    g.locations = [0, 1];
    g.startPoint = new Point(0, 0);
    g.endPoint = new Point(1, 1);
    w.backgroundGradient = g;
    w.url = url || `${SITE}/`;
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    return w;
}
function header(w, d, label) {
    const h = w.addStack();
    h.centerAlignContent();
    const mark = h.addStack();
    mark.size = new Size(8, 8);
    mark.cornerRadius = 4;
    mark.backgroundColor = C.accent;
    h.addSpacer(5);
    text(h, label, 11, C.dim, 'semibold');
    h.addSpacer();
    if (d.offline) icon(h, 'wifi.slash', 10, C.faint);
    return h;
}
const tasksDue = d => d.tasks.today + d.tasks.overdue;
function counts(w, d, compact) {
    const row = w.addStack();
    row.centerAlignContent();
    row.spacing = compact ? 9 : 14;
    const one = (sym, n, url, warn) => {
        const s = row.addStack();
        s.centerAlignContent();
        s.spacing = 3;
        if (url && tappable()) s.url = url;
        icon(s, sym, compact ? 11 : 12, warn ? C.late : C.accent);
        text(s, n == null ? '–' : n, compact ? 12 : 13, C.text, 'semibold');
    };
    if (d.mail) one('envelope.fill', d.mail.unread, d.links.mail);
    one('checklist', tasksDue(d), d.links.tasks, d.tasks.overdue > 0);
    if (!compact && d.chat != null) one('bubble.left.and.bubble.right.fill', d.chat, d.links.chat);
    if (!compact && d.planner) one('rectangle.split.3x1.fill', d.planner, d.links.planner);
    return row;
}
function eventRow(stack, e, d, size) {
    const row = stack.addStack();
    row.centerAlignContent();
    row.spacing = 6;
    if (tappable()) row.url = d.links.calendar;
    const bar = row.addStack();
    bar.size = new Size(3, size + 5);
    bar.cornerRadius = 1.5;
    bar.backgroundColor = new Color(e.color || '#4c8dff');
    const when = `${e.day === d.date ? '' : `${dayLabel(e.day, d)} `}${e.allDay ? 'All day' : e.at}`;
    text(row, when, size - 1, C.dim, 'semibold');
    text(row, e.title, size, C.text, 'semibold');
    return row;
}
function agenda(stack, d, max, size) {
    if (!d.events.length) return text(stack, 'Nothing planned this week', size, C.dim, 'medium');
    d.events.slice(0, max).forEach(e => eventRow(stack, e, d, size));
    if (d.events.length > max) text(stack, `+${d.events.length - max} more`, size - 2, C.faint);
}
function taskList(stack, d, max, size) {
    if (!d.tasks.list.length) {
        const s = stack.addStack();
        s.centerAlignContent();
        s.spacing = 4;
        icon(s, 'checkmark.circle.fill', size, C.good);
        text(s, d.tasks.open ? 'Nothing due' : 'All done', size, C.dim, 'medium');
        return;
    }
    d.tasks.list.slice(0, max).forEach(t => {
        const s = stack.addStack();
        s.centerAlignContent();
        s.spacing = 5;
        if (tappable()) s.url = d.links.tasks;
        icon(s, t.late ? 'exclamationmark.circle' : t.starred && !t.today ? 'star' : 'circle', size - 1, t.late ? C.late : C.accent);
        text(s, t.text, size, C.text, 'medium');
    });
}
function section(stack, title) {
    text(stack, title.toUpperCase(), 9, C.faint, 'bold');
}
function mailBig(w, d) {
    const s = w.addStack();
    s.centerAlignContent();
    s.spacing = 6;
    icon(s, 'envelope.fill', 18, C.accent);
    text(s, d.mail ? d.mail.unread : '–', 30, C.text, 'bold');
    text(w, d.mail ? (d.mail.unread === 1 ? 'unread message' : 'unread messages') : 'Open Mail once to count', 11, C.dim, 'medium', 2);
    if (d.mail && Date.now() - d.mail.at > 60 * 60 * 1000) text(w, `as of ${fmt(new Date(d.mail.at), 'EEE HH:mm')}`, 9, C.faint);
}

/* ---------- the sizes ---------- */
function small(d) {
    const w = base(param === 'tasks' ? d.links.tasks : param === 'mail' ? d.links.mail : d.links.calendar);
    w.setPadding(14, 14, 12, 14);
    header(w, d, dayLabel(d.date, d, true));
    w.addSpacer(7);
    if (param === 'mail') mailBig(w, d);
    else if (param === 'tasks') {
        section(w, `Tasks · ${tasksDue(d)} due`);
        w.addSpacer(4);
        const s = w.addStack();
        s.layoutVertically();
        s.spacing = 4;
        taskList(s, d, 3, 12);
    } else {
        const next = d.events.find(e => !e.allDay) || d.events[0];
        if (next) {
            text(w, `${next.day === d.date ? '' : `${dayLabel(next.day, d)} · `}${next.allDay ? 'All day' : next.at}`, 11, C.accent, 'semibold');
            text(w, next.title, 15, C.text, 'bold', 2);
            if (next.location) text(w, next.location, 10, C.faint);
        } else text(w, 'Nothing planned', 14, C.dim, 'semibold', 2);
    }
    w.addSpacer();
    counts(w, d, true);
    return w;
}
function medium(d) {
    const w = base(d.links.home);
    w.setPadding(14, 15, 12, 15);
    header(w, d, `${dayLabel(d.date, d, true)} · ${d.name}`);
    w.addSpacer(8);
    const body = w.addStack();
    body.topAlignContent();
    const left = body.addStack();
    left.layoutVertically();
    left.spacing = 5;
    if (param === 'tasks') taskList(left, d, 4, 12);
    else if (param === 'mail') mailBig(left, d);
    else agenda(left, d, 4, 12);
    if (!param) {
        body.addSpacer(12);
        const right = body.addStack();
        right.layoutVertically();
        right.spacing = 5;
        right.size = new Size(112, 0);
        section(right, 'Tasks');
        taskList(right, d, 3, 11);
    }
    body.addSpacer();
    w.addSpacer();
    counts(w, d, false);
    return w;
}
function large(d) {
    const w = base(d.links.home);
    w.setPadding(16, 16, 14, 16);
    header(w, d, `${dayLabel(d.date, d, true)} · ${d.name}`);
    w.addSpacer(10);
    if (param !== 'tasks' && param !== 'mail') {
        section(w, 'Agenda');
        w.addSpacer(5);
        const a = w.addStack();
        a.layoutVertically();
        a.spacing = 6;
        agenda(a, d, param === 'agenda' ? 11 : 7, 13);
        w.addSpacer(12);
    }
    if (param !== 'agenda' && param !== 'mail') {
        section(w, `Tasks · ${tasksDue(d)} due`);
        w.addSpacer(5);
        const t = w.addStack();
        t.layoutVertically();
        t.spacing = 6;
        taskList(t, d, param === 'tasks' ? 10 : 4, 13);
    }
    if (param === 'mail') mailBig(w, d);
    w.addSpacer();
    if (d.news && d.news.title && !param) {
        const n = w.addStack();
        n.spacing = 5;
        n.centerAlignContent();
        icon(n, 'megaphone.fill', 11, C.accent);
        text(n, d.news.title, 11, C.dim, 'medium');
        w.addSpacer(8);
    }
    counts(w, d, false);
    return w;
}
// lock screen (iOS 16 and later): drawn in one colour by iOS
function circular(d) {
    const w = new ListWidget();
    w.addAccessoryWidgetBackground = true;
    w.url = param === 'tasks' ? d.links.tasks : d.links.mail;
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    const s = w.addStack();
    s.layoutVertically();
    s.centerAlignContent();
    const top = s.addStack();
    top.addSpacer();
    icon(top, param === 'tasks' || !d.mail ? 'checklist' : 'envelope.fill', 12, Color.white());
    top.addSpacer();
    const mid = s.addStack();
    mid.addSpacer();
    text(mid, param === 'tasks' || !d.mail ? tasksDue(d) : d.mail.unread, 18, Color.white(), 'bold');
    mid.addSpacer();
    return w;
}
function rectangular(d) {
    const w = new ListWidget();
    w.url = d.links.calendar;
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    const next = d.events.find(e => !e.allDay) || d.events[0];
    if (param === 'tasks') {
        text(w, `${tasksDue(d)} tasks due`, 13, Color.white(), 'bold');
        d.tasks.list.slice(0, 2).forEach(t => text(w, t.text, 12, Color.white(), 'medium'));
        return w;
    }
    if (next) {
        text(w, `${next.day === d.date ? '' : `${dayLabel(next.day, d)} `}${next.allDay ? 'All day' : next.at}`, 12, Color.white(), 'semibold');
        text(w, next.title, 14, Color.white(), 'bold');
    } else text(w, 'Nothing planned', 14, Color.white(), 'bold');
    const bits = [];
    if (d.mail) bits.push(`${d.mail.unread} unread`);
    bits.push(`${tasksDue(d)} tasks`);
    text(w, bits.join(' · '), 11, Color.white(), 'medium');
    return w;
}
function inline(d) {
    const w = new ListWidget();
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    const next = d.events.find(e => !e.allDay && e.day === d.date);
    const t = param === 'mail' && d.mail ? `${d.mail.unread} unread` : next && param !== 'tasks' ? `${next.at} ${next.title}` : `${tasksDue(d)} tasks due${d.mail ? ` · ${d.mail.unread} unread` : ''}`;
    w.addText(t);
    return w;
}
function problem(message) {
    const w = base();
    if (family.startsWith('accessory')) {
        w.addText('EderveenGroup: check the widget');
        return w;
    }
    w.setPadding(14, 14, 14, 14);
    header(w, {}, 'EderveenGroup');
    w.addSpacer(6);
    text(w, message, 12, C.dim, 'medium', 5);
    w.addSpacer();
    return w;
}
function build(d) {
    if (d.error) return problem(d.error);
    const make = { small, medium, large, extraLarge: large, accessoryCircular: circular, accessoryRectangular: rectangular, accessoryInline: inline }[family] || medium;
    return make(d);
}

/* ---------- run ---------- */
const data = await load();
if (config.runsInWidget) {
    Script.setWidget(build(data));
} else {
    // opened in Scriptable itself: show a preview
    const pick = new Alert();
    pick.title = 'EderveenGroup widget';
    pick.message = data.error || 'Which size would you like to see?';
    ['Small', 'Medium', 'Large'].forEach(x => pick.addAction(x));
    pick.addCancelAction('Close');
    const i = await pick.presentSheet();
    if (i >= 0) {
        family = ['small', 'medium', 'large'][i];
        const w = build(data);
        if (i === 0) await w.presentSmall();
        else if (i === 1) await w.presentMedium();
        else await w.presentLarge();
    }
}
Script.complete();
