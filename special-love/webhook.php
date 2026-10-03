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
ensure_storefront_schema();

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
    $order = $ref ? one('SELECT * FROM orders WHERE reference = ?', [$ref])
        : ($sessionId ? one('SELECT * FROM orders WHERE stripe_session_id = ?', [$sessionId]) : null);
    $paidNow = $type === 'checkout.session.async_payment_succeeded' || ($obj['payment_status'] ?? '') === 'paid';
    if ($order && $paidNow && $order['payment_status'] !== 'paid') stripe_mark_paid($order, $obj);
} elseif ($type === 'checkout.session.expired' || $type === 'checkout.session.async_payment_failed') {
    // Never paid: throw the order away.
    $ref = $obj['client_reference_id'] ?? null;
    $order = $ref ? one('SELECT * FROM orders WHERE reference = ?', [$ref]) : null;
    if ($order && !in_array($order['payment_status'], ['paid', 'refunded'], true)) delete_order((int)$order['id']);
}

http_response_code(200);
echo 'ok';
