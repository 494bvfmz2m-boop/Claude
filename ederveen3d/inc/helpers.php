<?php
// Shared helpers

function config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $path = __DIR__ . '/../config.php';
        if (!file_exists($path)) {
            header('Location: install.php');
            exit;
        }
        $cfg = require $path;
    }
    return $cfg;
}

function setting(string $key, $default = null) {
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (all('SELECT skey, svalue FROM settings') as $r) {
            $cache[$r['skey']] = $r['svalue'];
        }
    }
    return array_key_exists($key, $cache) && $cache[$key] !== null && $cache[$key] !== ''
        ? $cache[$key] : $default;
}

function set_setting(string $key, ?string $value): void {
    q('INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)', [$key, $value]);
}

function e(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function money(int $cents): string {
    return '€ ' . number_format($cents / 100, 2, ',', '.');
}

/** Portfolio mode: no cart or payments, products link to Marktplaats instead. */
function showcase_mode(): bool {
    return setting('shop_mode', 'showcase') !== 'shop';
}

function url(string $path = ''): string {
    $base = rtrim(setting('site_url', ''), '/');
    if ($base === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
        $base = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
    }
    return $base . '/' . ltrim($path, '/');
}

function redirect(string $path): void {
    header('Location: ' . (preg_match('#^https?://#', $path) ? $path : url($path)));
    exit;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void {
    $sent = $_POST['_csrf'] ?? '';
    if (!is_string($sent) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        http_response_code(400);
        exit('Beveiligingscontrole mislukt. Ga terug en probeer het opnieuw.');
    }
}

function flash(?string $msg = null, string $type = 'ok') {
    if ($msg !== null) {
        $_SESSION['flash'][] = ['msg' => $msg, 'type' => $type];
        return null;
    }
    $out = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $out;
}

function slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'item';
}

function cart(): array {
    return $_SESSION['cart'] ?? [];
}

function cart_count(): int {
    $n = 0;
    foreach (cart() as $line) $n += (int)$line['qty'];
    return $n;
}

function cart_lines(): array {
    $cart = cart();
    if (!$cart) return [];
    $ids = array_map('intval', array_keys($cart));
    $in = implode(',', array_fill(0, count($ids), '?'));
    $rows = all("SELECT * FROM products WHERE id IN ($in) AND visible = 1", $ids);
    $lines = [];
    foreach ($rows as $p) {
        $qty = max(1, (int)$cart[$p['id']]['qty']);
        $lines[] = ['product' => $p, 'qty' => $qty, 'subtotal' => $qty * (int)$p['price_cents']];
    }
    return $lines;
}

function shipping_cents(int $subtotal, string $method): int {
    if ($method === 'pickup') return 0;
    $free = (int)setting('free_shipping_over_cents', 0);
    if ($free > 0 && $subtotal >= $free) return 0;
    return (int)setting('shipping_standard_cents', 495);
}

function shipping_label(string $method): string {
    return $method === 'pickup' ? 'ophalen in Maarn' : 'PostNL';
}

function btw_cents(int $amount): int {
    $rate = (float)setting('btw_rate', '0');
    if ($rate <= 0) return 0;
    // Prices include btw: this is the btw part of the total
    return (int)round($amount - ($amount / (1 + $rate)));
}

function order_ref(): string {
    return 'E3D-' . strtoupper(bin2hex(random_bytes(3))) . '-' . date('y');
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
