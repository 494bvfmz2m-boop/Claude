<?php
/**
 * Stripe webhook endpoint.
 * Put this URL in Stripe: https://yourshop.com/webhook.php
 */
declare(strict_types=1);
session_start();
require __DIR__ . '/inc/helpers.php';
require __DIR__ . '/inc/db.php';
require __DIR__ . '/inc/stripe.php';

$payload = file_get_contents('php://input') ?: '';
$sig = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? null;
$secret = (string) setting(stripe_mode() === 'live' ? 'stripe_live_webhook_secret' : 'stripe_test_webhook_secret', '');

if (!stripe_verify_webhook($payload, $sig, $secret)) {
    http_response_code(400);
    exit('Invalid signature');
}

$event = json_decode($payload, true);
$type = $event['type'] ?? '';
$obj = $event['data']['object'] ?? [];

if ($type === 'checkout.session.completed' || $type === 'checkout.session.async_payment_succeeded') {
    $ref = $obj['client_reference_id'] ?? ($obj['metadata']['order_reference'] ?? null);
    $sessionId = $obj['id'] ?? null;
    if ($ref) {
        q('UPDATE orders SET payment_status = "paid", status = IF(status = "new", "paid", status) WHERE reference = ?', [$ref]);
    } elseif ($sessionId) {
        q('UPDATE orders SET payment_status = "paid" WHERE stripe_session_id = ?', [$sessionId]);
    }
} elseif ($type === 'checkout.session.expired' || $type === 'checkout.session.async_payment_failed') {
    $ref = $obj['client_reference_id'] ?? null;
    if ($ref) q('UPDATE orders SET payment_status = "unpaid" WHERE reference = ? AND payment_status <> "paid"', [$ref]);
}

http_response_code(200);
echo 'ok';
