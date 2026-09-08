<?php
require_once __DIR__ . '/includes/functions.php';

http_response_code(404);

$currentPage = '';
$pageTitle = 'Page not found';
$pageDescription = "The page you're looking for doesn't exist.";
$noIndex = true;

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">404</span>
        <h1>That page doesn't exist</h1>
        <p class="lede lede--center">The link might be old, or the URL might just be mistyped. Either way, it's not here.</p>
    </div>
</section>

<section class="section text-center">
    <div class="container">
        <div class="btn-row" style="justify-content:center;">
            <a href="/" class="btn btn--primary">Back to home</a>
            <a href="/contact" class="btn btn--ghost">Report a broken link</a>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
