<?php
/**
 * Database connection (MySQL/MariaDB via PDO) for accounts, roles, posts,
 * tickets, and store orders.
 */

function db_connect() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        // Never leak DB credentials or raw exception details to visitors.
        die('Site is temporarily unavailable (database connection failed). Please try again shortly.');
    }
}

/** SELECT multiple rows. $params are bound positionally or by name. */
function db_query($sql, $params = []) {
    $stmt = db_connect()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** SELECT a single row, or null if no match. */
function db_query_one($sql, $params = []) {
    $stmt = db_connect()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** INSERT/UPDATE/DELETE. Returns the number of affected rows. */
function db_execute($sql, $params = []) {
    $stmt = db_connect()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

/** Last auto-increment ID from the most recent INSERT. */
function db_last_insert_id() {
    return (int) db_connect()->lastInsertId();
}
