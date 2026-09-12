<?php
require_once __DIR__ . '/includes/bootstrap.php';

$me = current_user();
$id = (int)($_GET['id'] ?? 0);
$token = $_GET['token'] ?? '';
$ticket = find_ticket_by_id($id);

$isStaff = $me && user_has_permission($me, 'manage_tickets');
$isOwner = $me && $ticket && !empty($ticket['user_id']) && (int)$ticket['user_id'] === (int)$me['id'];
$tokenOk = $ticket && !empty($ticket['access_token']) && $token !== '' && hash_equals($ticket['access_token'], $token);
$hasAccess = $ticket && ($isStaff || $isOwner || $tokenOk);

$error = null;

if ($hasAccess && $_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';

    if ($action === 'reply') {
        $message = trim($_POST['message'] ?? '');
        if ($message === '') {
            $error = 'Please write a message before sending.';
        } else {
            $authorId = $me ? $me['id'] : null;
            $authorName = $me ? $me['username'] : $ticket['submitted_name'];
            add_ticket_reply($ticket['id'], $authorId, $authorName, $message, $isStaff);

            // A reply from the submitter's side reopens a closed ticket automatically.
            if (!$isStaff && $ticket['status'] === 'closed') {
                db_execute("UPDATE tickets SET status = 'open' WHERE id = ?", [$ticket['id']]);
            }

            // Notify the other side.
            if ($isStaff) {
                $notifyEmail = ticket_contact_email($ticket);
                if ($notifyEmail) {
                    $link = SITE_URL . '/ticket?id=' . $ticket['id'] . (empty($ticket['user_id']) ? '&token=' . $ticket['access_token'] : '');
                    send_ticket_reply_email($notifyEmail, $ticket['subject'], $link);
                }
            }

            $qs = 'id=' . $ticket['id'] . ($token !== '' ? '&token=' . urlencode($token) : '');
            redirect(SITE_URL . '/ticket?' . $qs);
        }
    }

    if ($action === 'toggle_status' && $isStaff) {
        db_execute("UPDATE tickets SET status = IF(status = 'open', 'closed', 'open') WHERE id = ?", [$ticket['id']]);
        redirect(SITE_URL . '/ticket?id=' . $ticket['id']);
    }
}

$pageTitle = $ticket ? $ticket['subject'] : 'Ticket';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';

$replies = $hasAccess ? get_ticket_replies($ticket['id']) : [];
?>
<section class="section">
  <div class="wrap" style="max-width: 700px;">
    <?php if (!$ticket): ?>
      <div class="section-head">
        <h2>Ticket not found</h2>
        <p><a href="<?= SITE_URL ?>/support">Submit a new ticket</a></p>
      </div>
    <?php elseif (!$hasAccess): ?>
      <div class="section-head">
        <h2>Can't view this ticket</h2>
        <p>Either log in with the account that submitted it, or use the link you were emailed.</p>
      </div>
    <?php else: ?>
      <div class="post-meta" style="margin-bottom:6px;">
        <span class="post-type-tag<?= $ticket['status'] === 'open' ? ' announcement' : '' ?>"><?= e($ticket['status']) ?></span>
        <span class="muted">· <?= e(time_ago($ticket['created_at'])) ?></span>
      </div>
      <h1><?= e($ticket['subject']) ?></h1>

      <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

      <?php require __DIR__ . '/includes/ticket_thread.php'; ?>

      <div class="card ticket-reply-form">
        <form method="post">
          <?= csrf_field() ?>
          <div class="field">
            <label for="message">Reply</label>
            <textarea id="message" name="message" rows="4" required></textarea>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="submit" name="action" value="reply" class="btn btn-primary">Send reply</button>
          </div>
        </form>
        <?php if ($isStaff): ?>
          <form method="post" style="margin-top:10px;">
            <?= csrf_field() ?>
            <button type="submit" name="action" value="toggle_status" class="btn btn-outline btn-sm"><?= $ticket['status'] === 'open' ? 'Mark closed' : 'Re-open' ?></button>
          </form>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
