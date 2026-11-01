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

// Docs: shown right inside the app (and to others, when shared), so only plain structure:
// no inline styles (they could cover the page with a fake form), and pictures only embedded
// (data:) or from this site, never fetched from elsewhere (which could track who reads it).
const DOC_OPTIONS = {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'br', 'img', 'mark', 'sub', 'sup', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], li: ['data-checked'], ul: ['data-checklist'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], '*': ['style'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['data'] },
    allowProtocolRelative: false,
    transformTags: {
        a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
        img: (tagName, attribs) => ({ tagName, attribs: /^data:image\/(png|jpeg|gif|webp);/.test(attribs.src || '') || /^\/(?!\/)/.test(attribs.src || '') ? attribs : {} })
    },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src
};

module.exports = {
    sanitizeEmailHtml: html => sanitizeHtml(html, EMAIL_OPTIONS),
    sanitizeDocHtml: html => sanitizeHtml(html || '', DOC_OPTIONS),
    sanitizeComposeHtml: html => sanitizeHtml(html || '', COMPOSE_OPTIONS)
};
