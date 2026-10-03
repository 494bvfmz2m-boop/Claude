<?php
require_login();
$GLOBALS['page_title'] = 'Je account - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Je bestellingen, printverzoeken en beveiligingsinstellingen.';
$u = current_user();
$orders = all('SELECT * FROM orders WHERE user_id = ? OR email = ? ORDER BY created_at DESC', [$u['id'], $u['email']]);
$requests = all('SELECT * FROM custom_requests WHERE user_id = ? OR email = ? ORDER BY created_at DESC', [$u['id'], $u['email']]);
?>
<h1>Hoi <?= e($u['full_name'] ?: $u['email']) ?></h1>
<div class="tabs">
  <a class="tab active" href="<?= e(url('?p=account')) ?>"><?= showcase_mode() ? 'Printverzoeken' : 'Bestellingen &amp; verzoeken' ?></a>
  <a class="tab" href="<?= e(url('?p=chat')) ?>">Chat</a>
  <a class="tab" href="<?= e(url('?p=security')) ?>">Beveiliging</a>
  <?php if (is_staff()): ?><a class="tab" href="<?= e(url('?p=admin')) ?>">Beheer</a><?php endif; ?>
</div>

<?php if (!showcase_mode() || $orders): ?>
<div class="card">
  <h2>Je bestellingen</h2>
  <?php if (!$orders): ?><p class="muted">Nog geen bestellingen.</p><?php else: ?>
  <div class="table-scroll"><table>
    <thead><tr><th>Referentie</th><th>Datum</th><th>Totaal</th><th>Status</th><th>Betaling</th><th></th></tr></thead>
    <tbody><?php foreach ($orders as $o): ?>
      <tr>
        <td><?= e($o['reference']) ?></td>
        <td><?= e(date('j M Y', strtotime($o['created_at']))) ?></td>
        <td><?= money((int)$o['total_cents']) ?></td>
        <td><span class="pill"><?= e($o['status']) ?></span></td>
        <td><span class="pill"><?= e($o['payment_status']) ?></span></td>
        <td><a class="btn ghost small" href="<?= e(url('?p=order&ref=' . urlencode($o['reference']))) ?>">Bekijken</a></td>
      </tr>
    <?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</div>

<?php endif; ?>

<div class="card">
  <h2>Printverzoeken</h2>
  <?php if (!$requests): ?>
    <p class="muted">Nog geen verzoeken. <a href="<?= e(url('?p=custom')) ?>">Stuur een idee in</a>.</p>
  <?php else: ?>
  <div class="table-scroll"><table>
    <thead><tr><th>Datum</th><th>Bestand</th><th>Materiaal</th><th>Aantal</th><th>Status</th><th>Prijs</th></tr></thead>
    <tbody><?php foreach ($requests as $r): ?>
      <tr>
        <td><?= e(date('j M Y', strtotime($r['created_at']))) ?></td>
        <td><?= e($r['original_filename'] ?: '-') ?></td>
        <td><?= e($r['material']) ?></td>
        <td><?= (int)$r['quantity'] ?></td>
        <td><span class="pill"><?= e(request_statuses()[request_status((string)$r['status'])]) ?></span></td>
        <td><?= $r['quote_cents'] !== null ? money((int)$r['quote_cents']) : '<span class="muted">volgt</span>' ?></td>
      </tr>
    <?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</div>
