<?php
/**
 * XyphrosAuth — shared account system for xyphros.net + portal.xyphros.net
 * ============================================================================
 * This exact file is copied into BOTH codebases:
 *   - xyphros-site/includes/XyphrosAuth.php
 *   - xyphros-portal/src/XyphrosAuth.php
 * If you ever edit the auth logic, edit it in one place and copy it to the
 * other — there's no shared server-side include across the two subdomains.
 *
 * Before including this file, the app must already have defined:
 *   DB_HOST, DB_NAME, DB_USER, DB_PASS   — MySQL connection
 *   COOKIE_DOMAIN                        — '.xyphros.net'
 *   COOKIE_NAME                          — 'xyphros_session' (same on both sites)
 */

class XyphrosAuth
{
    private static ?PDO $pdo = null;

    // ------------------------------------------------------------------
    // Connection
    // ------------------------------------------------------------------
    public static function db(): PDO
    {
        if (self::$pdo === null) {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    public static function uuid(): string
    {
        $d = random_bytes(16);
        $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
        $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
    }

    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------
    public static function findById(string $id): ?array
    {
        $s = self::db()->prepare('SELECT * FROM users WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    public static function findByEmail(string $email): ?array
    {
        $s = self::db()->prepare('SELECT * FROM users WHERE email = ?');
        $s->execute([strtolower(trim($email))]);
        return $s->fetch() ?: null;
    }

    public static function findByUsername(string $username): ?array
    {
        $s = self::db()->prepare('SELECT * FROM users WHERE username = ?');
        $s->execute([strtolower(trim($username))]);
        return $s->fetch() ?: null;
    }

    public static function findByDiscordId(string $discordId): ?array
    {
        $s = self::db()->prepare('SELECT * FROM users WHERE discord_id = ?');
        $s->execute([$discordId]);
        return $s->fetch() ?: null;
    }

    public static function createUser(string $username, string $email, string $password, array $extra = []): string
    {
        $id = self::uuid();
        $fields = array_merge([
            'id'              => $id,
            'username'        => strtolower(trim($username)),
            'email'           => strtolower(trim($email)),
            'password_hash'   => self::hashPassword($password),
            'name'            => $extra['name'] ?? $username,
            'email_verified'  => 0,
            'locked'          => 0,
            'is_super_admin'  => 0,
            'is_portal_staff' => 0,
            'is_xyphros_staff'=> 0,
            'workspace_limit' => 3,
            'unlimited'       => 0,
            'twofa_method'    => 'none',
        ], $extra, ['id' => $id]);

        $cols = array_keys($fields);
        $sql = 'INSERT INTO users (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
        self::db()->prepare($sql)->execute(array_values($fields));
        return $id;
    }

    public static function updateUser(string $id, array $fields): void
    {
        if (!$fields) return;
        $set = implode(', ', array_map(fn($c) => "$c = ?", array_keys($fields)));
        $vals = array_values($fields);
        $vals[] = $id;
        self::db()->prepare("UPDATE users SET $set WHERE id = ?")->execute($vals);
    }

    public static function hashPassword(string $pw): string
    {
        return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verifyPassword(string $pw, string $hash): bool
    {
        return password_verify($pw, $hash);
    }

    // ------------------------------------------------------------------
    // Sessions (shared cookie across *.xyphros.net)
    // ------------------------------------------------------------------
    public static function createSession(string $userId): string
    {
        $token = bin2hex(random_bytes(32));
        $hash  = hash('sha256', $token);
        $expires = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30); // 30 days

        self::db()->prepare(
            'INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, expires_at) VALUES (?,?,?,?,?,?)'
        )->execute([
            self::uuid(), $userId, $hash,
            $_SERVER['REMOTE_ADDR'] ?? null,
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            $expires,
        ]);

        setcookie(COOKIE_NAME, $token, [
            'expires'  => time() + 60 * 60 * 24 * 30,
            'path'     => '/',
            'domain'   => COOKIE_DOMAIN,
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        return $token;
    }

    public static function currentUser(): ?array
    {
        $token = $_COOKIE[COOKIE_NAME] ?? null;
        if (!$token) return null;

        $hash = hash('sha256', $token);
        $s = self::db()->prepare(
            'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > NOW()'
        );
        $s->execute([$hash]);
        return $s->fetch() ?: null;
    }

    public static function destroySession(): void
    {
        $token = $_COOKIE[COOKIE_NAME] ?? null;
        if ($token) {
            $hash = hash('sha256', $token);
            self::db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$hash]);
        }
        setcookie(COOKIE_NAME, '', [
            'expires' => time() - 3600, 'path' => '/', 'domain' => COOKIE_DOMAIN,
            'secure' => true, 'httponly' => true, 'samesite' => 'Lax',
        ]);
    }

    public static function destroyAllSessions(string $userId, ?string $keepToken = null): void
    {
        if ($keepToken) {
            $keepHash = hash('sha256', $keepToken);
            self::db()->prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
                ->execute([$userId, $keepHash]);
        } else {
            self::db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
        }
    }

    /** For an account page's "active devices" list. */
    public static function sessions(string $userId): array
    {
        $cur = $_COOKIE[COOKIE_NAME] ?? null;
        $curHash = $cur ? hash('sha256', $cur) : null;
        $stmt = self::db()->prepare(
            'SELECT id, token_hash, expires_at, created_at, ip, user_agent FROM sessions
             WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['current'] = $curHash !== null && hash_equals($r['token_hash'], $curHash);
            unset($r['token_hash']);
        }
        return $rows;
    }

    public static function revokeSession(string $userId, string $sessionId): void
    {
        self::db()->prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')->execute([$sessionId, $userId]);
    }

    // ------------------------------------------------------------------
    // CSRF, derived from the auth session cookie itself rather than a
    // separate native PHP session. A native session needs its own cookie
    // to round-trip correctly (right domain/path/SameSite, no proxy or
    // multi-pool weirdness) — if it doesn't, forms fail with a false
    // "session expired" even though the person is very much still logged
    // in. Deriving the token from the auth cookie they already have
    // sidesteps that: no second cookie to go wrong, and it's just as
    // unforgeable since the session token itself is a 32-byte secret an
    // attacker can't read (httponly) or guess.
    // Only meaningful once someone is logged in — pages reachable while
    // logged out (e.g. the first step of registration) should keep using
    // the ordinary csrf_field()/csrf_verify() from functions.php instead.
    // ------------------------------------------------------------------
    public static function csrfToken(): string
    {
        $token = $_COOKIE[COOKIE_NAME] ?? '';
        return $token === '' ? '' : hash_hmac('sha256', 'account-csrf', $token);
    }

    public static function csrfVerify(?string $submitted): bool
    {
        $expected = self::csrfToken();
        return $expected !== '' && $submitted !== null && hash_equals($expected, $submitted);
    }

    // ------------------------------------------------------------------
    // Login brute-force throttling (login_attempts table)
    // ------------------------------------------------------------------

    /** True if this email has hit LOGIN_MAX_ATTEMPTS failures within LOGIN_THROTTLE_WINDOW. */
    public static function isLoginThrottled(string $email): bool
    {
        $email = strtolower(trim($email));
        if ($email === '') return false;
        $since = date('Y-m-d H:i:s', time() - LOGIN_THROTTLE_WINDOW);
        $s = self::db()->prepare('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND created_at > ?');
        $s->execute([$email, $since]);
        return (int) $s->fetchColumn() >= LOGIN_MAX_ATTEMPTS;
    }

    public static function registerFailedLogin(string $email): void
    {
        $email = strtolower(trim($email));
        if ($email === '') return;
        self::db()->prepare('INSERT INTO login_attempts (email, ip, created_at) VALUES (?, ?, NOW())')
            ->execute([$email, substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45)]);
        // Opportunistic cleanup — no separate cron needed for a table this small.
        self::db()->prepare('DELETE FROM login_attempts WHERE created_at < ?')
            ->execute([date('Y-m-d H:i:s', time() - LOGIN_THROTTLE_WINDOW)]);
    }

    public static function clearFailedLogins(string $email): void
    {
        $email = strtolower(trim($email));
        if ($email === '') return;
        self::db()->prepare('DELETE FROM login_attempts WHERE email = ?')->execute([$email]);
    }

    // ------------------------------------------------------------------
    // Roles
    // ------------------------------------------------------------------
    public static function isSuperAdmin(?array $user): bool { return $user && !empty($user['is_super_admin']); }
    public static function isPortalStaff(?array $user): bool { return $user && (!empty($user['is_portal_staff']) || self::isSuperAdmin($user)); }
    public static function isXyphrosStaff(?array $user): bool { return $user && (!empty($user['is_xyphros_staff']) || self::isSuperAdmin($user)); }

    // ------------------------------------------------------------------
    // One-time codes (email 2FA, registration, password reset, email change)
    // ------------------------------------------------------------------
    public static function generateCode(string $userId, string $purpose, ?string $payload = null, int $ttlSeconds = 600): string
    {
        // Only one active code per (user, purpose) at a time.
        self::db()->prepare('DELETE FROM auth_codes WHERE user_id = ? AND purpose = ?')->execute([$userId, $purpose]);

        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        self::db()->prepare(
            'INSERT INTO auth_codes (id, user_id, purpose, code_hash, payload, expires_at) VALUES (?,?,?,?,?,?)'
        )->execute([
            self::uuid(), $userId, $purpose, hash('sha256', $code), $payload,
            date('Y-m-d H:i:s', time() + $ttlSeconds),
        ]);
        return $code;
    }

    /**
     * Returns the stored payload (string, possibly empty) on success, or false on failure.
     * Deletes the code once used, and rate-limits to 5 attempts per code.
     */
    public static function verifyCode(string $userId, string $purpose, string $entered): string|false
    {
        $s = self::db()->prepare('SELECT * FROM auth_codes WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
        $s->execute([$userId, $purpose]);
        $row = $s->fetch();
        if (!$row) return false;

        if (strtotime($row['expires_at']) < time()) {
            self::db()->prepare('DELETE FROM auth_codes WHERE id = ?')->execute([$row['id']]);
            return false;
        }
        if ($row['attempts'] >= 5) {
            self::db()->prepare('DELETE FROM auth_codes WHERE id = ?')->execute([$row['id']]);
            return false;
        }
        if (!hash_equals($row['code_hash'], hash('sha256', $entered))) {
            self::db()->prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]);
            return false;
        }

        self::db()->prepare('DELETE FROM auth_codes WHERE id = ?')->execute([$row['id']]);
        return (string)($row['payload'] ?? '');
    }

    // ------------------------------------------------------------------
    // TOTP (authenticator app) — RFC 6238, no external dependency
    // ------------------------------------------------------------------
    public static function generateTotpSecret(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 alphabet
        $secret = '';
        for ($i = 0; $i < 32; $i++) $secret .= $chars[random_int(0, 31)];
        return $secret;
    }

    public static function totpProvisioningUri(string $secret, string $accountLabel, string $issuer = 'Xyphros'): string
    {
        $label = rawurlencode($issuer . ':' . $accountLabel);
        return 'otpauth://totp/' . $label
            . '?secret=' . $secret
            . '&issuer=' . rawurlencode($issuer)
            . '&algorithm=SHA1&digits=6&period=30';
    }

    private static function base32Decode(string $b32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $b32 = strtoupper(rtrim($b32, '='));
        $bits = '';
        foreach (str_split($b32) as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) continue;
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $bytes = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) $bytes .= chr(bindec($byte));
        }
        return $bytes;
    }

    private static function totpAt(string $secret, int $timeSlice): string
    {
        $key = self::base32Decode($secret);
        $time = pack('N*', 0) . pack('N*', $timeSlice);
        $hash = hash_hmac('sha1', $time, $key, true);
        $offset = ord($hash[19]) & 0xf;
        $truncated = (
            ((ord($hash[$offset])     & 0x7f) << 24) |
            ((ord($hash[$offset + 1]) & 0xff) << 16) |
            ((ord($hash[$offset + 2]) & 0xff) << 8)  |
             (ord($hash[$offset + 3]) & 0xff)
        );
        return str_pad((string)($truncated % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /** Accepts a code from the current or adjacent 30s window (clock drift tolerance). */
    public static function verifyTotp(string $secret, string $code): bool
    {
        $code = preg_replace('/\D/', '', $code);
        if (strlen($code) !== 6) return false;
        $slice = (int)floor(time() / 30);
        for ($i = -1; $i <= 1; $i++) {
            if (hash_equals(self::totpAt($secret, $slice + $i), $code)) return true;
        }
        return false;
    }
}
