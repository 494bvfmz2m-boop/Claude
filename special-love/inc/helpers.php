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
    return '$' . number_format($cents / 100, 2);
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
        exit('Security check failed. Please go back and try again.');
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

/**
 * Parse a product's colour or size list, e.g. "Purple, Orange, Glow in the dark +2.50".
 * A "+amount" after an option adds that much to the price.
 * Returns [['label' => 'Glow in the dark', 'extra' => 250], ...].
 */
function product_options(?string $raw): array {
    $out = [];
    foreach (explode(',', (string)$raw) as $part) {
        $part = trim($part);
        if ($part === '') continue;
        $extra = 0;
        if (preg_match('/^(.*?)\s*\(?\+\s*\$?\s*(\d+(?:[.,]\d{1,2})?)\s*\)?$/u', $part, $m) && trim($m[1]) !== '') {
            $part = trim($m[1]);
            $extra = (int)round((float)str_replace(',', '.', $m[2]) * 100);
        }
        $out[] = ['label' => $part, 'extra' => $extra];
    }
    return $out;
}

/** Find the option the customer picked; null when it isn't one of the product's options. */
function find_option(array $options, string $label): ?array {
    foreach ($options as $o) if (strcasecmp($o['label'], $label) === 0) return $o;
    return null;
}

/** Price of one item with the chosen colour and size. */
function option_price(array $product, string $colour, string $size): int {
    $price = (int)$product['price_cents'];
    if ($colour !== '' && ($o = find_option(product_options($product['colours'] ?? ''), $colour))) $price += $o['extra'];
    if ($size !== '' && ($o = find_option(product_options($product['sizes'] ?? ''), $size))) $price += $o['extra'];
    return $price;
}

/** "Colour: Purple, Size: Large" (empty when the product has no choices). */
function option_text(string $colour, string $size): string {
    return implode(', ', array_filter([$colour !== '' ? 'Colour: ' . $colour : '', $size !== '' ? 'Size: ' . $size : '']));
}

/**
 * Cart lines are keyed per product AND colour AND size, so a purple and an orange
 * clicker are two separate lines: ['id' => 5, 'qty' => 1, 'colour' => 'Purple', 'size' => ''].
 */
function cart(): array {
    return normalise_cart($_SESSION['cart'] ?? []);
}

/** Upgrade carts saved by the old version (keyed by product id only). */
function normalise_cart(array $cart): array {
    $out = [];
    foreach ($cart as $key => $line) {
        $id = (int)($line['id'] ?? $key);
        $colour = (string)($line['colour'] ?? '');
        $size = (string)($line['size'] ?? '');
        $k = cart_key($id, $colour, $size);
        $out[$k] = ['id' => $id, 'qty' => min(99, (int)($out[$k]['qty'] ?? 0) + max(1, (int)($line['qty'] ?? 1))), 'colour' => $colour, 'size' => $size];
    }
    return $out;
}

function cart_key(int $id, string $colour, string $size): string {
    return $id . '|' . $colour . '|' . $size;
}

/** Add a product to a cart array (cart or saved-for-later) and return it. */
function cart_put(array $cart, int $id, int $qty, string $colour, string $size): array {
    $k = cart_key($id, $colour, $size);
    $cart[$k] = ['id' => $id, 'qty' => min(99, (int)($cart[$k]['qty'] ?? 0) + $qty), 'colour' => $colour, 'size' => $size];
    return $cart;
}

function cart_count(): int {
    $n = 0;
    foreach (cart() as $line) $n += (int)$line['qty'];
    return $n;
}

function cart_lines(?array $cart = null): array {
    $cart = $cart === null ? cart() : normalise_cart($cart);
    if (!$cart) return [];
    $ids = array_values(array_unique(array_map(fn($l) => (int)$l['id'], $cart)));
    $in = implode(',', array_fill(0, count($ids), '?'));
    $products = [];
    foreach (all("SELECT * FROM products WHERE id IN ($in) AND visible = 1", $ids) as $p) $products[(int)$p['id']] = $p;
    $lines = [];
    foreach ($cart as $key => $l) {
        $p = $products[(int)$l['id']] ?? null;
        if (!$p) continue;
        $qty = max(1, (int)$l['qty']);
        $unit = option_price($p, $l['colour'], $l['size']);
        $lines[] = ['key' => $key, 'product' => $p, 'qty' => $qty, 'colour' => $l['colour'], 'size' => $l['size'],
                    'options' => option_text($l['colour'], $l['size']), 'unit' => $unit, 'subtotal' => $qty * $unit];
    }
    return $lines;
}

function shipping_cents(int $subtotal, string $method): int {
    if ($method === 'express') return (int)setting('shipping_express_cents', 1995);
    $free = (int)setting('free_shipping_over_cents', 15000);
    if ($free > 0 && $subtotal >= $free) return 0;
    return (int)setting('shipping_standard_cents', 995);
}

function gst_cents(int $amount): int {
    $rate = (float)setting('gst_rate', '0.10');
    if ($rate <= 0) return 0;
    // GST-inclusive pricing: tax component of the total
    return (int)round($amount - ($amount / (1 + $rate)));
}

function order_ref(): string {
    return 'SL-' . strtoupper(bin2hex(random_bytes(3))) . '-' . date('y');
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
