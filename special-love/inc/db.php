<?php
// Database connection (PDO / MySQL)

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfg = config();
    $dsn = 'mysql:host=' . $cfg['db_host'] . ';port=' . $cfg['db_port'] . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        exit('Database connection failed. Check config.php.');
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function one(string $sql, array $params = []) {
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function all(string $sql, array $params = []): array {
    return q($sql, $params)->fetchAll();
}

/** Add a column if it is missing (lets updates go live without running install.php again). */
function ensure_column(string $table, string $name, string $definition): void {
    $exists = one('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$table, $name]);
    if (!$exists) q("ALTER TABLE `$table` ADD COLUMN `$name` $definition");
}

/** Bump this when the schema below changes. */
const SL_SCHEMA_VERSION = '3';

function ensure_storefront_schema(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $current = one("SELECT svalue FROM settings WHERE skey = 'schema_version'");
    if ($current && $current['svalue'] === SL_SCHEMA_VERSION) return;
    try {
        apply_schema_updates();
    } catch (PDOException $e) {
        error_log('Special Love database update failed: ' . $e->getMessage());
        http_response_code(503);
        header('Retry-After: 300');
        $denied = stripos($e->getMessage(), 'denied') !== false;
        exit('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Back soon</title>'
           . '<div style="font:16px/1.6 system-ui,sans-serif;max-width:620px;margin:60px auto;padding:0 16px">'
           . '<h1>We\'ll be right back</h1><p>The shop is finishing an update. Please try again in a few minutes.</p>'
           . '<p style="color:#666;font-size:14px"><b>Shop owner:</b> the website could not update its database. '
           . ($denied ? 'The database user is not allowed to change tables. In cPanel go to <b>MySQL Databases</b>, find your database user under "Add User To Database", and give it <b>ALL PRIVILEGES</b>. Then reload this page.'
                      : 'Open check.php for details.')
           . '<br><small>' . htmlspecialchars($e->getMessage()) . '</small></p></div>');
    }
}

function apply_schema_updates(): void {

    foreach ([
        'product_details' => 'TEXT NULL',
        'colours' => 'TEXT NULL',
        'size_text' => 'VARCHAR(190) NULL',
        'promo_badge' => 'VARCHAR(80) NULL',
        'is_best_seller' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'is_new' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ] as $name => $definition) ensure_column('products', $name, $definition);

    // Discount codes, hiding, and payments for custom print quotes.
    ensure_column('orders', 'discount_cents', 'INT NOT NULL DEFAULT 0');
    ensure_column('orders', 'discount_code', 'VARCHAR(80) NULL');
    ensure_column('orders', 'hidden', 'TINYINT(1) NOT NULL DEFAULT 0');
    ensure_column('orders', 'request_id', 'INT NULL');
    ensure_column('orders', 'receipt_sent', 'TINYINT(1) NOT NULL DEFAULT 0');
    ensure_column('custom_requests', 'hidden', 'TINYINT(1) NOT NULL DEFAULT 0');
    ensure_column('custom_requests', 'access_token', 'VARCHAR(64) NULL');

    q('CREATE TABLE IF NOT EXISTS product_media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        path VARCHAR(255) NOT NULL,
        kind VARCHAR(10) NOT NULL DEFAULT "image",
        sort INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    q('CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NULL,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(190) NULL,
        rating TINYINT NOT NULL DEFAULT 5,
        body TEXT NOT NULL,
        verified TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT "pending",
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (product_id), INDEX (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    q('CREATE TABLE IF NOT EXISTS request_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        sender VARCHAR(10) NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // Existing product photos become the first item of each product's gallery.
    q('INSERT INTO product_media (product_id, path, kind, sort)
       SELECT p.id, p.image, "image", 0 FROM products p
       WHERE p.image IS NOT NULL AND p.image <> ""
         AND NOT EXISTS (SELECT 1 FROM product_media m WHERE m.product_id = p.id)');
    // Every custom request needs a private chat link.
    foreach (all('SELECT id FROM custom_requests WHERE access_token IS NULL') as $r) {
        q('UPDATE custom_requests SET access_token = ? WHERE id = ?', [bin2hex(random_bytes(16)), $r['id']]);
    }
    // The free gift now comes with every order.
    q("UPDATE settings SET svalue = 'Free gift with every order' WHERE skey = 'promo_bar_text' AND svalue = 'Free gift with high priced orders'");

    q("INSERT INTO settings (skey, svalue) VALUES ('schema_version', ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)", [SL_SCHEMA_VERSION]);
}
