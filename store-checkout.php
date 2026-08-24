<?php
require_once __DIR__ . '/includes/functions.php';

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/store'));
    exit;
}

$ident = $_GET['ident'] ?? '';
$justCompleted = isset($_GET['complete']);

$currentPage = 'store';
$pageTitle = 'Checkout';
require __DIR__ . '/includes/header.php';
?>

<script defer src="https://js.tebex.io/v/1.js"></script>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Store &mdash; Work in progress</span>
        <h1><?php echo $justCompleted ? 'Thanks!' : 'Checkout'; ?></h1>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:520px;text-align:center;">
        <?php if ($justCompleted): ?>
            <p class="lede" style="margin-bottom:8px;">Your order is being processed &mdash; it'll show up in your order history shortly.</p>
            <p style="color:var(--text-faint,#9b93b0);font-size:13px;margin-bottom:24px;">We'll also send a confirmation email. If you don't see it in a few minutes, check your spam folder.</p>
            <a href="/account?tab=orders" class="btn btn--primary">View order history</a>
        <?php elseif ($ident): ?>
            <p class="lede" style="margin-bottom:24px;">Opening checkout&hellip;</p>
            <button id="reopen-checkout" class="btn btn--primary" style="display:none;">Open checkout</button>
            <script>
            addEventListener('load', function () {
                function open() {
                    Tebex.checkout.init({
                        ident: <?php echo json_encode($ident); ?>,
                        colors: [
                            { name: 'primary', color: '#6d28f9' },
                            { name: 'secondary', color: '#c026e8' }
                        ]
                    });
                    Tebex.checkout.launch();
                }
                open();
                document.getElementById('reopen-checkout').style.display = 'inline-flex';
                document.getElementById('reopen-checkout').addEventListener('click', open);

                Tebex.checkout.on('payment:complete', function () {
                    window.location = '/store-checkout?complete=1';
                });
            });
            </script>
        <?php else: ?>
            <p class="lede">Nothing to check out. <a href="/store">Back to the store</a>.</p>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
