<?php
/**
 * Dynamic sitemap, served at /sitemap.xml (matched via the generic
 * clean-URL rule in .htaccess, which appends .php to the request path
 * and serves this file if it exists). Lists every real, indexable page
 * — marketing pages plus every published post — so it can't go stale
 * the way a hand-written static file would.
 */
require_once __DIR__ . '/includes/functions.php';

header('Content-Type: application/xml; charset=UTF-8');

$staticPaths = ['/', '/products', '/store', '/posts', '/about', '/contact', '/privacy', '/terms', '/cookies', '/refund'];

$posts = Content::all('posts');
$posts = array_filter($posts, fn($p) => !empty($p['published']));

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($staticPaths as $path) {
    echo '  <url><loc>' . e(SITE_URL . $path) . '</loc></url>' . "\n";
}
foreach ($posts as $post) {
    if (empty($post['slug'])) continue;
    echo '  <url><loc>' . e(SITE_URL . '/posts/' . rawurlencode($post['slug'])) . '</loc>';
    if (!empty($post['created_at'])) {
        $ts = strtotime($post['created_at']);
        if ($ts) echo '<lastmod>' . date('Y-m-d', $ts) . '</lastmod>';
    }
    echo '</url>' . "\n";
}

echo '</urlset>' . "\n";
