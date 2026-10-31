'use strict';

// Live updates: Server-Sent Events fed by an IMAP IDLE connection on the inbox.

const express = require('express');
const { wrap } = require('../http');

module.exports = function eventRoutes({ mail, wakeDue }) {
    const r = express.Router();

    r.get('/events', wrap(async (req, res) => {
        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        let stop = null;
        let closed = false;
        const ping = setInterval(() => res.write(': ping\n\n'), 25000);
        const waker = setInterval(async () => {
            const woke = await wakeDue(req.session, true).catch(() => 0);
            if (woke) send('snooze', { woke });
        }, 30000);
        req.on('close', () => {
            closed = true;
            clearInterval(ping);
            clearInterval(waker);
            if (stop) stop();
        });
        try {
            stop = await mail.watchInbox(req.session, change => send('mailbox', change));
            if (closed) stop();
            else send('ready', {});
        } catch {
            send('unavailable', {});
            res.end();
        }
    }));

    return r;
};
