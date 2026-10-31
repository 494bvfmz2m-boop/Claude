'use strict';

// Two-step verification setup: QR code, enabling, recovery codes, turning it off.

const express = require('express');
const QRCode = require('qrcode');
const totp = require('../../lib/totp');
const { wrap } = require('../http');
const { newRecoveryCodes } = require('../twofa');

module.exports = function twofaRoutes({ store, checkCode }) {
    const r = express.Router();

    r.get('/', (req, res) => {
        const tf = store.getTwofa(req.session.email);
        res.json({ enabled: !!(tf && tf.secret), since: tf && tf.since, recoveryLeft: tf && tf.recovery ? tf.recovery.length : 0 });
    });

    r.post('/setup', wrap(async (req, res) => {
        const tf = store.getTwofa(req.session.email);
        if (tf && tf.secret) return res.status(400).json({ error: 'Two-factor is already on' });
        const secret = totp.generateSecret();
        store.setTwofa(req.session.email, { pending: secret });
        const uri = totp.otpauthUri(secret, req.session.email);
        const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d12', light: '#ffffff' } });
        res.json({ secret: secret.match(/.{1,4}/g).join(' '), uri, qr });
    }));

    r.post('/enable', (req, res) => {
        const tf = store.getTwofa(req.session.email);
        if (!tf || !tf.pending) return res.status(400).json({ error: 'Start setup first' });
        if (totp.verify(tf.pending, req.body.code) === null) return res.status(400).json({ error: 'That code didn’t match. Make sure your phone’s clock is right and try the newest code.' });
        const { codes, hashes } = newRecoveryCodes();
        store.setTwofa(req.session.email, { secret: tf.pending, since: Date.now(), recovery: hashes });
        // other devices never passed a 2FA check: sign them out, keep this one
        store.sessions.revokeAll(req.session.email, req.session.sid);
        res.json({ ok: true, recovery: codes });
    });

    r.post('/disable', (req, res) => {
        const tf = store.getTwofa(req.session.email);
        if (!tf || !tf.secret) return res.json({ ok: true });
        if (!checkCode(req.session.email, tf, req.body.code).ok) return res.status(400).json({ error: 'That code didn’t work' });
        store.setTwofa(req.session.email, null);
        res.json({ ok: true });
    });

    r.post('/recovery', (req, res) => {
        const tf = store.getTwofa(req.session.email);
        if (!tf || !tf.secret) return res.status(400).json({ error: 'Two-factor is off' });
        if (!checkCode(req.session.email, tf, req.body.code).ok) return res.status(400).json({ error: 'That code didn’t work' });
        const { codes, hashes } = newRecoveryCodes();
        store.setTwofa(req.session.email, { ...store.getTwofa(req.session.email), recovery: hashes });
        res.json({ recovery: codes });
    });

    return r;
};
