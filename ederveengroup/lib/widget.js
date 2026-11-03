'use strict';

// Home-screen and lock-screen widgets on iPhone come from Scriptable (a free app that makes widgets
// from a short script). This fills in the person's private feed address in widget-scriptable.js.

const fs = require('fs');
const path = require('path');

const TEMPLATE = fs.readFileSync(path.join(__dirname, 'widget-scriptable.js'), 'utf8');
// safe inside the script's single quotes
const quoted = v => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, '');

function widgetScript({ feed, site }) {
    return TEMPLATE.replace("'__FEED__'", `'${quoted(feed)}'`).replace("'__SITE__'", `'${quoted(site)}'`);
}

module.exports = { widgetScript };
