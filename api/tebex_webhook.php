<?php
/**
 * Receives Tebex webhook events (Creator Panel -> your store -> Webhooks ->
 * set the URL to https://yourdomain.com/api/tebex_webhook). Purely a
 * convenience log for Admin -> Store — the storefront and checkout flow in
 * store.php/basket.php work completely independently of this file, so if
 * Tebex ever changes their payload shape, worst case is a missing/incomplete
 * row here, not a broken purchase flow.
 *
 * Tebex validates a new webhook URL by first POSTing a
 * {"type":"validation.webhook","subject":{"id":"..."}} payload and expecting
 * this endpoint to echo that id back to https://webhooks.tebex.io/api/validate
 * so it can confirm you actually control this URL.
 */
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/database.php';

header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

// Optional shared secret, if the store owner set one up (see
// includes/tebex_config.example.php). Skipped entirely if left blank.
if (defined('TEBEX_WEBHOOK_SECRET') && TEBEX_WEBHOOK_SECRET !== '') {
    $signature = $_SERVER['HTTP_X_SIGNATURE'] ?? $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
    $expected = hash_hmac('sha256', $raw, TEBEX_WEBHOOK_SECRET);
    if (!$signature || !hash_equals($expected, $signature)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'invalid signature']);
        exit;
    }
}

$type = $payload['type'] ?? '';

// Handshake Tebex sends when you first save the webhook URL.
if ($type === 'validation.webhook') {
    $validationId = $payload['subject']['id'] ?? $payload['id'] ?? null;
    if ($validationId) {
        $ch = curl_init('https://webhooks.tebex.io/api/validate');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['id' => $validationId]),
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
    echo json_encode(['ok' => true]);
    exit;
}

// Only log actual completed payments — ignore every other event type.
if (strpos($type, 'payment.completed') === false) {
    echo json_encode(['ok' => true, 'ignored' => true]);
    exit;
}

$subject = $payload['subject'] ?? $payload;
$transactionId = $subject['transaction_id'] ?? $subject['id'] ?? $payload['id'] ?? null;

if (!$transactionId) {
    echo json_encode(['ok' => true, 'ignored' => true]);
    exit;
}

$basketIdent = $subject['basket']['ident'] ?? null;
$minecraftUsername = $subject['player']['username'] ?? $subject['username'] ?? null;
$email = $subject['customer']['email'] ?? $subject['email'] ?? null;
$total = $subject['price']['amount'] ?? $subject['amount'] ?? null;
$currency = $subject['price']['currency'] ?? $subject['currency'] ?? null;

try {
    db_execute(
        "INSERT INTO tebex_orders (transaction_id, basket_ident, minecraft_username, email, total, currency, status, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
         ON DUPLICATE KEY UPDATE basket_ident = VALUES(basket_ident), minecraft_username = VALUES(minecraft_username),
             email = VALUES(email), total = VALUES(total), currency = VALUES(currency), raw_payload = VALUES(raw_payload)",
        [$transactionId, $basketIdent, $minecraftUsername, $email, $total, $currency, $raw]
    );
} catch (PDOException $e) {
    // Never fail the webhook response over a logging problem — Tebex will
    // retry on a non-2xx, which would just duplicate-process the same order.
}

echo json_encode(['ok' => true]);
