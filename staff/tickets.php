<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_support');

$navPage = 'tickets';
$pageTitle = 'Support chat';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $ticketId = $_POST['ticket_id'] ?? '';
    $ticket = $ticketId ? SupportTicket::find($ticketId) : null;
    $action = $_POST['action'] ?? '';

    if ($ticket && $action === 'reply') {
        $body = trim($_POST['body'] ?? '');
        if ($body !== '') {
            SupportTicket::addMessage($ticketId, 'staff', $currentStaffUser['id'], $currentStaffUser['name'] ?: $currentStaffUser['username'], $body);
        }
        header('Location: /staff/tickets?ticket=' . rawurlencode($ticketId));
        exit;
    }

    if ($ticket && $action === 'close') {
        SupportTicket::close($ticketId, $currentStaffUser['id']);
        AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?: $currentStaffUser['username'], 'support_ticket_closed', $ticket['user_id'], $ticket['subject'], 'Closed a support conversation');
        header('Location: /staff/tickets?status=open');
        exit;
    }
}

$status = ($_GET['status'] ?? 'open') === 'closed' ? 'closed' : 'open';
$tickets = SupportTicket::all($status);

$activeTicketId = $_GET['ticket'] ?? ($tickets[0]['id'] ?? '');
$activeTicket = $activeTicketId ? SupportTicket::find($activeTicketId) : null;
$activeMessages = $activeTicket ? SupportTicket::messages($activeTicket['id']) : [];
if ($activeTicket) {
    SupportTicket::markReadByStaff($activeTicket['id']);
    $activeUser = XyphrosAuth::findById($activeTicket['user_id']);
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Support chat</h1>
        <p>Every conversation a signed-in customer has started from the site.</p>
    </div>
</div>

<div class="product-tabs">
    <a href="/staff/tickets?status=open" class="product-tab <?php echo $status === 'open' ? 'is-active' : ''; ?>">Open</a>
    <a href="/staff/tickets?status=closed" class="product-tab <?php echo $status === 'closed' ? 'is-active' : ''; ?>">Closed</a>
</div>

<div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
    <div class="staff-card" style="flex:0 0 300px; min-width:260px; padding:12px; max-height:640px; overflow-y:auto;">
        <?php if (empty($tickets)): ?>
            <div class="empty-state" style="padding:30px 16px;">
                <div class="empty-state__icon"><?php echo xs_icon('chat', 22); ?></div>
                <p style="margin:0;font-size:13px;">No <?php echo $status; ?> conversations.</p>
            </div>
        <?php else: foreach ($tickets as $t): ?>
            <?php $tUser = XyphrosAuth::findById($t['user_id']); ?>
            <a href="/staff/tickets?status=<?php echo e($status); ?>&ticket=<?php echo e($t['id']); ?>"
               style="display:block;padding:12px;border-radius:var(--radius-sm);margin-bottom:4px;<?php echo ($activeTicket && $t['id'] === $activeTicket['id']) ? 'background:var(--gradient-soft);' : ''; ?>">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <strong style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><?php echo e($tUser['name'] ?? $tUser['username'] ?? 'Unknown'); ?></strong>
                    <?php if (!empty($t['unread_by_staff'])): ?><span class="staff-nav__badge" style="margin-left:0;">&bull;</span><?php endif; ?>
                </div>
                <div style="font-size:12px;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;"><?php echo e($t['subject']); ?></div>
                <div style="font-size:11px;color:var(--text-faint);margin-top:4px;"><?php echo e(time_ago($t['last_message_at'])); ?></div>
            </a>
        <?php endforeach; endif; ?>
    </div>

    <div class="staff-card" style="flex:1; min-width:280px; padding:0; display:flex; flex-direction:column; height:640px;">
        <?php if (!$activeTicket): ?>
            <div class="empty-state" style="margin:auto;border:none;">
                <div class="empty-state__icon"><?php echo xs_icon('chat', 24); ?></div>
                <p style="margin:0;">Pick a conversation from the list.</p>
            </div>
        <?php else: ?>
            <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                <div>
                    <strong style="font-size:14.5px;"><?php echo e($activeUser['name'] ?? $activeUser['username'] ?? 'Unknown user'); ?></strong>
                    <div style="font-size:12px;color:var(--text-faint);"><?php echo e($activeUser['email'] ?? ''); ?></div>
                </div>
                <?php if ($activeTicket['status'] === 'open'): ?>
                <form method="post" onsubmit="return confirm('Close this conversation? The customer can still start a new one any time.');">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="ticket_id" value="<?php echo e($activeTicket['id']); ?>">
                    <input type="hidden" name="action" value="close">
                    <button type="submit" class="btn btn--danger btn--sm">Close ticket</button>
                </form>
                <?php else: ?>
                    <span class="badge-muted">Closed <?php echo e(time_ago($activeTicket['closed_at'] ?? $activeTicket['last_message_at'])); ?></span>
                <?php endif; ?>
            </div>
            <div id="ticket-thread" style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
                <?php foreach ($activeMessages as $m): ?>
                    <?php echo xs_render_support_message($m); ?>
                <?php endforeach; ?>
            </div>
            <?php if ($activeTicket['status'] === 'open'): ?>
            <form method="post" id="reply-form" style="display:flex;gap:8px;padding:14px;border-top:1px solid var(--border);align-items:flex-end;">
                <?php csrf_field(); ?>
                <input type="hidden" name="ticket_id" value="<?php echo e($activeTicket['id']); ?>">
                <input type="hidden" name="action" value="reply">
                <textarea name="body" id="reply-input" rows="2" placeholder="Reply&hellip; (Enter to send, Shift+Enter for a new line)" required style="flex:1;resize:none;" autofocus></textarea>
                <button type="submit" class="btn btn--primary btn--sm">Send</button>
            </form>
            <?php else: ?>
            <div style="padding:14px 20px;border-top:1px solid var(--border);color:var(--text-faint);font-size:12.5px;text-align:center;">This conversation is closed.</div>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</div>

<?php if ($activeTicket && $activeTicket['status'] === 'open'): ?>
<script>
(function () {
    var thread = document.getElementById('ticket-thread');
    var ticketId = <?php echo json_encode($activeTicket['id']); ?>;
    var lastId = <?php echo json_encode(end($activeMessages) ? end($activeMessages)['id'] : ''); ?>;

    thread.scrollTop = thread.scrollHeight;

    setInterval(function () {
        fetch('/staff/ticket-poll?ticket=' + encodeURIComponent(ticketId) + '&after=' + encodeURIComponent(lastId))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.ok) return;
                (data.messages || []).forEach(function (m) {
                    var wrap = document.createElement('div');
                    wrap.innerHTML = data.html[m.id];
                    thread.appendChild(wrap.firstElementChild);
                    lastId = m.id;
                });
                if (data.messages && data.messages.length) thread.scrollTop = thread.scrollHeight;
                if (data.ticket && data.ticket.status === 'closed') location.reload();
            })
            .catch(function () {});
    }, 5000);

    // Enter sends the reply, Shift+Enter still inserts a newline.
    var replyForm = document.getElementById('reply-form');
    var replyInput = document.getElementById('reply-input');
    if (replyForm && replyInput) {
        replyInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (replyInput.value.trim()) replyForm.requestSubmit();
            }
        });
    }
})();
</script>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>
