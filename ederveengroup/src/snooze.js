'use strict';

// Snoozed mail wakes lazily: whenever the user is online (folder refreshes and the live
// stream), since the server only holds credentials inside the user's own session.
function createSnoozeWaker({ store, mail }) {
    const lastWake = new Map();
    return async function wakeDue(session, force) {
        const now = Date.now();
        if (!force && now - (lastWake.get(session.email) || 0) < 20000) return 0;
        lastWake.set(session.email, now);
        const due = store.takeDueSnoozes(session.email, now);
        return due.length ? mail.wakeSnoozes(session, due) : 0;
    };
}

module.exports = { createSnoozeWaker };
