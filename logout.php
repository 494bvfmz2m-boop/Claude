<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/XyphrosAuth.php';

XyphrosAuth::destroySession();
header('Location: /');
exit;
