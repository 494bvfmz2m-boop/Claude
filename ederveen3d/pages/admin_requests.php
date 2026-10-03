<?php
require_staff();
$GLOBALS['page_title'] = 'Printverzoeken - beheer';
$GLOBALS['page_desc'] = 'Printverzoeken bekijken en bijhouden.';
$statuses = request_statuses();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $status = (string)($_POST['status'] ?? 'new');
    $quoteRaw = str_replace(',', '.', trim((string)($_POST['quote'] ?? '')));
    $quote = $quoteRaw === '' ? null : (int)round(((float)$quoteRaw) * 100);
    if (array_key_exists($status, $statuses)) {
        q('UPDATE custom_requests SET status = ?, quote_cents = ?, staff_notes = ? WHERE id = ?',
          [$status, $quote, trim((string)($_POST['staff_notes'] ?? '')), $id]);
        flash('Opgeslagen.');
    }
    redirect('?p=admin_requests' . (isset($_POST['filter']) && $_POST['filter'] !== '' ? '&status=' . urlencode((string)$_POST['filter']) : ''));
}

$filter = (string)($_GET['status'] ?? 'actief');
$all = all('SELECT r.*, c.id AS chat_id FROM custom_requests r LEFT JOIN chats c ON c.user_id = r.user_id ORDER BY r.created_at DESC LIMIT 300');
$counts = array_fill_keys(array_keys($statuses), 0);
foreach ($all as &$r) { $r['status'] = request_status((string)$r['status']); $counts[$r['status']]++; }
unset($r);
$requests = array_values(array_filter($all, fn($r) =>
    $filter === 'alles' ? true : ($filter === 'actief' ? !in_array($r['status'], ['done', 'declined'], true) : $r['status'] === $filter)));
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_requests'); ?>

<div class="filter-bar">
  <?php
    $tabs = ['actief' => 'Openstaand'] + $statuses + ['alles' => 'Alles'];
    foreach ($tabs as $key => $label):
      $n = $key === 'actief' ? $counts['new'] + $counts['talking'] + $counts['printing'] : ($counts[$key] ?? null);
  ?>
    <a class="chip-link <?= $filter === $key ? 'active' : '' ?>" href="<?= e(url('?p=admin_requests&status=' . $key)) ?>"><?= e($label) ?><?= $n !== null ? ' <b>' . (int)$n . '</b>' : '' ?></a>
  <?php endforeach; ?>
</div>

<?php if (!$requests): ?><div class="card"><p class="muted">Niets in deze lijst. 🎉</p></div><?php endif; ?>
<div class="request-list">
<?php foreach ($requests as $r): ?>
  <article class="card request <?= 'st-' . e($r['status']) ?>">
    <header>
      <div>
        <h3><?= e($r['full_name'] ?: $r['email']) ?></h3>
        <p class="small muted"><?= e(date('d-m-Y H:i', strtotime($r['created_at']))) ?> · <a href="mailto:<?= e($r['email']) ?>"><?= e($r['email']) ?></a></p>
      </div>
      <span class="status-tag"><?= e($statuses[$r['status']]) ?></span>
    </header>
    <?php if ($r['details']): ?><p><?= nl2br(e($r['details'])) ?></p><?php endif; ?>
    <p class="small muted"><?= e($r['material'] ?: 'Weet ik niet') ?> · <?= (int)$r['quantity'] ?>×
      <?php if ($r['file_path']): ?> · <a href="<?= e(url($r['file_path'])) ?>" download>📎 <?= e($r['original_filename'] ?: 'bestand') ?></a><?php endif; ?></p>

    <form method="post" class="request-actions">
      <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><input type="hidden" name="filter" value="<?= e($filter) ?>">
      <div class="seg">
        <?php foreach ($statuses as $key => $label): ?>
          <label><input type="radio" name="status" value="<?= e($key) ?>" <?= $r['status'] === $key ? 'checked' : '' ?>><span><?= e($label) ?></span></label>
        <?php endforeach; ?>
      </div>
      <div class="request-fields">
        <label>Prijs (€) <input name="quote" inputmode="decimal" placeholder="bijv. 7,50" value="<?= $r['quote_cents'] !== null ? number_format((int)$r['quote_cents'] / 100, 2, ',', '') : '' ?>"></label>
        <label>Notitie voor jezelf <input name="staff_notes" value="<?= e($r['staff_notes']) ?>"></label>
      </div>
      <div class="request-buttons">
        <button class="btn small" type="submit">Opslaan</button>
        <?php if ($r['chat_id']): ?>
          <a class="btn ghost small" href="<?= e(url('?p=admin_chats&id=' . (int)$r['chat_id'])) ?>">💬 Open chat</a>
        <?php else: ?>
          <a class="btn ghost small" href="mailto:<?= e($r['email']) ?>?subject=<?= rawurlencode('Je printverzoek bij ' . setting('store_name', 'Ederveen3D')) ?>">✉️ Mail terug</a>
        <?php endif; ?>
      </div>
    </form>
  </article>
<?php endforeach; ?>
</div>
