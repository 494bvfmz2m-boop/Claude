<?php
require_staff();
$GLOBALS['page_title'] = 'Instellingen - beheer';
$GLOBALS['page_desc'] = 'Naam, contactgegevens, bedrijfsgegevens, verzending en btw.';

/** Only keep http(s) links, so nothing odd ends up in an href. */
function clean_link(string $v): string {
    $v = trim($v);
    return preg_match('#^https?://#i', $v) ? $v : '';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    set_setting('shop_mode', ($_POST['shop_mode'] ?? 'showcase') === 'shop' ? 'shop' : 'showcase');
    set_setting('store_name', trim((string)($_POST['store_name'] ?? '')));
    set_setting('tagline', trim((string)($_POST['tagline'] ?? '')));
    set_setting('contact_email', trim((string)($_POST['contact_email'] ?? '')));
    set_setting('site_url', rtrim(trim((string)($_POST['site_url'] ?? '')), '/'));
    set_setting('instagram_url', clean_link((string)($_POST['instagram_url'] ?? '')));
    set_setting('tiktok_url', clean_link((string)($_POST['tiktok_url'] ?? '')));
    set_setting('marktplaats_profile_url', clean_link((string)($_POST['marktplaats_profile_url'] ?? '')));
    set_setting('legal_name', trim((string)($_POST['legal_name'] ?? '')));
    set_setting('business_address', trim((string)($_POST['business_address'] ?? '')));
    set_setting('kvk_number', trim((string)($_POST['kvk_number'] ?? '')));
    set_setting('btw_id', trim((string)($_POST['btw_id'] ?? '')));
    set_setting('currency', strtolower(trim((string)($_POST['currency'] ?? 'eur'))));
    set_setting('btw_rate', (string)max(0, (float)str_replace(',', '.', (string)($_POST['btw_rate'] ?? '0'))));
    set_setting('shipping_standard_cents', (string)(int)round(((float)str_replace(',', '.', (string)($_POST['shipping_standard'] ?? '0'))) * 100));
    set_setting('free_shipping_over_cents', (string)(int)round(((float)str_replace(',', '.', (string)($_POST['free_over'] ?? '0'))) * 100));
    set_setting('promo_bar_enabled', isset($_POST['promo_bar_enabled']) ? '1' : '0');
    set_setting('promo_bar_text', trim((string)($_POST['promo_bar_text'] ?? '')));
    flash('Instellingen opgeslagen.');
    redirect('?p=admin_settings');
}
$mode = showcase_mode() ? 'showcase' : 'shop';
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_settings'); ?>

<form class="card" method="post" style="max-width:680px">
  <?= csrf_field() ?>
  <h2>Soort website</h2>
  <label>Modus
    <select name="shop_mode">
      <option value="showcase" <?= $mode === 'showcase' ? 'selected' : '' ?>>Portfolio: producten linken naar Marktplaats</option>
      <option value="shop" <?= $mode === 'shop' ? 'selected' : '' ?>>Webshop: winkelwagen en online betalen</option>
    </select>
  </label>
  <p class="small muted">Zet de webshop pas aan als je bent ingeschreven bij de KvK en je bedrijfsgegevens hieronder hebt ingevuld.</p>

  <h2>Algemeen</h2>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="promo_bar_enabled" value="1" style="width:auto" <?= setting('promo_bar_enabled', '1') === '1' ? 'checked' : '' ?>> Balk bovenaan tonen</label>
  <label>Tekst in de balk <input name="promo_bar_text" value="<?= e(setting('promo_bar_text', 'Laag voor laag geprint in Ederveen')) ?>"></label>
  <label>Naam <input name="store_name" value="<?= e(setting('store_name', '')) ?>"></label>
  <label>Slogan <input name="tagline" value="<?= e(setting('tagline', '')) ?>"></label>
  <label>Contact-e-mail <input type="email" name="contact_email" value="<?= e(setting('contact_email', '')) ?>"></label>
  <label>Websiteadres <input name="site_url" placeholder="https://ederveen.xyz" value="<?= e(setting('site_url', '')) ?>"></label>

  <h2>Links</h2>
  <label>Marktplaats-profiel <input name="marktplaats_profile_url" placeholder="https://www.marktplaats.nl/u/..." value="<?= e(setting('marktplaats_profile_url', '')) ?>"></label>
  <div class="row">
    <label>Instagram <input name="instagram_url" placeholder="https://instagram.com/ederveen3d" value="<?= e(setting('instagram_url', '')) ?>"></label>
    <label>TikTok <input name="tiktok_url" placeholder="https://tiktok.com/@ederveen3d" value="<?= e(setting('tiktok_url', '')) ?>"></label>
  </div>

  <h2>Bedrijfsgegevens</h2>
  <p class="small muted">Verplicht voor een webshop. Laat leeg zolang je niet bij de KvK staat ingeschreven; lege velden worden niet getoond.</p>
  <label>Naam eigenaar <input name="legal_name" value="<?= e(setting('legal_name', '')) ?>"></label>
  <label>Adres <input name="business_address" placeholder="Straat 1, 6741 AA Ederveen" value="<?= e(setting('business_address', '')) ?>"></label>
  <div class="row">
    <label>KvK-nummer <input name="kvk_number" value="<?= e(setting('kvk_number', '')) ?>"></label>
    <label>Btw-id <input name="btw_id" placeholder="NL000000000B01" value="<?= e(setting('btw_id', '')) ?>"></label>
  </div>

  <h2>Geld en verzending</h2>
  <div class="row">
    <label>Valuta <input name="currency" value="<?= e(setting('currency', 'eur')) ?>"></label>
    <label>Btw-tarief (0 bij KOR, 0.21 = 21%) <input name="btw_rate" type="number" step="0.01" min="0" value="<?= e(setting('btw_rate', '0')) ?>"></label>
    <label>Verzendkosten PostNL <input name="shipping_standard" type="number" step="0.01" min="0" value="<?= number_format((int)setting('shipping_standard_cents', 495) / 100, 2, '.', '') ?>"></label>
    <label>Gratis verzending vanaf (0 = nooit) <input name="free_over" type="number" step="0.01" min="0" value="<?= number_format((int)setting('free_shipping_over_cents', 0) / 100, 2, '.', '') ?>"></label>
  </div>
  <button class="btn hover-sheen" type="submit">Opslaan</button>
</form>
