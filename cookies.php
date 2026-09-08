<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'cookies';
$pageTitle = 'Cookies Policy';
$pageDescription = 'The cookies xyphros.net sets and why.';

$settings = get_settings();
$contactEmail = $settings['contact_email'];

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Legal</span>
        <h1>Cookies Policy</h1>
        <p class="lede lede--center">Every cookie this site sets, in full &mdash; there's no hidden tracking list.</p>
    </div>
</section>

<section class="section">
    <div class="container legal-content">
        <p class="legal-updated">Last updated 8 September 2026.</p>

        <h2>The short version</h2>
        <p>xyphros.net only sets cookies that are strictly necessary to make the site work &mdash; keeping you signed in, and protecting forms from cross-site attacks. We don't use analytics, advertising, or tracking cookies, so there's nothing here that needs your opt-in consent under EU/UK cookie law &mdash; but we're listing every one anyway, because you should be able to see exactly what's set.</p>

        <h2>Cookies we set</h2>
        <ul>
            <li><strong><code>xyphros_session</code></strong> &mdash; keeps you signed in, shared across xyphros.net and portal.xyphros.net so one account works on both. Expires when your session ends or you sign out.</li>
            <li><strong><code>xs_csrf</code></strong> &mdash; a random token used to confirm form submissions (like the contact form) actually came from this site, not a forged request from elsewhere.</li>
            <li><strong><code>xs_discord_state</code></strong> and <strong><code>xs_discord_return</code></strong> &mdash; set only while you're in the middle of linking your Discord account, to confirm the login came back from the right place and return you to where you started. Both expire within minutes and aren't set otherwise.</li>
        </ul>

        <h2>What we don't set</h2>
        <p>No analytics cookies (Google Analytics or similar), no advertising or retargeting cookies, and no third-party tracking pixels.</p>

        <h2>Third-party requests that aren't cookies</h2>
        <p>A couple of things load from third-party domains as part of normal page rendering, which is worth being upfront about even though they're not cookies we set:</p>
        <ul>
            <li><strong>Google Fonts</strong> &mdash; the site's typefaces load from Google's font CDN, which sees the requesting IP address like any web request.</li>
            <li><strong>Tebex checkout</strong> &mdash; when you buy something, you're taken to Tebex's own checkout, which is a separate site with its own cookies outside our control.</li>
        </ul>

        <h2>Managing cookies</h2>
        <p>Since everything here is required for the site to log you in and protect forms, turning cookies off in your browser will effectively sign you out and may break account-only pages. You're of course free to do that in your browser's settings at any time.</p>

        <h2>Questions</h2>
        <p>Email <a href="mailto:<?php echo e($contactEmail); ?>"><?php echo e($contactEmail); ?></a> if anything here isn't clear.</p>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
