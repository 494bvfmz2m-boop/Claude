<?php
require_staff();
$GLOBALS['page_title'] = 'Betalingen - beheer';
$GLOBALS['page_desc'] = 'Stripe koppelen en online betalen aanzetten.';

$testResult = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? 'save';

    if ($action === 'save') {
        set_setting('stripe_mode', ($_POST['stripe_mode'] ?? 'test') === 'live' ? 'live' : 'test');
        set_setting('stripe_enabled', isset($_POST['stripe_enabled']) ? '1' : '0');
        set_setting('stripe_test_publishable', trim((string)($_POST['stripe_test_publishable'] ?? '')));
        set_setting('stripe_live_publishable', trim((string)($_POST['stripe_live_publishable'] ?? '')));
        // Secret fields are only overwritten when something new is typed in.
        foreach (['stripe_test_secret', 'stripe_live_secret', 'stripe_test_webhook_secret', 'stripe_live_webhook_secret'] as $k) {
            $v = trim((string)($_POST[$k] ?? ''));
            if ($v !== '') set_setting($k, $v);
            if (isset($_POST['clear_' . $k])) set_setting($k, '');
        }
        flash('Betaalinstellingen opgeslagen.');
        redirect('?p=admin_payments');
    }

    if ($action === 'test') {
        $res = stripe_request('GET', 'balance');
        $testResult = isset($res['error'])
            ? ['err', $res['error']['message'] ?? 'Stripe heeft de sleutel geweigerd.']
            : ['ok', 'Verbonden met Stripe (' . stripe_mode() . '-modus).'];
    }
}

$has = fn(string $k) => setting($k, '') !== '' ? 'Opgeslagen' : 'Niet ingesteld';
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_payments'); ?>

<?php if ($testResult): ?><div class="note <?= $testResult[0] === 'ok' ? 'ok' : 'err' ?> anim-pop"><?= e($testResult[1]) ?></div><?php endif; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="save">
    <h2>Stripe</h2>
    <p class="small muted">Kopieer je sleutels uit het Stripe-dashboard (Developers &rarr; API keys). Geheime sleutels worden op je eigen server bewaard en niet meer getoond. Zet in Stripe onder Settings &rarr; Payment methods ook iDEAL aan.</p>
    <label>Modus
      <select name="stripe_mode">
        <option value="test" <?= stripe_mode() === 'test' ? 'selected' : '' ?>>Test (geen echt geld)</option>
        <option value="live" <?= stripe_mode() === 'live' ? 'selected' : '' ?>>Live</option>
      </select>
    </label>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="stripe_enabled" value="1" style="width:auto" <?= setting('stripe_enabled', '0') === '1' ? 'checked' : '' ?>>
      Online betalen bij het afrekenen
    </label>

    <h3>Testsleutels</h3>
    <label>Publishable key <input name="stripe_test_publishable" value="<?= e(setting('stripe_test_publishable', '')) ?>" placeholder="pk_test_..."></label>
    <label>Geheime sleutel (<?= $has('stripe_test_secret') ?>) <input name="stripe_test_secret" placeholder="sk_test_... (leeg laten om te bewaren)" autocomplete="off"></label>
    <label>Webhook signing secret (<?= $has('stripe_test_webhook_secret') ?>) <input name="stripe_test_webhook_secret" placeholder="whsec_... (leeg laten om te bewaren)" autocomplete="off"></label>

    <h3>Live-sleutels</h3>
    <label>Publishable key <input name="stripe_live_publishable" value="<?= e(setting('stripe_live_publishable', '')) ?>" placeholder="pk_live_..."></label>
    <label>Geheime sleutel (<?= $has('stripe_live_secret') ?>) <input name="stripe_live_secret" placeholder="sk_live_... (leeg laten om te bewaren)" autocomplete="off"></label>
    <label>Webhook signing secret (<?= $has('stripe_live_webhook_secret') ?>) <input name="stripe_live_webhook_secret" placeholder="whsec_... (leeg laten om te bewaren)" autocomplete="off"></label>

    <button class="btn hover-sheen" type="submit">Opslaan</button>
  </form>

  <div class="card">
    <h2>Verbinding testen</h2>
    <p class="small muted">Hiermee vraag je Stripe of je opgeslagen sleutel werkt.</p>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="test">
      <button class="btn ghost" type="submit">Stripe-verbinding testen</button>
    </form>
    <h2 style="margin-top:22px">Webhook</h2>
    <p class="small">Voeg in je Stripe-dashboard (Developers &rarr; Webhooks &rarr; Add endpoint) deze URL toe. Die wijst naar <strong>je eigen server</strong>, zodat betaalde bestellingen automatisch worden bijgewerkt:</p>
    <p><code style="user-select:all"><?= e(url('webhook.php')) ?></code></p>
    <?php $siteUrl = trim((string)setting('site_url', '')); ?>
    <p class="small muted">Dit adres komt van het <strong>Websiteadres</strong> bij <?= $siteUrl !== '' ? 'Instellingen (<code>' . e($siteUrl) . '</code>)' : 'Instellingen (nu automatisch bepaald)' ?>. Verandert je domein, pas het daar aan en stel de webhook opnieuw in. Luister naar <code>checkout.session.completed</code> en <code>checkout.session.async_payment_succeeded</code> (nodig voor iDEAL) en plak het signing secret hierboven (test en live hebben elk een eigen).</p>
    <h2 style="margin-top:22px">Status</h2>
    <p><span class="pill"><?= stripe_enabled() ? 'Online betalen AAN' : 'Online betalen UIT' ?></span>
       <span class="pill"><?= e(stripe_mode()) ?> -modus</span></p>
  </div>
</div>
