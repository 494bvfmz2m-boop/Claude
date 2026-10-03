<?php
require_staff();
$GLOBALS['page_title'] = 'Print requests - admin';
$GLOBALS['page_desc'] = 'Review custom print requests and send quotes.';

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
        flash('Request updated.');
    }
    redirect('?p=admin_requests');
}

$requests = all('SELECT * FROM custom_requests ORDER BY created_at DESC LIMIT 200');
?>
<h1>Admin</h1>
<?php admin_tabs('admin_requests'); ?>

<div class="card">
  <h2>Custom print requests</h2>
  <?php if (!$requests): ?><p class="muted">No requests yet.</p><?php endif; ?>
  <?php foreach ($requests as $r): ?>
    <div class="card hover-lift" style="margin-bottom:14px">
      <div class="grid cols-2">
        <div>
          <h3><?= e($r['full_name'] ?: $r['email']) ?> <span class="pill"><?= e($r['status']) ?></span></h3>
          <p class="small muted"><?= e(date('j M Y H:i', strtotime($r['created_at']))) ?> &middot; <?= e($r['email']) ?></p>
          <p class="small"><?= e($r['material']) ?> &middot; qty <?= (int)$r['quantity'] ?></p>
          <?php if ($r['details']): ?><p class="small muted"><?= nl2br(e($r['details'])) ?></p><?php endif; ?>
          <?php if ($r['file_path']): ?>
            <p><a class="btn ghost small" href="<?= e(url($r['file_path'])) ?>" download><?= e($r['original_filename'] ?: 'Download model') ?></a></p>
          <?php else: ?><p class="small muted">No file attached.</p><?php endif; ?>
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
          <label>Quote (<?= e(strtoupper(setting('currency', 'AUD'))) ?>)
            <input name="quote" type="number" step="0.01" min="0"
                   value="<?= $r['quote_cents'] !== null ? number_format((int)$r['quote_cents'] / 100, 2, '.', '') : '' ?>"></label>
          <label>Internal notes <textarea name="staff_notes"><?= e($r['staff_notes']) ?></textarea></label>
          <button class="btn small" type="submit">Save</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>
