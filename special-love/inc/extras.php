<?php
// Helpers for galleries, reviews, themes, receipts and the custom print chat.

/** Send a plain-text email through the server's mail(). Returns false if the host refuses. */
function send_mail(string $to, string $subject, string $body): bool {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $from = setting('contact_email', '');
    $store = setting('store_name', 'Special Love 3D');
    $headers = ['Content-Type: text/plain; charset=UTF-8'];
    if (filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'From: ' . mb_encode_mimeheader($store) . ' <' . $from . '>';
        $headers[] = 'Reply-To: ' . $from;
    }
    return @mail($to, mb_encode_mimeheader($subject), $body, implode("\r\n", $headers));
}

/** Social links set in Admin -> Store settings, as label => url. */
function social_links(): array {
    return array_filter([
        'Instagram' => setting('instagram_url', ''),
        'Facebook'  => setting('facebook_url', ''),
        'TikTok'    => setting('tiktok_url', ''),
        'YouTube'   => setting('youtube_url', ''),
    ]);
}

const SL_THEMES = [
    'none'      => ['label' => 'Normal',    'icon' => '✨'],
    'halloween' => ['label' => 'Halloween', 'icon' => '🎃'],
    'christmas' => ['label' => 'Christmas', 'icon' => '🎄'],
    'easter'    => ['label' => 'Easter',    'icon' => '🐣'],
];

function active_theme(): string {
    $t = setting('theme', 'none');
    return isset(SL_THEMES[$t]) ? $t : 'none';
}

function custom_requests_open(): bool {
    return setting('custom_requests_open', '1') === '1';
}

// ---------- product photos and videos ----------

const SL_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const SL_VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v'];

/** Save one uploaded photo or video. Returns ['path' => ..., 'kind' => image|video] or null. */
function save_product_media(array $file, array &$errors): ?array {
    if (empty($file['name']) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    $label = mb_substr((string)$file['name'], 0, 60);
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors[] = $label . ': upload failed. It may be bigger than your hosting allows (check upload_max_filesize in cPanel).';
        return null;
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (in_array($ext, SL_IMAGE_EXT, true)) {
        if ((int)$file['size'] > 10 * 1024 * 1024) { $errors[] = $label . ': photos must be 10 MB or smaller.'; return null; }
        if (@getimagesize($file['tmp_name']) === false) { $errors[] = $label . ': not a readable image.'; return null; }
        $kind = 'image';
    } elseif (in_array($ext, SL_VIDEO_EXT, true)) {
        if ((int)$file['size'] > 100 * 1024 * 1024) { $errors[] = $label . ': videos must be 100 MB or smaller.'; return null; }
        $mime = function_exists('mime_content_type') ? (string)@mime_content_type($file['tmp_name']) : 'video/';
        if (strpos($mime, 'video/') !== 0 && $mime !== 'application/octet-stream') { $errors[] = $label . ': not a video file.'; return null; }
        $kind = 'video';
    } else {
        $errors[] = $label . ': use a JPG, PNG, WEBP, GIF or AVIF photo, or an MP4, WEBM or MOV video.';
        return null;
    }
    $dir = __DIR__ . '/../uploads/products';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        $errors[] = $label . ': could not be saved. Check the uploads folder is writable.';
        return null;
    }
    return ['path' => 'uploads/products/' . $name, 'kind' => $kind];
}

/** Turn a multiple file input ($_FILES['media']) into a list of single files. */
function uploaded_files(string $field): array {
    $f = $_FILES[$field] ?? null;
    if (!$f || !is_array($f['name'])) return $f && $f['name'] !== '' ? [$f] : [];
    $out = [];
    foreach ($f['name'] as $i => $n) {
        $out[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $out;
}

function product_media(int $productId): array {
    return all('SELECT * FROM product_media WHERE product_id = ? ORDER BY sort, id', [$productId]);
}

/** Keep products.image (used on cards and in the cart) pointing at the first photo. */
function refresh_product_cover(int $productId): void {
    $first = one('SELECT path FROM product_media WHERE product_id = ? AND kind = "image" ORDER BY sort, id LIMIT 1', [$productId]);
    q('UPDATE products SET image = ? WHERE id = ?', [$first['path'] ?? null, $productId]);
}

// ---------- reviews ----------

function stars(int $rating): string {
    $rating = max(1, min(5, $rating));
    return '<span class="stars" aria-label="' . $rating . ' out of 5">' . str_repeat('★', $rating) . '<span>' . str_repeat('★', 5 - $rating) . '</span></span>';
}

/** Handle the review form. Returns a list of errors (empty when saved). */
function submit_review(int $productId): array {
    $name = trim((string)($_POST['name'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $body = trim((string)($_POST['body'] ?? ''));
    $rating = max(1, min(5, (int)($_POST['rating'] ?? 5)));
    $errors = [];
    if ($name === '') $errors[] = 'Please add your name.';
    if (mb_strlen($body) < 5) $errors[] = 'Please write a few words for your review.';
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'That email address does not look right.';
    if (!$errors && !throttle('review', 5, 3600)) $errors[] = 'Too many reviews from you just now. Please try again later.';
    if ($errors) return $errors;
    $verified = $email !== '' && one("SELECT 1 FROM orders WHERE email = ? AND payment_status = 'paid' LIMIT 1", [$email]) ? 1 : 0;
    q('INSERT INTO reviews (product_id, name, email, rating, body, verified) VALUES (?,?,?,?,?,?)',
      [$productId ?: null, mb_substr($name, 0, 120), $email ?: null, $rating, mb_substr($body, 0, 2000), $verified]);
    $owner = setting('contact_email', '');
    if ($owner) send_mail($owner, 'New review waiting for approval', $name . ' (' . $rating . "/5):\n\n" . $body . "\n\nApprove it in Admin: " . url('?p=admin_reviews'));
    flash('Thank you! Your review will appear once we have checked it.');
    return [];
}

// ---------- custom print chat ----------

function request_link(array $r): string {
    return url('?p=request&id=' . (int)$r['id'] . '&t=' . urlencode((string)$r['access_token']));
}

function can_view_request(array $r): bool {
    if (is_staff()) return true;
    $t = (string)($_GET['t'] ?? $_POST['t'] ?? '');
    if ($t !== '' && !empty($r['access_token']) && hash_equals((string)$r['access_token'], $t)) return true;
    $u = current_user();
    return $u && ((int)$r['user_id'] === (int)$u['id'] || strcasecmp((string)$r['email'], (string)$u['email']) === 0);
}

function add_request_message(int $requestId, string $sender, string $body): void {
    q('INSERT INTO request_messages (request_id, sender, body) VALUES (?,?,?)', [$requestId, $sender, $body]);
}

// ---------- receipts ----------

/** Runs once when an order becomes paid: links quote payments back to the chat and emails a receipt. */
function after_order_paid(int $orderId): void {
    $order = one('SELECT * FROM orders WHERE id = ?', [$orderId]);
    if (!$order) return;
    if (!empty($order['request_id'])) {
        $r = one('SELECT * FROM custom_requests WHERE id = ?', [$order['request_id']]);
        if ($r && $r['status'] !== 'paid') {
            q('UPDATE custom_requests SET status = "paid" WHERE id = ?', [$r['id']]);
            add_request_message((int)$r['id'], 'system', 'Quote paid: ' . money((int)$order['total_cents']) . ' (order ' . $order['reference'] . '). We will start printing soon.');
        }
    }
    if ((int)$order['receipt_sent'] === 0) {
        q('UPDATE orders SET receipt_sent = 1 WHERE id = ?', [$orderId]);
        send_mail($order['email'], 'Your receipt for order ' . $order['reference'], receipt_text($order));
        $owner = setting('contact_email', '');
        if ($owner) send_mail($owner, 'New paid order ' . $order['reference'], "A new order was paid.\n\n" . receipt_text($order) . "\n\nOpen it in Admin: " . url('?p=admin_orders'));
    }
}

function receipt_text(array $order): string {
    $lines = [];
    $lines[] = setting('store_name', 'Special Love 3D') . ' - receipt';
    $lines[] = 'Order: ' . $order['reference'];
    $lines[] = 'Date: ' . date('j M Y', strtotime($order['created_at']));
    $lines[] = '';
    foreach (all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]) as $it) {
        $lines[] = $it['name'] . ' x ' . (int)$it['qty'] . '   ' . money((int)$it['unit_price_cents'] * (int)$it['qty']);
    }
    $lines[] = 'Shipping   ' . money((int)$order['shipping_cents']);
    if ((int)$order['discount_cents'] > 0) $lines[] = 'Discount' . ($order['discount_code'] ? ' (' . $order['discount_code'] . ')' : '') . '   -' . money((int)$order['discount_cents']);
    $lines[] = 'Total paid   ' . money((int)$order['total_cents']);
    $lines[] = '';
    $lines[] = 'View or print your receipt: ' . url('?p=receipt&ref=' . urlencode($order['reference']));
    $lines[] = '';
    $lines[] = 'Thank you for supporting our small business!';
    return implode("\n", $lines);
}
