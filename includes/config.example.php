<?php
/**
 * Site configuration — EXAMPLE / TEMPLATE.
 *
 * Copy this to includes/config.php and fill in real values there.
 * includes/config.php is gitignored on purpose: it holds live database,
 * SMTP, Discord, Tebex, and cron credentials and must never be committed.
 */

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
define('ASSET_VERSION', '1');

// ---- Staff login (shared account system) -------------------------------
// This site reads a shared session cookie and checks whether that account
// has the is_xyphros_staff (or is_super_admin) flag in the shared `users`
// table — see includes/XyphrosAuth.php.
//
// Same database as XyphrosPortal's own config — this is what makes one
// account work on both sites.
define('DB_HOST', 'localhost');
define('DB_NAME', 'CHANGE_ME');
define('DB_USER', 'CHANGE_ME');
define('DB_PASS', 'CHANGE_ME');

// Cookie shared across xyphros.net and portal.xyphros.net. Must be
// byte-for-byte identical to XyphrosPortal's config.
define('COOKIE_NAME',   'xyphros_session');
define('COOKIE_DOMAIN', '.xyphros.net');

// Idle timeout, in seconds, before a staff member is asked to re-check
// their session is still valid (2 hours) — this just re-queries the shared
// session table, it doesn't log anyone out early.
define('STAFF_SESSION_TIMEOUT', 7200);

// ---- Outgoing email (SMTP) ---------------------------------------------
// Used for 2FA codes and contact-form notifications. Keep the real
// config.php's permissions tight on the server (e.g. 640) since this is a
// real mailbox password.
define('SMTP_HOST', 'CHANGE_ME');
define('SMTP_PORT', 465); // implicit TLS
define('SMTP_USERNAME', 'no-reply@example.com');
define('SMTP_PASSWORD', 'CHANGE_ME');
define('SMTP_FROM_EMAIL', 'no-reply@example.com');
define('SMTP_FROM_NAME', SITE_NAME);

// A second mailbox used only for replying to contact-form messages from
// the staff Messages panel, so replies come from a human-looking address
// instead of no-reply@.
define('CONTACT_SMTP_USERNAME', 'contact@example.com');
define('CONTACT_SMTP_PASSWORD', 'CHANGE_ME');
define('CONTACT_FROM_EMAIL', 'contact@example.com');
define('CONTACT_FROM_NAME', SITE_NAME);

// ---- Discord (optional, for pulling a team member's avatar) -----------
// Used only by the "Fetch avatar from Discord" button on the Team page
// in the staff panel — nothing else on the site touches this.
//
// To get a token: create an application at https://discord.com/developers/applications,
// add a Bot to it, and copy the bot token from the Bot tab. The bot
// doesn't need to be in any server or have any special permissions —
// looking up a user's public profile by ID works regardless.
// Leave this blank to disable the feature (the manual photo upload still
// works fine without it).
define('DISCORD_BOT_TOKEN', '');
define('DISCORD_INVITE_URL', 'https://discord.gg/CHANGE_ME');

// Posts a message to this Discord channel every time someone creates a
// Xyphros account. Anyone with this URL can post to that channel, so
// treat it like a password — if it ever leaks, regenerate it from
// Discord (channel settings -> Integrations -> Webhooks) and swap in
// the new one here.
define('DISCORD_SIGNUP_WEBHOOK_URL', '');

// ---- Shop (Tebex, work in progress) --------------------------------------
// Public token: safe in front-end requests (listing categories/packages).
// Private key: server-side only — used for creating baskets (requires
// passing the customer's real IP). Get both from
// creator.tebex.io/developers/api-keys once your project exists.
// Webhook secret: filled in once /webhook-tebex is registered in the
// Tebex control panel and a secret is issued for it.
define('TEBEX_PUBLIC_TOKEN', '');
define('TEBEX_PRIVATE_KEY', '');
define('TEBEX_WEBHOOK_SECRET', '');
define('TEBEX_API_BASE', 'https://headless.tebex.io/api');

// ---- Portal workspace-boost license keys ----------------------------------
// Maps a Tebex package ID to the license tier (see License::tiers() in
// includes/License.php) it should auto-generate a key for on purchase.
// Any package_id NOT listed here just completes normally with no license
// key generated (e.g. cosmetic/Discord-role packages).
define('TEBEX_LICENSE_PACKAGES', [
    // 7557311 => 'ws5',
]);

// ---- Deferred email sending -------------------------------------------
// send-pending-emails.php sends order-confirmation and license-key emails
// OUTSIDE the Tebex webhook request (SMTP is too slow to do inline —
// see the comment in webhook-tebex.php). Point a cron job at this URL
// every 1-2 minutes:
//   https://your-site.example/send-pending-emails.php?key=THIS_VALUE
// Treat this like any other credential — rotate if it's ever exposed.
define('CRON_SECRET', 'CHANGE_ME');
