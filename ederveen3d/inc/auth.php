<?php
// Authentication, roles and rate limiting

function current_user() {
    static $user = false;
    if ($user !== false) return $user;
    $id = $_SESSION['uid'] ?? null;
    $user = $id ? one('SELECT * FROM users WHERE id = ?', [$id]) : null;
    return $user;
}

function is_logged_in(): bool {
    return current_user() !== null;
}

function user_role(): string {
    $u = current_user();
    return $u ? $u['role'] : 'guest';
}

function is_staff(): bool {
    return in_array(user_role(), ['staff', 'owner'], true);
}

function is_owner(): bool {
    return user_role() === 'owner';
}

function require_login(): void {
    if (!is_logged_in()) {
        $_SESSION['after_login'] = $_SERVER['REQUEST_URI'] ?? '';
        flash('Please sign in to continue.', 'warn');
        redirect('?p=login');
    }
}

function require_staff(): void {
    require_login();
    if (!is_staff()) {
        http_response_code(403);
        exit('Not allowed.');
    }
}

function require_owner(): void {
    require_login();
    if (!is_owner()) {
        http_response_code(403);
        exit('Owner access only.');
    }
}

function login_user(array $user): void {
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$user['id'];
    unset($_SESSION['pending_2fa_uid']);
    q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [$user['id']]);
}

function logout_user(): void {
    $_SESSION = [];
    session_destroy();
}

function throttle(string $key, int $max = 8, int $windowSeconds = 900): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $id = $key . '|' . $ip;
    q('DELETE FROM login_attempts WHERE created_at < (NOW() - INTERVAL ? SECOND)', [$windowSeconds]);
    $n = (int)(one('SELECT COUNT(*) c FROM login_attempts WHERE ident = ?', [$id])['c'] ?? 0);
    if ($n >= $max) return false;
    q('INSERT INTO login_attempts (ident, created_at) VALUES (?, NOW())', [$id]);
    return true;
}

function clear_throttle(string $key): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    q('DELETE FROM login_attempts WHERE ident = ?', [$key . '|' . $ip]);
}
