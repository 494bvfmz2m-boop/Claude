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

function ensure_storefront_schema(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $columns = [
        'product_details' => 'TEXT NULL',
        'colours' => 'TEXT NULL',
        'size_text' => 'VARCHAR(190) NULL',
        'promo_badge' => 'VARCHAR(80) NULL',
        'is_best_seller' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'is_new' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ];
    foreach ($columns as $name => $definition) {
        $exists = one('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['products', $name]);
        if (!$exists) q("ALTER TABLE products ADD COLUMN `$name` $definition");
    }
    // Discount codes used on paid orders (added automatically, no reinstall needed).
    $orderColumns = [
        'discount_cents' => 'INT NOT NULL DEFAULT 0',
        'discount_code' => 'VARCHAR(80) NULL',
    ];
    foreach ($orderColumns as $name => $definition) {
        $exists = one('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['orders', $name]);
        if (!$exists) q("ALTER TABLE orders ADD COLUMN `$name` $definition");
    }
}
