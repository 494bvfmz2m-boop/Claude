'use strict';

// The app's own pages. Kept in one place so the server (deep links, ?next= after login) and
// the tests agree on what a valid in-app address is. Codes are short base64url strings.
const APP_ROUTE = /^\/(?:(?:inbox|sent|drafts|archive|junk|trash|snoozed|starred)(?:\/[A-Za-z0-9_-]{11})?|f\/[A-Za-z0-9_-]{8}(?:\/[A-Za-z0-9_-]{11})?|search\/[A-Za-z0-9_-]{6,16}(?:\/[A-Za-z0-9_-]{11})?|settings(?:\/[a-z]{2,20})?)\/?$/;

// The hub apps that are a page of their own at /<name>/ (signed in, with a username)
const APP_PAGES = ['notes', 'tasks', 'contacts', 'calendar', 'files', 'photos', 'docs', 'slides', 'sheets', 'forms', 'chat', 'planner', 'whiteboard', 'photoedit', 'videoedit', 'widgets', 'jarvis'];
const ADMIN_ONLY = ['jarvis']; // pages only admins get (everyone else: not found)
const PAGE_RE = new RegExp(`^/(profile|admin|${APP_PAGES.join('|')})/?$`);

// Pages a sign-in may continue to (?next=): the hub, the username step, an app, or a mail
// page. Anything else (other sites, //host, odd paths) falls back to the hub.
function safeNext(next, baseUrl = '/mail/') {
    const n = String(next || '');
    if (n === '/' || n === '/welcome' || PAGE_RE.test(n) || /^\/r\/[A-Za-z0-9_-]{16}$/.test(n)) return n;
    if (n.startsWith(baseUrl) && APP_ROUTE.test('/' + n.slice(baseUrl.length))) return n;
    return '/';
}

module.exports = { APP_ROUTE, APP_PAGES, ADMIN_ONLY, safeNext };
