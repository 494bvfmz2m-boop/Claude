<div class="card review">
  <p><?= stars((int)$r['rating']) ?><?php if ((int)$r['verified'] === 1): ?> <span class="pill">Verified buyer</span><?php endif; ?></p>
  <p><?= nl2br(e($r['body'])) ?></p>
  <p class="small muted">— <?= e($r['name']) ?>, <?= e(date('j M Y', strtotime($r['created_at']))) ?></p>
</div>
