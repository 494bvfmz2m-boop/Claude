<?php
require_once __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Rules';
$pageDescription = 'Server and Discord rules — keep it chill, keep it kind.';
require_once __DIR__ . '/includes/header.php';
?>
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2>Server Rules</h2>
      <p>Keep it chill, keep it kind. Everyone's expected to follow these.</p>
    </div>

    <div class="rules-tabs">
      <button data-rules-tab="minecraft" class="active">🦥 Minecraft</button>
      <button data-rules-tab="discord">🍍 Discord</button>
    </div>

    <div class="card">
      <div class="rules-panel active" data-rules-panel="minecraft">
        <ol class="rules-list">
          <?php foreach (($settings['minecraft_rules'] ?? []) as $rule): ?>
            <li><?= e($rule) ?></li>
          <?php endforeach; ?>
        </ol>
      </div>
      <div class="rules-panel" data-rules-panel="discord">
        <ol class="rules-list">
          <?php foreach (($settings['discord_rules'] ?? []) as $rule): ?>
            <li><?= e($rule) ?></li>
          <?php endforeach; ?>
        </ol>
      </div>
    </div>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
