'use strict';

// Mail servers other than the default (Purelymail): people ask to bring their own mailbox,
// an admin accepts or rejects, and accepted addresses (or whole domains) sign in against
// their own IMAP/SMTP servers.
//
// Connections to servers people type in are only ever made to public internet addresses on
// the standard encrypted mail ports, so the request form can't be used to probe the network
// this server lives in. Passwords given to check a request are used once and never stored.

const dns = require('dns').promises;
const net = require('net');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

const PORTS = { imap: { 993: 'tls', 143: 'starttls' }, smtp: { 465: 'tls', 587: 'starttls' } };
const HOST_RE = /^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/i;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[a-z0-9.-]{3,253}$/i;

const clean = v => String(v == null ? '' : v).trim();

/** validates one server ({ host, port, security }) for 'imap' or 'smtp'; returns it or throws */
function cleanServer(kind, input = {}) {
    const host = clean(input.host).toLowerCase().replace(/\.$/, '');
    const port = Number(input.port);
    const security = clean(input.security).toLowerCase() || PORTS[kind][port];
    const label = kind.toUpperCase();
    if (!HOST_RE.test(host) || net.isIP(host)) throw bad(`Enter the ${label} server as a host name, like ${kind}.example.com`);
    if (!PORTS[kind][port]) throw bad(`${label} must use port ${kind === 'imap' ? '993 (SSL/TLS) or 143 (STARTTLS)' : '465 (SSL/TLS) or 587 (STARTTLS)'}`);
    if (!['tls', 'starttls'].includes(security)) throw bad(`${label} has to be encrypted (SSL/TLS or STARTTLS)`);
    return { host, port, security };
}
const bad = message => Object.assign(new Error(message), { status: 400 });

/** a request from the form, validated (the password is handled separately and never kept) */
function cleanRequest(body = {}) {
    const email = clean(body.email).toLowerCase();
    if (!EMAIL_RE.test(email)) throw bad('Enter your full email address');
    return {
        name: clean(body.name).replace(/[\r\n<>"]/g, '').slice(0, 80),
        email,
        imap: cleanServer('imap', body.imap),
        smtp: cleanServer('smtp', body.smtp),
        login: body.login === 'local' ? 'local' : 'email',
        note: clean(body.note).slice(0, 500)
    };
}

/* ---------- only public addresses ---------- */
function isPublicIp(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return !(
            a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
        );
    }
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPublicIp(v.slice(7));
    return !(v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff') || v.startsWith('2001:db8'));
}

/** resolves a host and returns an address to connect to, refusing private networks */
async function publicAddress(host, { allowPrivate = false } = {}) {
    let addrs;
    try {
        addrs = await dns.lookup(host, { all: true });
    } catch {
        throw bad(`${host} doesn’t exist (check the spelling)`);
    }
    if (!addrs.length) throw bad(`${host} doesn’t exist`);
    if (!allowPrivate && addrs.some(a => !isPublicIp(a.address))) throw bad(`${host} isn’t a public mail server`);
    return addrs[0].address;
}

/* ---------- connecting ---------- */
const userFor = (email, login) => (login === 'local' ? email.split('@')[0] : email);

function imapOptions(server, address, auth) {
    return {
        host: address || server.host,
        servername: server.host, // certificates are checked against the name, not the address
        port: server.port,
        secure: server.security === 'tls',
        ...(server.security === 'starttls' ? { doSTARTTLS: true } : {}),
        auth,
        logger: false,
        emitLogs: false,
        connectionTimeout: 12000,
        greetingTimeout: 10000
    };
}

function smtpOptions(server, address, auth) {
    return {
        host: address || server.host,
        port: server.port,
        secure: server.security === 'tls',
        requireTLS: server.security === 'starttls',
        tls: { servername: server.host },
        auth,
        connectionTimeout: 12000,
        greetingTimeout: 10000
    };
}

/** signs in to both servers once to prove the settings (and the mailbox) are right */
async function checkRequest(req, password, { allowPrivate = false } = {}) {
    const auth = { user: userFor(req.email, req.login), pass: String(password || '') };
    if (!auth.pass) throw bad('Enter your mailbox password so we can check the settings');
    const imapAt = await publicAddress(req.imap.host, { allowPrivate });
    const client = new ImapFlow(imapOptions(req.imap, imapAt, auth));
    client.on('error', () => {});
    try {
        await client.connect();
    } catch (err) {
        throw bad(err.authenticationFailed ? 'Your IMAP server didn’t accept that email and password' : `Couldn’t connect to ${req.imap.host}:${req.imap.port}`);
    }
    await client.logout().catch(() => {});
    const smtpAt = await publicAddress(req.smtp.host, { allowPrivate });
    const transport = nodemailer.createTransport(smtpOptions(req.smtp, smtpAt, auth));
    try {
        await transport.verify();
    } catch (err) {
        throw bad(/auth|credential|535|534/i.test(String(err && (err.code || err.message))) ? 'Your SMTP server didn’t accept that email and password' : `Couldn’t connect to ${req.smtp.host}:${req.smtp.port}`);
    } finally {
        transport.close();
    }
    return true;
}

/* ---------- auto-detect (Thunderbird's provider database, then the domain's MX) ---------- */
function parseAutoconfig(xml) {
    const pick = type => {
        const m = new RegExp(`<(incoming|outgoing)Server[^>]*type="${type}"[^>]*>([\\s\\S]*?)</\\1Server>`, 'gi');
        let best = null;
        for (const [, , body] of xml.matchAll(m)) {
            const tag = t => ((new RegExp(`<${t}>([^<]*)</${t}>`, 'i').exec(body) || [])[1] || '').trim();
            const socket = tag('socketType').toUpperCase();
            const security = socket === 'SSL' ? 'tls' : socket === 'STARTTLS' ? 'starttls' : null;
            const server = { host: tag('hostname').toLowerCase(), port: Number(tag('port')), security, login: /%EMAILLOCALPART%/.test(tag('username')) ? 'local' : 'email' };
            if (!security || !PORTS[type === 'imap' ? 'imap' : 'smtp'][server.port]) continue;
            if (!best || (best.security !== 'tls' && security === 'tls')) best = server;
        }
        return best;
    };
    const imap = pick('imap');
    const smtp = pick('smtp');
    return imap && smtp ? { imap: { host: imap.host, port: imap.port, security: imap.security }, smtp: { host: smtp.host, port: smtp.port, security: smtp.security }, login: imap.login } : null;
}

async function fetchIspdb(domain) {
    try {
        const res = await fetch(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(6000) });
        return res.ok ? parseAutoconfig(await res.text()) : null;
    } catch {
        return null;
    }
}

/** best guess of the settings for an address, or { purelymail: true } when it's already supported */
async function autodetect(email) {
    const domain = clean(email).toLowerCase().split('@')[1];
    if (!domain || !HOST_RE.test(domain)) throw bad('Enter your email address first');
    let mx = [];
    try {
        mx = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority).map(r => r.exchange.toLowerCase());
    } catch {
        // no MX records: fall back to the provider database only
    }
    if (mx.some(h => h === 'purelymail.com' || h.endsWith('.purelymail.com'))) return { purelymail: true };
    const direct = await fetchIspdb(domain);
    if (direct) return { ...direct, source: 'provider' };
    // custom domains hosted somewhere well known: look the mail host's provider up instead
    if (mx[0]) {
        const provider = mx[0].split('.').slice(-2).join('.');
        if (provider !== domain) {
            const viaMx = await fetchIspdb(provider);
            if (viaMx) return { ...viaMx, source: 'mx' };
        }
    }
    return null;
}

module.exports = { autodetect, checkRequest, cleanRequest, cleanServer, imapOptions, isPublicIp, parseAutoconfig, publicAddress, smtpOptions, userFor };
