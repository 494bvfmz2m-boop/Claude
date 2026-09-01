<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/XyphrosAuth.php';
require_once __DIR__ . '/Content.php';
require_once __DIR__ . '/Tebex.php';
require_once __DIR__ . '/License.php';
require_once __DIR__ . '/Discord.php';

/** Build a static asset URL with a cache-busting version query string. */
function asset_url(string $path): string
{
    return $path . '?v=' . ASSET_VERSION;
}

/**
 * Send headers that discourage host-level / CDN page caching of dynamic
 * pages. Call this before any HTML output. Static assets (css/js/img)
 * are unaffected — those are cached normally and busted via asset_url().
 */
function no_cache_headers(): void
{
    if (headers_sent()) {
        return;
    }
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

/** Default site content, used until the staff Settings page overrides a field. */
function settings_defaults(): array
{
    return [
        'tagline' => SITE_TAGLINE,
        'hero_headline' => 'Software for people who build things together.',
        'hero_subtext' => 'Xyphros Studios is an independent studio building small, focused tools for teams and communities — starting with XyphrosPortal, a shared home for tasks, to-dos, and notes.',
        'about_intro_heading' => 'We build the tools we wish existed.',
        'about_intro_text' => "Xyphros Studios is a small, independent studio. We'd rather ship one tool that people genuinely rely on than ten that nobody finishes setting up.",
        'why_heading' => 'Less noise, more done',
        'why_text' => "Most workspace tools try to do everything and end up doing nothing well. We started Xyphros Studios to build the opposite: small, focused products with a clear job and no clutter around it.\n\nXyphrosPortal is the first product to come out of that approach — a shared workspace for tasks, to-do lists, and notes that's simple enough to actually keep using.",
        'how_heading' => 'Built in-house, kept simple',
        'how_text' => "Everything we ship is designed, built, and maintained by our own team. That keeps things slower in some ways, but it means every product gets the same care and the same standards.",
        'contact_email' => SITE_CONTACT_EMAIL,
        'product_support_heading' => 'Product support',
        'product_support_text' => 'For XyphrosPortal account issues, sign in and use in-app support.',
    ];
}

/** Load site content settings, filling in any missing fields with defaults. */
function get_settings(): array
{
    return array_merge(settings_defaults(), Content::singleton('settings'));
}

/** Load team members from the shared content database. */
function get_team(): array
{
    return Content::all('team');
}

/** Wrap the last word of a phrase in a span for gradient highlighting. */
function highlight_last_word(string $text, string $class = 'grad'): string
{
    $text = rtrim($text);
    $trailingPunct = '';
    if ($text !== '' && in_array(substr($text, -1), ['.', '!', '?'], true)) {
        $trailingPunct = substr($text, -1);
        $text = substr($text, 0, -1);
    }
    $lastSpace = strrpos($text, ' ');
    if ($lastSpace === false) {
        return e($text) . e($trailingPunct);
    }
    $head = substr($text, 0, $lastSpace);
    $lastWord = substr($text, $lastSpace + 1);
    return e($head) . ' <span class="' . e($class) . '">' . e($lastWord) . '</span>' . e($trailingPunct);
}

/**
 * Start a session with sane, hardened cookie defaults. Safe to call
 * multiple times; only acts the first time per request.
 */
function xs_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Character count that works whether or not the mbstring extension is installed. */
function str_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

/** Uppercase that works whether or not the mbstring extension is installed. */
function str_upper(string $value): string
{
    return function_exists('mb_strtoupper') ? mb_strtoupper($value) : strtoupper($value);
}

/** Substring that works whether or not the mbstring extension is installed. */
function str_sub(string $value, int $start, ?int $length = null): string
{
    return function_exists('mb_substr') ? mb_substr($value, $start, $length) : substr($value, $start, $length ?? PHP_INT_MAX);
}

/** Render multi-paragraph plain text (blank line = new paragraph) as safe HTML. */
function render_paragraphs(string $text): string
{
    return render_post_body($text);
}

/** Escape a string for safe HTML output. */
function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

/** Read a JSON data file, returning an array (empty array if missing/broken). */
function load_json(string $path): array
{
    if (!file_exists($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Write an array back to a JSON data file (pretty-printed, atomic-ish). */
function save_json(string $path, array $data): bool
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    return file_put_contents($path, $json, LOCK_EX) !== false;
}

/**
 * CSRF for pages reachable while logged out (login, register,
 * forgot-password) — where there's no Xyphros auth session yet to derive
 * a token from. This used to run on PHP's native session
 * ($_SESSION['csrf_token'] via xs_session_start()), but that's proven
 * unreliable on this host (the classic symptom: real submissions
 * intermittently fail with "session expired" even though the person
 * never left the page). This avoids PHP sessions entirely — just a
 * plain, directly-set cookie and a matching hidden field, the same
 * "double submit" pattern, but with nothing server-side that can fail
 * to persist.
 */
function xs_csrf_token(): string
{
    if (empty($_COOKIE['xs_csrf'])) {
        $token = bin2hex(random_bytes(32));
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        setcookie('xs_csrf', $token, [
            'expires'  => time() + 3600,
            'path'     => '/',
            'secure'   => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE['xs_csrf'] = $token; // usable immediately, without needing a second request
    }
    return $_COOKIE['xs_csrf'];
}

function xs_csrf_field(): void
{
    echo '<input type="hidden" name="csrf_token" value="' . e(xs_csrf_token()) . '">';
}

function xs_csrf_verify(?string $submitted): bool
{
    $cookie = $_COOKIE['xs_csrf'] ?? '';
    return $cookie !== '' && $submitted !== null && hash_equals($cookie, $submitted);
}

/**
 * Short-lived state value for the Discord OAuth round trip
 * (/discord-link -> Discord -> /discord-callback), stored the same
 * "double submit" way as xs_csrf_token(): a plain httponly cookie the
 * callback compares the returned ?state= against. Prevents someone
 * from tricking a logged-in visitor into linking the attacker's own
 * Discord account by crafting a callback URL themselves.
 */
function xs_discord_oauth_state(): string
{
    $token = bin2hex(random_bytes(24));
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie('xs_discord_state', $token, [
        'expires'  => time() + 600,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    return $token;
}

function xs_discord_oauth_state_verify(?string $submitted): bool
{
    $cookie = $_COOKIE['xs_discord_state'] ?? '';
    return $cookie !== '' && $submitted !== null && hash_equals($cookie, $submitted);
}

/**
 * Creates the session and sends them on their way — except if the
 * account is flagged must_change_password (set by staff issuing a temp
 * password or a reset link), in which case every path into a session
 * funnels through the same mandatory "set a new password" step before
 * they reach anything else.
 */
function complete_login(array $user, string $returnTo): void
{
    XyphrosAuth::createSession($user['id']);
    if (!empty($user['must_change_password'])) {
        header('Location: /set-new-password?return_to=' . rawurlencode($returnTo));
    } else {
        header('Location: ' . $returnTo);
    }
    exit;
}

/**
 * A long, URL-safe, one-time token — same auth_codes table generateCode()
 * uses, just not limited to 6 digits (that's for something a person types
 * in; this is for something that only ever appears in a link).
 */
function generate_link_token(string $userId, string $purpose, int $ttlSeconds = 900): string
{
    XyphrosAuth::db()->prepare('DELETE FROM auth_codes WHERE user_id = ? AND purpose = ?')->execute([$userId, $purpose]);
    $token = bin2hex(random_bytes(32));
    XyphrosAuth::db()->prepare(
        'INSERT INTO auth_codes (id, user_id, purpose, code_hash, payload, expires_at) VALUES (?,?,?,?,?,?)'
    )->execute([
        XyphrosAuth::uuid(), $userId, $purpose, hash('sha256', $token), null,
        date('Y-m-d H:i:s', time() + $ttlSeconds),
    ]);
    return $token;
}

/** Generate (or reuse) a CSRF token for the current session. */
function csrf_token(): string
{
    xs_session_start();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/** Echo a hidden CSRF input field, ready to drop inside a <form>. */
function csrf_field(): void
{
    echo '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

/** Verify a submitted CSRF token against the session's token. */
function csrf_verify(?string $submitted): bool
{
    xs_session_start();
    if (empty($_SESSION['csrf_token']) || empty($submitted)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $submitted);
}

/** Turn a title into a URL-safe slug, e.g. "Hello, World!" -> "hello-world". */
function slugify(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');
    return $text !== '' ? $text : 'post-' . substr(md5((string) microtime(true)), 0, 8);
}

/** Ensure a slug is unique among existing items (by 'slug' key), appending -2, -3, etc. */
function unique_slug(string $base, array $items, ?string $ignoreId = null): string
{
    $slug = $base;
    $i = 2;
    while (true) {
        $clash = false;
        foreach ($items as $item) {
            if (($item['id'] ?? null) === $ignoreId) {
                continue;
            }
            if (($item['slug'] ?? null) === $slug) {
                $clash = true;
                break;
            }
        }
        if (!$clash) {
            return $slug;
        }
        $slug = $base . '-' . $i;
        $i++;
    }
}

/** Friendly date formatting, e.g. "17 Jun 2026". */
/** The current live site-wide broadcast, or null. Managed from staff.xyphros.net. */
function get_active_broadcast(): ?array
{
    try {
        $stmt = XyphrosAuth::db()->prepare("SELECT data FROM collections WHERE collection = 'broadcast_xyphros' ORDER BY created_at DESC");
        $stmt->execute();
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (is_array($rec) && !empty($rec['active'])) return $rec;
        }
    } catch (Throwable $e) {
        // Fail silently — a broken broadcast lookup should never take the whole site down.
    }
    return null;
}

function format_date(string $isoDate): string
{
    $ts = strtotime($isoDate);
    return $ts ? date('j M Y', $ts) : $isoDate;
}

/**
 * Validate and move an uploaded image to a destination directory.
 *
 * Returns the relative (web) path on success, null if no file was
 * uploaded, or throws a RuntimeException with a user-facing message on
 * validation failure.
 */
function handle_image_upload(string $fieldName, string $destDir, string $publicUrlPrefix): ?string
{
    if (empty($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fieldName];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('There was a problem uploading that file. Please try again.');
    }

    $maxBytes = 5 * 1024 * 1024; // 5 MB
    if ($file['size'] > $maxBytes) {
        throw new RuntimeException('That image is too large. Please use a file under 5 MB.');
    }

    // Verify it's really an image (don't trust the extension or MIME header).
    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        throw new RuntimeException('That file does not look like a valid image.');
    }

    $allowed = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_GIF => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];
    if (!isset($allowed[$imageInfo[2]])) {
        throw new RuntimeException('Please upload a JPG, PNG, GIF, or WebP image.');
    }
    $ext = $allowed[$imageInfo[2]];

    if (!is_dir($destDir)) {
        mkdir($destDir, 0775, true);
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $destPath = rtrim($destDir, '/') . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new RuntimeException('Could not save the uploaded image.');
    }

    return rtrim($publicUrlPrefix, '/') . '/' . $filename;
}

/**
 * Look up a Discord user's current avatar by their user ID (the numeric
 * ID, not their username — right-click their name in Discord with
 * Developer Mode on and "Copy User ID"). Returns [true, cdnUrl] on
 * success or [false, humanReadableError] on failure. Never touches the
 * team member's name — only ever used to fill in a photo.
 */
function discord_fetch_avatar_url(string $discordId): array
{
    if (empty(DISCORD_BOT_TOKEN)) {
        return [false, 'No Discord bot token is configured — see DISCORD_BOT_TOKEN in includes/config.php.'];
    }
    $discordId = trim($discordId);
    if (!preg_match('/^\d{15,25}$/', $discordId)) {
        return [false, "That doesn't look like a Discord user ID — it should be a long number (right-click their name in Discord with Developer Mode on, then \"Copy User ID\")."];
    }

    $ch = curl_init("https://discord.com/api/v10/users/{$discordId}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bot ' . DISCORD_BOT_TOKEN],
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        return [false, "Couldn't reach Discord: {$curlError}"];
    }
    $data = json_decode($body, true);
    if ($status === 401) {
        return [false, 'Discord rejected the bot token — double check DISCORD_BOT_TOKEN in config.php.'];
    }
    if ($status !== 200 || empty($data['id'])) {
        return [false, $data['message'] ?? "Discord user {$discordId} not found."];
    }
    if (empty($data['avatar'])) {
        return [false, 'That Discord account has no custom avatar set (just the default one), so there\'s nothing to pull.'];
    }

    $ext = str_starts_with($data['avatar'], 'a_') ? 'gif' : 'png';
    return [true, "https://cdn.discordapp.com/avatars/{$discordId}/{$data['avatar']}.{$ext}?size=256"];
}

/**
 * Posts a "new account" notification to Discord. Never lets a failure
 * here (Discord down, webhook deleted, network hiccup) block or break
 * the actual registration — it's purely a side effect, so failures are
 * just logged.
 */
function notify_discord_signup(string $name, string $email, string $ip): void
{
    if (empty(DISCORD_SIGNUP_WEBHOOK_URL)) {
        return;
    }

    $payload = [
        'embeds' => [[
            'title' => 'New Xyphros account',
            'color' => hexdec('6d28f9'),
            'fields' => [
                ['name' => 'Name', 'value' => $name !== '' ? $name : '—', 'inline' => true],
                ['name' => 'Email', 'value' => $email !== '' ? $email : '—', 'inline' => true],
                ['name' => 'IP', 'value' => $ip !== '' ? $ip : '—', 'inline' => true],
            ],
            'timestamp' => date('c'),
        ]],
    ];

    $ch = curl_init(DISCORD_SIGNUP_WEBHOOK_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("Discord signup notification failed: {$curlError}");
    }
}

function delete_uploaded_file(?string $publicPath): void
{
    if (!$publicPath) {
        return;
    }
    $local = ROOT_PATH . $publicPath;
    if (is_file($local)) {
        @unlink($local);
    }
}

/**
 * Render a plain-text post body as safe HTML paragraphs. Blank lines
 * start a new paragraph; single line breaks become <br>. Everything is
 * escaped first, so this is safe even though posts are authored by a
 * single trusted staff account.
 */
function render_post_body(string $body): string
{
    $body = str_replace("\r\n", "\n", $body);
    $paragraphs = preg_split('/\n\s*\n/', trim($body));
    $html = '';
    foreach ($paragraphs as $para) {
        $para = trim($para);
        if ($para === '') {
            continue;
        }
        $html .= '<p>' . nl2br(e($para)) . '</p>' . "\n";
    }
    return $html;
}

/**
 * Turns a Tebex package's (HTML) description into plain text lines,
 * one per bullet/paragraph/line-break in the source — used to render
 * store package cards as a short intro + a real feature list instead
 * of strip_tags()'d HTML mashed into one run-on, mid-sentence-truncated
 * paragraph (block tags carry no whitespace of their own once removed,
 * so "<li>A</li><li>B</li>" became "AB" instead of two lines).
 * Each returned line has any leading "-"/"•"/"*" bullet marker and
 * extra whitespace stripped, and HTML entities decoded, but is NOT
 * escaped — the caller still needs to e() it before output.
 */
function xs_store_description_lines(string $html, int $max = 4): array
{
    $withBreaks = preg_replace('/<\s*(br|\/li|\/p|\/div)[^>]*>/i', "\n", $html);
    $text = html_entity_decode(strip_tags($withBreaks ?? $html), ENT_QUOTES, 'UTF-8');

    $lines = [];
    foreach (preg_split('/\r\n|\r|\n/', $text) as $line) {
        $line = trim(preg_replace('/^[\-\*•\x{2022}]+\s*/u', '', trim($line)));
        if ($line !== '') {
            $lines[] = $line;
        }
        if (count($lines) >= $max) {
            break;
        }
    }
    return $lines;
}

/** A short label + dot color for a product status value. */
function product_status_meta(string $status): array
{
    $map = [
        'online' => ['label' => 'Online', 'class' => 'status--online'],
        'beta' => ['label' => 'Beta', 'class' => 'status--beta'],
        'coming_soon' => ['label' => 'Coming soon', 'class' => 'status--soon'],
        'maintenance' => ['label' => 'Maintenance', 'class' => 'status--maintenance'],
    ];
    return $map[$status] ?? $map['online'];
}

/**
 * Tiny inline stroke icons, so account/staff pages don't depend on an
 * icon font or external request. Usage: echo xs_icon('shield').
 */
function xs_icon(string $name, int $size = 16): string
{
    $icons = [
        'user'     => '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
        'shield'   => '<path d="M12 3l7 3v5.5c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
        'monitor'  => '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/>',
        'grid'     => '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
        'camera'   => '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1-1.6h7.8l1 1.6h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z"/><circle cx="12" cy="13" r="3.2"/>',
        'check'    => '<path d="M5 13l4.5 4.5L19 8"/>',
        'key'      => '<circle cx="8" cy="14.5" r="3.5"/><path d="M10.8 11.7L18 4.5M15 7.5l2 2M18 4.5l2 2"/>',
        'mail'     => '<rect x="3.5" y="5.5" width="17" height="13" rx="1.8"/><path d="M4.5 7l7.5 6 7.5-6"/>',
        'phone'    => '<rect x="7.5" y="3" width="9" height="18" rx="2"/><path d="M11 18h2"/>',
        'arrow'    => '<path d="M8 5l7 7-7 7"/>',
        'home'     => '<path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9h12v-9"/>',
        'doc'      => '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4"/><path d="M9 13h6M9 16.5h6"/>',
        'box'      => '<path d="M3.5 8l8.5-4.5L20.5 8v8l-8.5 4.5L3.5 16z"/><path d="M3.5 8l8.5 4.5 8.5-4.5M12 12.5V21"/>',
        'users'    => '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c1.1-3 3.3-4.6 6-4.6s4.9 1.6 6 4.6"/><circle cx="17" cy="8.5" r="2.4"/><path d="M15.5 14.7c2 .3 3.5 1.7 4.3 4.1"/>',
        'sliders'  => '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1.8" fill="var(--bg-card,#120f1c)"/><circle cx="16" cy="12" r="1.8" fill="var(--bg-card,#120f1c)"/><circle cx="10" cy="18" r="1.8" fill="var(--bg-card,#120f1c)"/>',
        'inbox'    => '<path d="M3.5 12.5h5l1.7 2.5h3.6l1.7-2.5h5"/><path d="M5 5.5h14l2 7v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-6z"/>',
        'send'     => '<path d="M3.5 11.5L20 3.8 12.3 20.5l-2.4-6.9-6.4-2.1z"/><path d="M9.9 13.6L20 3.8"/>',
        'logout'   => '<path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3"/><path d="M15 16l4.5-4-4.5-4M19.5 12h-11"/>',
        'external' => '<path d="M9 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M14 4h6v6M20 4l-9.5 9.5"/>',
    ];
    return '<svg viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:inline-block;vertical-align:middle">' . ($icons[$name] ?? '') . '</svg>';
}

/** The Discord glyph (filled, brand mark) — used on the "Link Discord" button and connection rows. */
function xs_icon_discord(int $size = 16): string
{
    return '<svg viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="currentColor" style="flex-shrink:0;display:inline-block;vertical-align:middle"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
}

/**
 * Who posted this. Looks up the author's CURRENT name/avatar from the
 * shared account (so a later name change or avatar update shows up on
 * old posts too), falling back to the name snapshotted at publish time
 * if the account was deleted or the database is unreachable.
 * Caches lookups per request since one author often has many posts.
 */
function post_author(array $post): array
{
    static $cache = [];
    $fallback = ['name' => $post['author_name'] ?? SITE_NAME, 'avatar' => null];

    $id = $post['author_id'] ?? null;
    if (!$id) return $fallback;
    if (array_key_exists($id, $cache)) return $cache[$id];

    try {
        require_once __DIR__ . '/XyphrosAuth.php';
        $u = XyphrosAuth::findById($id);
        $result = $u
            ? ['name' => $u['name'] ?: $u['username'], 'avatar' => $u['avatar'] ?? null]
            : $fallback;
    } catch (Throwable $e) {
        $result = $fallback;
    }

    return $cache[$id] = $result;
}

/**
 * The shared shell every branded transactional email uses. Deliberately
 * light rather than dark — dark HTML emails render inconsistently
 * across clients (Gmail, Outlook, Apple Mail all handle it differently)
 * — so this uses safe inline styles and a light card instead of trying
 * to force the site's dark theme into an inbox.
 */
function render_branded_email(string $heading, string $bodyHtml, ?string $code = null, ?string $ctaText = null, ?string $ctaUrl = null, string $footerNote = ''): string
{
    $logo = e(SITE_URL . '/assets/img/logo-full.png');
    $heading = e($heading);
    $footerNote = $footerNote !== '' ? e($footerNote) : "If you didn't expect this email, you can safely ignore it.";

    $codeBlock = '';
    if ($code !== null) {
        $codeBlock = '<tr><td style="padding:0 40px 28px;text-align:center;">
<div style="display:inline-block;background:#f6f1ff;border:1px solid #e3d6ff;border-radius:12px;padding:16px 32px;">
<span style="font-family:\'Courier New\',monospace;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#5b0fce;">' . e($code) . '</span>
</div></td></tr>';
    }

    $ctaBlock = '';
    if ($ctaText !== null && $ctaUrl !== null) {
        $ctaBlock = '<tr><td style="padding:0 40px 28px;text-align:center;">
<a href="' . e($ctaUrl) . '" style="display:inline-block;background:#6d28f9;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;padding:13px 32px;border-radius:10px;">' . e($ctaText) . '</a>
</td></tr>';
    }

    return <<<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#f2f0f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e5f0;">
<tr><td style="padding:32px 40px 0;text-align:center;">
<img src="{$logo}" alt="Xyphros" style="height:28px;width:auto;">
</td></tr>
<tr><td style="padding:28px 40px 8px;">
<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#161227;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{$heading}</h1>
<p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#5a5470;">{$bodyHtml}</p>
</td></tr>
{$codeBlock}
{$ctaBlock}
<tr><td style="padding:0 40px 32px;">
<p style="margin:0;font-size:12.5px;line-height:1.6;color:#9b93b0;text-align:center;">{$footerNote}</p>
</td></tr>
<tr><td style="padding:20px 40px;background:#f9f8fc;border-top:1px solid #eeebf5;text-align:center;">
<p style="margin:0;font-size:12px;color:#a8a1bb;">Xyphros Studios &middot; <a href="https://xyphros.net" style="color:#8a5cf6;text-decoration:none;">xyphros.net</a></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
HTML;
}

/** Convenience wrapper for the common "here's your code" email shape. */
function render_code_email(string $heading, string $bodyHtml, string $code, string $footerNote = ''): string
{
    return render_branded_email($heading, $bodyHtml, $code, null, null, $footerNote);
}

/** Convenience wrapper for staff-initiated account notices (password reset, account locked, etc). */
function render_notice_email(string $heading, string $bodyHtml, ?string $ctaText = null, ?string $ctaUrl = null, string $footerNote = ''): string
{
    return render_branded_email($heading, $bodyHtml, null, $ctaText, $ctaUrl, $footerNote);
}

/**
 * Branded email with a license-key display box. Reuses render_branded_email's
 * shell but with its own key block sized for a long structured key
 * (e.g. "XYPH-XXXX-XXXX-XXXX-XXXX") rather than the short numeric-code
 * block in render_branded_email/render_code_email, which is sized for
 * 6-digit OTPs and would overflow the email's 480px width with a key
 * this long.
 */
function render_license_email(string $heading, string $bodyHtml, string $key, ?string $ctaText = null, ?string $ctaUrl = null, string $footerNote = ''): string
{
    $logo = e(SITE_URL . '/assets/img/logo-full.png');
    $heading = e($heading);
    $footerNote = $footerNote !== '' ? e($footerNote) : "If you didn't expect this email, you can safely ignore it.";

    $keyBlock = '<tr><td style="padding:0 40px 28px;text-align:center;">
<div style="display:inline-block;background:#f6f1ff;border:1px solid #e3d6ff;border-radius:12px;padding:14px 20px;">
<span style="font-family:\'Courier New\',monospace;font-size:17px;font-weight:700;letter-spacing:0.06em;color:#5b0fce;word-break:break-all;">' . e($key) . '</span>
</div></td></tr>';

    $ctaBlock = '';
    if ($ctaText !== null && $ctaUrl !== null) {
        $ctaBlock = '<tr><td style="padding:0 40px 28px;text-align:center;">
<a href="' . e($ctaUrl) . '" style="display:inline-block;background:#6d28f9;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;padding:13px 32px;border-radius:10px;">' . e($ctaText) . '</a>
</td></tr>';
    }

    return <<<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#f2f0f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e5f0;">
<tr><td style="padding:32px 40px 0;text-align:center;">
<img src="{$logo}" alt="Xyphros" style="height:28px;width:auto;">
</td></tr>
<tr><td style="padding:28px 40px 8px;">
<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#161227;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{$heading}</h1>
<p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#5a5470;">{$bodyHtml}</p>
</td></tr>
{$keyBlock}
{$ctaBlock}
<tr><td style="padding:0 40px 32px;">
<p style="margin:0;font-size:12.5px;line-height:1.6;color:#9b93b0;text-align:center;">{$footerNote}</p>
</td></tr>
<tr><td style="padding:20px 40px;background:#f9f8fc;border-top:1px solid #eeebf5;text-align:center;">
<p style="margin:0;font-size:12px;color:#a8a1bb;">Xyphros Studios &middot; <a href="https://xyphros.net" style="color:#8a5cf6;text-decoration:none;">xyphros.net</a></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
HTML;
}

/**
 * Adds a package to an already-created (and, if required, already
 * Discord-authed) basket, records our own pending order, and redirects
 * to checkout. Shared by store-buy.php (packages with no requirements)
 * and store-auth-return.php (packages that needed Discord auth first).
 */
/**
 * Hands out the next sequential, human-friendly order number ("Order
 * #1042") using a tiny dedicated auto-increment table. Deliberately NOT
 * done by counting existing shop_orders rows — that has a race condition
 * under concurrent purchases and breaks once any order gets deleted
 * (numbers would repeat). A real auto-increment column, even in its own
 * one-column table, is the only race-free way to do this without
 * application-level locking.
 */
function xs_next_order_number(): int
{
    $db = XyphrosAuth::db();
    $db->exec('CREATE TABLE IF NOT EXISTS order_sequence (id INT AUTO_INCREMENT PRIMARY KEY)');
    $db->exec('INSERT INTO order_sequence () VALUES ()');
    return (int) $db->lastInsertId();
}

function xs_store_finalize_purchase(string $ident, int $packageId, array $user): void
{
    [$addOk, , $addErr] = Tebex::addPackage($ident, $packageId, 1);
    if (!$addOk) {
        error_log('Tebex add package failed: ' . ($addErr ?? 'unknown error'));
        header('Location: /store?error=' . rawurlencode("Couldn't add that item to checkout — please try again."));
        exit;
    }

    $package = Tebex::getPackage($packageId);

    // Our own record of the pending order — this is what actually ties a
    // purchase to a Xyphros account. The webhook looks this up by matching
    // the Xyphros user ID we set as custom.xyphros_user_id at basket
    // creation, which Tebex includes in the payment.completed webhook.
    Content::insert('shop_orders', [
        'order_number' => xs_next_order_number(),
        'basket_ident' => $ident,
        'xyphros_user_id' => $user['id'],
        'package_id' => $packageId,
        'package_name' => $package['name'] ?? 'Unknown item',
        'price' => $package['total_price'] ?? $package['base_price'] ?? 0,
        'currency' => $package['currency'] ?? 'USD',
        'status' => 'pending',
    ]);

    header('Location: /store-checkout?ident=' . rawurlencode($ident));
    exit;
}

