'use strict';

// Home-screen and lock-screen widgets on iPhone come from Scriptable (a free app that makes widgets
// from a short script). widget-scriptable.js holds every widget; each script someone copies keeps
// only its own widget's part, with their private feed address filled in.

const fs = require('fs');
const path = require('path');

const TEMPLATE = fs.readFileSync(path.join(__dirname, 'widget-scriptable.js'), 'utf8');

// the widgets, in the order the gallery shows them
const WIDGET_KINDS = [
    { id: 'calendar', name: 'Calendar', script: 'EG Calendar', group: 'Your things', blurb: 'Today’s date, big, with what’s next. Large shows the whole month with a dot on busy days.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'tasks', name: 'Tasks', script: 'EG Tasks', group: 'Your things', blurb: 'A ring that fills up as you tick things off, what’s due, and a chart of what you did this week.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'notes', name: 'Notes', script: 'EG Notes', group: 'Your things', blurb: 'Your notes as sticky notes in their own colours, pinned ones first.', sizes: ['small', 'medium', 'large', 'lock'], param: 'a word from a note’s title shows that note' },
    { id: 'today', name: 'Good morning', script: 'EG Today', group: 'Your things', blurb: 'A greeting with the colours of the time of day: sunrise, blue sky, sunset, stars.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'overview', name: 'Overview', script: 'EderveenGroup', group: 'Your things', blurb: 'Agenda, tasks, mail and chat in one.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'nextup', name: 'Next up', script: 'EG Next up', group: 'Fun', blurb: 'A live timer that ticks down to your next appointment, to the second.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'countdown', name: 'Countdown', script: 'EG Countdown', group: 'Fun', blurb: 'Days to go until your next big day: a birthday, a holiday, a deadline.', sizes: ['small', 'medium', 'large', 'lock'], param: '“Holiday|2026-12-24”, or a word from an event’s name' },
    { id: 'memories', name: 'Memories', script: 'EG Memories', group: 'Fun', blurb: 'A photo from this day in earlier years, from your Photos. Another one every day.', sizes: ['small', 'medium', 'large'], param: 'nothing to set' },
    { id: 'weather', name: 'Weather', script: 'EG Weather', group: 'Fun', blurb: 'Where you are, now and the coming week, with a sky to match. Forecast by Open-Meteo.', sizes: ['small', 'medium', 'large', 'lock'], param: 'a place as numbers, like “52.07, 5.65”, instead of your location' },
    { id: 'progress', name: 'Progress', script: 'EG Progress', group: 'Fun', blurb: 'Rings for how much of the day, week, month and year has gone by.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'quote', name: 'Quote of the day', script: 'EG Quote', group: 'Fun', blurb: 'A short, kind push for the day, on a colour that changes daily.', sizes: ['small', 'medium', 'large', 'lock'], param: '“random” for a new one at every refresh' },
    { id: 'inbox', name: 'Inbox', script: 'EG Inbox', group: 'Counts', blurb: 'Unread mail, chats and cards due. Inbox zero gets a party.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'storage', name: 'Storage', script: 'EG Storage', group: 'Counts', blurb: 'How full your own cloud is, with your files, photos and videos.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set' },
    { id: 'jarvis', name: 'Jarvis', script: 'EG Jarvis', group: 'Jarvis', blurb: 'His glowing core, a greeting and your day at a glance, with the last thing he said. Tap it to talk to him.', sizes: ['small', 'medium', 'large', 'lock'], param: 'nothing to set', admin: true }
];

// safe inside the script's single quotes
const quoted = v => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, '');

/** the script for one widget: only its part, with the feed address in it */
function widgetScript({ feed, site, kind = 'overview' }) {
    const meta = WIDGET_KINDS.find(k => k.id === kind) || WIDGET_KINDS.find(k => k.id === 'overview');
    const body = TEMPLATE.replace(/\/\*@kind:([a-z]+)\*\/\n([\s\S]*?)\/\*@end\*\/\n/g, (all, k, part) => (k === meta.id ? part : ''));
    return body
        .replace(/__TITLE__/g, `${meta.name} widget`)
        .replace('__SCRIPT__', meta.script)
        .replace('__PARAM__', meta.param === 'nothing to set' ? 'Parameter: not needed.' : `Parameter (optional, in Edit Widget): ${meta.param}.`)
        .replace("'__KIND__'", `'${meta.id}'`)
        .replace("'__FEED__'", `'${quoted(feed)}'`)
        .replace("'__SITE__'", `'${quoted(site)}'`);
}

// the names a Scriptable script can use, in the order the Widgets page hands them over
const GLOBALS = ['ListWidget', 'Color', 'Font', 'Size', 'Point', 'Rect', 'LinearGradient', 'SFSymbol', 'DrawContext', 'Path', 'Image', 'Request', 'FileManager', 'DateFormatter', 'Location', 'Alert', 'Script', 'Device', 'config', 'args'];

/** every widget's script as a function, for the Widgets page's live previews (no eval needed) */
function widgetPreviews({ feed, site, kinds = WIDGET_KINDS }) {
    const WIDGET_KINDS = kinds; // (only the ones this person can have)
    const parts = WIDGET_KINDS.map(k => `${JSON.stringify(k.id)}: async function (${GLOBALS.join(', ')}) {\n${widgetScript({ feed, site, kind: k.id })}\n}`);
    const sources = Object.fromEntries(WIDGET_KINDS.map(k => [k.id, widgetScript({ feed, site, kind: k.id })]));
    // the texts too, for the Copy buttons (a copy has to happen right away when tapped, on iPhone)
    return `// EderveenGroup widget previews: the real Scriptable scripts, run on the page\nwindow.EGWidgetScripts = {\n${parts.join(',\n')}\n};\nwindow.EGWidgetGlobals = ${JSON.stringify(GLOBALS)};\nwindow.EGWidgetSources = ${JSON.stringify(sources).replace(/</g, '\\u003c')};\n`;
}

module.exports = { widgetScript, widgetPreviews, WIDGET_KINDS, GLOBALS };
