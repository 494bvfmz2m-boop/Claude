<?php
/**
 * Floating support chat widget. Only ever included by footer.php when
 * a user is signed in — support chat is tied to an account, so signed-
 * out visitors get pointed at /contact instead (see footer.php).
 */
$xsSupportTicket = SupportTicket::openForUser($xsCurrentUser['id']);
$xsSupportMessages = $xsSupportTicket ? SupportTicket::messages($xsSupportTicket['id']) : [];
$xsSupportUnread = $xsSupportTicket && !empty($xsSupportTicket['unread_by_user']);
$xsSupportLastMsgId = !empty($xsSupportMessages) ? end($xsSupportMessages)['id'] : '';
?>
<div class="support-widget" id="support-widget"
     data-ticket-id="<?php echo e($xsSupportTicket['id'] ?? ''); ?>"
     data-ticket-status="<?php echo e($xsSupportTicket['status'] ?? ''); ?>"
     data-last-msg-id="<?php echo e($xsSupportLastMsgId); ?>"
     data-csrf="<?php echo e(XyphrosAuth::csrfToken()); ?>">
    <button type="button" class="support-widget__fab" id="support-fab" aria-label="Open support chat" aria-haspopup="dialog" aria-expanded="false">
        <?php echo xs_icon('chat', 22); ?>
        <span class="support-widget__dot" id="support-unread-dot" <?php echo $xsSupportUnread ? '' : 'hidden'; ?>></span>
    </button>
    <div class="support-widget__panel" id="support-panel" hidden role="dialog" aria-label="Support chat" aria-modal="false">
        <div class="support-widget__head">
            <span><?php echo xs_icon('chat', 16); ?> Support</span>
            <button type="button" class="support-widget__close" id="support-close" aria-label="Close chat"><?php echo xs_icon('x', 16); ?></button>
        </div>
        <div class="support-widget__body" id="support-messages">
            <?php if (empty($xsSupportMessages)): ?>
                <p class="support-widget__empty">Send us a message and a real person will reply here. Your conversation is saved on your account until we mark it resolved.</p>
            <?php else: foreach ($xsSupportMessages as $m): ?>
                <?php echo xs_render_support_message($m); ?>
            <?php endforeach; endif; ?>
        </div>
        <div class="support-widget__closed-note" id="support-closed-note" <?php echo ($xsSupportTicket && $xsSupportTicket['status'] === 'closed') ? '' : 'hidden'; ?>>
            This conversation was closed by our team. Sending a message below starts a new one.
        </div>
        <form class="support-widget__foot" id="support-form">
            <textarea id="support-input" placeholder="Type a message&hellip;" rows="1" maxlength="4000"></textarea>
            <button type="submit" class="support-widget__send" aria-label="Send message"><?php echo xs_icon('send', 16); ?></button>
        </form>
    </div>
</div>
