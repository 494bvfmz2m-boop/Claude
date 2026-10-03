<?php
require_staff();
$GLOBALS['page_title'] = 'Payments - admin';
$GLOBALS['page_desc'] = 'Connect Stripe and switch card payments on.';

$testResult = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? 'save';

    if ($action === 'save') {
        set_setting('stripe_mode', ($_POST['stripe_mode'] ?? 'test') === 'live' ? 'live' : 'test');
        set_setting('stripe_enabled', isset($_POST['stripe_enabled']) ? '1' : '0');
        set_setting('stripe_promo_codes', isset($_POST['stripe_promo_codes']) ? '1' : '0');
        set_setting('stripe_test_publishable', trim((string)($_POST['stripe_test_publishable'] ?? '')));
        set_setting('stripe_live_publishable', trim((string)($_POST['stripe_live_publishable'] ?? '')));
        // Secret fields are only overwritten when something new is typed in.
        foreach (['stripe_test_secret', 'stripe_live_secret', 'stripe_test_webhook_secret', 'stripe_live_webhook_secret'] as $k) {
            $v = trim((string)($_POST[$k] ?? ''));
            if ($v !== '') set_setting($k, $v);
            if (isset($_POST['clear_' . $k])) set_setting($k, '');
        }
        flash('Payment settings saved.');
        redirect('?p=admin_payments');
    }

    if ($action === 'test') {
        $res = stripe_request('GET', 'balance');
        $testResult = isset($res['error'])
            ? ['err', $res['error']['message'] ?? 'Stripe rejected the key.']
            : ['ok', 'Connected to Stripe in ' . stripe_mode() . ' mode.'];
    }
}

$has = fn(string $k) => setting($k, '') !== '' ? 'Saved' : 'Not set';
?>
<h1>Admin</h1>
<?php admin_tabs('admin_payments'); ?>

<?php if ($testResult): ?><div class="note <?= $testResult[0] === 'ok' ? 'ok' : 'err' ?> anim-pop"><?= e($testResult[1]) ?></div><?php endif; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="save">
    <h2>Stripe</h2>
    <p class="small muted">Copy your keys from the Stripe dashboard (Developers &rarr; API keys). Secret keys are stored on your own server and never shown again.</p>
    <label>Mode
      <select name="stripe_mode">
        <option value="test" <?= stripe_mode() === 'test' ? 'selected' : '' ?>>Test (no real money)</option>
        <option value="live" <?= stripe_mode() === 'live' ? 'selected' : '' ?>>Live</option>
      </select>
    </label>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="stripe_enabled" value="1" style="width:auto" <?= setting('stripe_enabled', '0') === '1' ? 'checked' : '' ?>>
      Take card payments at checkout
    </label>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="stripe_promo_codes" value="1" style="width:auto" <?= setting('stripe_promo_codes', '1') === '1' ? 'checked' : '' ?>>
      Let customers enter a discount code (kortingsbon) on the payment page
    </label>
    <p class="small muted">Make discount codes in Stripe: Product catalogue &rarr; Coupons &rarr; New coupon, then add a customer-facing code (e.g. WELCOME10). Make them in Test mode to try, and again in Live mode for real customers.</p>

    <h3>Test keys</h3>
    <label>Publishable key <input name="stripe_test_publishable" value="<?= e(setting('stripe_test_publishable', '')) ?>" placeholder="pk_test_..."></label>
    <label>Secret key (<?= $has('stripe_test_secret') ?>) <input name="stripe_test_secret" placeholder="sk_test_... (leave blank to keep)" autocomplete="off"></label>
    <label>Webhook signing secret (<?= $has('stripe_test_webhook_secret') ?>) <input name="stripe_test_webhook_secret" placeholder="whsec_... (leave blank to keep)" autocomplete="off"></label>

    <h3>Live keys</h3>
    <label>Publishable key <input name="stripe_live_publishable" value="<?= e(setting('stripe_live_publishable', '')) ?>" placeholder="pk_live_..."></label>
    <label>Secret key (<?= $has('stripe_live_secret') ?>) <input name="stripe_live_secret" placeholder="sk_live_... (leave blank to keep)" autocomplete="off"></label>
    <label>Webhook signing secret (<?= $has('stripe_live_webhook_secret') ?>) <input name="stripe_live_webhook_secret" placeholder="whsec_... (leave blank to keep)" autocomplete="off"></label>

    <button class="btn hover-sheen" type="submit">Save payment settings</button>
  </form>

  <div class="card">
    <h2>Check the connection</h2>
    <p class="small muted">This asks Stripe whether your saved secret key works.</p>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="test">
      <button class="btn ghost" type="submit">Test Stripe connection</button>
    </form>
    <h2 style="margin-top:22px">Webhook</h2>
    <p class="small">In your Stripe dashboard (Developers &rarr; Webhooks &rarr; Add endpoint), add this URL — it points at <strong>your own server</strong>, so paid orders update automatically:</p>
    <p><code style="user-select:all"><?= e(url('webhook.php')) ?></code></p>
    <?php $siteUrl = trim((string)setting('site_url', '')); ?>
    <p class="small muted">This address comes from the <strong>Website address</strong> in <?= $siteUrl !== '' ? 'Store settings (<code>' . e($siteUrl) . '</code>)' : 'Store settings (currently auto-detected from your server)' ?>. If your domain changes, update it there and set this webhook again. Listen for <code>checkout.session.completed</code>, then paste the signing secret above (test and live each have their own).</p>
    <h2 style="margin-top:22px">Status</h2>
    <p><span class="pill"><?= stripe_enabled() ? 'Card payments ON' : 'Card payments OFF' ?></span>
       <span class="pill"><?= e(stripe_mode()) ?> mode</span></p>
  </div>
</div>
