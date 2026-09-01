<?php
/**
 * Site configuration.
 *
 * SECURITY: this file only defines constants and reads them from
 * environment variables or from includes/config.local.php. It holds NO
 * real secrets itself and is safe to commit to version control.
 *
 * Real credentials (DB password, SMTP password, Tebex keys, Discord
 * tokens, cron secret) belong in includes/config.local.php on the
 * server — copy includes/config.local.example.php to that filename,
 * fill in real values, and keep it out of git (it's already listed in
 * .gitignore). Set its file permissions tight on the server (e.g. 640).
 */

// Load the untracked local overrides first, if present, so every
// define() below can fall back to a value that was set there.
$xsLocalConfig = __DIR__ . '/config.local.php';
if (is_file($xsLocalConfig)) {
    require $xsLocalConfig;
}

/** Read a config value: explicit local override -> environment variable -> default. */
function xs_env(string $constName, $default = '')
{
    if (defined($constName)) return constant($constName);
    $env = getenv($constName);
    return $env !== false ? $env : $default;
}

// ---- Identity -------------------------------------------------------------
define('SITE_NAME', 'Xyphros Studios');
define('SITE_TAGLINE', 'Software for people who build things together.');
define('SITE_URL', 'https://xyphros.net');
define('SITE_CONTACT_EMAIL', 'hello@xyphros.net'); // EDIT ME: real inbox to receive contact form mail

// ---- Paths ------------------------------------------------------------
define('ROOT_PATH', dirname(__DIR__));
define('DATA_DIR', ROOT_PATH . '/data');
define('UPLOADS_DIR', ROOT_PATH . '/uploads');
define('UPLOADS_URL', '/uploads');

define('POSTS_FILE', DATA_DIR . '/posts.json');
define('PRODUCTS_FILE', DATA_DIR . '/products.json');
define('MESSAGES_FILE', DATA_DIR . '/messages.json');
define('SETTINGS_FILE', DATA_DIR . '/settings.json');
define('TEAM_FILE', DATA_DIR . '/team.json');
define('SENT_EMAILS_FILE', DATA_DIR . '/sent_emails.json');

// ---- Static asset cache-busting ---------------------------------------
// Your host caches static files (css/js/images) aggressively. Every URL
// to assets/* is suffixed with ?v=ASSET_VERSION (see asset_url() in
// includes/functions.php). Bump this number any time you manually
// replace a file in assets/ over FTP so visitors' browsers are forced
// to fetch the new version instead of an old cached copy.
define('ASSET_VERSION', '46');

// ---- Staff login (shared account system) -------------------------------
// Staff no longer log in here directly. There is one login page for the
// whole company, at portal.xyphros.net/login.php. This site just reads the
// shared session cookie and checks whether that account has the
// is_xyphros_staff (or is_super_admin) flag in the shared `users` table —
// see includes/XyphrosAuth.php and staff/includes/auth.php.
//
// Same database as XyphrosPortal's config/config.php — this is what makes
// one account work on both sites.
define('DB_HOST', xs_env('DB_HOST', 'localhost'));
define('DB_NAME', xs_env('DB_NAME', 'xyphros'));
define('DB_USER', xs_env('DB_USER', 'xyphros'));
define('DB_PASS', xs_env('DB_PASS', ''));

// Cookie shared across xyphros.net and portal.xyphros.net. Must be
// byte-for-byte identical to XyphrosPortal's config/config.php.
define('COOKIE_NAME',   'xyphros_session');
define('COOKIE_DOMAIN', '.xyphros.net');

// Login, registration, forgot-password, and account management all
// live right here now — nothing account-related redirects to the
// Portal or anywhere else. See /login.php, /register.php,
// /forgot-password.php, /account.php.

// Idle timeout, in seconds, before a staff member is asked to re-check
// their session is still valid (2 hours) — this just re-queries the shared
// session table, it doesn't log anyone out early.
define('STAFF_SESSION_TIMEOUT', 7200);

// ---- Login brute-force throttling --------------------------------------
// After this many failed attempts for the same email within the window,
// further attempts are refused for the rest of the window. See
// XyphrosAuth::isLoginThrottled()/registerFailedLogin() and the
// login_attempts table in the SQL migration.
define('LOGIN_MAX_ATTEMPTS', 8);
define('LOGIN_THROTTLE_WINDOW', 15 * 60); // 15 minutes

// ---- Outgoing email (SMTP) ---------------------------------------------
// Used for 2FA codes and contact-form notifications. Keep config.local.php
// permissions tight on the server (e.g. 640) since this holds a real
// mailbox password.
define('SMTP_HOST', xs_env('SMTP_HOST', 'xyphros.net'));
define('SMTP_PORT', (int) xs_env('SMTP_PORT', 465)); // implicit TLS
define('SMTP_USERNAME', xs_env('SMTP_USERNAME', 'no-reply@xyphros.net'));
define('SMTP_PASSWORD', xs_env('SMTP_PASSWORD', ''));
define('SMTP_FROM_EMAIL', xs_env('SMTP_FROM_EMAIL', 'no-reply@xyphros.net'));
define('SMTP_FROM_NAME', SITE_NAME);

// A second mailbox used only for replying to contact-form messages from
// the staff Messages panel, so replies come from a human-looking address
// instead of no-reply@.
define('CONTACT_SMTP_USERNAME', xs_env('CONTACT_SMTP_USERNAME', 'contact@xyphros.net'));
define('CONTACT_SMTP_PASSWORD', xs_env('CONTACT_SMTP_PASSWORD', ''));
define('CONTACT_FROM_EMAIL', xs_env('CONTACT_FROM_EMAIL', 'contact@xyphros.net'));
define('CONTACT_FROM_NAME', SITE_NAME);

// ---- Discord (bot + OAuth) ----------------------------------------------
// The bot token is used only for the staff "fetch avatar from Discord"
// button. Store-purchase role granting is handled entirely by Tebex's
// own Discord integration (configured in the Tebex creator dashboard,
// not here) — see store-buy.php's required-auth redirect.
define('DISCORD_BOT_TOKEN', xs_env('DISCORD_BOT_TOKEN', ''));
define('DISCORD_INVITE_URL', xs_env('DISCORD_INVITE_URL', 'https://discord.gg/Y6rdEBwsMr'));

// OAuth2 app credentials, from a Discord application's "OAuth2" tab
// (can be the same application as the bot above, or a separate one).
// Used by /discord-link (account.php's "Connections" tab) so a customer
// can show which Discord account is theirs on their Xyphros profile —
// purely informational, not used for checkout. Redirect URI must be
// added in the Discord developer portal EXACTLY as below (including
// https://).
define('DISCORD_CLIENT_ID', xs_env('DISCORD_CLIENT_ID', ''));
define('DISCORD_CLIENT_SECRET', xs_env('DISCORD_CLIENT_SECRET', ''));
define('DISCORD_OAUTH_REDIRECT_URI', xs_env('DISCORD_OAUTH_REDIRECT_URI', SITE_URL . '/discord-callback'));

// Posts a message to this Discord channel every time someone creates a
// Xyphros account. Anyone with this URL can post to that channel, so
// treat it like a password — if it ever leaks, regenerate it from
// Discord (channel settings -> Integrations -> Webhooks) and swap in
// the new one here.
define('DISCORD_SIGNUP_WEBHOOK_URL', xs_env('DISCORD_SIGNUP_WEBHOOK_URL', ''));

// ---- Shop (Tebex) --------------------------------------------------------
// Public token: safe in front-end requests (listing categories/packages).
// Private key: server-side only — used for creating baskets (requires
// passing the customer's real IP). Get both from
// creator.tebex.io/developers/api-keys once your project exists.
// Webhook secret: filled in once /webhook-tebex is registered in the
// Tebex control panel and a secret is issued for it.
define('TEBEX_PUBLIC_TOKEN', xs_env('TEBEX_PUBLIC_TOKEN', ''));
define('TEBEX_PRIVATE_KEY', xs_env('TEBEX_PRIVATE_KEY', ''));
define('TEBEX_WEBHOOK_SECRET', xs_env('TEBEX_WEBHOOK_SECRET', ''));
define('TEBEX_API_BASE', 'https://headless.tebex.io/api');

// ---- Portal workspace-boost license keys ----------------------------------
// Maps a Tebex package ID to the license tier (see License::tiers() in
// includes/License.php) it should auto-generate a key for on purchase.
// Any package_id NOT listed here just completes normally with no license
// key generated (e.g. cosmetic/Discord-role packages).
define('TEBEX_LICENSE_PACKAGES', [
    7557311 => 'ws5',
    7557349 => 'ws10',
    7557352 => 'unlimited',
    7582198 => 'editor_pro', // XyphrosEditor Pro — redeemed at editor.xyphros.net/license.php, not Portal
]);

// ---- Deferred email sending -------------------------------------------
// send-pending-emails.php sends order-confirmation and license-key emails
// OUTSIDE the Tebex webhook request (SMTP is too slow to do inline —
// see the comment in webhook-tebex.php). Point a cron job at this URL
// every 1-2 minutes:
//   https://xyphros.net/send-pending-emails.php?key=THIS_VALUE
// Treat this like any other credential — rotate if it's ever exposed.
define('CRON_SECRET', xs_env('CRON_SECRET', ''));
