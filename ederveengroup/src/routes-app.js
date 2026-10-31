'use strict';

// The app's own pages. Kept in one place so the server (deep links, ?next= after login) and
// the tests agree on what a valid in-app address is. Codes are short base64url strings.
const APP_ROUTE = /^\/(?:(?:inbox|sent|drafts|archive|junk|trash|snoozed|starred)(?:\/[A-Za-z0-9_-]{11})?|f\/[A-Za-z0-9_-]{8}(?:\/[A-Za-z0-9_-]{11})?|search\/[A-Za-z0-9_-]{6,16}(?:\/[A-Za-z0-9_-]{11})?|settings(?:\/[a-z]{2,20})?)\/?$/;

module.exports = { APP_ROUTE };
