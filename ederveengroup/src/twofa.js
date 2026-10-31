'use strict';

const crypto = require('crypto');
const totp = require('../lib/totp');

const hashCode = c => crypto.createHash('sha256').update(c).digest('hex');
const normRecovery = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function newRecoveryCodes() {
    const codes = Array.from({ length: 10 }, () => {
        const raw = totp.base32Encode(crypto.randomBytes(5)).slice(0, 8);
        return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    });
    return { codes, hashes: codes.map(c => hashCode(normRecovery(c))) };
}

// Checks a 6-digit code (never the same one twice) or a single-use recovery code.
function createSecondFactor(store) {
    const lastStep = new Map(); // email -> last accepted TOTP time step
    return function check(email, tf, input) {
        const code = String(input || '').trim();
        if (/^\d{3}\s?\d{3}$/.test(code)) {
            const step = totp.verify(tf.secret, code);
            if (step === null || step <= (lastStep.get(email) || 0)) return { ok: false };
            lastStep.set(email, step);
            return { ok: true, method: '2fa' };
        }
        const idx = (tf.recovery || []).indexOf(hashCode(normRecovery(code)));
        if (idx < 0 || !normRecovery(code)) return { ok: false };
        tf.recovery.splice(idx, 1);
        store.setTwofa(email, tf);
        return { ok: true, method: 'recovery-code', usedRecovery: true, recoveryLeft: tf.recovery.length };
    };
}

module.exports = { newRecoveryCodes, createSecondFactor, hashCode, normRecovery };
