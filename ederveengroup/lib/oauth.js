'use strict';

// "Sign in with Microsoft" and "Sign in with Google" (OAuth 2.0 / OpenID Connect, with PKCE).
// The sign-in happens on Microsoft's or Google's own page; we get back an access token for
// the person's mailbox (IMAP and SMTP, used with XOAUTH2) and a refresh token to renew it.
// We never see their password.

const crypto = require('crypto');

const MSA_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'; // personal Microsoft accounts (Outlook.com, Hotmail, Live)

// where each kind of account reads and sends mail
const MAIL_SERVERS = {
    google: { imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
    microsoft: { imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false, requireTLS: true } },
    'microsoft-work': { imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false, requireTLS: true } }
};
const LABELS = { google: 'Google', microsoft: 'Microsoft', 'microsoft-work': 'Microsoft 365' };

const b64url = buf => Buffer.from(buf).toString('base64url');
const random = (n = 32) => b64url(crypto.randomBytes(n));
const bad = (message, code = 'failed') => Object.assign(new Error(message), { status: 400, code });

function decodeJwt(token) {
    const part = String(token || '').split('.')[1];
    if (!part) throw bad('The sign-in answer was incomplete');
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * config: { google: { clientId, clientSecret } | null, microsoft: { clientId, clientSecret, tenant } | null,
 *           devIssuer?: string (testing only: a stand-in provider), devMailHost?: string (testing only) }
 */
function createOAuth(config = {}) {
    const dev = config.devIssuer ? config.devIssuer.replace(/\/$/, '') : null;
    const providers = {
        google: config.google && {
            id: 'google',
            name: 'Google',
            client: config.google,
            authUrl: dev ? `${dev}/google/authorize` : 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: dev ? `${dev}/google/token` : 'https://oauth2.googleapis.com/token',
            scope: 'openid email profile https://mail.google.com/',
            // offline + consent: Google only hands out a refresh token when asked like this
            extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
            issuerOk: iss => iss === 'https://accounts.google.com' || iss === 'accounts.google.com' || (dev && iss === `${dev}/google`),
            account(claims) {
                if (claims.email_verified === false || claims.email_verified === 'false') throw bad('Your Google address isn’t verified yet', 'unverified');
                return { email: String(claims.email || '').toLowerCase(), name: claims.name || '', mail: 'google' };
            }
        },
        microsoft: config.microsoft && {
            id: 'microsoft',
            name: 'Microsoft',
            client: config.microsoft,
            authUrl: dev ? `${dev}/microsoft/authorize` : `https://login.microsoftonline.com/${config.microsoft.tenant || 'common'}/oauth2/v2.0/authorize`,
            tokenUrl: dev ? `${dev}/microsoft/token` : `https://login.microsoftonline.com/${config.microsoft.tenant || 'common'}/oauth2/v2.0/token`,
            scope: 'openid email profile offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
            extra: { prompt: 'select_account' },
            issuerOk: iss => /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/.test(iss) || (dev && iss === `${dev}/microsoft`),
            account(claims) {
                // personal accounts (Outlook.com, Hotmail, Live) and work/school accounts (Microsoft 365)
                const email = String(claims.email || claims.preferred_username || '').toLowerCase();
                return { email, name: claims.name || '', mail: claims.tid === MSA_TENANT ? 'microsoft' : 'microsoft-work' };
            }
        }
    };

    async function post(url, form) {
        let res;
        try {
            res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(15000) });
        } catch {
            throw Object.assign(new Error('Couldn’t reach the sign-in service. Try again in a moment.'), { status: 502, code: 'unreachable' });
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            const err = Object.assign(new Error(data.error_description ? String(data.error_description).split('\n')[0].slice(0, 200) : 'The sign-in didn’t go through'), { status: 400, code: data.error || 'failed' });
            if (data.error === 'invalid_grant') err.authenticationFailed = true; // refresh token revoked or expired
            throw err;
        }
        return data;
    }

    return {
        MAIL_SERVERS,
        /** which providers are set up: [{ id, name }] */
        enabled: () => Object.values(providers).filter(Boolean).map(p => ({ id: p.id, name: p.name })),
        has: id => !!providers[id],

        /** step 1: where to send the browser, plus what to remember until it comes back */
        start(id, { redirectUri, loginHint } = {}) {
            const p = providers[id];
            if (!p) throw bad('That sign-in option isn’t set up');
            const state = random(16);
            const nonce = random(16);
            const verifier = random(48);
            const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
            const q = new URLSearchParams({
                client_id: p.client.clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                response_mode: 'query',
                scope: p.scope,
                state,
                nonce,
                code_challenge: challenge,
                code_challenge_method: 'S256',
                ...p.extra,
                ...(loginHint ? { login_hint: loginHint } : {})
            });
            return { url: `${p.authUrl}?${q}`, state, nonce, verifier };
        },

        /** step 2: the code that came back -> tokens and who signed in */
        async finish(id, { code, verifier, redirectUri, nonce }) {
            const p = providers[id];
            if (!p) throw bad('That sign-in option isn’t set up');
            const t = await post(p.tokenUrl, {
                grant_type: 'authorization_code',
                code: String(code || ''),
                redirect_uri: redirectUri,
                client_id: p.client.clientId,
                client_secret: p.client.clientSecret,
                code_verifier: verifier
            });
            if (!t.access_token || !t.id_token) throw bad('The sign-in answer was incomplete');
            // the ID token came straight from the provider over TLS, so its claims can be trusted
            // once they're for us, from them, current, and tied to this sign-in (nonce)
            const c = decodeJwt(t.id_token);
            const aud = [].concat(c.aud || []);
            if (!aud.includes(p.client.clientId)) throw bad('That sign-in was meant for another app');
            if (!p.issuerOk(String(c.iss || ''))) throw bad('That sign-in came from an unexpected place');
            if (!c.exp || c.exp * 1000 < Date.now() - 60000) throw bad('That sign-in expired. Please try again.');
            if (nonce && c.nonce !== nonce) throw bad('That sign-in didn’t match. Please try again.');
            const who = p.account(c);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.email)) throw bad(`Your ${p.name} account has no email address`, 'no_email');
            return {
                ...who,
                tokens: { provider: who.mail, accessToken: t.access_token, refreshToken: t.refresh_token || null, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 }
            };
        },

        /** a fresh access token from a refresh token */
        async refresh(mailProvider, refreshToken) {
            const p = providers[mailProvider === 'google' ? 'google' : 'microsoft'];
            if (!p) throw Object.assign(new Error('That sign-in option was turned off'), { authenticationFailed: true });
            if (!refreshToken) throw Object.assign(new Error('Please sign in again'), { authenticationFailed: true });
            const form = { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: p.client.clientId, client_secret: p.client.clientSecret };
            if (p.id === 'microsoft') form.scope = p.scope;
            const t = await post(p.tokenUrl, form);
            return { accessToken: t.access_token, refreshToken: t.refresh_token || refreshToken, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 };
        },

        /** IMAP and SMTP servers for an account kind ('google', 'microsoft', 'microsoft-work') */
        servers(mailProvider) {
            const s = MAIL_SERVERS[mailProvider];
            if (!s) return null;
            if (!config.devMailHost) return s;
            // testing only: a local mail server that accepts XOAUTH2
            return { imap: { host: config.devMailHost, port: 993, secure: true }, smtp: { host: config.devMailHost, port: 465, secure: true } };
        },
        label: mailProvider => LABELS[mailProvider] || mailProvider
    };
}

module.exports = { createOAuth, MAIL_SERVERS, MSA_TENANT, decodeJwt };
