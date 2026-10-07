<?php
require_staff();
$GLOBALS['page_title'] = 'Print requests - admin';
$GLOBALS['page_desc'] = 'Chat with customers about custom prints and send quotes.';

$statuses = ['new', 'reviewing', 'quoted', 'accepted', 'paid', 'printing', 'complete', 'declined'];
$id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
$back = '?p=admin_requests' . ($id ? '&id=' . $id : '') . (!empty($_GET['hidden']) ? '&hidden=1' : '');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'toggle_open') {
        set_setting('custom_requests_open', custom_requests_open() ? '0' : '1');
        flash(custom_requests_open() ? 'Custom print requests are closed. Existing chats still work.' : 'Custom print requests are open again.');
        redirect('?p=admin_requests');
    }
    if ($action === 'save_closed_message') {
        set_setting('custom_closed_message', trim((string)($_POST['closed_message'] ?? '')));
        flash('Message saved.');
        redirect('?p=admin_requests');
    }

    $r = one('SELECT * FROM custom_requests WHERE id = ?', [$id]);
    if (!$r) redirect('?p=admin_requests');

    if ($action === 'hide' || $action === 'unhide') {
        q('UPDATE custom_requests SET hidden = ? WHERE id = ?', [$action === 'hide' ? 1 : 0, $id]);
        flash($action === 'hide' ? 'Request hidden. Find it under "Hidden".' : 'Request is back in the list.');
        redirect('?p=admin_requests');
    }
    if ($action === 'delete') {
        if ($r['file_path'] && strpos($r['file_path'], 'uploads/models/') === 0) @unlink(__DIR__ . '/../' . $r['file_path']);
        q('DELETE FROM request_messages WHERE request_id = ?', [$id]);
        q('UPDATE orders SET request_id = NULL WHERE request_id = ?', [$id]);
        q('DELETE FROM custom_requests WHERE id = ?', [$id]);
        flash('Request deleted.');
        redirect('?p=admin_requests');
    }
    if ($action === 'message') {
        $body = trim((string)($_POST['body'] ?? ''));
        if ($body !== '') {
            add_request_message($id, 'staff', mb_substr($body, 0, 4000));
            send_mail($r['email'], 'New message about your custom print', setting('store_name', 'Special Love 3D') . " replied:\n\n" . $body . "\n\nReply or see your quote here: " . request_link($r));
        }
        redirect($back . '#chat');
    }
    if ($action === 'quote') {
        $amount = (int)round(((float)($_POST['quote'] ?? 0)) * 100);
        if ($amount <= 0) {
            flash('Enter a quote amount.', 'err');
        } else {
            q('UPDATE custom_requests SET quote_cents = ?, status = "quoted" WHERE id = ?', [$amount, $id]);
            $note = trim((string)($_POST['note'] ?? ''));
            add_request_message($id, 'system', 'Quote: ' . money($amount) . ($note !== '' ? "\n" . $note : '') . "\nYou can pay it right here on this page.");
            send_mail($r['email'], 'Your custom print quote: ' . money($amount), "Your quote is ready: " . money($amount) . ($note !== '' ? "\n\n" . $note : '') . "\n\nPay instantly here: " . request_link($r));
            flash('Quote sent. The customer can pay it straight away.');
        }
        redirect($back);
    }
    if ($action === 'update') {
        $status = (string)($_POST['status'] ?? 'new');
        if (in_array($status, $statuses, true)) {
            q('UPDATE custom_requests SET status = ?, staff_notes = ? WHERE id = ?', [$status, trim((string)($_POST['staff_notes'] ?? '')), $id]);
            if ($status !== $r['status'] && in_array($status, ['printing', 'complete', 'declined'], true)) {
                add_request_message($id, 'system', ['printing' => 'Your print has started! 🖨️', 'complete' => 'Your print is finished and on its way. 📦', 'declined' => 'Sorry, we are unable to take on this print.'][$status]);
            }
            flash('Request updated.');
        }
        redirect($back);
    }
    redirect($back);
}

$open = custom_requests_open();
$r = $id ? one('SELECT * FROM custom_requests WHERE id = ?', [$id]) : null;
?>
<h1>Admin</h1>
<?php admin_tabs('admin_requests'); ?>

<?php if (!$r): ?>
<?php
$showHidden = !empty($_GET['hidden']);
$requests = all('SELECT r.*, (SELECT COUNT(*) FROM request_messages m WHERE m.request_id = r.id AND m.sender = "customer") AS customer_msgs,
                        (SELECT sender FROM request_messages m WHERE m.request_id = r.id AND m.sender <> "system" ORDER BY m.id DESC LIMIT 1) AS last_sender
                 FROM custom_requests r WHERE r.hidden = ? ORDER BY r.created_at DESC LIMIT 200', [$showHidden ? 1 : 0]);
?>
<div class="card" style="margin-bottom:20px">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div>
      <h2 style="margin:0"><?= $open ? '🟢 Taking custom print requests' : '🛑 Custom print requests are closed' ?></h2>
      <p class="small muted" style="margin:4px 0 0"><?= $open ? 'Backed up? Close new requests. Existing chats and quotes keep working.' : 'Customers see the message below instead of the request form.' ?></p>
    </div>
    <form method="post" id="openform">
      <?= csrf_field() ?><input type="hidden" name="action" value="toggle_open">
      <button class="btn <?= $open ? 'danger' : '' ?>" type="submit"><?= $open ? 'Close custom orders' : 'Open custom orders' ?></button>
    </form>
  </div>
  <form method="post" style="margin-top:14px">
    <?= csrf_field() ?><input type="hidden" name="action" value="save_closed_message">
    <label>Message shown while closed <input name="closed_message" placeholder="We're fully booked on custom prints right now. Check back soon!" value="<?= e(setting('custom_closed_message', '')) ?>"></label>
    <button class="btn ghost small" type="submit">Save message</button>
  </form>
</div>

<div class="card">
  <h2>Custom print requests</h2>
  <p class="small">
    <a class="pill<?= !$showHidden ? ' promo' : '' ?>" href="<?= e(url('?p=admin_requests')) ?>">Active</a>
    <a class="pill<?= $showHidden ? ' promo' : '' ?>" href="<?= e(url('?p=admin_requests&hidden=1')) ?>">Hidden</a>
  </p>
  <?php if (!$requests): ?><p class="muted">No requests here.</p><?php endif; ?>
  <div class="table-scroll"><table>
    <thead><tr><th>Customer</th><th>Request</th><th>Status</th><th>Quote</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($requests as $q): ?>
      <tr>
        <td><?= e($q['full_name'] ?: $q['email']) ?><br><span class="small muted"><?= e(date('j M Y', strtotime($q['created_at']))) ?></span></td>
        <td class="small"><?= e($q['material']) ?> &middot; qty <?= (int)$q['quantity'] ?><?php if ($q['last_sender'] === 'customer'): ?><br><span class="pill promo">💬 waiting for your reply</span><?php endif; ?></td>
        <td><span class="pill"><?= e($q['status']) ?></span></td>
        <td><?= $q['quote_cents'] !== null ? money((int)$q['quote_cents']) : '—' ?></td>
        <td style="white-space:nowrap">
          <a class="btn small" href="<?= e(url('?p=admin_requests&id=' . (int)$q['id'])) ?>">Open chat</a>
          <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$q['id'] ?>">
            <button class="btn ghost small" type="submit" name="action" value="<?= $showHidden ? 'unhide' : 'hide' ?>"><?= $showHidden ? 'Unhide' : 'Hide' ?></button>
            <button class="btn danger small" type="submit" name="action" value="delete" onclick="return confirm('Delete this request, its chat and uploaded file? This cannot be undone.')">Delete</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>

<?php else: ?>
<?php
$messages = all('SELECT * FROM request_messages WHERE request_id = ? ORDER BY id', [$r['id']]);
$paidOrder = one("SELECT * FROM orders WHERE request_id = ? AND payment_status IN ('paid', 'refunded') ORDER BY id DESC LIMIT 1", [$r['id']]);
?>
<p><a href="<?= e(url('?p=admin_requests')) ?>">← All requests</a></p>
<div class="grid cols-2" style="align-items:start">
  <div>
    <div class="card" style="margin-bottom:18px">
      <h2><?= e($r['full_name'] ?: $r['email']) ?> <span class="pill"><?= e($r['status']) ?></span><?php if ((int)$r['hidden'] === 1): ?><span class="pill">hidden</span><?php endif; ?></h2>
      <p class="small muted"><?= e(date('j M Y H:i', strtotime($r['created_at']))) ?> &middot; <a href="mailto:<?= e($r['email']) ?>"><?= e($r['email']) ?></a></p>
      <p class="small"><?= e($r['material']) ?> &middot; qty <?= (int)$r['quantity'] ?></p>
      <?php if ($r['details']): ?><p class="small muted"><?= nl2br(e($r['details'])) ?></p><?php endif; ?>
      <?php if ($r['file_path']): ?>
        <p><a class="btn ghost small" href="<?= e(url($r['file_path'])) ?>" download><?= e($r['original_filename'] ?: 'Download model') ?></a></p>
      <?php else: ?><p class="small muted">No file attached.</p><?php endif; ?>
      <p class="small">Customer's chat page: <a href="<?= e(request_link($r)) ?>" target="_blank" rel="noopener">open</a></p>
    </div>

    <div class="quote-box">
      <?php if ($paidOrder): ?>
        <h2>✅ Paid <?= money((int)$paidOrder['total_cents']) ?></h2>
        <p class="small">Order <a href="<?= e(url('?p=admin_orders')) ?>"><?= e($paidOrder['reference']) ?></a>, ship to <?= e($paidOrder['full_name']) ?>, <?= e($paidOrder['address1']) ?>, <?= e($paidOrder['city']) ?> <?= e($paidOrder['postcode']) ?>.</p>
      <?php else: ?>
        <h2><?= $r['quote_cents'] !== null ? 'Quote sent: ' . money((int)$r['quote_cents']) : 'Send a quote' ?></h2>
        <form method="post">
          <?= csrf_field() ?><input type="hidden" name="action" value="quote">
          <label>Price incl. shipping (<?= e(strtoupper(setting('currency', 'AUD'))) ?>)
            <input name="quote" type="number" step="0.01" min="0.5" required value="<?= $r['quote_cents'] !== null ? number_format((int)$r['quote_cents'] / 100, 2, '.', '') : '' ?>"></label>
          <label>Note for the customer (optional) <input name="note" placeholder="e.g. Ready in 5 days, printed in matte black PLA"></label>
          <button class="btn" type="submit"><?= $r['quote_cents'] !== null ? 'Send updated quote' : 'Send quote' ?></button>
          <p class="small muted" style="margin-top:8px">The customer gets a "Pay now" button in their chat<?= stripe_enabled() ? '' : ' (switch on card payments in Admin → Payments first)' ?>.</p>
        </form>
      <?php endif; ?>
    </div>

    <form class="card" method="post">
      <?= csrf_field() ?><input type="hidden" name="action" value="update">
      <label>Status
        <select name="status">
          <?php foreach ($statuses as $s): ?>
            <option value="<?= $s ?>" <?= $r['status'] === $s ? 'selected' : '' ?>><?= $s ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Internal notes (only staff see these) <textarea name="staff_notes"><?= e($r['staff_notes']) ?></textarea></label>
      <button class="btn small" type="submit">Save</button>
    </form>
    <form method="post" style="margin-top:12px;display:flex;gap:8px">
      <?= csrf_field() ?>
      <button class="btn ghost small" type="submit" name="action" value="<?= (int)$r['hidden'] === 1 ? 'unhide' : 'hide' ?>"><?= (int)$r['hidden'] === 1 ? 'Unhide' : 'Hide' ?></button>
      <button class="btn danger small" type="submit" name="action" value="delete" onclick="return confirm('Delete this request, its chat and uploaded file? This cannot be undone.')">Delete request</button>
    </form>
  </div>

  <div class="card" id="chat">
    <h2>Chat</h2>
    <div class="chat" data-chat data-count="<?= count($messages) ?>">
      <?php if (!$messages): ?><p class="muted small">No messages yet.</p><?php endif; ?>
      <?php foreach ($messages as $m): ?>
        <div class="msg <?= $m['sender'] === 'system' ? 'system' : ($m['sender'] === 'staff' ? 'mine' : '') ?>">
          <?= nl2br(e($m['body'])) ?>
          <span class="meta"><?= $m['sender'] === 'system' ? '' : ($m['sender'] === 'staff' ? 'You' : e($r['full_name'] ?: $r['email'])) . ' · ' ?><?= e(date('j M H:i', strtotime($m['created_at']))) ?></span>
        </div>
      <?php endforeach; ?>
    </div>
    <form method="post" style="margin-top:12px">
      <?= csrf_field() ?><input type="hidden" name="action" value="message">
      <label>Reply <textarea name="body" required maxlength="4000"></textarea></label>
      <button class="btn" type="submit">Send</button>
      <p class="small muted" style="margin-top:6px">The customer is emailed a link to your reply.</p>
    </form>
  </div>
</div>
<?php endif; ?>
