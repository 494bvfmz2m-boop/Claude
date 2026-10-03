<?php
$store = setting('store_name', 'Ederveen3D');
$showcase = showcase_mode();
$GLOBALS['page_title'] = $store . ' — 3D-prints uit Maarn';
$GLOBALS['page_desc'] = 'Leuke, kleurrijke 3D-prints, laag voor laag gemaakt in Maarn. Bekijk mijn werk, stuur je eigen idee in of chat met me.';
$featured = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_best_seller DESC, is_new DESC, created_at DESC LIMIT 8');
$cats = all('SELECT category, COUNT(*) n FROM products WHERE visible = 1 AND category IS NOT NULL AND category <> "" GROUP BY category ORDER BY n DESC LIMIT 8');
$icons = ['Draken' => '🐉', 'Dieren' => '🐾', 'Magneten' => '🧲', 'Fidgets' => '🌀', 'Sleutelhangers' => '🔑', 'Overig' => '✨'];
$socials = array_filter(['Instagram' => setting('instagram_url', ''), 'TikTok' => setting('tiktok_url', ''), 'Marktplaats' => setting('marktplaats_profile_url', '')]);
?>
<section class="hero">
  <div class="hero-copy">
    <span class="kicker">3D-printstudio · Maarn</span>
    <h1>Ideeën,<br><span class="hl">laag voor laag</span><br>geprint.</h1>
    <p class="lead">Kleurrijke prints, handige spulletjes en jouw eigen ontwerp — gemaakt op mijn Bambu Lab-printer en met de hand afgewerkt.</p>
    <div class="hero-buttons">
      <a class="btn" href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Bekijk mijn werk' : 'Naar de shop' ?></a>
      <a class="btn ghost" href="<?= e(url('?p=custom')) ?>">Eigen idee laten printen</a>
    </div>
  </div>
  <div class="hero-art" aria-hidden="true">
    <div class="stack">
      <div class="nozzle"></div>
      <?php for ($i = 0; $i < 9; $i++): ?><span style="--i:<?= $i ?>"></span><?php endfor; ?>
    </div>
  </div>
</section>

<section class="steps reveal">
  <div><b>1</b><h3>Kies of bedenk</h3><p>Kies iets uit mijn werk of vertel wat je zelf in gedachten hebt.</p></div>
  <div><b>2</b><h3>Even overleggen</h3><p>Via de chat, Marktplaats of een berichtje. Je hoort vooraf wat het kost.</p></div>
  <div><b>3</b><h3>Printen &amp; klaar</h3><p>Ik print het, werk het af en verstuur het. Of je haalt het op in Maarn.</p></div>
</section>

<section class="block reveal">
  <div class="block-head">
    <h2>Van de printer</h2>
    <a href="<?= e(url('?p=shop')) ?>">Alles bekijken →</a>
  </div>
  <?php if ($cats): ?>
    <div class="cat-pills">
      <?php foreach ($cats as $c): ?>
        <a href="<?= e(url('?p=shop&cat=' . urlencode($c['category']))) ?>"><?= $icons[$c['category']] ?? '•' ?> <?= e($c['category']) ?></a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
  <div class="products">
    <?php foreach ($featured as $p) include __DIR__ . '/_product_card.php'; ?>
  </div>
  <?php if (!$featured): ?><p class="muted">Hier komen je producten zodra je ze toevoegt in het beheer.</p><?php endif; ?>
</section>

<section class="idea-band reveal">
  <div>
    <h2>Zelf iets in gedachten?</h2>
    <p>Een naamsleutelhanger, een onderdeel dat kapot is of iets wat je online zag: vertel het me. Een bestand is handig, maar niet nodig.</p>
  </div>
  <div class="idea-buttons">
    <a class="btn light" href="<?= e(url('?p=custom')) ?>">Idee insturen</a>
    <a class="btn outline-light" href="<?= e(url('?p=chat')) ?>">💬 Chat met me</a>
  </div>
</section>

<section id="over" class="about reveal">
  <img src="<?= e(url('assets/logo.svg')) ?>" alt="Logo <?= e($store) ?>">
  <div>
    <span class="kicker">Over mij</span>
    <h2>Hoi! Dit is <?= e($store) ?>.</h2>
    <p>Ederveen3D is mijn eigen 3D-printstudio in Maarn. De naam komt van mijn achternaam. Ik ontwerp en print leuke, kleurrijke dingen: van draakjes en fidgets tot handige spullen voor op je bureau.</p>
    <p>Ik print in PLA Basic en PETG Basic van Bambu Lab. Elke print controleer ik zelf, werk ik netjes af en verpak ik met zorg.</p>
    <?php if ($socials): ?>
      <p class="about-links"><?php foreach ($socials as $label => $link): ?><a href="<?= e($link) ?>" target="_blank" rel="noopener"><?= e($label) ?> ↗</a><?php endforeach; ?></p>
    <?php endif; ?>
  </div>
</section>

<section class="facts reveal">
  <div><b>📍</b><span>Geprint in Maarn</span></div>
  <div><b>🧵</b><span>PLA Basic &amp; PETG Basic</span></div>
  <div><b>📦</b><span>PostNL of gratis ophalen</span></div>
  <div><b>💳</b><span>Marktplaats of kaart</span></div>
</section>
