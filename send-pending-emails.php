<?php
/**
 * Sends order-confirmation and license-key emails that were deliberately
 * NOT sent inline from webhook-tebex.php — SMTP is too slow (12s connect
 * timeout per call, sometimes two calls back to back) to do inside a
 * webhook request without risking Tebex marking it failed/retrying, which
 * is exactly what was happening before this was split out.
 *
 * Point a cron job at this URL every 1-2 minutes:
 *   https://xyphros.net/send-pending-emails.php?key=CRON_SECRET
 *
 * Safe to call as often as you like — it only ever processes records
 * that haven't been emailed yet, so nothing gets sent twice.
 */
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/mailer.php';

header('Content-Type: text/plain');

if (empty($_GET['key']) || !hash_equals(CRON_SECRET, (string) $_GET['key'])) {
    http_response_code(403);
    echo "forbidden\n";
    exit;
}

$sentOrders = 0;
$sentLicenses = 0;
$failed = 0;

// ---- Order confirmation emails ----
$pendingOrders = array_filter(
    Content::all('shop_orders'),
    fn($o) => ($o['status'] ?? '') === 'completed' && empty($o['confirmation_email_sent'])
);

foreach (array_slice(array_values($pendingOrders), 0, 20) as $order) {
    $buyer = !empty($order['xyphros_user_id']) ? XyphrosAuth::findById($order['xyphros_user_id']) : null;
    if (!$buyer) {
        // No account to email — mark it sent anyway so this doesn't retry forever.
        Content::update('shop_orders', $order['id'], ['confirmation_email_sent' => true]);
        continue;
    }

    [$ok] = send_smtp_mail(
        $buyer['email'],
        'Your Xyphros order is confirmed',
        "Thanks for your purchase!\n\n{$order['package_name']}\n\nYour order is confirmed.",
        [],
        render_notice_email(
            'Order confirmed',
            'Thanks for your purchase of <strong>' . e($order['package_name']) . '</strong>.',
            'View order history',
            'https://xyphros.net/account?tab=orders'
        )
    );

    if ($ok) {
        Content::update('shop_orders', $order['id'], ['confirmation_email_sent' => true]);
        $sentOrders++;
    } else {
        error_log("send-pending-emails: order confirmation failed for order {$order['id']}");
        $failed++;
    }
}

// ---- License key emails ----
foreach (License::pendingPurchaseEmails(20) as $license) {
    $buyerId = $license['purchased_by_user_id'] ?? null;
    $buyer = $buyerId ? XyphrosAuth::findById($buyerId) : null;
    if (!$buyer) {
        License::markEmailSent($license['id']);
        continue;
    }

    $tierInfo = License::tiers()[$license['tier'] ?? ''] ?? null;
    $tierLabel = $tierInfo['label'] ?? 'a license boost';
    $redeemUrl = $tierInfo['redeem_url'] ?? 'https://portal.xyphros.net/redeem';
    $redeemProduct = $tierInfo['redeem_product'] ?? 'XyphrosPortal';
    $key = $license['key'] ?? '';

    [$ok] = send_smtp_mail(
        $buyer['email'],
        'Your Xyphros license key',
        "Your license key for {$tierLabel}:\n\n{$key}\n\nRedeem it at {$redeemUrl}",
        [],
        render_notice_email(
            'Your license key',
            'Your purchase includes <strong>' . e($tierLabel) . '</strong>. Redeem this key inside ' . e($redeemProduct) . ' to apply it:'
                . '<div style="margin:16px 0;padding:14px 18px;background:#f9f8fc;border:1px solid #eeebf5;border-radius:8px;font-family:monospace;font-size:15px;text-align:center;letter-spacing:.05em;">' . e($key) . '</div>',
            'Redeem in ' . $redeemProduct,
            $redeemUrl
        )
    );

    if ($ok) {
        License::markEmailSent($license['id']);
        $sentLicenses++;
    } else {
        error_log("send-pending-emails: license email failed for key {$key}");
        $failed++;
    }
}

echo "order confirmations sent: {$sentOrders}\n";
echo "license keys sent: {$sentLicenses}\n";
echo "failed (left for next run): {$failed}\n";
