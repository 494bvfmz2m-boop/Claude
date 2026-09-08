<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'privacy';
$pageTitle = 'Privacy Policy';
$pageDescription = 'How Xyphros Studios collects, uses, and protects your data.';

$settings = get_settings();
$contactEmail = $settings['contact_email'];

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Legal</span>
        <h1>Privacy Policy</h1>
        <p class="lede lede--center">What we collect, why, and how to get it removed.</p>
    </div>
</section>

<section class="section">
    <div class="container legal-content">
        <p class="legal-updated">Last updated 8 September 2026.</p>

        <h2>Who this covers</h2>
        <p>This policy applies to xyphros.net and its subdomains (including portal.xyphros.net and staff.xyphros.net), operated by Xyphros Studios ("we", "us"). If you have questions about anything here, email <a href="mailto:<?php echo e($contactEmail); ?>"><?php echo e($contactEmail); ?></a>.</p>

        <h2>What we collect</h2>
        <ul>
            <li><strong>Account details</strong> &mdash; name, email address, and a bcrypt-hashed password. We never store your password in plain text and can't recover it for you (only reset it).</li>
            <li><strong>Discord details, if you link your account</strong> &mdash; your Discord user ID, username, and avatar. This is optional, but required if you want to buy a store item that grants a Discord role, since that's the only reliable way we've found to hand the role to the right person.</li>
            <li><strong>Purchase records</strong> &mdash; which package you bought, when, and the order status. Card and payment details are never sent to or stored by us &mdash; our payment processor, Tebex, handles those directly and we only ever see the result.</li>
            <li><strong>Contact form submissions</strong> &mdash; your name, email, and message, so we can reply.</li>
            <li><strong>Basic security logs</strong> &mdash; IP address and timestamp on account signup and failed login attempts, kept only to detect abuse and enforce the login rate-limit described in our <a href="/terms">Terms</a>.</li>
        </ul>
        <p>We don't run analytics, ad tracking, or behavioural profiling on this site. There's no tracking pixel or third-party analytics script anywhere on xyphros.net.</p>

        <h2>Why we collect it</h2>
        <ul>
            <li>To create and secure your account, and keep you signed in across our products.</li>
            <li>To deliver what you paid for &mdash; including granting a Discord role through our store, or generating a license key for a Portal purchase.</li>
            <li>To reply to messages you send us.</li>
            <li>To keep the site secure (rate-limiting logins, spotting abuse).</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We don't sell your data. It's shared only with the third parties that make the site actually work:</p>
        <ul>
            <li><strong>Tebex</strong> &mdash; our payment processor and store platform. Buying something sends your email and order details to Tebex; for a purchase that grants a Discord role, we also pass along your already-linked Discord ID so Tebex's Discord integration can grant it.</li>
            <li><strong>Discord</strong> &mdash; if you choose to link your account, Discord's OAuth login tells us your Discord ID, username, and avatar. Our bot uses your Discord ID only to grant the role your purchase paid for.</li>
            <li><strong>Google Fonts</strong> &mdash; this site loads webfonts from Google's servers, which can see the requesting IP address as part of a normal font request.</li>
            <li><strong>Our email provider</strong> &mdash; used to send account verification codes and contact-form replies.</li>
        </ul>

        <h2>Cookies</h2>
        <p>We only set cookies that are strictly necessary for the site to function &mdash; see the full list on our <a href="/cookies">Cookies Policy</a>. There are no advertising or analytics cookies.</p>

        <h2>How long we keep it</h2>
        <p>Account data is kept for as long as your account exists. Contact-form messages and security logs are kept only as long as needed to act on them or investigate abuse, and are periodically cleared out.</p>

        <h2>Your rights</h2>
        <p>You can review and update most of your account details yourself from <a href="/account">Account settings</a>, including unlinking Discord at any time. To access, correct, or delete data we hold about you &mdash; including closing your account entirely &mdash; email <a href="mailto:<?php echo e($contactEmail); ?>"><?php echo e($contactEmail); ?></a> and we'll action it. We don't currently have a fully self-service "delete my account" button; requests are handled by a real person, by email.</p>

        <h2>Changes to this policy</h2>
        <p>If this policy changes in a meaningful way, we'll update the date at the top of this page.</p>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
