<?php
// Custom print request: private chat with the shop, and paying the quote.
$r = one('SELECT * FROM custom_requests WHERE id = ?', [(int)($_GET['id'] ?? 0)]);
if (!$r || !can_view_request($r)) {
    http_response_code(404);
    echo '<h1>Request not found</h1><p class="muted">Use the link from your email, or sign in with the email you used for the request.</p>';
    return;
}
$GLOBALS['page_title'] = 'Your custom print request - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Chat about your custom print and pay your quote.';
$link = request_link($r);
$errors = [];

// Back from Stripe without paying.
$cancelRef = (string)($_GET['cancel'] ?? '');
if ($cancelRef !== '' && $cancelRef === ($_SESSION['pending_order'] ?? null)) {
    unset($_SESSION['pending_order']);
    $pending = one('SELECT * FROM orders WHERE reference = ? AND request_id = ?', [$cancelRef, $r['id']]);
    if ($pending && discard_unpaid_order($pending)) flash('Payment cancelled. Nothing was charged; you can pay whenever you are ready.', 'warn');
    redirect($link);
}

$paidOrder = one("SELECT * FROM orders WHERE request_id = ? AND payment_status IN ('paid', 'refunded') ORDER BY id DESC LIMIT 1", [$r['id']]);
$canPay = !$paidOrder && $r['quote_cents'] !== null && (int)$r['quote_cents'] > 0
    && in_array($r['status'], ['quoted', 'accepted'], true) && stripe_enabled();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'message') {
        $body = trim((string)($_POST['body'] ?? ''));
        if ($body === '') {
            $errors[] = 'Type a message first.';
        } elseif (!throttle('chat', 30, 900)) {
            $errors[] = 'You are sending messages very quickly. Please wait a few minutes.';
        } else {
            add_request_message((int)$r['id'], is_staff() ? 'staff' : 'customer', mb_substr($body, 0, 4000));
            if (!is_staff()) {
                $owner = setting('contact_email', '');
                if ($owner) send_mail($owner, 'New message about a custom print', ($r['full_name'] ?: $r['email']) . " wrote:\n\n" . $body . "\n\nReply: " . url('?p=admin_requests&id=' . (int)$r['id']));
            }
            redirect($link . '#chat');
        }
    }

    if ($action === 'pay' && $canPay) {
        $f = [];
        foreach (['full_name', 'phone', 'address1', 'address2', 'city', 'state', 'postcode', 'country'] as $k) $f[$k] = trim((string)($_POST[$k] ?? ''));
        if ($f['full_name'] === '') $errors[] = 'Please enter your name.';
        if ($f['address1'] === '' || $f['city'] === '' || $f['postcode'] === '') $errors[] = 'Please complete your delivery address.';
        if (!$errors) {
            $total = (int)$r['quote_cents'];
            $ref = order_ref();
            q('INSERT INTO orders (reference, user_id, email, full_name, phone, address1, address2, city, state, postcode, country, notes,
                shipping_method, subtotal_cents, shipping_cents, gst_cents, total_cents, request_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
                $ref, $r['user_id'], $r['email'], $f['full_name'], $f['phone'], $f['address1'], $f['address2'],
                $f['city'], $f['state'], $f['postcode'], $f['country'] ?: 'Australia', 'Custom print request #' . (int)$r['id'],
                'quote', $total, 0, gst_cents($total), $total, $r['id'],
            ]);
            $orderId = (int)db()->lastInsertId();
            q('INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES (?,?,?,?,?)',
              [$orderId, null, 'Custom print (' . $r['material'] . ', qty ' . (int)$r['quantity'] . ') - request #' . (int)$r['id'], $total, 1]);
            $order = one('SELECT * FROM orders WHERE id = ?', [$orderId]);
            $items = all('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);
            $cancel = '?p=request&id=' . (int)$r['id'] . '&t=' . urlencode((string)$r['access_token']) . '&cancel=' . urlencode($ref);
            [$payUrl, $err] = stripe_checkout_session($order, $items, $cancel);
            if ($payUrl) {
                $_SESSION['pending_order'] = $ref;
                redirect($payUrl);
            }
            delete_order($orderId);
            $errors[] = 'The payment page could not be opened: ' . $err;
        }
    }
}

$messages = all('SELECT * FROM request_messages WHERE request_id = ? ORDER BY id', [$r['id']]);
$mySide = is_staff() ? 'staff' : 'customer';
$last = one('SELECT * FROM orders WHERE request_id = ? ORDER BY id DESC LIMIT 1', [$r['id']]);
?>
<h1>Custom print request #<?= (int)$r['id'] ?> <span class="pill"><?= e($r['status']) ?></span></h1>
<?php if (is_staff()): ?><p class="small"><a href="<?= e(url('?p=admin_requests&id=' . (int)$r['id'])) ?>">← Open in Admin to send a quote</a></p><?php endif; ?>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <div>
    <div data-quote>
      <?php if ($paidOrder): ?>
        <div class="quote-box">
          <h2>✅ Paid</h2>
          <p>You paid <strong><?= money((int)$paidOrder['total_cents']) ?></strong>. We'll keep you posted here while it prints.</p>
          <a class="btn small" href="<?= e(url('?p=receipt&ref=' . urlencode($paidOrder['reference']))) ?>">View receipt</a>
        </div>
      <?php elseif ($r['quote_cents'] !== null && in_array($r['status'], ['quoted', 'accepted'], true)): ?>
        <div class="quote-box">
          <h2>Your quote: <?= money((int)$r['quote_cents']) ?></h2>
          <p class="small muted">Includes printing and shipping. Pay below and we'll start right away.</p>
          <?php if ($canPay): ?>
            <form method="post">
              <?= csrf_field() ?><input type="hidden" name="action" value="pay">
              <?php $src = $_POST ?: ($last ?: ['full_name' => $r['full_name']]); ?>
              <label>Full name <input name="full_name" required value="<?= e($src['full_name'] ?? '') ?>"></label>
              <label>Phone <input name="phone" value="<?= e($src['phone'] ?? '') ?>"></label>
              <label>Address <input name="address1" required value="<?= e($src['address1'] ?? '') ?>"></label>
              <label>Apartment / unit (optional) <input name="address2" value="<?= e($src['address2'] ?? '') ?>"></label>
              <div class="row">
                <label>City / suburb <input name="city" required value="<?= e($src['city'] ?? '') ?>"></label>
                <label>State / region <input name="state" value="<?= e($src['state'] ?? '') ?>"></label>
                <label>Postcode <input name="postcode" required value="<?= e($src['postcode'] ?? '') ?>"></label>
                <label>Country <input name="country" value="<?= e($src['country'] ?? 'Australia') ?>"></label>
              </div>
              <button class="btn hover-sheen" type="submit" style="width:100%">Pay <?= money((int)$r['quote_cents']) ?> now</button>
              <?php if (setting('stripe_promo_codes', '1') === '1'): ?><p class="small muted" style="margin-top:8px">Have a discount code? You can enter it on the payment page.</p><?php endif; ?>
            </form>
          <?php else: ?>
            <p class="small muted">Online payment isn't switched on right now. Send us a message and we'll sort out payment.</p>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    </div>

    <div class="card">
      <h2>Your request</h2>
      <p class="small"><?= e($r['material']) ?> &middot; qty <?= (int)$r['quantity'] ?> &middot; sent <?= e(date('j M Y', strtotime($r['created_at']))) ?></p>
      <?php if ($r['details']): ?><p class="muted"><?= nl2br(e($r['details'])) ?></p><?php endif; ?>
      <p class="small muted"><?= $r['original_filename'] ? 'File: ' . e($r['original_filename']) : 'No file attached.' ?></p>
      <p class="small muted">Keep this page's link private: anyone with it can see this chat.</p>
    </div>
  </div>

  <div class="card" id="chat">
    <h2>Chat with <?= e(setting('store_name', 'Special Love')) ?></h2>
    <div class="chat" data-chat data-count="<?= count($messages) ?>">
      <?php foreach ($messages as $m): ?>
        <div class="msg <?= $m['sender'] === 'system' ? 'system' : ($m['sender'] === $mySide ? 'mine' : '') ?>">
          <?= nl2br(e($m['body'])) ?>
          <span class="meta"><?= $m['sender'] === 'system' ? '' : ($m['sender'] === 'staff' ? e(setting('store_name', 'Special Love')) : e($r['full_name'] ?: 'You')) . ' · ' ?><?= e(date('j M H:i', strtotime($m['created_at']))) ?></span>
        </div>
      <?php endforeach; ?>
    </div>
    <form method="post" style="margin-top:12px">
      <?= csrf_field() ?><input type="hidden" name="action" value="message">
      <label>Message <textarea name="body" required maxlength="4000" placeholder="Ask a question, share a size or colour..."></textarea></label>
      <button class="btn" type="submit">Send</button>
    </form>
  </div>
</div>
