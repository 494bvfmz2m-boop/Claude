<?php
/**
 * Single entry point every page requires instead of hand-listing includes.
 * Order matters: config (sessions/constants) -> data stores -> helpers -> auth -> store.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/tebex.php';
