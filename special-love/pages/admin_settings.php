<?php
require_staff();
$GLOBALS['page_title'] = 'Store settings - admin';
$GLOBALS['page_desc'] = 'Shop name, contact details, shipping prices and tax.';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['theme'])) {
    // One-click holiday theme buttons.
    csrf_check();
    $theme = (string)$_POST['theme'];
    if (isset(SL_THEMES[$theme])) {
        set_setting('theme', $theme);
        flash(SL_THEMES[$theme]['icon'] . ' ' . SL_THEMES[$theme]['label'] . ' theme is now live on the website.');
    }
    redirect('?p=admin_settings');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    foreach (['instagram_url', 'facebook_url', 'tiktok_url', 'youtube_url'] as $k) {
        $v = trim((string)($_POST[$k] ?? ''));
        if ($v !== '' && !preg_match('#^https?://#i', $v)) $v = 'https://' . $v;
        set_setting($k, filter_var($v, FILTER_VALIDATE_URL) ? $v : '');
    }
    set_setting('store_name', trim((string)($_POST['store_name'] ?? '')));
    set_setting('tagline', trim((string)($_POST['tagline'] ?? '')));
    set_setting('contact_email', trim((string)($_POST['contact_email'] ?? '')));
    set_setting('site_url', rtrim(trim((string)($_POST['site_url'] ?? '')), '/'));
    set_setting('currency', strtolower(trim((string)($_POST['currency'] ?? 'aud'))));
    set_setting('gst_rate', (string)max(0, (float)($_POST['gst_rate'] ?? 0)));
    set_setting('shipping_standard_cents', (string)(int)round(((float)($_POST['shipping_standard'] ?? 0)) * 100));
    set_setting('shipping_express_cents', (string)(int)round(((float)($_POST['shipping_express'] ?? 0)) * 100));
    set_setting('free_shipping_over_cents', (string)(int)round(((float)($_POST['free_over'] ?? 0)) * 100));
    set_setting('promo_bar_enabled', isset($_POST['promo_bar_enabled']) ? '1' : '0');
    set_setting('promo_bar_text', trim((string)($_POST['promo_bar_text'] ?? '')));
    flash('Store settings saved.');
    redirect('?p=admin_settings');
}
?>
<h1>Admin</h1>
<?php admin_tabs('admin_settings'); ?>

<div class="card" style="max-width:640px;margin-bottom:20px">
  <h2>Holiday theme</h2>
  <p class="small muted">Changes the colours and decorations of the whole website. Switch back to Normal when the holiday is over.</p>
  <form method="post" class="theme-buttons">
    <?= csrf_field() ?>
    <?php foreach (SL_THEMES as $key => $t): ?>
      <button class="btn <?= active_theme() === $key ? '' : 'ghost' ?>" type="submit" name="theme" value="<?= e($key) ?>"><?= $t['icon'] ?> <?= e($t['label']) ?><?= active_theme() === $key ? ' ✓' : '' ?></button>
    <?php endforeach; ?>
  </form>
</div>

<form class="card" method="post" style="max-width:640px">
  <?= csrf_field() ?>
  <h2>Store</h2>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="promo_bar_enabled" value="1" style="width:auto" <?= setting('promo_bar_enabled', '1') === '1' ? 'checked' : '' ?>> Show top announcement bar</label>
  <label>Announcement text <input name="promo_bar_text" value="<?= e(setting('promo_bar_text', 'Free gift with every order')) ?>"></label>
  <label>Shop name <input name="store_name" value="<?= e(setting('store_name', '')) ?>"></label>
  <label>Tagline <input name="tagline" value="<?= e(setting('tagline', '')) ?>"></label>
  <label>Contact email <input type="email" name="contact_email" value="<?= e(setting('contact_email', '')) ?>"></label>
  <label>Website address <input name="site_url" placeholder="https://yourshop.com" value="<?= e(setting('site_url', '')) ?>"></label>
  <h2>Social links</h2>
  <p class="small muted">Shown in the "Follow Special Love 3D" section and the footer. Leave blank to hide.</p>
  <div class="row">
    <label>Instagram <input name="instagram_url" placeholder="https://instagram.com/yourshop" value="<?= e(setting('instagram_url', '')) ?>"></label>
    <label>Facebook <input name="facebook_url" placeholder="https://facebook.com/yourshop" value="<?= e(setting('facebook_url', '')) ?>"></label>
    <label>TikTok <input name="tiktok_url" placeholder="https://tiktok.com/@yourshop" value="<?= e(setting('tiktok_url', '')) ?>"></label>
    <label>YouTube <input name="youtube_url" placeholder="https://youtube.com/@yourshop" value="<?= e(setting('youtube_url', '')) ?>"></label>
  </div>
  <h2>Money</h2>
  <div class="row">
    <label>Currency code <input name="currency" value="<?= e(setting('currency', 'aud')) ?>"></label>
    <label>Tax rate (0.10 = 10% GST) <input name="gst_rate" type="number" step="0.01" min="0" value="<?= e(setting('gst_rate', '0.10')) ?>"></label>
    <label>Standard shipping <input name="shipping_standard" type="number" step="0.01" min="0" value="<?= number_format((int)setting('shipping_standard_cents', 995) / 100, 2, '.', '') ?>"></label>
    <label>Express shipping <input name="shipping_express" type="number" step="0.01" min="0" value="<?= number_format((int)setting('shipping_express_cents', 1995) / 100, 2, '.', '') ?>"></label>
    <label>Free standard shipping over (0 = never) <input name="free_over" type="number" step="0.01" min="0" value="<?= number_format((int)setting('free_shipping_over_cents', 0) / 100, 2, '.', '') ?>"></label>
  </div>
  <button class="btn hover-sheen" type="submit">Save settings</button>
</form>
