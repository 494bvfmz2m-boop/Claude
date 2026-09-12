<?php
/**
 * Database credentials for this deployment.
 *
 * Copy this file to `db_config.php` (same folder) and fill in the real
 * values for your host's MySQL/MariaDB database. "localhost" is correct for
 * almost every shared host (cPanel, Pebble Host, etc.) — if yours gives you
 * a different database hostname, change DB_HOST to match.
 *
 * `db_config.php` is listed in .gitignore on purpose: a database password
 * is a live secret and should never be committed to source control. Upload
 * it directly to your host (FTP/file manager) next to this example file.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
