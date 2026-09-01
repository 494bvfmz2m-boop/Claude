<?php
/**
 * Real, secret configuration — copy this file to config.local.php on
 * your server (same folder) and fill in real values there.
 *
 * config.local.php is listed in .gitignore on purpose: it should never
 * be committed or uploaded anywhere public. includes/config.php reads
 * every constant defined here automatically.
 *
 * Keep this file's permissions tight on the server, e.g.:
 *   chmod 640 includes/config.local.php
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_db_name');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');

define('SMTP_HOST', 'xyphros.net');
define('SMTP_PORT', 465);
define('SMTP_USERNAME', 'no-reply@xyphros.net');
define('SMTP_PASSWORD', 'your_smtp_password');
define('SMTP_FROM_EMAIL', 'no-reply@xyphros.net');

define('CONTACT_SMTP_USERNAME', 'contact@xyphros.net');
define('CONTACT_SMTP_PASSWORD', 'your_contact_smtp_password');
define('CONTACT_FROM_EMAIL', 'contact@xyphros.net');

// Discord bot (for role granting + staff avatar fetch)
define('DISCORD_BOT_TOKEN', '');
define('DISCORD_INVITE_URL', 'https://discord.gg/your-invite');
define('DISCORD_GUILD_ID', '');

// Discord OAuth2 app (for account linking — see /discord-link)
define('DISCORD_CLIENT_ID', '');
define('DISCORD_CLIENT_SECRET', '');
// Must exactly match a redirect registered in the Discord developer portal.
define('DISCORD_OAUTH_REDIRECT_URI', 'https://xyphros.net/discord-callback');

define('DISCORD_SIGNUP_WEBHOOK_URL', '');

// Tebex
define('TEBEX_PUBLIC_TOKEN', '');
define('TEBEX_PRIVATE_KEY', '');
define('TEBEX_WEBHOOK_SECRET', '');

// send-pending-emails.php cron secret
define('CRON_SECRET', '');
