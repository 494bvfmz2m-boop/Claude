// __TITLE__: an EderveenGroup widget, for Scriptable (a free iPhone app: scriptable.app)
//
// Home screen: hold an empty spot → Edit → Add Widget → Scriptable → pick a size → Add Widget.
// Then hold the new widget → Edit Widget → Script: __SCRIPT__.
// Lock screen: hold the lock screen → Customize → Lock Screen → tap the widget area → Scriptable.
// __PARAM__
//
// This script has a private link to your EderveenGroup in it: don't share it. Made on
// EderveenGroup → Widgets, where you can also make a new link (this one then stops working).

const KIND = '__KIND__';
const FEED = '__FEED__';
const SITE = '__SITE__';

const C = {
    text: new Color('#f3f6ff'),
    dim: new Color('#c7d0e6', 0.78),
    faint: new Color('#c7d0e6', 0.5),
    accent: new Color('#6ea8ff'),
    late: new Color('#ff8f8f'),
    good: new Color('#7ee2b8'),
    ink: new Color('#1f2937'),
    inkDim: new Color('#1f2937', 0.7)
};
let A = C.accent; // this widget's own colour
let family = config.widgetFamily || 'medium';
const param = String(args.widgetParameter || '').trim();
const MAKERS = {};
const REFRESH = () => new Date(Date.now() + 15 * 60 * 1000);

/* ---------- the data: fresh from EderveenGroup, or the last copy when offline ---------- */
async function load() {
    const fm = FileManager.local();
    const file = fm.joinPath(fm.cacheDirectory(), `ederveengroup-${KIND}.json`);
    let tz = 'UTC';
    try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
        tz = 'UTC';
    }
    try {
        const req = new Request(`${FEED}?kind=${KIND}&tz=${encodeURIComponent(tz)}`);
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
const pad = n => String(n).padStart(2, '0');
const isoDay = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
const dateOf = day => new Date(`${day}T12:00:00`);
const todayIso = () => isoDay(new Date());
function addDays(day, n) {
    const t = dateOf(day);
    t.setDate(t.getDate() + n);
    return isoDay(t);
}
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
function fmt(date, pattern) {
    const f = new DateFormatter();
    f.locale = 'en_GB';
    f.dateFormat = pattern;
    return f.string(date);
}
function dayLabel(day, d, long) {
    const today = (d && d.date) || todayIso();
    if (!long && day === today) return 'Today';
    if (!long && day === addDays(today, 1)) return 'Tomorrow';
    return fmt(dateOf(day), long ? 'EEE d MMM' : 'EEE');
}
function font(size, weight) {
    if (weight === 'bold') return Font.boldSystemFont(size);
    if (weight === 'heavy') return Font.heavySystemFont(size);
    if (weight === 'semibold') return Font.semiboldSystemFont(size);
    if (weight === 'medium') return Font.mediumSystemFont(size);
    if (weight === 'round') return Font.boldRoundedSystemFont(size);
    return Font.systemFont(size);
}
function text(stack, value, size, color, weight, lines = 1) {
    const t = stack.addText(String(value));
    t.font = font(size, weight);
    t.textColor = color || C.text;
    t.lineLimit = lines;
    t.minimumScaleFactor = 0.7;
    return t;
}
function icon(stack, name, size, color) {
    const sym = SFSymbol.named(name);
    if (!sym) return null;
    sym.applyFont(Font.systemFont(size));
    const img = stack.addImage(sym.image);
    img.imageSize = new Size(size, size);
    img.tintColor = color || A;
    return img;
}
const tappable = () => family === 'medium' || family === 'large' || family === 'extraLarge';
const lockScreen = () => family.startsWith('accessory');
function gradient(top, bottom) {
    const g = new LinearGradient();
    g.colors = [new Color(top), new Color(bottom)];
    g.locations = [0, 1];
    g.startPoint = new Point(0, 0);
    g.endPoint = new Point(1, 1);
    return g;
}
function base(url, top = '#16203d', bottom = '#06080f') {
    const w = new ListWidget();
    if (!lockScreen()) w.backgroundGradient = gradient(top, bottom);
    w.url = url || `${SITE}/`;
    w.refreshAfterDate = REFRESH();
    return w;
}
function header(w, label, sym) {
    const h = w.addStack();
    h.centerAlignContent();
    if (sym) icon(h, sym, 11, A);
    else {
        const mark = h.addStack();
        mark.size = new Size(8, 8);
        mark.cornerRadius = 4;
        mark.backgroundColor = A;
    }
    h.addSpacer(5);
    text(h, label, 11, C.dim, 'semibold');
    h.addSpacer();
    return h;
}
function offline(w, d) {
    if (!d.offline) return;
    const s = w.addStack();
    s.addSpacer();
    icon(s, 'wifi.slash', 9, C.faint);
}
const column = (parent, spacing = 4) => {
    const s = parent.addStack();
    s.layoutVertically();
    s.spacing = spacing;
    return s;
};
const row = (parent, spacing = 5) => {
    const s = parent.addStack();
    s.centerAlignContent();
    s.spacing = spacing;
    return s;
};
function centered(parent, fill) {
    const r = parent.addStack();
    r.addSpacer();
    fill(r);
    r.addSpacer();
    return r;
}
function section(stack, title, color) {
    text(stack, title.toUpperCase(), 9, color || C.faint, 'bold');
}
// a ring that fills up, drawn as an image
function ring(fraction, size, color, width = 7, track) {
    const dc = new DrawContext();
    dc.size = new Size(size, size);
    dc.opaque = false;
    dc.respectScreenScale = true;
    const r = size / 2 - width / 2 - 1;
    const c = size / 2;
    const arc = (to, col) => {
        const p = new Path();
        const steps = Math.max(3, Math.ceil(to * 90));
        for (let i = 0; i <= steps; i++) {
            const a = -Math.PI / 2 + 2 * Math.PI * to * (i / steps);
            const pt = new Point(c + r * Math.cos(a), c + r * Math.sin(a));
            if (i === 0) p.move(pt);
            else p.addLine(pt);
        }
        dc.addPath(p);
        dc.setStrokeColor(col);
        dc.setLineWidth(width);
        dc.strokePath();
    };
    arc(1, track || new Color('#ffffff', 0.14));
    const f = Math.max(0, Math.min(1, fraction));
    if (f > 0.002) {
        arc(f, color);
        // a round end
        const a = -Math.PI / 2 + 2 * Math.PI * f;
        dc.setFillColor(color);
        dc.fillEllipse(new Rect(c + r * Math.cos(a) - width / 2, c + r * Math.sin(a) - width / 2, width, width));
        dc.fillEllipse(new Rect(c - width / 2, c - r - width / 2, width, width));
    }
    return dc.getImage();
}
// a ring with something in the middle
function ringWith(parent, fraction, size, color, big, small, width) {
    const s = parent.addStack();
    s.size = new Size(size, size);
    s.backgroundImage = ring(fraction, size, color, width);
    s.layoutVertically();
    s.centerAlignContent();
    s.addSpacer();
    centered(s, r => text(r, big, size * 0.27, C.text, 'round'));
    if (small) centered(s, r => text(r, small, Math.max(8, size * 0.1), C.dim, 'semibold'));
    s.addSpacer();
    return s;
}
// bars, oldest first, with a label under each
function bars(values, labels, width, height, color) {
    const dc = new DrawContext();
    dc.size = new Size(width, height);
    dc.opaque = false;
    dc.respectScreenScale = true;
    const n = values.length;
    const gap = 6;
    const bw = (width - gap * (n - 1)) / n;
    const top = Math.max(1, ...values);
    const room = height - 14;
    values.forEach((v, i) => {
        const h = Math.max(3, (v / top) * room);
        const x = i * (bw + gap);
        const p = new Path();
        p.addRoundedRect(new Rect(x, room - h, bw, h), 3, 3);
        dc.addPath(p);
        dc.setFillColor(i === n - 1 ? color : new Color('#ffffff', v ? 0.35 : 0.12));
        dc.fillPath();
        dc.setFont(Font.semiboldSystemFont(9));
        dc.setTextColor(new Color('#c7d0e6', 0.7));
        dc.setTextAlignedCenter();
        dc.drawTextInRect(labels[i], new Rect(x - 4, room + 2, bw + 8, 12));
    });
    return dc.getImage();
}
function problem(message) {
    const w = base();
    if (lockScreen()) {
        w.addText('EderveenGroup: check the widget');
        return w;
    }
    w.setPadding(14, 14, 14, 14);
    header(w, 'EderveenGroup');
    w.addSpacer(6);
    text(w, message, 12, C.dim, 'medium', 5);
    w.addSpacer();
    return w;
}
const tasksDue = d => d.tasks.today + d.tasks.overdue;
function eventRow(stack, e, d, size) {
    const r = row(stack, 6);
    if (tappable()) r.url = d.links.calendar;
    const bar = r.addStack();
    bar.size = new Size(3, size + 5);
    bar.cornerRadius = 1.5;
    bar.backgroundColor = new Color(e.color || '#4c8dff');
    text(r, `${e.day === d.date ? '' : `${dayLabel(e.day, d)} `}${e.allDay ? 'All day' : e.at}`, size - 1, C.dim, 'semibold');
    text(r, e.title, size, C.text, 'semibold');
    return r;
}
function agenda(stack, d, max, size) {
    if (!d.events.length) return text(stack, 'Nothing planned', size, C.dim, 'medium');
    d.events.slice(0, max).forEach(e => eventRow(stack, e, d, size));
    if (d.events.length > max) text(stack, `+${d.events.length - max} more`, size - 2, C.faint);
}
function taskRows(stack, d, max, size) {
    if (!d.tasks.list.length) {
        const s = row(stack, 4);
        icon(s, 'checkmark.circle.fill', size, C.good);
        text(s, d.tasks.open ? 'Nothing due' : 'All done', size, C.dim, 'medium');
        return;
    }
    d.tasks.list.slice(0, max).forEach(t => {
        const s = row(stack, 5);
        if (tappable()) s.url = d.links.tasks;
        icon(s, t.late ? 'exclamationmark.circle' : t.starred && !t.today ? 'star' : 'circle', size - 1, t.late ? C.late : A);
        text(s, t.text, size, C.text, 'medium');
    });
}
const nextTimed = d => d.events.find(e => !e.allDay && e.ts > Date.now() - 60 * 1000);

/*@kind:overview*/
MAKERS.overview = {
    feed: true,
    small(d) {
        const w = base(d.links.calendar);
        w.setPadding(14, 14, 12, 14);
        header(w, dayLabel(d.date, d, true));
        w.addSpacer(7);
        const next = d.events.find(e => !e.allDay) || d.events[0];
        if (next) {
            text(w, `${next.day === d.date ? '' : `${dayLabel(next.day, d)} · `}${next.allDay ? 'All day' : next.at}`, 11, A, 'semibold');
            text(w, next.title, 15, C.text, 'bold', 2);
        } else text(w, 'Nothing planned', 14, C.dim, 'semibold', 2);
        w.addSpacer();
        this.counts(w, d, true);
        return w;
    },
    medium(d) {
        const w = base(d.links.home);
        w.setPadding(14, 15, 12, 15);
        header(w, `${dayLabel(d.date, d, true)} · ${d.name}`);
        w.addSpacer(8);
        const body = w.addStack();
        body.topAlignContent();
        agenda(column(body, 5), d, 4, 12);
        body.addSpacer(12);
        const right = column(body, 5);
        right.size = new Size(112, 0);
        section(right, 'Tasks');
        taskRows(right, d, 3, 11);
        body.addSpacer();
        w.addSpacer();
        this.counts(w, d, false);
        return w;
    },
    large(d) {
        const w = base(d.links.home);
        w.setPadding(16, 16, 14, 16);
        header(w, `${dayLabel(d.date, d, true)} · ${d.name}`);
        w.addSpacer(10);
        section(w, 'Agenda');
        w.addSpacer(5);
        agenda(column(w, 6), d, 7, 13);
        w.addSpacer(12);
        section(w, `Tasks · ${tasksDue(d)} due`);
        w.addSpacer(5);
        taskRows(column(w, 6), d, 4, 13);
        w.addSpacer();
        if (d.news && d.news.title) {
            const n = row(w, 5);
            icon(n, 'megaphone.fill', 11, A);
            text(n, d.news.title, 11, C.dim, 'medium');
            w.addSpacer(8);
        }
        this.counts(w, d, false);
        return w;
    },
    counts(w, d, compact) {
        const r = row(w, compact ? 9 : 14);
        const one = (sym, n, url, warn) => {
            const s = row(r, 3);
            if (url && tappable()) s.url = url;
            icon(s, sym, compact ? 11 : 12, warn ? C.late : A);
            text(s, n == null ? '–' : n, compact ? 12 : 13, C.text, 'semibold');
        };
        if (d.mail) one('envelope.fill', d.mail.unread, d.links.mail);
        one('checklist', tasksDue(d), d.links.tasks, d.tasks.overdue > 0);
        if (!compact && d.chat != null) one('bubble.left.and.bubble.right.fill', d.chat, d.links.chat);
        if (!compact && d.planner) one('rectangle.split.3x1.fill', d.planner, d.links.planner);
    },
    rectangular(d) {
        const w = base(d.links.calendar);
        const next = d.events.find(e => !e.allDay) || d.events[0];
        text(w, next ? `${next.day === d.date ? '' : `${dayLabel(next.day, d)} `}${next.allDay ? 'All day' : next.at}` : 'Today', 12, Color.white(), 'semibold');
        text(w, next ? next.title : 'Nothing planned', 14, Color.white(), 'bold');
        text(w, `${d.mail ? `${d.mail.unread} unread · ` : ''}${tasksDue(d)} tasks`, 11, Color.white(), 'medium');
        return w;
    },
    inline(d) {
        const w = base(d.links.home);
        const next = d.events.find(e => !e.allDay && e.day === d.date);
        w.addText(next ? `${next.at} ${next.title}` : `${tasksDue(d)} tasks due${d.mail ? ` · ${d.mail.unread} unread` : ''}`);
        return w;
    },
    circular(d) {
        return lockNumber(d.links.mail, d.mail ? 'envelope.fill' : 'checklist', d.mail ? d.mail.unread : tasksDue(d));
    }
};
/*@end*/

/*@kind:calendar*/
MAKERS.calendar = {
    feed: true,
    theme: ['#2a1426', '#0b070c', '#ff6b6b'],
    // the date, big, the way the phone's own calendar shows it
    dateBlock(stack, d, big) {
        const s = column(stack, 0);
        text(s, fmt(dateOf(d.date), 'EEEE').toUpperCase(), big ? 11 : 10, A, 'bold');
        text(s, String(+d.date.slice(8)), big ? 40 : 34, C.text, 'round');
        return s;
    },
    small(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(13, 14, 12, 14);
        this.dateBlock(w, d);
        w.addSpacer(4);
        const next = d.events.find(e => e.day === d.date) || d.events[0];
        if (next) {
            const r = row(w, 5);
            const bar = r.addStack();
            bar.size = new Size(3, 26);
            bar.cornerRadius = 1.5;
            bar.backgroundColor = new Color(next.color);
            const c = column(r, 0);
            text(c, next.title, 12, C.text, 'semibold');
            text(c, `${next.day === d.date ? '' : `${dayLabel(next.day, d)} `}${next.allDay ? 'All day' : next.at}`, 10, C.dim, 'medium');
        } else text(w, 'No events', 12, C.dim, 'medium');
        w.addSpacer();
        return w;
    },
    medium(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 15, 12, 15);
        const body = w.addStack();
        body.topAlignContent();
        const left = column(body, 2);
        left.size = new Size(92, 0);
        this.dateBlock(left, d, true);
        const n = d.events.filter(e => e.day === d.date).length;
        text(left, n ? `${n} today` : 'Free today', 11, C.dim, 'semibold');
        body.addSpacer(10);
        const right = column(body, 6);
        agenda(right, d, 5, 12);
        body.addSpacer();
        w.addSpacer();
        offline(w, d);
        return w;
    },
    large(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 16, 12, 16);
        const top = row(w, 8);
        text(top, fmt(dateOf(d.date), 'MMMM'), 15, A, 'bold');
        text(top, d.date.slice(0, 4), 15, C.dim, 'semibold');
        top.addSpacer();
        w.addSpacer(6);
        this.month(w, d);
        w.addSpacer(10);
        section(w, 'Coming up', A);
        w.addSpacer(4);
        agenda(column(w, 5), d, 4, 12);
        w.addSpacer();
        return w;
    },
    // this month, Monday first, today circled, a dot where something is planned
    month(w, d) {
        const first = d.month ? d.month.first : `${d.date.slice(0, 8)}01`;
        const counts = (d.month && d.month.days) || {};
        const lead = (dateOf(first).getDay() + 6) % 7;
        const len = new Date(+first.slice(0, 4), +first.slice(5, 7), 0).getDate();
        const cw = 40;
        const names = w.addStack();
        names.spacing = 4;
        ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((n, i) => {
            const c = names.addStack();
            c.size = new Size(cw, 13);
            c.addSpacer();
            text(c, n, 9, i > 4 ? C.faint : C.dim, 'bold');
            c.addSpacer();
        });
        const grid = column(w, 2);
        for (let start = 0; start < lead + len; start += 7) {
            const r = grid.addStack();
            r.spacing = 4;
            for (let i = start; i < start + 7; i++) {
                const cell = r.addStack();
                cell.size = new Size(cw, 24);
                cell.layoutVertically();
                const num = i - lead + 1;
                if (num < 1 || num > len) continue;
                const day = `${first.slice(0, 8)}${pad(num)}`;
                const isToday = day === d.date;
                const top = cell.addStack();
                top.addSpacer();
                const n = top.addStack();
                n.size = new Size(20, 18);
                n.cornerRadius = 9;
                if (isToday) n.backgroundColor = A;
                n.addSpacer();
                text(n, num, 11, isToday ? Color.white() : day < d.date ? C.faint : C.text, isToday ? 'bold' : 'medium');
                n.addSpacer();
                top.addSpacer();
                const dot = cell.addStack();
                dot.addSpacer();
                const dd = dot.addStack();
                dd.size = new Size(4, 4);
                dd.cornerRadius = 2;
                if (counts[day]) dd.backgroundColor = day < d.date ? C.faint : A;
                dot.addSpacer();
            }
        }
    },
    rectangular(d) {
        const w = base(d.links.calendar);
        const next = d.events.find(e => e.day === d.date && !e.allDay) || d.events[0];
        text(w, fmt(dateOf(d.date), 'EEEE d MMM'), 12, Color.white(), 'semibold');
        text(w, next ? next.title : 'No events', 14, Color.white(), 'bold');
        if (next) text(w, `${next.day === d.date ? '' : `${dayLabel(next.day, d)} `}${next.allDay ? 'All day' : next.at}${next.location ? ` · ${next.location}` : ''}`, 11, Color.white(), 'medium');
        return w;
    },
    inline(d) {
        const w = base(d.links.calendar);
        const next = d.events.find(e => e.day === d.date && !e.allDay);
        w.addText(next ? `${next.at} ${next.title}` : `${fmt(dateOf(d.date), 'EEE d MMM')} · no more events`);
        return w;
    },
    circular(d) {
        const w = base(d.links.calendar);
        w.addAccessoryWidgetBackground = true;
        const s = column(w, 0);
        centered(s, r => text(r, fmt(dateOf(d.date), 'EEE').toUpperCase(), 10, Color.white(), 'bold'));
        centered(s, r => text(r, +d.date.slice(8), 22, Color.white(), 'round'));
        return w;
    }
};
/*@end*/

/*@kind:tasks*/
MAKERS.tasks = {
    feed: true,
    theme: ['#0f2a24', '#050f0c', '#34d399'],
    // how far today is done: what you ticked off against what's still due
    fraction: d => (d.tasks.doneToday + tasksDue(d) ? d.tasks.doneToday / (d.tasks.doneToday + tasksDue(d)) : 1),
    small(d) {
        const w = base(d.links.tasks, ...this.theme);
        w.setPadding(12, 12, 12, 12);
        header(w, 'Tasks', 'checklist');
        w.addSpacer();
        centered(w, r => ringWith(r, this.fraction(d), 82, A, tasksDue(d), tasksDue(d) === 1 ? 'to do' : 'to do', 9));
        w.addSpacer();
        centered(w, r => text(r, d.tasks.doneToday ? `${d.tasks.doneToday} done today` : d.tasks.overdue ? `${d.tasks.overdue} late` : 'Nice and calm', 10, d.tasks.overdue && !d.tasks.doneToday ? C.late : C.dim, 'semibold'));
        return w;
    },
    medium(d) {
        const w = base(d.links.tasks, ...this.theme);
        w.setPadding(14, 14, 12, 15);
        const body = w.addStack();
        body.centerAlignContent();
        const left = column(body, 4);
        ringWith(left, this.fraction(d), 88, A, tasksDue(d), 'to do', 9);
        body.addSpacer(14);
        const right = column(body, 5);
        section(right, d.tasks.overdue ? `${d.tasks.overdue} late · ${d.tasks.today} today` : `${d.tasks.today} today · ${d.tasks.open} open`, d.tasks.overdue ? C.late : A);
        taskRows(right, d, 5, 12);
        body.addSpacer();
        return w;
    },
    large(d) {
        const w = base(d.links.tasks, ...this.theme);
        w.setPadding(16, 16, 14, 16);
        const top = w.addStack();
        top.centerAlignContent();
        ringWith(top, this.fraction(d), 64, A, tasksDue(d), null, 7);
        top.addSpacer(12);
        const t = column(top, 1);
        text(t, 'Tasks', 18, C.text, 'bold');
        text(t, `${d.tasks.doneToday} done today · ${d.tasks.open} open`, 11, C.dim, 'semibold');
        top.addSpacer();
        w.addSpacer(12);
        taskRows(column(w, 6), d, 8, 13);
        w.addSpacer();
        section(w, 'Done this week', A);
        w.addSpacer(4);
        const img = w.addImage(bars(d.tasks.week.map(x => x.done), d.tasks.week.map(x => fmt(dateOf(x.day), 'EEEEE')), 300, 58, A));
        img.imageSize = new Size(300, 58);
        return w;
    },
    rectangular(d) {
        const w = base(d.links.tasks);
        text(w, `${tasksDue(d)} to do${d.tasks.overdue ? ` · ${d.tasks.overdue} late` : ''}`, 13, Color.white(), 'bold');
        d.tasks.list.slice(0, 2).forEach(t => text(w, `○ ${t.text}`, 12, Color.white(), 'medium'));
        if (!d.tasks.list.length) text(w, 'Nothing due', 12, Color.white(), 'medium');
        return w;
    },
    inline(d) {
        const w = base(d.links.tasks);
        w.addText(`${tasksDue(d)} tasks to do${d.tasks.doneToday ? ` · ${d.tasks.doneToday} done` : ''}`);
        return w;
    },
    circular(d) {
        const w = base(d.links.tasks);
        w.addAccessoryWidgetBackground = true;
        const s = w.addStack();
        s.size = new Size(60, 60);
        s.backgroundImage = ring(this.fraction(d), 60, Color.white(), 6, new Color('#ffffff', 0.3));
        s.addSpacer();
        text(s, tasksDue(d), 20, Color.white(), 'round');
        s.addSpacer();
        return w;
    }
};
/*@end*/

/*@kind:notes*/
MAKERS.notes = {
    feed: true,
    theme: ['#2a2416', '#0e0c07', '#f5c542'],
    // the note asked for in Parameter (part of its title), or the pinned ones, newest first
    pick(d) {
        const q = param.toLowerCase();
        const found = q ? d.notes.filter(n => `${n.title} ${n.text}`.toLowerCase().includes(q)) : [];
        return found.length ? found.concat(d.notes.filter(n => !found.includes(n))) : d.notes;
    },
    card(parent, n, w, h, big) {
        const c = parent.addStack();
        c.layoutVertically();
        c.size = new Size(w, h);
        c.cornerRadius = 14;
        c.backgroundColor = new Color(n.color);
        c.setPadding(9, 10, 9, 10);
        const t = row(c, 3);
        if (n.pinned) icon(t, 'pin.fill', 9, C.inkDim);
        text(t, n.title || 'Note', big ? 14 : 12, C.ink, 'bold', 2);
        c.addSpacer(3);
        text(c, n.text || ' ', big ? 12 : 10, C.inkDim, 'medium', big ? 8 : 4);
        c.addSpacer();
        return c;
    },
    empty(w) {
        text(w, 'No notes yet', 14, C.dim, 'bold');
        text(w, 'Write one in Notes on EderveenGroup', 11, C.faint, 'medium', 2);
    },
    small(d) {
        const notes = this.pick(d);
        if (!notes.length) {
            const w = base(d.links.notes, ...this.theme);
            this.empty(w);
            return w;
        }
        const n = notes[0];
        const w = new ListWidget();
        w.url = d.links.notes;
        w.refreshAfterDate = REFRESH();
        w.backgroundColor = new Color(n.color);
        w.setPadding(14, 14, 12, 14);
        const t = row(w, 4);
        if (n.pinned) icon(t, 'pin.fill', 10, C.inkDim);
        text(t, n.title || 'Note', 15, C.ink, 'bold', 2);
        w.addSpacer(4);
        text(w, n.text || ' ', 11, C.inkDim, 'medium', 6);
        w.addSpacer();
        return w;
    },
    medium(d) {
        const w = base(d.links.notes, ...this.theme);
        w.setPadding(12, 12, 12, 12);
        const notes = this.pick(d);
        if (!notes.length) {
            this.empty(w);
            return w;
        }
        const r = w.addStack();
        r.spacing = 10;
        r.addSpacer();
        notes.slice(0, 2).forEach(n => this.card(r, n, 150, 142));
        r.addSpacer();
        return w;
    },
    large(d) {
        const w = base(d.links.notes, ...this.theme);
        w.setPadding(14, 14, 14, 14);
        header(w, `Notes · ${d.noteCount}`, 'note.text');
        w.addSpacer(8);
        const notes = this.pick(d);
        if (!notes.length) {
            this.empty(w);
            return w;
        }
        const grid = column(w, 10);
        for (let i = 0; i < Math.min(4, notes.length); i += 2) {
            const r = grid.addStack();
            r.spacing = 10;
            r.addSpacer();
            notes.slice(i, i + 2).forEach(n => this.card(r, n, 148, 140));
            r.addSpacer();
        }
        w.addSpacer();
        return w;
    },
    rectangular(d) {
        const w = base(d.links.notes);
        const n = this.pick(d)[0];
        text(w, n ? n.title || 'Note' : 'No notes', 13, Color.white(), 'bold');
        if (n) text(w, n.text, 11, Color.white(), 'medium', 2);
        return w;
    },
    inline(d) {
        const w = base(d.links.notes);
        const n = this.pick(d)[0];
        w.addText(n ? `📝 ${n.title || n.text}` : 'No notes');
        return w;
    },
    circular(d) {
        return lockNumber(d.links.notes, 'note.text', d.noteCount);
    }
};
/*@end*/

/*@kind:today*/
MAKERS.today = {
    feed: true,
    // the sky of the moment: dawn, day, evening, night
    sky() {
        const h = new Date().getHours();
        if (h >= 5 && h < 9) return { hello: 'Good morning', top: '#ff9a6b', bottom: '#7b3fa0', accent: '#ffe1a8', sym: 'sunrise.fill' };
        if (h >= 9 && h < 12) return { hello: 'Good morning', top: '#4aa3ff', bottom: '#1f4fb5', accent: '#ffe27a', sym: 'sun.max.fill' };
        if (h >= 12 && h < 18) return { hello: 'Good afternoon', top: '#2f8fff', bottom: '#174a9c', accent: '#ffe27a', sym: 'sun.max.fill' };
        if (h >= 18 && h < 22) return { hello: 'Good evening', top: '#ff7a59', bottom: '#4b1d78', accent: '#ffd0a8', sym: 'sunset.fill' };
        return { hello: 'Good night', top: '#1a2456', bottom: '#05081a', accent: '#c9d6ff', sym: 'moon.stars.fill' };
    },
    // the temperature, if the Weather widget looked lately
    weather() {
        try {
            const fm = FileManager.local();
            const f = fm.joinPath(fm.cacheDirectory(), 'eg-weather.json');
            if (!fm.fileExists(f)) return null;
            const c = JSON.parse(fm.readString(f));
            return Date.now() - c.at < 3 * 3600e3 && c.w && c.w.current ? Math.round(c.w.current.temperature_2m) : null;
        } catch (e) {
            return null;
        }
    },
    small(d) {
        const s = this.sky();
        A = new Color(s.accent);
        const w = base(d.links.home, s.top, s.bottom);
        w.setPadding(14, 14, 12, 14);
        const t = row(w, 5);
        icon(t, s.sym, 16, A);
        const temp = this.weather();
        if (temp != null) text(t, `${temp}°`, 13, C.text, 'semibold');
        w.addSpacer();
        text(w, `${s.hello},`, 13, new Color('#ffffff', 0.85), 'semibold');
        text(w, d.name, 18, Color.white(), 'bold');
        w.addSpacer(4);
        text(w, this.line(d), 10, new Color('#ffffff', 0.8), 'medium', 2);
        return w;
    },
    line(d) {
        const next = d.events.find(e => e.day === d.date && !e.allDay);
        const due = tasksDue(d);
        if (next) return `${next.title} at ${next.at}`;
        if (due) return `${due} task${due === 1 ? '' : 's'} today`;
        return 'Nothing planned. Enjoy!';
    },
    medium(d) {
        const s = this.sky();
        A = new Color(s.accent);
        const w = base(d.links.home, s.top, s.bottom);
        w.setPadding(15, 16, 13, 16);
        const top = row(w, 6);
        icon(top, s.sym, 18, A);
        text(top, fmt(new Date(), 'EEEE d MMMM'), 12, new Color('#ffffff', 0.85), 'semibold');
        top.addSpacer();
        const temp = this.weather();
        if (temp != null) text(top, `${temp}°`, 15, Color.white(), 'bold');
        w.addSpacer(6);
        text(w, `${s.hello}, ${d.name}`, 20, Color.white(), 'bold');
        w.addSpacer();
        const r = row(w, 14);
        const bit = (sym, value, label) => {
            const b = row(r, 4);
            icon(b, sym, 12, A);
            text(b, value, 13, Color.white(), 'bold');
            text(b, label, 11, new Color('#ffffff', 0.75), 'medium');
        };
        const today = d.events.filter(e => e.day === d.date).length;
        bit('calendar', today, today === 1 ? 'event' : 'events');
        bit('checklist', tasksDue(d), 'to do');
        if (d.mail) bit('envelope.fill', d.mail.unread, 'unread');
        w.addSpacer(4);
        text(w, this.line(d), 11, new Color('#ffffff', 0.8), 'medium');
        return w;
    },
    large(d) {
        const s = this.sky();
        A = new Color(s.accent);
        const w = base(d.links.home, s.top, s.bottom);
        w.setPadding(16, 16, 14, 16);
        const top = row(w, 6);
        icon(top, s.sym, 20, A);
        text(top, fmt(new Date(), 'EEEE d MMMM'), 13, new Color('#ffffff', 0.85), 'semibold');
        top.addSpacer();
        const temp = this.weather();
        if (temp != null) text(top, `${temp}°`, 17, Color.white(), 'bold');
        w.addSpacer(8);
        text(w, `${s.hello},`, 18, new Color('#ffffff', 0.85), 'semibold');
        text(w, d.name, 30, Color.white(), 'bold');
        w.addSpacer(14);
        section(w, 'Today', A);
        w.addSpacer(4);
        const todays = d.events.filter(e => e.day === d.date);
        if (todays.length) agenda(column(w, 6), { ...d, events: todays }, 4, 13);
        else text(w, 'Nothing planned. Enjoy!', 13, new Color('#ffffff', 0.85), 'medium');
        w.addSpacer(12);
        section(w, `To do · ${tasksDue(d)}`, A);
        w.addSpacer(4);
        taskRows(column(w, 6), d, 3, 13);
        w.addSpacer();
        if (d.mail) {
            const r = row(w, 4);
            icon(r, 'envelope.fill', 12, A);
            text(r, `${d.mail.unread} unread`, 12, Color.white(), 'semibold');
        }
        return w;
    },
    rectangular(d) {
        const w = base(d.links.home);
        text(w, `${this.sky().hello}, ${d.name}`, 13, Color.white(), 'bold');
        text(w, this.line(d), 12, Color.white(), 'medium', 2);
        return w;
    },
    inline(d) {
        const w = base(d.links.home);
        w.addText(`${this.sky().hello} · ${this.line(d)}`);
        return w;
    },
    circular(d) {
        return lockNumber(d.links.home, this.sky().sym, tasksDue(d));
    }
};
/*@end*/

/*@kind:countdown*/
MAKERS.countdown = {
    feed: true,
    theme: ['#3b1d5c', '#110a22', '#f472b6'],
    // what to count down to: "Holiday|2026-12-24", a date, part of an event's name, or the next all-day event
    target(d) {
        const m = /^(?:(.+?)\s*[|:]\s*)?(\d{4}-\d{2}-\d{2})$/.exec(param);
        if (m) return { title: m[1] || 'The big day', day: m[2] };
        const q = param.toLowerCase();
        const tomorrow = addDays(d.date, 1);
        return (q && d.events.find(e => e.title.toLowerCase().includes(q))) || d.events.find(e => e.allDay && e.day >= tomorrow) || d.events.find(e => e.day >= tomorrow) || null;
    },
    left(d, t) {
        return Math.max(0, daysBetween(d.date, t.day));
    },
    small(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 14, 12, 14);
        const t = this.target(d);
        header(w, 'Countdown', 'hourglass');
        w.addSpacer();
        if (!t) {
            text(w, 'Nothing to count down to', 13, C.dim, 'bold', 3);
            w.addSpacer();
            return w;
        }
        const n = this.left(d, t);
        text(w, n === 0 ? 'Today!' : n, n === 0 ? 30 : 44, C.text, 'round');
        text(w, n === 0 ? '🎉' : n === 1 ? 'day to go' : 'days to go', 11, A, 'bold');
        w.addSpacer(4);
        text(w, t.title, 12, C.text, 'semibold', 2);
        return w;
    },
    medium(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 16, 12, 16);
        const t = this.target(d);
        if (!t) {
            header(w, 'Countdown', 'hourglass');
            w.addSpacer();
            text(w, 'Add an all-day event, or type “Holiday|2026-12-24” as the widget’s Parameter.', 13, C.dim, 'semibold', 3);
            w.addSpacer();
            return w;
        }
        const n = this.left(d, t);
        const body = w.addStack();
        body.centerAlignContent();
        ringWith(body, n === 0 ? 1 : Math.max(0.03, 1 - n / 100), 108, A, n === 0 ? '🎉' : n, n === 0 ? 'today' : n === 1 ? 'day' : 'days', 10);
        body.addSpacer(16);
        const c = column(body, 3);
        section(c, 'Counting down to', A);
        text(c, t.title, 18, C.text, 'bold', 2);
        text(c, fmt(dateOf(t.day), 'EEEE d MMMM yyyy'), 11, C.dim, 'semibold');
        if (n > 13) text(c, `${Math.floor(n / 7)} weeks and ${n % 7} days`, 11, C.faint, 'medium');
        body.addSpacer();
        return w;
    },
    large(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(16, 16, 14, 16);
        header(w, 'Countdown', 'hourglass');
        const t = this.target(d);
        if (!t) {
            w.addSpacer();
            text(w, 'Add an all-day event, or type “Holiday|2026-12-24” as the widget’s Parameter.', 14, C.dim, 'semibold', 3);
            w.addSpacer();
            return w;
        }
        const n = this.left(d, t);
        w.addSpacer(8);
        centered(w, r => ringWith(r, n === 0 ? 1 : Math.max(0.03, 1 - n / 100), 150, A, n === 0 ? '🎉' : n, n === 0 ? 'today!' : n === 1 ? 'day to go' : 'days to go', 12));
        w.addSpacer(8);
        centered(w, r => text(r, t.title, 18, C.text, 'bold'));
        centered(w, r => text(r, fmt(dateOf(t.day), 'EEEE d MMMM yyyy'), 11, C.dim, 'semibold'));
        w.addSpacer();
        const later = d.events.filter(e => e.allDay && e.day > d.date && e.title !== t.title).slice(0, 3);
        if (later.length) {
            section(w, 'Also coming up', A);
            w.addSpacer(4);
            later.forEach(e => {
                const r = row(w, 6);
                text(r, `${this.left(d, e)}d`, 12, A, 'bold');
                text(r, e.title, 12, C.text, 'semibold');
                r.addSpacer();
                text(r, fmt(dateOf(e.day), 'd MMM'), 11, C.faint, 'medium');
                w.addSpacer(3);
            });
        }
        return w;
    },
    rectangular(d) {
        const w = base(d.links.calendar);
        const t = this.target(d);
        if (!t) {
            w.addText('Nothing to count down to');
            return w;
        }
        const n = this.left(d, t);
        text(w, n === 0 ? 'Today!' : `${n} days`, 18, Color.white(), 'round');
        text(w, t.title, 12, Color.white(), 'semibold');
        return w;
    },
    inline(d) {
        const w = base(d.links.calendar);
        const t = this.target(d);
        w.addText(t ? `${this.left(d, t)} days until ${t.title}` : 'Nothing to count down to');
        return w;
    },
    circular(d) {
        const t = this.target(d);
        return lockNumber(d.links.calendar, 'hourglass', t ? this.left(d, t) : '–');
    }
};
/*@end*/

/*@kind:nextup*/
MAKERS.nextup = {
    feed: true,
    theme: ['#0e2a3d', '#05111a', '#38bdf8'],
    // a timer that counts down on its own, to the second, without the widget refreshing
    timer(stack, ts, size, color) {
        const t = stack.addDate(new Date(ts));
        t.applyTimerStyle();
        t.font = Font.boldRoundedSystemFont(size);
        t.textColor = color || C.text;
        t.minimumScaleFactor = 0.6;
        t.lineLimit = 1;
        return t;
    },
    when(e, d) {
        return `${e.day === d.date ? '' : `${dayLabel(e.day, d)} `}${e.at}${e.end ? `–${e.end}` : ''}`;
    },
    small(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 14, 12, 14);
        header(w, 'Next up', 'timer');
        w.addSpacer();
        const e = nextTimed(d);
        if (!e) {
            text(w, 'Nothing coming up', 14, C.dim, 'bold', 2);
            w.addSpacer();
            return w;
        }
        w.refreshAfterDate = new Date(Math.min(e.ts + 60 * 1000, REFRESH().getTime()));
        text(w, 'in', 11, A, 'bold');
        this.timer(w, e.ts, 26, C.text);
        w.addSpacer(4);
        text(w, e.title, 13, C.text, 'semibold', 2);
        text(w, this.when(e, d), 10, C.dim, 'medium');
        return w;
    },
    medium(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(14, 16, 12, 16);
        header(w, 'Next up', 'timer');
        w.addSpacer(6);
        const e = nextTimed(d);
        if (!e) {
            text(w, 'Nothing coming up this week', 15, C.dim, 'bold');
            w.addSpacer();
            return w;
        }
        w.refreshAfterDate = new Date(Math.min(e.ts + 60 * 1000, REFRESH().getTime()));
        const body = w.addStack();
        body.centerAlignContent();
        const left = column(body, 2);
        text(left, e.title, 17, C.text, 'bold', 2);
        text(left, `${this.when(e, d)}${e.location ? ` · ${e.location}` : ''}`, 11, C.dim, 'semibold');
        body.addSpacer(10);
        const right = column(body, 0);
        text(right, 'starts in', 10, A, 'bold');
        this.timer(right, e.ts, 24, C.text);
        body.addSpacer();
        w.addSpacer();
        const after = d.events.filter(x => !x.allDay && x.ts > e.ts)[0];
        if (after) {
            const r = row(w, 5);
            icon(r, 'arrow.turn.down.right', 10, C.faint);
            text(r, `Then ${after.title} · ${this.when(after, d)}`, 11, C.faint, 'medium');
        }
        return w;
    },
    large(d) {
        const w = base(d.links.calendar, ...this.theme);
        w.setPadding(16, 16, 14, 16);
        header(w, 'Next up', 'timer');
        const e = nextTimed(d);
        if (!e) {
            w.addSpacer();
            text(w, 'Nothing coming up this week', 16, C.dim, 'bold');
            w.addSpacer();
            return w;
        }
        w.refreshAfterDate = new Date(Math.min(e.ts + 60 * 1000, REFRESH().getTime()));
        w.addSpacer(8);
        text(w, e.title, 22, C.text, 'bold', 2);
        text(w, `${this.when(e, d)}${e.location ? ` · ${e.location}` : ''}`, 12, C.dim, 'semibold');
        w.addSpacer(6);
        const r = row(w, 6);
        text(r, 'starts in', 12, A, 'bold');
        this.timer(r, e.ts, 30, C.text);
        w.addSpacer(14);
        section(w, 'After that', A);
        w.addSpacer(4);
        d.events.filter(x => !x.allDay && x.ts > e.ts).slice(0, 5).forEach(x => {
            const line = row(w, 6);
            const bar = line.addStack();
            bar.size = new Size(3, 16);
            bar.cornerRadius = 1.5;
            bar.backgroundColor = new Color(x.color);
            text(line, x.title, 12, C.text, 'semibold');
            line.addSpacer();
            const rel = line.addDate(new Date(x.ts));
            rel.applyRelativeStyle();
            rel.font = Font.mediumSystemFont(11);
            rel.textColor = C.dim;
            rel.lineLimit = 1;
            w.addSpacer(4);
        });
        w.addSpacer();
        return w;
    },
    rectangular(d) {
        const w = base(d.links.calendar);
        const e = nextTimed(d);
        if (!e) {
            w.addText('Nothing coming up');
            return w;
        }
        text(w, e.title, 13, Color.white(), 'bold');
        const r = row(w, 4);
        text(r, 'in', 13, Color.white(), 'medium');
        this.timer(r, e.ts, 15, Color.white());
        return w;
    },
    inline(d) {
        const w = base(d.links.calendar);
        const e = nextTimed(d);
        w.addText(e ? `${e.at} ${e.title}` : 'Nothing coming up');
        return w;
    },
    circular(d) {
        const e = nextTimed(d);
        const mins = e ? Math.max(0, Math.round((e.ts - Date.now()) / 60000)) : null;
        return lockNumber(d.links.calendar, 'timer', mins == null ? '–' : mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`);
    }
};
/*@end*/

/*@kind:memories*/
MAKERS.memories = {
    feed: true,
    async all(d) {
        const w = new ListWidget();
        w.url = d.links.photos;
        w.refreshAfterDate = REFRESH();
        w.backgroundColor = new Color('#16161c');
        if (!d.photo) {
            w.setPadding(14, 14, 14, 14);
            header(w, 'Memories', 'photo.on.rectangle');
            w.addSpacer();
            text(w, 'Add photos in Photos on EderveenGroup and they show up here.', 12, C.dim, 'semibold', 4);
            w.addSpacer();
            return w;
        }
        try {
            const req = new Request(d.photo.url);
            req.timeoutInterval = 20;
            w.backgroundImage = await req.loadImage();
        } catch (e) {
            w.backgroundColor = new Color('#2b2b36');
        }
        w.setPadding(12, 12, 10, 12);
        w.addSpacer();
        const label = d.photo.years ? `${d.photo.years} year${d.photo.years === 1 ? '' : 's'} ago today` : 'From your photos';
        const shade = (t, size, weight) => {
            const x = text(w, t, size, Color.white(), weight);
            x.shadowColor = new Color('#000000', 0.75);
            x.shadowRadius = 4;
            x.shadowOffset = new Point(0, 1);
            return x;
        };
        shade(label, family === 'small' ? 13 : 15, 'bold');
        shade(fmt(dateOf(d.photo.day), 'd MMMM yyyy'), 10, 'semibold');
        return w;
    }
};
/*@end*/

/*@kind:weather*/
MAKERS.weather = {
    feed: false,
    // from your phone's location (or "52.07, 5.65" as Parameter), at Open-Meteo: free, no account
    async prepare() {
        const fm = FileManager.local();
        const file = fm.joinPath(fm.cacheDirectory(), 'eg-weather.json');
        const cached = fm.fileExists(file) ? JSON.parse(fm.readString(file)) : null;
        let loc = null;
        const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(param);
        if (m) loc = { latitude: +m[1], longitude: +m[2] };
        if (!loc) {
            try {
                Location.setAccuracyToThreeKilometers();
                loc = await Location.current();
            } catch (e) {
                loc = cached && cached.loc;
            }
        }
        if (!loc) return { error: 'Open this script in Scriptable once and allow your location, or type your place as numbers (like 52.07, 5.65) under Parameter.' };
        const near = cached && cached.loc && Math.abs(cached.loc.latitude - loc.latitude) < 0.05 && Math.abs(cached.loc.longitude - loc.longitude) < 0.05;
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude.toFixed(3)}&longitude=${loc.longitude.toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
            const req = new Request(url);
            req.timeoutInterval = 20;
            const data = await req.loadJSON();
            if (!data || !data.current) throw new Error('no forecast');
            let place = near ? cached.place : '';
            if (!place) {
                try {
                    const g = await Location.reverseGeocode(loc.latitude, loc.longitude);
                    place = (g && g[0] && (g[0].locality || g[0].subAdministrativeArea || g[0].name)) || '';
                } catch (e) {
                    place = '';
                }
            }
            const out = { loc: { latitude: loc.latitude, longitude: loc.longitude }, place, w: data, at: Date.now() };
            fm.writeString(file, JSON.stringify(out));
            return out;
        } catch (e) {
            if (cached && cached.w) return { ...cached, offline: true };
            return { error: 'Can’t get the weather right now.' };
        }
    },
    // WMO weather codes, as words, a symbol and a sky
    look(code, day) {
        const c = Number(code);
        if (c === 0) return day ? ['Clear', 'sun.max.fill', '#3b9cff', '#1a5fbf'] : ['Clear', 'moon.stars.fill', '#1b2a5e', '#070b1f'];
        if (c <= 2) return day ? ['Partly cloudy', 'cloud.sun.fill', '#4a8fd8', '#24508f'] : ['Partly cloudy', 'cloud.moon.fill', '#1f2b52', '#090d1f'];
        if (c === 3) return ['Cloudy', 'cloud.fill', '#66758a', '#323c4a'];
        if (c === 45 || c === 48) return ['Fog', 'cloud.fog.fill', '#7d8794', '#454c56'];
        if (c >= 51 && c <= 57) return ['Drizzle', 'cloud.drizzle.fill', '#4d6378', '#26323f'];
        if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ['Rain', 'cloud.rain.fill', '#3d5368', '#1c2632'];
        if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ['Snow', 'cloud.snow.fill', '#8aa3c2', '#4a6382'];
        if (c >= 95) return ['Thunderstorm', 'cloud.bolt.rain.fill', '#3c3f5c', '#15162a'];
        return ['', 'cloud.fill', '#66758a', '#323c4a'];
    },
    small(d) {
        const cur = d.w.current;
        const [label, , top, bottom] = this.look(cur.weather_code, cur.is_day);
        const w = base(null, top, bottom);
        w.url = 'https://open-meteo.com/';
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(14, 14, 12, 14);
        const head = row(w, 6);
        text(head, d.place || 'Here', 13, Color.white(), 'bold');
        head.addSpacer();
        icon(head, this.look(cur.weather_code, cur.is_day)[1], 18, Color.white());
        text(w, `${Math.round(cur.temperature_2m)}°`, 44, Color.white(), 'round');
        w.addSpacer();
        text(w, label, 12, Color.white(), 'semibold');
        text(w, `H ${Math.round(d.w.daily.temperature_2m_max[0])}°  L ${Math.round(d.w.daily.temperature_2m_min[0])}°`, 11, new Color('#ffffff', 0.8), 'semibold');
        return w;
    },
    days(w, d, n) {
        const r = w.addStack();
        for (let i = 0; i < Math.min(n, d.w.daily.time.length); i++) {
            const c = column(r, 3);
            centered(c, x => text(x, i === 0 ? 'Today' : fmt(dateOf(d.w.daily.time[i]), 'EEE'), 10, new Color('#ffffff', 0.8), 'semibold'));
            centered(c, x => icon(x, this.look(d.w.daily.weather_code[i], 1)[1], 16, Color.white()));
            centered(c, x => text(x, `${Math.round(d.w.daily.temperature_2m_max[i])}°`, 12, Color.white(), 'bold'));
            centered(c, x => text(x, `${Math.round(d.w.daily.temperature_2m_min[i])}°`, 10, new Color('#ffffff', 0.65), 'semibold'));
            if (i < n - 1) r.addSpacer();
        }
    },
    medium(d) {
        const cur = d.w.current;
        const [label, , top, bottom] = this.look(cur.weather_code, cur.is_day);
        const w = base(null, top, bottom);
        w.url = 'https://open-meteo.com/';
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(13, 15, 12, 15);
        const head = row(w, 8);
        const t = column(head, 0);
        text(t, d.place || 'Here', 13, Color.white(), 'bold');
        text(t, `${Math.round(cur.temperature_2m)}°`, 32, Color.white(), 'round');
        head.addSpacer();
        const right = column(head, 1);
        text(right, label, 12, Color.white(), 'semibold');
        text(right, `Feels ${Math.round(cur.apparent_temperature)}°`, 10, new Color('#ffffff', 0.8), 'medium');
        text(right, `Rain ${d.w.daily.precipitation_probability_max[0] || 0}%`, 10, new Color('#ffffff', 0.8), 'medium');
        w.addSpacer();
        this.days(w, d, 5);
        return w;
    },
    large(d) {
        const cur = d.w.current;
        const [label, sym, top, bottom] = this.look(cur.weather_code, cur.is_day);
        const w = base(null, top, bottom);
        w.url = 'https://open-meteo.com/';
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(16, 16, 14, 16);
        text(w, d.place || 'Here', 15, Color.white(), 'bold');
        const r = row(w, 10);
        text(r, `${Math.round(cur.temperature_2m)}°`, 56, Color.white(), 'round');
        icon(r, sym, 40, Color.white());
        text(w, `${label} · feels ${Math.round(cur.apparent_temperature)}° · wind ${Math.round(cur.wind_speed_10m)} km/h`, 12, new Color('#ffffff', 0.85), 'semibold');
        w.addSpacer();
        for (let i = 0; i < Math.min(7, d.w.daily.time.length); i++) {
            const x = row(w, 8);
            const dl = x.addStack();
            dl.size = new Size(54, 0);
            text(dl, i === 0 ? 'Today' : fmt(dateOf(d.w.daily.time[i]), 'EEEE'), 12, Color.white(), 'semibold');
            icon(x, this.look(d.w.daily.weather_code[i], 1)[1], 15, Color.white());
            x.addSpacer();
            text(x, `${d.w.daily.precipitation_probability_max[i] || 0}%`, 11, new Color('#bfe1ff'), 'semibold');
            text(x, `${Math.round(d.w.daily.temperature_2m_min[i])}°`, 12, new Color('#ffffff', 0.65), 'semibold');
            text(x, `${Math.round(d.w.daily.temperature_2m_max[i])}°`, 12, Color.white(), 'bold');
            w.addSpacer(5);
        }
        return w;
    },
    rectangular(d) {
        const w = base('https://open-meteo.com/');
        const cur = d.w.current;
        const [label, sym] = this.look(cur.weather_code, cur.is_day);
        const r = row(w, 6);
        icon(r, sym, 16, Color.white());
        text(r, `${Math.round(cur.temperature_2m)}°`, 20, Color.white(), 'round');
        text(w, `${label} · H ${Math.round(d.w.daily.temperature_2m_max[0])}° L ${Math.round(d.w.daily.temperature_2m_min[0])}°`, 11, Color.white(), 'medium');
        return w;
    },
    inline(d) {
        const w = base('https://open-meteo.com/');
        w.addText(`${Math.round(d.w.current.temperature_2m)}° ${this.look(d.w.current.weather_code, d.w.current.is_day)[0]}${d.place ? ` in ${d.place}` : ''}`);
        return w;
    },
    circular(d) {
        return lockNumber('https://open-meteo.com/', this.look(d.w.current.weather_code, d.w.current.is_day)[1], `${Math.round(d.w.current.temperature_2m)}°`);
    }
};
/*@end*/

/*@kind:progress*/
MAKERS.progress = {
    feed: false,
    prepare() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monday = new Date(start);
        monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        const month = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const year = new Date(now.getFullYear(), 0, 1);
        const nextYear = new Date(now.getFullYear() + 1, 0, 1);
        const part = (a, b) => (now - a) / (b - a);
        return {
            parts: [
                { name: 'Day', f: part(start, new Date(start.getTime() + 864e5)), color: '#ffb74d' },
                { name: 'Week', f: part(monday, new Date(monday.getTime() + 7 * 864e5)), color: '#4dd0e1' },
                { name: 'Month', f: part(month, nextMonth), color: '#ba68c8' },
                { name: 'Year', f: part(year, nextYear), color: '#81c784' }
            ],
            daysLeft: Math.ceil((nextYear - now) / 864e5),
            year: now.getFullYear()
        };
    },
    pct: f => `${Math.floor(f * 100)}%`,
    small(d) {
        const w = base(null, '#1a1a2e', '#0a0a14');
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(12, 12, 12, 12);
        const y = d.parts[3];
        header(w, `${d.year}`, 'chart.pie.fill');
        A = new Color(y.color);
        w.addSpacer();
        centered(w, r => ringWith(r, y.f, 84, new Color(y.color), this.pct(y.f), 'of the year', 9));
        w.addSpacer();
        centered(w, r => text(r, `${d.daysLeft} days left`, 10, C.dim, 'semibold'));
        return w;
    },
    medium(d) {
        const w = base(null, '#1a1a2e', '#0a0a14');
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(14, 14, 12, 14);
        const r = w.addStack();
        d.parts.forEach((p, i) => {
            const c = column(r, 5);
            ringWith(c, p.f, 70, new Color(p.color), this.pct(p.f), null, 8);
            centered(c, x => text(x, p.name, 11, C.dim, 'semibold'));
            if (i < 3) r.addSpacer();
        });
        w.addSpacer();
        centered(w, x => text(x, `${d.daysLeft} days left in ${d.year}`, 11, C.faint, 'semibold'));
        return w;
    },
    large(d) {
        const w = base(null, '#1a1a2e', '#0a0a14');
        w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
        w.setPadding(16, 16, 14, 16);
        text(w, 'How far along', 18, C.text, 'bold');
        text(w, fmt(new Date(), 'EEEE d MMMM'), 11, C.dim, 'semibold');
        w.addSpacer();
        const grid = column(w, 14);
        for (let i = 0; i < 4; i += 2) {
            const r = grid.addStack();
            d.parts.slice(i, i + 2).forEach((p, j) => {
                const c = row(r, 10);
                ringWith(c, p.f, 84, new Color(p.color), this.pct(p.f), null, 9);
                const t = column(c, 0);
                text(t, p.name, 13, C.text, 'bold');
                text(t, `${this.pct(1 - p.f)} to go`, 10, C.dim, 'semibold');
                if (j === 0) r.addSpacer();
            });
        }
        w.addSpacer();
        centered(w, x => text(x, `${d.daysLeft} days left in ${d.year}`, 11, C.faint, 'semibold'));
        return w;
    },
    rectangular(d) {
        const w = base();
        d.parts.forEach(p => text(w, `${p.name} ${this.pct(p.f)}`, 11, Color.white(), 'semibold'));
        return w;
    },
    inline(d) {
        const w = base();
        w.addText(`${d.year} is ${this.pct(d.parts[3].f)} done`);
        return w;
    },
    circular(d) {
        const w = base();
        w.addAccessoryWidgetBackground = true;
        const s = w.addStack();
        s.size = new Size(60, 60);
        s.backgroundImage = ring(d.parts[3].f, 60, Color.white(), 6, new Color('#ffffff', 0.3));
        s.addSpacer();
        text(s, this.pct(d.parts[3].f), 14, Color.white(), 'round');
        s.addSpacer();
        return w;
    }
};
/*@end*/

/*@kind:inbox*/
MAKERS.inbox = {
    feed: true,
    zero: d => d.mail && d.mail.unread === 0,
    small(d) {
        const zero = this.zero(d);
        const w = base(d.links.mail, zero ? '#0f5132' : '#13294b', zero ? '#04210f' : '#07101f');
        w.setPadding(14, 14, 12, 14);
        header(w, 'Mail', 'envelope.fill');
        w.addSpacer();
        if (!d.mail) text(w, 'Open Mail once to count', 13, C.dim, 'bold', 3);
        else if (zero) {
            text(w, '🎉', 30, C.text);
            text(w, 'Inbox zero', 16, C.text, 'bold');
        } else {
            text(w, d.mail.unread, 42, C.text, 'round');
            text(w, d.mail.unread === 1 ? 'unread message' : 'unread messages', 11, A, 'bold');
        }
        w.addSpacer();
        this.foot(w, d);
        return w;
    },
    foot(w, d) {
        const r = row(w, 10);
        if (d.chat != null) {
            const c = row(r, 3);
            icon(c, 'bubble.left.and.bubble.right.fill', 10, A);
            text(c, `${d.chat} chat`, 10, C.dim, 'semibold');
        }
        if (d.mail && Date.now() - d.mail.at > 3600e3) text(r, `as of ${fmt(new Date(d.mail.at), 'HH:mm')}`, 9, C.faint, 'medium');
    },
    medium(d) {
        const zero = this.zero(d);
        const w = base(d.links.mail, zero ? '#0f5132' : '#13294b', zero ? '#04210f' : '#07101f');
        w.setPadding(14, 16, 12, 16);
        header(w, 'Waiting for you', 'tray.full.fill');
        w.addSpacer();
        const r = w.addStack();
        const box = (parent, sym, n, label, url) => {
            const b = column(parent, 1);
            if (url && tappable()) b.url = url;
            icon(b, sym, 16, A);
            text(b, n == null ? '–' : n, 32, C.text, 'round');
            text(b, label, 11, C.dim, 'semibold');
        };
        box(r, zero ? 'sparkles' : 'envelope.fill', d.mail ? d.mail.unread : null, zero ? 'inbox zero 🎉' : 'unread mail', d.links.mail);
        r.addSpacer();
        box(r, 'bubble.left.and.bubble.right.fill', d.chat, 'unread chats', d.links.chat);
        r.addSpacer();
        box(r, 'rectangle.split.3x1.fill', d.planner, 'cards due', d.links.planner);
        w.addSpacer();
        if (d.mail && Date.now() - d.mail.at > 3600e3) text(w, `Mail as of ${fmt(new Date(d.mail.at), 'EEE HH:mm')}`, 9, C.faint, 'medium');
        return w;
    },
    large(d) {
        const zero = this.zero(d);
        const w = base(d.links.mail, zero ? '#0f5132' : '#13294b', zero ? '#04210f' : '#07101f');
        w.setPadding(16, 18, 14, 18);
        header(w, 'Waiting for you', 'tray.full.fill');
        w.addSpacer();
        const line = (sym, n, label, url) => {
            const r = row(w, 14);
            if (url) r.url = url;
            const b = r.addStack();
            b.size = new Size(46, 46);
            b.cornerRadius = 14;
            b.backgroundColor = new Color('#ffffff', 0.1);
            b.addSpacer();
            icon(b, sym, 20, A);
            b.addSpacer();
            text(r, n == null ? '–' : n, 34, C.text, 'round');
            text(r, label, 13, C.dim, 'semibold');
            r.addSpacer();
            w.addSpacer(12);
        };
        line(zero ? 'sparkles' : 'envelope.fill', d.mail ? d.mail.unread : null, zero ? 'inbox zero 🎉' : 'unread mail', d.links.mail);
        line('bubble.left.and.bubble.right.fill', d.chat, 'unread chats', d.links.chat);
        line('rectangle.split.3x1.fill', d.planner, 'cards due this week', d.links.planner);
        w.addSpacer();
        if (d.mail && Date.now() - d.mail.at > 3600e3) text(w, `Mail as of ${fmt(new Date(d.mail.at), 'EEE HH:mm')}`, 10, C.faint, 'medium');
        return w;
    },
    rectangular(d) {
        const w = base(d.links.mail);
        text(w, this.zero(d) ? 'Inbox zero 🎉' : `${d.mail ? d.mail.unread : '–'} unread mail`, 14, Color.white(), 'bold');
        if (d.chat != null) text(w, `${d.chat} unread chats`, 12, Color.white(), 'medium');
        return w;
    },
    inline(d) {
        const w = base(d.links.mail);
        w.addText(this.zero(d) ? 'Inbox zero 🎉' : `${d.mail ? d.mail.unread : '–'} unread${d.chat ? ` · ${d.chat} chats` : ''}`);
        return w;
    },
    circular(d) {
        return lockNumber(d.links.mail, 'envelope.fill', d.mail ? d.mail.unread : '–');
    }
};
/*@end*/

/*@kind:quote*/
MAKERS.quote = {
    feed: false,
    QUOTES: [
        'Small steps still move you forward.',
        'Done is better than perfect.',
        'Start where you are. Use what you have.',
        'Make today a little better than yesterday.',
        'The best time to begin is now.',
        'Rest is part of the work.',
        'You don’t have to see the whole staircase. Take the first step.',
        'Focus on what you can change.',
        'One thing at a time.',
        'Be kind. Everyone is fighting their own battle.',
        'Every expert was once a beginner.',
        'Your future self is watching. Make them proud.',
        'Slow progress is still progress.',
        'Good things take time.',
        'Make it simple, then make it better.',
        'Ask for help: it’s a strength, not a weakness.',
        'Celebrate the small wins.',
        'Today is a good day to learn something new.',
        'Breathe in. Breathe out. Carry on.',
        'Clear the desk, clear the mind.',
        'Plan the work, then work the plan.',
        'Mistakes are proof that you are trying.',
        'Be the energy you want to attract.',
        'A calm mind sees the way.',
        'Keep going. You’re closer than you think.',
        'Say thank you more often.',
        'Less, but better.',
        'You can do hard things.',
        'Curiosity is a superpower.',
        'The view gets better as you climb.',
        'Choose progress over perfection.',
        'Leave things better than you found them.',
        'What would this look like if it were easy?',
        'Drink some water. Stretch. Smile.',
        'Discipline is remembering what you want.',
        'Ideas are cheap. Doing is everything.',
        'Be patient with yourself.',
        'A good laugh makes any day better.',
        'Do one thing today that scares you a little.',
        'It’s a great day to make someone’s day.'
    ],
    SKIES: [['#ff6a88', '#7b2ff7'], ['#00b4db', '#0052a3'], ['#f7971e', '#c1386e'], ['#11998e', '#06493f'], ['#8e2de2', '#36105c'], ['#ee0979', '#5f0a3a'], ['#2193b0', '#173d57']],
    prepare() {
        const now = new Date();
        const n = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5) + now.getFullYear() * 7;
        const i = param.toLowerCase() === 'random' ? Math.floor(Math.random() * 1e6) : n;
        return { quote: this.QUOTES[i % this.QUOTES.length], sky: this.SKIES[i % this.SKIES.length] };
    },
    draw(d, size) {
        const w = base(null, d.sky[0], d.sky[1]);
        w.url = `${SITE}/`;
        const next = new Date();
        next.setHours(24, 0, 5, 0);
        w.refreshAfterDate = param.toLowerCase() === 'random' ? REFRESH() : next;
        w.setPadding(16, 16, 14, 16);
        text(w, '“', size * 2.2, new Color('#ffffff', 0.55), 'heavy');
        text(w, d.quote, size, Color.white(), 'bold', 6);
        w.addSpacer();
        text(w, fmt(new Date(), 'EEEE d MMMM'), 10, new Color('#ffffff', 0.75), 'semibold');
        return w;
    },
    small(d) {
        return this.draw(d, 14);
    },
    medium(d) {
        return this.draw(d, 17);
    },
    large(d) {
        return this.draw(d, 24);
    },
    rectangular(d) {
        const w = base();
        text(w, d.quote, 12, Color.white(), 'semibold', 3);
        return w;
    },
    inline(d) {
        const w = base();
        w.addText(d.quote);
        return w;
    },
    circular() {
        return lockNumber(`${SITE}/`, 'quote.opening', '“');
    }
};
/*@end*/

/*@kind:storage*/
MAKERS.storage = {
    feed: true,
    theme: ['#1f2937', '#0b0f14', '#a78bfa'],
    size(b) {
        const u = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        let n = b;
        while (n >= 1024 && i < u.length - 1) (n /= 1024), i++;
        return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
    },
    room: s => s.quota || s.used + s.free,
    small(d) {
        const s = d.storage;
        const w = base(d.links.files, ...this.theme);
        w.setPadding(12, 12, 12, 12);
        header(w, 'Files', 'externaldrive.fill');
        w.addSpacer();
        const room = this.room(s);
        centered(w, r => ringWith(r, room ? s.used / room : 0, 84, A, this.size(s.used), room ? `of ${this.size(room)}` : 'used', 9));
        w.addSpacer();
        centered(w, r => text(r, `${s.files} files · ${s.photos} photos`, 10, C.dim, 'semibold'));
        return w;
    },
    medium(d) {
        const s = d.storage;
        const w = base(d.links.files, ...this.theme);
        w.setPadding(14, 16, 12, 16);
        const body = w.addStack();
        body.centerAlignContent();
        const room = this.room(s);
        ringWith(body, room ? s.used / room : 0, 100, A, `${room ? Math.round((s.used / room) * 100) : 0}%`, 'used', 10);
        body.addSpacer(16);
        const c = column(body, 4);
        text(c, 'Your cloud', 17, C.text, 'bold');
        text(c, `${this.size(s.used)} used${room ? ` of ${this.size(room)}` : ''}`, 12, C.dim, 'semibold');
        const r = row(c, 10);
        const bit = (sym, n) => {
            const b = row(r, 3);
            icon(b, sym, 11, A);
            text(b, n, 12, C.text, 'semibold');
        };
        bit('doc.fill', s.files);
        bit('photo.fill', s.photos);
        bit('video.fill', s.videos);
        body.addSpacer();
        return w;
    },
    large(d) {
        const s = d.storage;
        const w = base(d.links.files, ...this.theme);
        w.setPadding(16, 16, 14, 16);
        header(w, 'Your cloud', 'externaldrive.fill');
        w.addSpacer();
        const room = this.room(s);
        centered(w, r => ringWith(r, room ? s.used / room : 0, 160, A, this.size(s.used), room ? `of ${this.size(room)}` : 'used', 14));
        w.addSpacer();
        const r = w.addStack();
        const box = (sym, n, label) => {
            const b = column(r, 2);
            centered(b, x => icon(x, sym, 18, A));
            centered(b, x => text(x, n, 20, C.text, 'round'));
            centered(b, x => text(x, label, 10, C.dim, 'semibold'));
        };
        box('doc.fill', s.files, 'files');
        r.addSpacer();
        box('photo.fill', s.photos, 'photos');
        r.addSpacer();
        box('video.fill', s.videos, 'videos');
        return w;
    },
    circular(d) {
        const s = d.storage;
        const room = this.room(s);
        const w = base(d.links.files);
        w.addAccessoryWidgetBackground = true;
        const st = w.addStack();
        st.size = new Size(60, 60);
        st.backgroundImage = ring(room ? s.used / room : 0, 60, Color.white(), 6, new Color('#ffffff', 0.3));
        st.addSpacer();
        text(st, `${room ? Math.round((s.used / room) * 100) : 0}%`, 14, Color.white(), 'round');
        st.addSpacer();
        return w;
    },
    inline(d) {
        const w = base(d.links.files);
        w.addText(`${this.size(d.storage.used)} in Files`);
        return w;
    }
};
/*@end*/

/* ---------- the lock screen's round widget: a symbol and a number ---------- */
function lockNumber(url, sym, value) {
    const w = base(url);
    w.addAccessoryWidgetBackground = true;
    const s = column(w, 0);
    centered(s, r => icon(r, sym, 12, Color.white()));
    centered(s, r => text(r, value, 18, Color.white(), 'round'));
    return w;
}

/* ---------- run ---------- */
async function build(d) {
    const m = MAKERS[KIND];
    if (d.error) return problem(d.error);
    if (m.theme) A = new Color(m.theme[2]);
    if (m.all && !lockScreen()) return m.all(d);
    const fam = family === 'extraLarge' ? 'large' : family;
    const pick = { small: m.small, medium: m.medium, large: m.large || m.medium, accessoryCircular: m.circular, accessoryRectangular: m.rectangular, accessoryInline: m.inline }[fam];
    if (!pick) {
        const w = base();
        w.addText(lockScreen() ? 'Not for the lock screen' : 'Pick another size');
        return w;
    }
    return pick.call(m, d);
}
const maker = MAKERS[KIND];
const data = maker.feed ? await load() : await maker.prepare();
if (config.runsInWidget) {
    Script.setWidget(await build(data));
} else {
    // opened in Scriptable itself: show a preview
    const pick = new Alert();
    pick.title = '__TITLE__';
    pick.message = data.error || 'Which size would you like to see?';
    ['Small', 'Medium', 'Large'].forEach(x => pick.addAction(x));
    pick.addCancelAction('Close');
    const i = await pick.presentSheet();
    if (i >= 0) {
        family = ['small', 'medium', 'large'][i];
        const w = await build(data);
        if (i === 0) await w.presentSmall();
        else if (i === 1) await w.presentMedium();
        else await w.presentLarge();
    }
}
Script.complete();
