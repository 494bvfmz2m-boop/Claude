'use strict';

const sanitizeHtml = require('sanitize-html');

// Email HTML is hostile by default: strip scripts, forms, frames and event
// handlers but keep enough markup and inline style for newsletters to render.
const EMAIL_OPTIONS = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img', 'center', 'font', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
        'colgroup', 'col', 'caption', 'style', 'u', 's', 'strike', 'small', 'big', 'sup', 'sub', 'hr', 'br',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'del', 'ins', 'mark', 'picture', 'source'
    ]),
    allowedAttributes: {
        '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height', 'bgcolor', 'color', 'dir', 'lang', 'title', 'border', 'cellpadding', 'cellspacing', 'background'],
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'srcset'],
        font: ['face', 'size', 'color'],
        td: ['colspan', 'rowspan', 'nowrap'],
        th: ['colspan', 'rowspan', 'nowrap'],
        col: ['span'],
        source: ['srcset', 'media', 'type']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data', 'cid'],
    allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
    allowVulnerableTags: true, // <style> is kept; it is rendered inside a script-less sandboxed iframe
    transformTags: {
        a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } })
    },
    exclusiveFilter: frame => frame.tag === 'style' && /@import|expression\s*\(|behavior\s*:|javascript:/i.test(frame.text || '')
};

// Signatures and composed bodies: a tighter set (no <style>).
const COMPOSE_OPTIONS = {
    ...EMAIL_OPTIONS,
    allowedTags: EMAIL_OPTIONS.allowedTags.filter(t => t !== 'style'),
    allowVulnerableTags: false,
    exclusiveFilter: undefined
};

module.exports = {
    sanitizeEmailHtml: html => sanitizeHtml(html, EMAIL_OPTIONS),
    sanitizeComposeHtml: html => sanitizeHtml(html || '', COMPOSE_OPTIONS)
};
