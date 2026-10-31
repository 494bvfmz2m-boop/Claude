'use strict';

const { sanitizeComposeHtml } = require('../lib/sanitize');

const id = v => String(v || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || Math.random().toString(36).slice(2, 10);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
// cutting html short would break it, so oversized content is refused instead
function limited(html, max, message) {
    if (html.length > max) throw Object.assign(new Error(message), { status: 413 });
    return html;
}

// Validates a settings patch from the browser; unknown keys are dropped by the store.
function cleanSettingsPatch(body = {}) {
    const p = { ...body };
    if ('signatures' in p) {
        p.signatures = [].concat(p.signatures || []).slice(0, 20).map(s => ({
            id: id(s.id),
            name: String(s.name || 'Signature').slice(0, 80),
            html: limited(sanitizeComposeHtml(String(s.html || '')), 200000, 'That signature is too large. Use a smaller image or an image link.')
        }));
    }
    if ('templates' in p) {
        p.templates = [].concat(p.templates || []).slice(0, 50).map(t => ({
            id: id(t.id),
            name: String(t.name || 'Template').slice(0, 80),
            subject: String(t.subject || '').slice(0, 300),
            html: limited(sanitizeComposeHtml(String(t.html || '')), 200000, 'That template is too large.')
        }));
    }
    if ('defaultSignature' in p) p.defaultSignature = p.defaultSignature ? id(p.defaultSignature) : null;
    if ('replySignature' in p) p.replySignature = p.replySignature ? id(p.replySignature) : null;
    if ('undoSendSeconds' in p) p.undoSendSeconds = Math.max(0, Math.min(30, Number(p.undoSendSeconds) || 0));
    if ('displayName' in p) p.displayName = String(p.displayName || '').replace(/[\r\n"<>]/g, '').slice(0, 120);
    if ('accent' in p && !/^#[0-9a-f]{6}$/i.test(p.accent)) delete p.accent;
    if ('theme' in p) p.theme = oneOf(p.theme, ['dark', 'light', 'system'], 'dark');
    if ('density' in p) p.density = oneOf(p.density, ['comfortable', 'compact'], 'comfortable');
    if ('readingPane' in p) p.readingPane = oneOf(p.readingPane, ['right', 'off'], 'right');
    if ('afterAction' in p) p.afterAction = oneOf(p.afterAction, ['next', 'list'], 'next');
    for (const k of ['senderPhotos', 'loadRemoteImages', 'saveSentCopy', 'conversations', 'tourDone']) if (k in p) p[k] = !!p[k];
    return p;
}

module.exports = { cleanSettingsPatch };
