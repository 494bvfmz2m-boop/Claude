<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_tickets');
$me = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'toggle_status') {
        db_execute("UPDATE tickets SET status = IF(status = 'open', 'closed', 'open') WHERE id = ?", [$id]);
        redirect(SITE_URL . '/admin/tickets?view=' . $id);
    }

    if ($action === 'delete') {
        db_execute("DELETE FROM tickets WHERE id = ?", [$id]);
        redirect(SITE_URL . '/admin/tickets');
    }

    if ($action === 'reply') {
        $message = trim($_POST['message'] ?? '');
        $ticket = find_ticket_by_id($id);
        if ($ticket && $message !== '') {
            add_ticket_reply($id, $me['id'], $me['username'], $message, true);
            $notifyEmail = ticket_contact_email($ticket);
            if ($notifyEmail) {
                $link = SITE_URL . '/ticket?id=' . $id . (empty($ticket['user_id']) ? '&token=' . $ticket['access_token'] : '');
                send_ticket_reply_email($notifyEmail, $ticket['subject'], $link);
            }
        }
        redirect(SITE_URL . '/admin/tickets?view=' . $id);
    }
}

$filter = $_GET['status'] ?? 'open';
$filter = in_array($filter, ['open', 'closed', 'all'], true) ? $filter : 'open';
$viewId = isset($_GET['view']) ? (int)$_GET['view'] : null;
$viewTicket = $viewId ? find_ticket_by_id($viewId) : null;

$pageTitle = 'Support Tickets';
$activeAdminPage = 'tickets';
require_once __DIR__ . '/../includes/header.php';

$tickets = get_tickets($filter === 'all' ? null : $filter);
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">

    <?php if ($viewTicket): ?>
      <a href="<?= SITE_URL ?>/admin/tickets?status=<?= e($filter) ?>" class="btn btn-outline btn-sm" style="margin-bottom:18px;">← All tickets</a>
      <h1><?= e($viewTicket['subject']) ?></h1>
      <p class="post-meta">
        <span class="post-type-tag<?= $viewTicket['status'] === 'open' ? ' announcement' : '' ?>"><?= e($viewTicket['status']) ?></span>
        <span class="muted">· <?= e(time_ago($viewTicket['created_at'])) ?></span>
      </p>

      <?php $ticket = $viewTicket; $replies = get_ticket_replies($ticket['id']); require __DIR__ . '/../includes/ticket_thread.php'; ?>

      <div class="card">
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="id" value="<?= (int)$viewTicket['id'] ?>">
          <div class="field">
            <label for="message">Reply</label>
            <textarea id="message" name="message" rows="4" required></textarea>
          </div>
          <button type="submit" name="action" value="reply" class="btn btn-primary">Send reply</button>
        </form>
      </div>

      <div style="margin-top:16px; display:flex; gap:8px;">
        <form method="post" class="inline-form">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="toggle_status">
          <input type="hidden" name="id" value="<?= (int)$viewTicket['id'] ?>">
          <button type="submit" class="btn btn-outline btn-sm"><?= $viewTicket['status'] === 'open' ? 'Mark closed' : 'Re-open' ?></button>
        </form>
        <form method="post" class="inline-form" data-confirm="Delete this ticket? This also deletes the whole conversation.">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id" value="<?= (int)$viewTicket['id'] ?>">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </div>

    <?php else: ?>

      <h1>Support Tickets</h1>
      <div class="rules-tabs" style="justify-content:flex-start; margin-bottom:22px;">
        <a href="<?= SITE_URL ?>/admin/tickets?status=open" class="btn btn-sm <?= $filter === 'open' ? 'btn-primary' : 'btn-outline' ?>">Open</a>
        <a href="<?= SITE_URL ?>/admin/tickets?status=closed" class="btn btn-sm <?= $filter === 'closed' ? 'btn-primary' : 'btn-outline' ?>">Closed</a>
        <a href="<?= SITE_URL ?>/admin/tickets?status=all" class="btn btn-sm <?= $filter === 'all' ? 'btn-primary' : 'btn-outline' ?>">All</a>
      </div>

      <?php if (empty($tickets)): ?>
        <p class="muted">No <?= $filter === 'all' ? '' : e($filter) . ' ' ?>tickets.</p>
      <?php else: ?>
        <div class="user-list">
          <?php foreach ($tickets as $t): ?>
            <div class="user-row">
              <div class="user-row-info">
                <span class="post-type-tag<?= $t['status'] === 'open' ? ' announcement' : '' ?>"><?= e($t['status']) ?></span>
                <strong><?= e($t['subject']) ?></strong>
                <span class="muted user-row-email">
                  <?= e($t['submitted_name']) ?><?= $t['user_id'] ? '' : ' (guest)' ?> · <?= e(time_ago($t['created_at'])) ?>
                </span>
              </div>
              <a href="<?= SITE_URL ?>/admin/tickets?view=<?= (int)$t['id'] ?>&status=<?= e($filter) ?>" class="btn btn-outline btn-sm">View</a>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
