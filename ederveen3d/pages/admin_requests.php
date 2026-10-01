<?php
require_staff();
$GLOBALS['page_title'] = 'Printverzoeken - beheer';
$GLOBALS['page_desc'] = 'Printverzoeken bekijken en prijzen doorgeven.';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $status = (string)($_POST['status'] ?? 'new');
    $allowed = ['new', 'reviewing', 'quoted', 'accepted', 'printing', 'complete', 'declined'];
    $quoteRaw = trim((string)($_POST['quote'] ?? ''));
    $quote = $quoteRaw === '' ? null : (int)round(((float)$quoteRaw) * 100);
    if (in_array($status, $allowed, true)) {
        q('UPDATE custom_requests SET status = ?, quote_cents = ?, staff_notes = ? WHERE id = ?',
          [$status, $quote, trim((string)($_POST['staff_notes'] ?? '')), $id]);
        flash('Verzoek bijgewerkt.');
    }
    redirect('?p=admin_requests');
}

$requests = all('SELECT * FROM custom_requests ORDER BY created_at DESC LIMIT 200');
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_requests'); ?>

<div class="card">
  <h2>Printverzoeken en berichten</h2>
  <?php if (!$requests): ?><p class="muted">Nog geen verzoeken.</p><?php endif; ?>
  <?php foreach ($requests as $r): ?>
    <div class="card hover-lift" style="margin-bottom:14px">
      <div class="grid cols-2">
        <div>
          <h3><?= e($r['full_name'] ?: $r['email']) ?> <span class="pill"><?= e($r['status']) ?></span></h3>
          <p class="small muted"><?= e(date('d-m-Y H:i', strtotime($r['created_at']))) ?> &middot; <?= e($r['email']) ?></p>
          <p class="small"><?= e($r['material']) ?> &middot; aantal <?= (int)$r['quantity'] ?></p>
          <?php if ($r['details']): ?><p class="small muted"><?= nl2br(e($r['details'])) ?></p><?php endif; ?>
          <?php if ($r['file_path']): ?>
            <p><a class="btn ghost small" href="<?= e(url($r['file_path'])) ?>" download><?= e($r['original_filename'] ?: 'Model downloaden') ?></a></p>
          <?php else: ?><p class="small muted">Geen bestand bijgevoegd.</p><?php endif; ?>
        </div>
        <form method="post">
          <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
          <label>Status
            <select name="status">
              <?php foreach (['new', 'reviewing', 'quoted', 'accepted', 'printing', 'complete', 'declined'] as $s): ?>
                <option value="<?= $s ?>" <?= $r['status'] === $s ? 'selected' : '' ?>><?= $s ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label>Prijs (<?= e(strtoupper(setting('currency', 'EUR'))) ?>)
            <input name="quote" type="number" step="0.01" min="0"
                   value="<?= $r['quote_cents'] !== null ? number_format((int)$r['quote_cents'] / 100, 2, '.', '') : '' ?>"></label>
          <label>Notities (alleen voor jou) <textarea name="staff_notes"><?= e($r['staff_notes']) ?></textarea></label>
          <button class="btn small" type="submit">Opslaan</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>
