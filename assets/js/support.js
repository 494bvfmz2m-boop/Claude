document.addEventListener('DOMContentLoaded', function () {
    var widget = document.getElementById('support-widget');
    if (!widget) return;

    var fab = document.getElementById('support-fab');
    var panel = document.getElementById('support-panel');
    var closeBtn = document.getElementById('support-close');
    var body = document.getElementById('support-messages');
    var closedNote = document.getElementById('support-closed-note');
    var form = document.getElementById('support-form');
    var input = document.getElementById('support-input');
    var dot = document.getElementById('support-unread-dot');

    var csrf = widget.dataset.csrf;
    var ticketId = widget.dataset.ticketId || '';
    var ticketStatus = widget.dataset.ticketStatus || '';
    var lastMsgId = widget.dataset.lastMsgId || '';
    var pollTimer = null;
    var isOpen = false;

    function scrollToBottom() {
        body.scrollTop = body.scrollHeight;
    }

    function clearEmptyState() {
        var empty = body.querySelector('.support-widget__empty');
        if (empty) empty.remove();
    }

    function appendMessage(html) {
        clearEmptyState();
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        body.appendChild(wrap.firstElementChild);
        scrollToBottom();
    }

    function setClosed(closed) {
        ticketStatus = closed ? 'closed' : 'open';
        closedNote.hidden = !closed;
    }

    function setUnread(on) {
        dot.hidden = !on;
    }

    function openPanel() {
        isOpen = true;
        panel.hidden = false;
        fab.hidden = true;
        fab.setAttribute('aria-expanded', 'true');
        setUnread(false);
        scrollToBottom();
        startPolling(4000);
        input.focus();
    }

    function closePanel() {
        isOpen = false;
        panel.hidden = true;
        fab.hidden = false;
        fab.setAttribute('aria-expanded', 'false');
        startPolling(20000);
    }

    function startPolling(interval) {
        if (pollTimer) clearInterval(pollTimer);
        if (!ticketId) return;
        pollTimer = setInterval(poll, interval);
    }

    function poll() {
        if (!ticketId) return;
        var url = '/support-poll?ticket=' + encodeURIComponent(ticketId) + '&after=' + encodeURIComponent(lastMsgId);
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.ok) return;
                (data.messages || []).forEach(function (m) {
                    appendMessage(renderBubble(m));
                    lastMsgId = m.id;
                });
                if (data.ticket) {
                    setClosed(data.ticket.status === 'closed');
                    if (!isOpen && data.messages && data.messages.some(function (m) { return m.sender_type === 'staff'; })) {
                        setUnread(true);
                    }
                }
            })
            .catch(function () {});
    }

    function renderBubble(m) {
        var side = m.sender_type === 'staff' ? 'staff' : 'user';
        var div = document.createElement('div');
        var textDiv = document.createElement('div');
        textDiv.textContent = m.body;
        return '<div class="support-msg support-msg--' + side + '" data-msg-id="' + m.id + '">'
            + '<div class="support-msg__bubble">' + textDiv.innerHTML.replace(/\n/g, '<br>') + '</div>'
            + '<div class="support-msg__meta">' + escapeHtml(m.sender_name) + ' &middot; just now</div>'
            + '</div>';
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    fab.addEventListener('click', function () {
        if (panel.hidden) openPanel(); else closePanel();
    });
    closeBtn.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) closePanel();
    });

    // Auto-grow the textarea up to a small cap instead of scrolling inside a tiny box.
    input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        input.style.height = 'auto';

        fetch('/support-send', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf_token: csrf, body: text }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.ok) {
                    appendMessage('<div class="support-msg support-msg--error">' + escapeHtml(data.error || 'That failed to send.') + '</div>');
                    return;
                }
                ticketId = data.ticket.id;
                widget.dataset.ticketId = ticketId;
                setClosed(false);
                var newest = data.messages[data.messages.length - 1];
                if (newest) lastMsgId = newest.id;
                // Re-render the whole thread on send (simplest correct way to
                // handle the "closed ticket -> brand new ticket" transition,
                // where every message in `messages` is new to this ticket id).
                clearEmptyState();
                body.innerHTML = '';
                data.messages.forEach(function (m) { body.innerHTML += renderBubble(m); });
                scrollToBottom();
                startPolling(isOpen ? 4000 : 20000);
            })
            .catch(function () {
                appendMessage('<div class="support-msg support-msg--error">Couldn\'t reach the server. Try again.</div>');
            });
    });

    if (ticketId) startPolling(20000);
});
