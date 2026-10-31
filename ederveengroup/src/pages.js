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

// HTML pages with <!--include:name--> partials and %BASE% / %V% / %ORIGIN% placeholders.
function createPages({ viewsDir, baseUrl, version }) {
    const cache = {};
    function render(name) {
        if (!cache[name]) {
            cache[name] = fs
                .readFileSync(path.join(viewsDir, name), 'utf8')
                .replace(/<!--include:([a-z-]+)-->/g, (_, part) => fs.readFileSync(path.join(viewsDir, 'partials', part + '.html'), 'utf8'))
                .replaceAll('%BASE%', baseUrl)
                .replaceAll('%V%', version);
        }
        return cache[name];
    }
    const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;
    return {
        send: (res, name, status = 200) =>
            res.status(status).type('html').set('Cache-Control', 'no-cache').send(render(name).replaceAll('%ORIGIN%', originOf(res.req)))
    };
}

module.exports = { assetVersion, createPages };
