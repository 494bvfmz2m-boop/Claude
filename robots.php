<?php
/** Served at /robots.txt via the rewrite rule in .htaccess. */
require_once __DIR__ . '/includes/config.php';

header('Content-Type: text/plain; charset=UTF-8');
?>
User-agent: *
Disallow: /admin/
Disallow: /account
Disallow: /two-factor
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /ticket
Disallow: /basket
Disallow: /order-return
Disallow: /api/
Allow: /

Sitemap: <?= SITE_URL ?>/sitemap.xml
