<?php
$store = setting('store_name', 'Ederveen3D');
$showcase = showcase_mode();
$GLOBALS['page_title'] = $store . ' — 3D-prints uit Ederveen';
$GLOBALS['page_desc'] = 'Leuke, kleurrijke 3D-prints, laag voor laag gemaakt in Ederveen. Bekijk mijn werk of stuur je eigen idee in.';
$best = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_best_seller DESC, created_at DESC LIMIT 4');
$new = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_new DESC, created_at DESC LIMIT 4');
$categories = ['Draken' => '🐉', 'Dieren' => '🐾', 'Magneten' => '🧲', 'Fidgets' => '🎮', 'Sleutelhangers' => '🔑', 'Overig' => '✨'];
$mpProfile = setting('marktplaats_profile_url', '');
?>
<section class="home-hero">
  <div class="home-hero-shade"></div>
  <div class="home-hero-copy anim-rise"><span class="kicker">Laag voor laag geprint</span><h1>Ederveen<em>3D</em></h1><p>Leuke, kleurrijke 3D-prints, met zorg gemaakt in Ederveen.</p><a class="btn hover-sheen" href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Bekijk mijn werk →' : 'Naar de shop →' ?></a> <a class="btn ghost" href="<?= e(url('?p=custom')) ?>">Eigen idee?</a></div>
</section>

<section id="best-sellers" class="home-section"><div class="section-heading"><div><span class="kicker">Favorieten</span><h2>Populair</h2></div><a href="<?= e(url('?p=shop&collection=best')) ?>">Alles bekijken →</a></div><div class="grid cols-4"><?php foreach ($best as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$best): ?><p class="muted">Producten verschijnen hier zodra je ze toevoegt.</p><?php endif; ?></div></section>

<section id="new-products" class="home-section"><div class="section-heading"><div><span class="kicker">Vers van de printer</span><h2>Nieuw</h2></div><a href="<?= e(url('?p=shop&collection=new')) ?>">Alles bekijken →</a></div><div class="grid cols-4"><?php foreach ($new as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$new): ?><p class="muted">Producten verschijnen hier zodra je ze toevoegt.</p><?php endif; ?></div></section>

<section id="categories" class="home-section section-band"><span class="kicker">Vind je favoriet</span><h2>Categorieën</h2><div class="grid cols-3 category-grid"><?php foreach ($categories as $name => $icon): ?><a class="card hover-lift" href="<?= e(url('?p=shop&cat=' . urlencode($name))) ?>"><b class="category-icon"><?= $icon ?></b><h3><?= e($name) ?></h3><p class="muted">Bekijk <?= e(mb_strtolower($name)) ?> →</p></a><?php endforeach; ?></div></section>

<?php if ($showcase): ?>
<section class="home-section split-feature"><div class="gift-art">🛒</div><div><span class="kicker pink">Iets gezien wat je leuk vindt?</span><h2>Bestellen gaat via Marktplaats</h2><p class="lead muted">Bij elk product staat een knop naar de Marktplaats-advertentie. Daar kun je het veilig kopen en betalen.</p><?php if ($mpProfile): ?><a class="btn ghost" href="<?= e($mpProfile) ?>" target="_blank" rel="noopener">Al mijn advertenties</a><?php endif; ?></div></section>
<?php endif; ?>

<section id="about" class="home-section split-feature"><div><span class="kicker">Over <?= e($store) ?></span><h2>Klein studiootje. Grote ideeën.</h2><p class="muted">Ederveen3D is mijn eigen 3D-printstudio in Ederveen. Ik ontwerp en print leuke, kleurrijke dingen: van draakjes en fidgets tot handige spullen voor op je bureau.</p><p class="muted">Elke print controleer ik zelf, werk ik netjes af en verpak ik met zorg.</p><p>Leuk dat je komt kijken!</p></div><div class="workshop-art">🖨️<span>Foto's van de printer komen binnenkort</span></div></section>

<section class="home-section section-band"><span class="kicker">Waarom Ederveen3D?</span><div class="grid cols-3 benefit-grid"><div><b>📍 Uit Ederveen</b><p class="muted">Lokaal geprint, gewoon hier in de Gelderse Vallei.</p></div><div><b>🖨️ 3D-geprint</b><p class="muted">Laag voor laag gemaakt met moderne printers.</p></div><div><b>✋ Met de hand afgewerkt</b><p class="muted">Elke print wordt gecontroleerd en netjes afgewerkt.</p></div><div><b>🎨 Veel kleuren</b><p class="muted">Bij veel producten kun je zelf een kleur kiezen.</p></div><div><b>💡 Eigen idee</b><p class="muted">Heb je een bestand of idee? Ik denk graag mee.</p></div><div><b>📦 Netjes verpakt</b><p class="muted">Verstuurd met PostNL of ophalen in Ederveen.</p></div></div></section>

<section class="home-section social-grid"><div class="card"><h2>Volg <?= e($store) ?></h2><p class="muted">Zie wat er nu van de printer komt.</p><?php foreach (array_filter(['Instagram' => setting('instagram_url', ''), 'TikTok' => setting('tiktok_url', '')]) as $label => $link): ?><a class="btn ghost small" href="<?= e($link) ?>" target="_blank" rel="noopener"><?= e($label) ?></a> <?php endforeach; ?></div><div class="card"><h2>Eigen idee laten printen?</h2><p class="muted">Stuur je bestand of beschrijf wat je zoekt. Ik laat weten of het kan en wat het kost.</p><a class="btn small" href="<?= e(url('?p=custom')) ?>">Idee insturen</a></div></section>

<section class="shipping-callout"><div><span class="kicker">Verzenden of ophalen</span><h2>Netjes verpakt. Verstuurd of opgehaald.</h2><p class="muted">Ik verstuur binnen Nederland met PostNL. Woon je in de buurt? Dan kun je je print ook ophalen in Ederveen.</p></div><a class="btn ghost" href="<?= e(url('?p=support')) ?>">Meer informatie</a></section>
