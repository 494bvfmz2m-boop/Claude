<?php
// Expects $ticket and $replies to be set by the including page.
$entries = [];
$entries[] = [
    'author_id' => $ticket['user_id'],
    'author_name' => $ticket['submitted_name'],
    'message' => $ticket['message'],
    'created_at' => $ticket['created_at'],
    'is_staff' => 0,
];
foreach ($replies as $r) {
    $entries[] = $r;
}
?>
<div class="ticket-thread">
  <?php foreach ($entries as $entry): ?>
    <div class="ticket-message<?= !empty($entry['is_staff']) ? ' staff' : '' ?>">
      <div class="ticket-message-head">
        <?php if (!empty($entry['author_id'])): ?>
          <?= author_badge_html($entry['author_id'], $entry['author_name']) ?>
        <?php else: ?>
          <span class="author-tag"><span class="author-name"><?= e($entry['author_name']) ?></span> <span class="muted">(guest)</span></span>
        <?php endif; ?>
        <?php if (!empty($entry['is_staff'])): ?><span class="post-type-tag announcement">staff</span><?php endif; ?>
        <span class="muted" style="font-size:0.8rem;">· <?= e(time_ago($entry['created_at'])) ?></span>
      </div>
      <div class="ticket-message-body"><?= e($entry['message']) ?></div>
    </div>
  <?php endforeach; ?>
</div>
