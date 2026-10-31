'use strict';

const addressparser = require('nodemailer/lib/addressparser');

// Lets async route handlers throw: errors reach the error middleware.
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) => Object.assign(new Error(message), { status });

const folderOf = req => String(req.query.folder || (req.body && req.body.folder) || 'INBOX');
const uidList = v => [].concat(v || []).map(Number).filter(n => Number.isInteger(n) && n > 0);
const isEmail = v => /^[^\s@]+@[^\s@]+$/.test(String(v || ''));

const parseAddresses = v =>
    addressparser(String(v || ''), { flatten: true })
        .filter(a => a.address && /@/.test(a.address))
        .map(a => ({ name: a.name || '', address: a.address }));

function requireAuth(req, res, next) {
    if (!req.session) return res.status(401).json({ error: 'Not signed in' });
    next();
}

module.exports = { wrap, httpError, folderOf, uidList, isEmail, parseAddresses, requireAuth };
