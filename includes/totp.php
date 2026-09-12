<?php
/**
 * Minimal TOTP (RFC 6238) + Base32 (RFC 4648) implementation, self-contained
 * so 2FA doesn't need Composer or any external library. Compatible with
 * Google Authenticator, Authy, 1Password, etc.
 */

function base32_encode($data) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    for ($i = 0; $i < strlen($data); $i++) {
        $bits .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
    }
    $output = '';
    foreach (str_split($bits, 5) as $chunk) {
        $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
        $output .= $alphabet[bindec($chunk)];
    }
    return $output;
}

function base32_decode($b32) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $b32 = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $b32));
    $bits = '';
    for ($i = 0; $i < strlen($b32); $i++) {
        $pos = strpos($alphabet, $b32[$i]);
        if ($pos === false) continue;
        $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
    }
    $bytes = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) < 8) break; // drop incomplete trailing bits
        $bytes .= chr(bindec($byte));
    }
    return $bytes;
}

/** Generates a fresh random TOTP secret (base32, 32 chars = 20 raw bytes). */
function generate_totp_secret() {
    return base32_encode(random_bytes(20));
}

/** The 6-digit TOTP code for a given base32 secret at a given time (or now). */
function get_totp_code($base32Secret, $timestamp = null) {
    if ($timestamp === null) $timestamp = time();
    $key = base32_decode($base32Secret);
    $timeSlice = (int) floor($timestamp / 30);
    $binaryCounter = pack('N*', 0) . pack('N*', $timeSlice); // 8-byte big-endian counter
    $hash = hash_hmac('sha1', $binaryCounter, $key, true);
    $offset = ord($hash[19]) & 0x0F;
    $truncated = ((ord($hash[$offset]) & 0x7F) << 24)
        | ((ord($hash[$offset + 1]) & 0xFF) << 16)
        | ((ord($hash[$offset + 2]) & 0xFF) << 8)
        | (ord($hash[$offset + 3]) & 0xFF);
    return str_pad((string)($truncated % 1000000), 6, '0', STR_PAD_LEFT);
}

/** Verifies a submitted code, allowing +/-$window 30-second steps of clock drift. */
function verify_totp_code($base32Secret, $code, $window = 1) {
    $code = trim($code);
    if (!preg_match('/^\d{6}$/', $code)) return false;
    $now = time();
    for ($i = -$window; $i <= $window; $i++) {
        if (hash_equals(get_totp_code($base32Secret, $now + ($i * 30)), $code)) {
            return true;
        }
    }
    return false;
}

/** Builds the otpauth:// URI used to generate the QR code for authenticator apps. */
function totp_provisioning_uri($secret, $username) {
    $label = rawurlencode(SITE_NAME . ':' . $username);
    $issuer = rawurlencode(SITE_NAME);
    return "otpauth://totp/{$label}?secret={$secret}&issuer={$issuer}&digits=6&period=30";
}
