<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_settings');
$me = current_user();

$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $settings = db_read('settings', []);
    $settings['site_name'] = trim($_POST['site_name'] ?? '') ?: 'SlothSMP';
    $settings['banner_text'] = trim($_POST['banner_text'] ?? '');
    $settings['java_ip'] = trim($_POST['java_ip'] ?? '');
    $settings['bedrock_ip'] = trim($_POST['bedrock_ip'] ?? '');
    $settings['bedrock_port'] = trim($_POST['bedrock_port'] ?? '');
    $settings['discord_invite'] = trim($_POST['discord_invite'] ?? '');

    $mcRules = preg_split('/\r\n|\r|\n/', trim($_POST['minecraft_rules'] ?? ''));
    $settings['minecraft_rules'] = array_values(array_filter(array_map('trim', $mcRules)));

    $dcRules = preg_split('/\r\n|\r|\n/', trim($_POST['discord_rules'] ?? ''));
    $settings['discord_rules'] = array_values(array_filter(array_map('trim', $dcRules)));

    db_write('settings', $settings);
    $success = true;
}

$pageTitle = 'Settings';
$activeAdminPage = 'settings';
require_once __DIR__ . '/../includes/header.php';
$settings = db_read('settings', []);
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1>Site settings</h1>
    <?php if ($success): ?><div class="alert alert-success">Settings saved.</div><?php endif; ?>

    <form method="post">
      <?= csrf_field() ?>
      <div class="card">
        <h2 style="margin-top:0;">General</h2>
        <div class="field">
          <label for="site_name">Site name</label>
          <input type="text" id="site_name" name="site_name" value="<?= e($settings['site_name'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="banner_text">Homepage banner text</label>
          <textarea id="banner_text" name="banner_text" rows="2"><?= e($settings['banner_text'] ?? '') ?></textarea>
        </div>
        <div class="field">
          <label for="discord_invite">Discord invite URL</label>
          <input type="text" id="discord_invite" name="discord_invite" value="<?= e($settings['discord_invite'] ?? '') ?>" placeholder="https://discord.gg/...">
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Minecraft server</h2>
        <div class="field">
          <label for="java_ip">Java IP</label>
          <input type="text" id="java_ip" name="java_ip" value="<?= e($settings['java_ip'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="bedrock_ip">Bedrock IP</label>
          <input type="text" id="bedrock_ip" name="bedrock_ip" value="<?= e($settings['bedrock_ip'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="bedrock_port">Bedrock port</label>
          <input type="text" id="bedrock_port" name="bedrock_port" value="<?= e($settings['bedrock_port'] ?? '') ?>">
        </div>
        <div class="hint">These feed the live status widget on the homepage automatically — no code changes needed.</div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Minecraft rules</h2>
        <div class="field">
          <label for="minecraft_rules">One rule per line</label>
          <textarea id="minecraft_rules" name="minecraft_rules" rows="10"><?= e(implode("\n", $settings['minecraft_rules'] ?? [])) ?></textarea>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Discord rules</h2>
        <div class="field">
          <label for="discord_rules">One rule per line</label>
          <textarea id="discord_rules" name="discord_rules" rows="10"><?= e(implode("\n", $settings['discord_rules'] ?? [])) ?></textarea>
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Save settings</button>
    </form>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
