<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_settings');
$me = current_user();

$THEMES = [
    'default' => ['label' => 'Default (Sloth jungle)', 'emoji' => '🦥'],
    'halloween' => ['label' => 'Halloween', 'emoji' => '🎃'],
    'christmas' => ['label' => 'Christmas', 'emoji' => '🎄'],
    'valentines' => ['label' => "Valentine's Day", 'emoji' => '💘'],
    'summer' => ['label' => 'Summer', 'emoji' => '☀️'],
];

$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $settings = db_read('settings', []);
    $theme = $_POST['active_theme'] ?? 'default';
    $settings['active_theme'] = array_key_exists($theme, $THEMES) ? $theme : 'default';
    $settings['theme_effects'] = isset($_POST['theme_effects']);
    db_write('settings', $settings);
    $success = true;
}

$pageTitle = 'Theme';
$activeAdminPage = 'theme';
require_once __DIR__ . '/../includes/header.php';
$settings = db_read('settings', []);
$currentTheme = $settings['active_theme'] ?? 'default';
$effectsOn = !empty($settings['theme_effects']);
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1>Theme</h1>
    <p class="muted">Switch the site's color palette for holidays and events. Changes apply everywhere immediately.</p>
    <?php if ($success): ?><div class="alert alert-success">Theme saved.</div><?php endif; ?>

    <form method="post">
      <?= csrf_field() ?>
      <div class="card">
        <label style="margin-bottom:14px;">Active theme</label>
        <div class="theme-grid">
          <?php foreach ($THEMES as $key => $t): ?>
            <label class="theme-option <?= $currentTheme === $key ? 'selected' : '' ?>">
              <input type="radio" name="active_theme" value="<?= e($key) ?>" <?= $currentTheme === $key ? 'checked' : '' ?>>
              <span class="theme-option-emoji"><?= $t['emoji'] ?></span>
              <span><?= e($t['label']) ?></span>
            </label>
          <?php endforeach; ?>
        </div>

        <div class="checkbox-row" style="margin-top:22px;">
          <input type="checkbox" id="theme_effects" name="theme_effects" <?= $effectsOn ? 'checked' : '' ?>>
          <label for="theme_effects">Enable falling-particle effects (bats/snow/hearts/waves depending on theme)</label>
        </div>
        <div class="hint">Effects respect visitors' "reduce motion" accessibility setting automatically — they won't show for anyone with that turned on. The Default theme has no particle effect.</div>

        <button type="submit" class="btn btn-primary" style="margin-top:22px;">Save theme</button>
      </div>
    </form>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
