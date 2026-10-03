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
        exit('Verbinding met de database mislukt. Controleer config.php.');
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
        'marktplaats_url' => 'VARCHAR(255) NULL',
    ];
    foreach ($columns as $name => $definition) {
        $exists = one('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['products', $name]);
        if (!$exists) q("ALTER TABLE products ADD COLUMN `$name` $definition");
    }
    q('CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT "open",
        admin_unread INT NOT NULL DEFAULT 0,
        user_unread INT NOT NULL DEFAULT 0,
        last_nudge_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    q('CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        from_admin TINYINT(1) NOT NULL DEFAULT 0,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (chat_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}
