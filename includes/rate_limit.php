<?php
/**
 * Small DB-backed rate limiter for brute-force-prone endpoints (login, 2FA
 * codes, registration, password reset requests, ticket creation). Each check
 * is scoped to a "bucket" (which endpoint) + "identifier" (who), so a burst
 * on one endpoint/account never affects another.
 */

/**
 * Best-effort caller IP. Trusts CF-Connecting-IP / X-Forwarded-For (fine for
 * shared hosts behind Cloudflare or another reverse proxy) — only ever used
 * for throttling, never for a security-critical access decision.
 */
function client_ip() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return trim($_SERVER['HTTP_CF_CONNECTING_IP']);
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * True if $identifier has already recorded >= $maxAttempts hits in $bucket
 * within the last $windowSeconds. Also opportunistically clears this
 * bucket/identifier's own expired rows so the table doesn't grow forever.
 */
function rate_limit_exceeded($bucket, $identifier, $maxAttempts, $windowSeconds) {
    db_execute(
        "DELETE FROM rate_limits WHERE bucket = ? AND identifier = ? AND created_at < (NOW() - INTERVAL ? SECOND)",
        [$bucket, $identifier, $windowSeconds]
    );
    $row = db_query_one(
        "SELECT COUNT(*) AS c FROM rate_limits WHERE bucket = ? AND identifier = ? AND created_at >= (NOW() - INTERVAL ? SECOND)",
        [$bucket, $identifier, $windowSeconds]
    );
    return ($row ? (int)$row['c'] : 0) >= $maxAttempts;
}

/** Records one hit against $identifier in $bucket (call after a failed/throttle-worthy attempt). */
function rate_limit_record($bucket, $identifier) {
    db_execute("INSERT INTO rate_limits (bucket, identifier) VALUES (?, ?)", [$bucket, $identifier]);
}
