<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'refund';
$pageTitle = 'Refund Policy';
$pageDescription = 'Our refund and subscription cancellation policy.';

$settings = get_settings();
$contactEmail = $settings['contact_email'];

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Legal</span>
        <h1>Refund Policy</h1>
        <p class="lede lede--center">Store purchases, in plain terms.</p>
    </div>
</section>

<section class="section">
    <div class="container legal-content">
        <p class="legal-updated">Last updated 8 September 2026.</p>

        <h2>Sales are final</h2>
        <p>All store purchases are digital goods (Discord roles, perks, and similar), delivered automatically once payment completes. Because of that, and in line with our payment processor <a href="https://www.tebex.io" target="_blank" rel="noopener">Tebex</a>'s own policy, <strong>we don't offer refunds</strong> once a purchase has gone through.</p>

        <h2>Before you buy</h2>
        <p>Double-check you're buying the right item, on the right account, before completing checkout &mdash; especially if a package grants a Discord role, since it needs to reach the Discord account linked to the Xyphros account you're signed in as. You can check or change your linked Discord account any time from <a href="/account?tab=connections">Account &rarr; Connections</a> before you buy.</p>

        <h2>Subscriptions</h2>
        <p>If you bought a recurring/subscription item, you can cancel it at any time from <a href="/account?tab=orders">Account &rarr; Orders</a>, which links out to Tebex's own payment history page. Cancelling stops future charges &mdash; it doesn't refund what's already been paid, and you keep access until the period you already paid for ends.</p>

        <h2>Something actually went wrong?</h2>
        <p>If a purchase failed to deliver &mdash; for example, payment went through but a role or license key never arrived &mdash; that's not covered by "no refunds," that's just a bug. Email <a href="mailto:<?php echo e($contactEmail); ?>"><?php echo e($contactEmail); ?></a> with your order details and we'll sort it out.</p>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
