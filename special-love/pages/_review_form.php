<?php
// Expects $reviewProductId (int, 0 = shop review) and $reviewErrors (array).
$reviewErrors = $reviewErrors ?? [];
$posted = $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'review';
?>
<form class="card" method="post" action="#reviews">
  <?= csrf_field() ?><input type="hidden" name="action" value="review">
  <h3>Leave a review</h3>
  <?php foreach ($reviewErrors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <div class="star-input" role="radiogroup" aria-label="Rating">
    <?php $sel = $posted ? (int)($_POST['rating'] ?? 5) : 5; for ($i = 5; $i >= 1; $i--): ?>
      <input type="radio" id="star<?= $reviewProductId ?>-<?= $i ?>" name="rating" value="<?= $i ?>" <?= $sel === $i ? 'checked' : '' ?>><label for="star<?= $reviewProductId ?>-<?= $i ?>" title="<?= $i ?> star<?= $i > 1 ? 's' : '' ?>">★</label>
    <?php endfor; ?>
  </div>
  <div class="row">
    <label>Your name <input name="name" required maxlength="120" value="<?= e($posted ? ($_POST['name'] ?? '') : (current_user()['full_name'] ?? '')) ?>"></label>
    <label>Email (not shown) <input type="email" name="email" maxlength="190" value="<?= e($posted ? ($_POST['email'] ?? '') : (current_user()['email'] ?? '')) ?>"></label>
  </div>
  <label>Your review <textarea name="body" required maxlength="2000"><?= e($posted ? ($_POST['body'] ?? '') : '') ?></textarea></label>
  <p class="small muted">Use the email you ordered with to get a "Verified buyer" badge. Reviews appear once we've checked them.</p>
  <button class="btn" type="submit">Send review</button>
</form>
