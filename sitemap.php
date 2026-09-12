<?php
/** Served at /sitemap.xml via the rewrite rule in .htaccess. */
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/database.php';
require_once __DIR__ . '/includes/functions.php';

header('Content-Type: application/xml; charset=UTF-8');

$staticPages = ['', 'rules', 'staff', 'announcements', 'support', 'store'];
$posts = get_posts();

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($staticPages as $path): ?>
  <url>
    <loc><?= e(SITE_URL . '/' . $path) ?></loc>
  </url>
<?php endforeach; ?>
<?php foreach ($posts as $p): ?>
  <url>
    <loc><?= e(SITE_URL . '/post?id=' . (int)$p['id']) ?></loc>
    <lastmod><?= e(date('Y-m-d', strtotime($p['created_at']))) ?></lastmod>
  </url>
<?php endforeach; ?>
</urlset>
