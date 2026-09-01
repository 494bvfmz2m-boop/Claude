<?php
/**
 * No longer part of the checkout flow — purchases used to bounce through
 * Tebex's own per-basket Discord login here (see git history). That's
 * been replaced by linking Discord to your Xyphros account once, in
 * /account?tab=connections, which store-buy.php now requires up front.
 * This file only exists so an old bookmarked/cached link doesn't 404.
 */
require_once __DIR__ . '/includes/functions.php';
header('Location: /store');
exit;
