'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Asset version: a hash of everything in public/, so ?v= URLs change on every deploy
// and the files themselves can be cached by browsers for a year.
function assetVersion(publicDir) {
    const hash = crypto.createHash('sha1');
    const walk = dir => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, f.name);
            if (f.isDirectory()) walk(full);
            else hash.update(f.name).update(fs.readFileSync(full));
        }
    };
    walk(publicDir);
    return hash.digest('hex').slice(0, 10);
}

// The app's ES modules import each other by plain path; an import map pins every one of
// them to this deploy's version so they can all be cached for a year. It's an inline
// script, so the CSP allows it by hash.
function moduleImportMap({ publicDir, baseUrl, version }) {
    const dir = path.join(publicDir, 'js', 'app');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort() : [];
    const json = JSON.stringify({ imports: Object.fromEntries(files.map(f => [`${baseUrl}js/app/${f}`, `${baseUrl}js/app/${f}?v=${version}`])) });
    return { json, hash: `'sha256-${crypto.createHash('sha256').update(json).digest('base64')}'` };
}

// HTML pages with <!--include:name--> partials and %BASE% / %V% / %IMPORTMAP% / %ORIGIN% placeholders.
function createPages({ viewsDir, publicDir, baseUrl, version }) {
    const importMap = moduleImportMap({ publicDir, baseUrl, version });
    const cache = {};
    function render(name) {
        if (!cache[name]) {
            cache[name] = fs
                .readFileSync(path.join(viewsDir, name), 'utf8')
                .replace(/<!--include:([a-z-]+)-->/g, (_, part) => fs.readFileSync(path.join(viewsDir, 'partials', part + '.html'), 'utf8'))
                .replace('%IMPORTMAP%', `<script type="importmap">${importMap.json}</script>`)
                .replaceAll('%BASE%', baseUrl)
                .replaceAll('%V%', version);
        }
        return cache[name];
    }
    // the service worker precaches this deploy's own files (never anything from /api/)
    const assets = [
        'css/app.css', 'js/boot.js', 'js/icons.js', 'favicon.svg', 'icons/apple-touch-icon.png',
        ...(fs.existsSync(path.join(publicDir, 'js', 'app')) ? fs.readdirSync(path.join(publicDir, 'js', 'app')).filter(f => f.endsWith('.js')).sort().map(f => `js/app/${f}`) : [])
    ].filter(f => fs.existsSync(path.join(publicDir, f))).map(f => `${baseUrl}${f}?v=${version}`);
    const serviceWorker = fs.existsSync(path.join(viewsDir, 'sw.js'))
        ? fs.readFileSync(path.join(viewsDir, 'sw.js'), 'utf8').replace('%ASSETS%', JSON.stringify(assets)).replaceAll('%BASE%', baseUrl).replaceAll('%V%', version)
        : null;
    const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;
    return {
        scriptHashes: [importMap.hash],
        serviceWorker,
        send: (res, name, status = 200) =>
            res.status(status).type('html').set('Cache-Control', 'no-cache').send(render(name).replaceAll('%ORIGIN%', originOf(res.req)))
    };
}

module.exports = { assetVersion, createPages };
