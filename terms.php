<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'terms';
$pageTitle = 'Terms & Conditions';
$pageDescription = 'The terms that apply to using xyphros.net and its store.';

$settings = get_settings();
$contactEmail = $settings['contact_email'];

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Legal</span>
        <h1>Terms &amp; Conditions</h1>
        <p class="lede lede--center">The ground rules for using xyphros.net and buying from our store.</p>
    </div>
</section>

<section class="section">
    <div class="container legal-content">
        <p class="legal-updated">Last updated 8 September 2026.</p>

        <p>
            <strong>Note for the site owner:</strong> this page hasn't been reviewed by a solicitor, and it doesn't
            name a governing jurisdiction. That section below is left as a placeholder on purpose rather than
            guessed at. Treat this as a solid starting draft, not a substitute for proper legal advice.
        </p>

        <h2>Using this site</h2>
        <p>By using xyphros.net you agree to these terms. If you don't agree, please don't use the site. We may update these terms from time to time; continuing to use the site after a change means you accept the update.</p>

        <h2>Accounts</h2>
        <ul>
            <li>You need to give accurate information when you register, and keep your password secure.</li>
            <li>One account per person. You're responsible for activity that happens under your account.</li>
            <li>We may suspend or close an account that's used to abuse the site, attempt fraud, or break these terms.</li>
            <li>Repeated failed login attempts on an account are temporarily rate-limited for security.</li>
        </ul>

        <h2>The store</h2>
        <ul>
            <li>Purchases are processed by <a href="https://www.tebex.io" target="_blank" rel="noopener">Tebex</a>, a third-party payment processor and store platform, not by us directly. Their own terms apply to the payment itself.</li>
            <li>Some items grant a Discord role automatically once payment completes. This requires a linked Discord account (see <a href="/account?tab=connections">Account &rarr; Connections</a>). Without one, we can't reliably tell Discord who to give the role to.</li>
            <li>Refunds and subscription cancellations are covered in our separate <a href="/refund">Refund Policy</a>.</li>
            <li>Digital items and roles are for your personal use and aren't transferable to another account or person.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>Don't use the site to break the law, attempt to access accounts that aren't yours, interfere with the site's security or availability, or abuse the contact form or any other feature.</p>

        <h2>No unsupported claims</h2>
        <p>We try to only describe our products and services accurately on this site. If you spot a claim that looks wrong or out of date, please <a href="/contact">let us know</a> and we'll fix it.</p>

        <h2>Liability</h2>
        <p>The site and our products are provided as-is. We work to keep everything running and accurate, but we can't guarantee the site or any product will be uninterrupted or error-free.</p>

        <h2>Governing law</h2>
        <p><em>[Placeholder: the jurisdiction whose law governs these terms hasn't been set yet. Fill this in once you've decided, ideally with input from a solicitor.]</em></p>

        <h2>Contact</h2>
        <p>Questions about these terms? Email <a href="mailto:<?php echo e($contactEmail); ?>"><?php echo e($contactEmail); ?></a>.</p>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
