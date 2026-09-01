<?php
/**
 * Tebex webhook receiver. Register this URL at
 * creator.tebex.io/webhooks/endpoints:
 *
 *     https://xyphros.net/webhook-tebex
 *
 * (no ".php" on the end — the site auto-redirects any .php URL to its
 * clean version, and webhooks don't follow redirects, so registering
 * the .php version would silently fail validation forever.)
 *
 * Then copy the secret it gives you into TEBEX_WEBHOOK_SECRET in
 * includes/config.php.
 *
 * Two layers of verification before anything here is trusted:
 *   1. Sender IP must be one of Tebex's two known webhook IPs.
 *   2. X-Signature header must match a SHA256 HMAC of the body, keyed
 *      with the webhook secret — this is the real proof the request
 *      came from Tebex and wasn't spoofed by someone who just guessed
 *      this URL.
 */
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/mailer.php';

// Tebex's fixed webhook sender IPs, per their docs. This is a soft check
// only — if the host sits behind any proxy/CDN, REMOTE_ADDR may not be
// Tebex's real IP even for a legitimate request, and this used to hard
// -404 with zero logging when that happened, silently eating every
// webhook. The signature check right below is the real proof of
// authenticity; this just logs anything unexpected for visibility.
$allowedIps = ['18.209.80.3', '54.87.231.232'];
$senderIp = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($senderIp, $allowedIps, true)) {
    error_log("Tebex webhook: sender IP {$senderIp} not in the known list — continuing anyway, relying on signature verification.");
}

$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

if (empty(TEBEX_WEBHOOK_SECRET)) {
    error_log('Tebex webhook received but TEBEX_WEBHOOK_SECRET is not set yet — rejecting.');
    http_response_code(503);
    exit;
}

$expectedSignature = hash_hmac('sha256', hash('sha256', $rawBody), TEBEX_WEBHOOK_SECRET);
if (!hash_equals($expectedSignature, $signature)) {
    error_log('Tebex webhook signature mismatch — request discarded.');
    http_response_code(401);
    exit;
}

$payload = json_decode($rawBody, true);
if (!is_array($payload) || empty($payload['type'])) {
    http_response_code(400);
    exit;
}

error_log('Tebex webhook received: type=' . $payload['type'] . ' id=' . ($payload['id'] ?? 'unknown'));

// Tebex sends this once when an endpoint is first added, to confirm it's
// live before sending anything real to it.
if ($payload['type'] === 'validation.webhook') {
    header('Content-Type: application/json');
    echo json_encode(['id' => $payload['id']]);
    exit;
}

$subject = $payload['subject'] ?? [];

switch ($payload['type']) {
    case 'payment.completed':
        handlePaymentCompleted($subject);
        break;
    case 'payment.declined':
        updateOrderStatus($subject, 'declined');
        break;
    case 'payment.refunded':
        updateOrderStatus($subject, 'refunded');
        break;
    case 'payment.dispute.opened':
        updateOrderStatus($subject, 'disputed');
        break;
    default:
        // Everything else (recurring payments, dispute resolutions, etc.)
        // isn't acted on yet — acknowledge it so Tebex doesn't retry, but
        // there's nothing to do until subscriptions/perks actually exist.
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);
exit;

/** Match a webhook payment subject back to our own pending order record. */
function findOrder(array $subject): ?array
{
    // We no longer send a "username" on basket creation (see Tebex.php —
    // that field is for real player-account validation, which Xyphros
    // accounts don't have). The reliable link back is the custom data
    // set at basket creation, which Tebex includes in this webhook.
    $xyphrosUserId = $subject['custom']['xyphros_user_id'] ?? null;
    if (!$xyphrosUserId) return null;

    $candidates = [];
    foreach (Content::all('shop_orders') as $order) {
        if (($order['status'] ?? '') === 'pending' && (string) ($order['xyphros_user_id'] ?? '') === (string) $xyphrosUserId) {
            $candidates[] = $order;
        }
    }
    if (empty($candidates)) return null;

    // If they somehow have more than one pending order (e.g. two tabs),
    // the most recently created one is the one this payment belongs to.
    usort($candidates, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    return $candidates[0];
}

function handlePaymentCompleted(array $subject): void
{
    $transactionId = $subject['transaction_id'] ?? null;
    if (!$transactionId) return;

    $match = findOrder($subject);
    if (!$match) {
        error_log('Tebex payment.completed webhook: no matching pending order found for transaction ' . $transactionId);
        return;
    }

    Content::update('shop_orders', $match['id'], [
        'status' => 'completed',
        'transaction_id' => $transactionId,
        'price_paid' => $subject['price_paid']['amount'] ?? $match['price'],
        'completed_at' => date('c'),
    ]);
    error_log("Tebex payment.completed: order {$match['id']} marked completed (transaction {$transactionId}).");

    // The order is recorded — that part can never be lost now regardless
    // of what happens below. Everything past this point is best-effort
    // (email delivery); wrapped in try/catch so a slow/failing SMTP call
    // can't turn into a fatal error, though a genuinely slow send could
    // still make Tebex mark this webhook as retrying even though the
    // purchase itself is already safely recorded — a harmless cosmetic
    // status in Tebex's dashboard in that case, not a functional issue,
    // since a retry just finds no matching *pending* order and no-ops.
    try {
        $buyer = XyphrosAuth::findById($match['xyphros_user_id']);
        $licenseKey = maybeIssueLicenseKey($match);
        sendOrderEmail($match, $buyer, $licenseKey);
    } catch (Throwable $e) {
        error_log("Tebex payment.completed: post-completion email/license work failed for order {$match['id']}: " . $e->getMessage());
    }

    // Grant any Discord role this package maps to (TEBEX_DISCORD_ROLES in
    // config.php), using the Discord account the buyer had linked at
    // checkout time. Best-effort and non-fatal, same reasoning as email
    // above — the order itself is already safely recorded regardless.
    try {
        Discord::grantRoleForOrder($match, $buyer ?? null);
    } catch (Throwable $e) {
        error_log("Tebex payment.completed: Discord role grant threw for order {$match['id']}: " . $e->getMessage());
    }
}

/** One combined email: order confirmation, plus the license key if this package issued one. */
function sendOrderEmail(array $order, ?array $buyer, ?array $licenseKey): void
{
    if (!$buyer) return;

    $orderLabel = !empty($order['order_number']) ? ' (Order #' . (int) $order['order_number'] . ')' : '';
    $subject = 'Your Xyphros order is confirmed' . $orderLabel;

    if ($licenseKey) {
        $tierData  = License::tiers()[$licenseKey['tier']] ?? null;
        $tierLabel = $tierData['label'] ?? 'a license boost';
        $redeemUrl = $tierData['redeem_url'] ?? 'https://portal.xyphros.net/redeem';
        $redeemProduct = $tierData['redeem_product'] ?? 'XyphrosPortal';
        $bodyHtml = 'Thanks for your purchase of <strong>' . e($order['package_name']) . '</strong>' . e($orderLabel) . '. '
            . 'Your license key for <strong>' . e($tierLabel) . '</strong> is below — redeem it inside ' . e($redeemProduct) . ' to apply it.';
        $bodyText = "Thanks for your purchase!\n\n{$order['package_name']}{$orderLabel}\n\n"
            . "Your license key for {$tierLabel}:\n{$licenseKey['key']}\n\nRedeem it at {$redeemUrl}";
        $footerNote = "Didn't see this land in your inbox? Check your spam folder. "
            . "You can also view this key anytime — go to your account, open the Orders tab, and click \"View key\" next to this purchase.";

        $html = render_license_email('Order confirmed', $bodyHtml, $licenseKey['key'], 'Redeem in ' . $redeemProduct, $redeemUrl, $footerNote);
    } else {
        $bodyHtml = 'Thanks for your purchase of <strong>' . e($order['package_name']) . '</strong>' . e($orderLabel) . '. Your order is confirmed.';
        $bodyText = "Thanks for your purchase!\n\n{$order['package_name']}{$orderLabel}\n\nYour order is confirmed.";
        $footerNote = "Didn't see this land in your inbox? Check your spam folder.";

        $html = render_notice_email('Order confirmed', $bodyHtml, 'View order history', 'https://xyphros.net/account?tab=orders', $footerNote);
    }

    [$ok] = send_smtp_mail($buyer['email'], $subject, $bodyText, [], $html);

    if ($ok) {
        Content::update('shop_orders', $order['id'], ['confirmation_email_sent' => true]);
        if ($licenseKey) License::markEmailSent($licenseKey['id']);
    } else {
        error_log("Tebex payment.completed: combined confirmation/license email failed to send for order {$order['id']}.");
    }
}

/**
 * If the purchased package is mapped to a workspace-boost tier (see
 * TEBEX_LICENSE_PACKAGES in config.php), auto-generates a license key.
 * Returns the record (with 'key', 'tier', 'id') or null if this package
 * doesn't issue one. Redeeming happens later, by the buyer, inside
 * XyphrosPortal (/redeem) — we don't apply the boost automatically here.
 */
function maybeIssueLicenseKey(array $order): ?array
{
    $packageId = (int) ($order['package_id'] ?? 0);
    $tier = License::tierForPackage($packageId);
    if (!$tier || !isset(License::tiers()[$tier])) return null;

    if (empty($order['xyphros_user_id'])) return null;

    $keys = License::generate($tier, 1, [
        'source' => 'purchase',
        'package_id' => $packageId,
        'basket_ident' => $order['basket_ident'] ?? null,
        'order_id' => $order['id'] ?? null,
        'order_number' => $order['order_number'] ?? null,
        'purchased_by_user_id' => $order['xyphros_user_id'],
        'email_sent' => false,
    ]);
    $key = $keys[0] ?? null;
    if (!$key) {
        error_log("Tebex payment.completed: failed to generate license key for order {$order['id']}.");
        return null;
    }

    $record = License::findByKey($key);
    error_log("Tebex payment.completed: issued license key {$key} (tier {$tier}) for order {$order['id']}.");
    return $record;
}

function updateOrderStatus(array $subject, string $status): void
{
    $transactionId = $subject['transaction_id'] ?? null;

    if ($status === 'declined') {
        // A declined payment never reached payment.completed, so there's
        // no transaction_id on our order yet — match the same way as a
        // fresh completion would.
        $match = findOrder($subject);
        if ($match) {
            Content::update('shop_orders', $match['id'], ['status' => 'declined']);
        }
        return;
    }

    // Refunds/disputes happen after a completed payment, which already
    // recorded a transaction_id — that's the reliable match here.
    if (!$transactionId) return;
    foreach (Content::all('shop_orders') as $order) {
        if (($order['transaction_id'] ?? null) === $transactionId) {
            Content::update('shop_orders', $order['id'], ['status' => $status]);
            return;
        }
    }
}
