<?php
require_once __DIR__ . '/includes/functions.php';

$groups = xs_docs_grouped();
$firstSlug = $groups[0]['pages'][0]['slug'] ?? null;

if ($firstSlug) {
    header('Location: /docs/' . rawurlencode($firstSlug));
    exit;
}

$currentPage = 'docs';
$pageTitle = 'Docs';
$pageDescription = 'Guides and reference for Xyphros products.';
require __DIR__ . '/includes/header.php';
?>

<section class="section text-center">
    <div class="container">
        <span class="eyebrow">Docs</span>
        <h1>Nothing published yet</h1>
        <p class="lede lede--center">Check back soon &mdash; we're still writing this up.</p>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
