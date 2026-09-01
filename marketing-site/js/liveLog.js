(function () {
  var cmdTextEl = document.getElementById('consoleCmdText');
  var cursorEl = document.getElementById('consoleCursor');
  var logEl = document.getElementById('consoleLog');
  if (!cmdTextEl || !logEl) return;

  // What actually happens inside a server, in the order it would really
  // happen -- a punishment, a filter catch, a ticket lifecycle, a reaction
  // role grant. Not abstract "features," the actual log lines XyphrosMod
  // writes.
  var SCRIPT = [
    { cmd: '/warn @Rowdy37 spamming invite links', type: 'warn', text: 'Warning logged for Rowdy37 — 2/3 toward auto-mute', meta: 'mod-log' },
    { cmd: '/ban @Raider99 raid account', type: 'ban', text: 'Raider99 banned · DM sent · mod-log updated', meta: 'mod-log' },
    { cmd: '#general: message from @spammer', type: 'filter', text: 'Blocked — matched swear filter, message deleted', meta: 'filters' },
    { cmd: 'panel click → Support', type: 'ticket', text: 'Ticket #482 opened by newcomer21', meta: 'tickets' },
    { cmd: 'ticket_claim #482', type: 'ticket', text: 'Claimed by StaffMod', meta: 'tickets' },
    { cmd: 'ticket_close #482 "resolved"', type: 'ticket', text: 'Closed · transcript saved', meta: 'tickets' },
    { cmd: 'reaction 🎮 on #roles', type: 'role', text: 'Gamer role granted to @newcomer21', meta: 'reaction roles' },
    { cmd: '/lockdown', type: 'lock', text: '#general locked — staff only can post', meta: 'moderation' },
  ];

  var TYPE_COLOR = {
    warn: 'var(--warn)', ban: 'var(--danger)', filter: 'var(--danger)',
    ticket: '#7dd3fc', role: 'var(--accent)', lock: 'var(--warn)',
  };

  var MAX_ENTRIES = 4;

  function addLogEntry(item, animate) {
    var li = document.createElement('li');
    li.className = 'console-log-entry';
    li.style.setProperty('--entry-color', TYPE_COLOR[item.type] || 'var(--accent)');

    var textEl = document.createElement('span');
    textEl.className = 'console-log-text';
    textEl.textContent = item.text;

    var metaEl = document.createElement('span');
    metaEl.className = 'console-log-meta';
    metaEl.textContent = item.meta;

    li.appendChild(textEl);
    li.appendChild(metaEl);
    logEl.insertBefore(li, logEl.firstChild);

    if (animate) {
      requestAnimationFrame(function () { li.classList.add('is-in'); });
    } else {
      li.classList.add('is-in');
    }

    var entries = logEl.querySelectorAll('.console-log-entry');
    if (entries.length > MAX_ENTRIES) {
      entries[entries.length - 1].remove();
    }
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    if (cursorEl) cursorEl.remove();
    cmdTextEl.textContent = SCRIPT[1].cmd;
    addLogEntry(SCRIPT[0], false);
    addLogEntry(SCRIPT[1], false);
    return;
  }

  function typeCmd(text, done) {
    var i = 0;
    cmdTextEl.textContent = '';
    (function step() {
      if (i <= text.length) {
        cmdTextEl.textContent = text.slice(0, i);
        i++;
        setTimeout(step, 20 + Math.random() * 26);
      } else {
        done();
      }
    })();
  }

  var idx = 0;
  var visible = false;
  var stepInFlight = false;

  // Re-entrant: a scroll-away mid-step just marks it not-in-flight without
  // logging that entry, and coming back into view calls this again -- no
  // separate "resume" path to keep in sync with the intersection state.
  function runStep() {
    if (!visible || stepInFlight) return;
    stepInFlight = true;
    var item = SCRIPT[idx % SCRIPT.length];
    idx++;
    typeCmd(item.cmd, function () {
      if (!visible) { stepInFlight = false; return; }
      setTimeout(function () {
        addLogEntry(item, true);
        cmdTextEl.textContent = '';
        stepInFlight = false;
        setTimeout(runStep, 1600);
      }, 420);
    });
  }

  var consoleEl = document.querySelector('.console');
  if (consoleEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (visible) runStep();
      });
    }, { threshold: 0.3 }).observe(consoleEl);
  } else {
    visible = true;
    runStep();
  }
})();
