<?php
$showcase = showcase_mode();
$GLOBALS['page_title'] = ($showcase ? 'Mijn werk' : 'Shop') . ' - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Bekijk draakjes, dieren, fidgets en handige spullen, laag voor laag geprint in Ederveen.';

$search = trim((string)($_GET['q'] ?? ''));
$cat = trim((string)($_GET['cat'] ?? ''));
$sort = $_GET['sort'] ?? 'new';
$collection = $_GET['collection'] ?? '';

$sql = 'SELECT * FROM products WHERE visible = 1';
$args = [];
if ($search !== '') { $sql .= ' AND (name LIKE ? OR description LIKE ?)'; $args[] = "%$search%"; $args[] = "%$search%"; }
if ($cat !== '')    { $sql .= ' AND category = ?'; $args[] = $cat; }
if ($collection === 'best') $sql .= ' AND is_best_seller = 1';
if ($collection === 'new') $sql .= ' AND is_new = 1';
$sql .= match ($sort) {
    'price_asc'  => ' ORDER BY price_cents ASC',
    'price_desc' => ' ORDER BY price_cents DESC',
    'name'       => ' ORDER BY name ASC',
    default      => ' ORDER BY created_at DESC',
};
$products = all($sql, $args);
$cats = all('SELECT DISTINCT category FROM products WHERE visible = 1 AND category IS NOT NULL AND category <> "" ORDER BY category');
?>
<h1><?= $showcase ? 'Mijn werk' : 'Shop' ?></h1>
<form class="card" method="get" style="margin-bottom:24px">
  <input type="hidden" name="p" value="shop">
  <input type="hidden" name="collection" value="<?= e($collection) ?>">
  <div class="grid cols-3">
    <label>Zoeken <input name="q" value="<?= e($search) ?>" placeholder="Draak, sleutelhanger..."></label>
    <label>Categorie
      <select name="cat">
        <option value="">Alle categorieën</option>
        <?php foreach ($cats as $c): ?>
          <option value="<?= e($c['category']) ?>" <?= $cat === $c['category'] ? 'selected' : '' ?>><?= e($c['category']) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Sorteren
      <select name="sort">
        <option value="new" <?= $sort === 'new' ? 'selected' : '' ?>>Nieuwste</option>
        <option value="price_asc" <?= $sort === 'price_asc' ? 'selected' : '' ?>>Prijs: laag naar hoog</option>
        <option value="price_desc" <?= $sort === 'price_desc' ? 'selected' : '' ?>>Prijs: hoog naar laag</option>
        <option value="name" <?= $sort === 'name' ? 'selected' : '' ?>>Naam</option>
      </select>
    </label>
  </div>
  <button class="btn" type="submit">Toepassen</button>
</form>

<div class="grid cols-3">
  <?php foreach ($products as $p): ?>
    <?php include __DIR__ . '/_product_card.php'; ?>
  <?php endforeach; ?>
</div>
<?php if (!$products): ?><p class="muted">Niets gevonden. Probeer een ander zoekwoord.</p><?php endif; ?>
