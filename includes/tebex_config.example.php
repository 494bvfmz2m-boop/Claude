<?php
/**
 * Tebex Headless API credentials.
 *
 * Copy this file to `tebex_config.php` (same folder) and fill in the real
 * values from your Tebex webstore — Creator Panel → your store → "API keys"
 * (or Settings → API for a Headless-type store).
 *
 * `tebex_config.php` is listed in .gitignore on purpose: these are live
 * secrets and should never be committed to source control. Upload it
 * directly to your host instead (FTP/file manager), next to this example
 * file.
 *
 * PUBLIC_TOKEN is safe-ish to expose (it's the same identifier a Tebex-hosted
 * webstore URL already contains), but PRIVATE_KEY must never be sent to the
 * browser or logged anywhere — every request that uses it happens
 * server-side in includes/tebex.php.
 */

define('TEBEX_PUBLIC_TOKEN', '');
define('TEBEX_PRIVATE_KEY', '');

// Optional: only needed if you wire up Tebex webhooks (Creator Panel →
// your store → Webhooks) to api/tebex_webhook.php, so payment-complete
// events can be checked before being trusted. Leave blank to skip
// verification (the endpoint still works, just without that extra check).
define('TEBEX_WEBHOOK_SECRET', '');
