<?php
require_staff();
$GLOBALS['page_title'] = 'Reviews - admin';
$GLOBALS['page_desc'] = 'Approve, hide or delete customer reviews.';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'delete') {
        q('DELETE FROM reviews WHERE id = ?', [$id]);
        flash('Review deleted.');
    } elseif (in_array($action, ['approved', 'hidden'], true)) {
        q('UPDATE reviews SET status = ? WHERE id = ?', [$action, $id]);
        flash($action === 'approved' ? 'Review is now on the website.' : 'Review hidden.');
    }
    redirect('?p=admin_reviews&show=' . urlencode((string)($_GET['show'] ?? 'pending')));
}

$show = (string)($_GET['show'] ?? 'pending');
if (!in_array($show, ['pending', 'approved', 'hidden'], true)) $show = 'pending';
$reviews = all('SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200', [$show]);
$counts = [];
foreach (all('SELECT status, COUNT(*) c FROM reviews GROUP BY status') as $c) $counts[$c['status']] = (int)$c['c'];
?>
<h1>Admin</h1>
<?php admin_tabs('admin_reviews'); ?>

<div class="card">
  <h2>Customer reviews</h2>
  <p class="small">
    <?php foreach (['pending' => 'Waiting for approval', 'approved' => 'On the website', 'hidden' => 'Hidden'] as $k => $label): ?>
      <a class="pill<?= $show === $k ? ' promo' : '' ?>" href="<?= e(url('?p=admin_reviews&show=' . $k)) ?>"><?= e($label) ?> (<?= $counts[$k] ?? 0 ?>)</a>
    <?php endforeach; ?>
  </p>
  <?php if (!$reviews): ?><p class="muted">Nothing here.</p><?php endif; ?>
  <?php foreach ($reviews as $r): ?>
    <div class="card" style="margin-bottom:14px">
      <p><?= stars((int)$r['rating']) ?> <strong><?= e($r['name']) ?></strong>
        <?php if ((int)$r['verified'] === 1): ?><span class="pill">Verified buyer</span><?php endif; ?>
        <span class="small muted"><?= e(date('j M Y H:i', strtotime($r['created_at']))) ?><?= $r['email'] ? ' · ' . e($r['email']) : '' ?> · <?= $r['product_name'] ? 'on ' . e($r['product_name']) : 'shop review' ?></span></p>
      <p><?= nl2br(e($r['body'])) ?></p>
      <form method="post" style="display:flex;gap:8px;flex-wrap:wrap">
        <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
        <?php if ($r['status'] !== 'approved'): ?><button class="btn small" name="action" value="approved">Approve</button><?php endif; ?>
        <?php if ($r['status'] !== 'hidden'): ?><button class="btn ghost small" name="action" value="hidden">Hide</button><?php endif; ?>
        <button class="btn danger small" name="action" value="delete" onclick="return confirm('Delete this review?')">Delete</button>
      </form>
    </div>
  <?php endforeach; ?>
</div>
