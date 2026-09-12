<?php
/**
 * Staff auth gate. Every staff/*.php page starts with this. Reuses the
 * exact same account system, DB, and secrets as the public site — this
 * used to be a separate app on staff.xyphros.net with its own copy of
 * every shared class; now that it lives inside this same codebase,
 * there's exactly one copy of XyphrosAuth/Content/License/etc, and one
 * config.local.php with the real credentials in it.
 */
require_once __DIR__ . '/../../includes/functions.php';

// Must happen before any HTML output (staff-layout-head.php, required
// later by every staff page) — session_start() (inside csrf_token(),
// called by every staff form's csrf_field()) silently fails to set its
// cookie once output has started, which would make every staff form
// submission fail CSRF verification.
xs_session_start();

$currentStaffUser = XyphrosAuth::currentUser();

if (!$currentStaffUser) {
    $next = $_SERVER['REQUEST_URI'] ?? '/staff';
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . $next));
    exit;
}

$isFounder = !empty($currentStaffUser['is_super_admin']);
$isXyphrosStaff = $isFounder || !empty($currentStaffUser['is_xyphros_staff']);

if (!$isXyphrosStaff) {
    http_response_code(403);
    echo "<!doctype html><meta charset='utf-8'><title>Access denied</title>"
        . "<body style='font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center;background:#08070d;color:#f5f4f9'>"
        . "<h1>Staff access only</h1>"
        . "<p>Your Xyphros account isn't set up for staff access. Ask a Founder to grant it from Staff Access.</p>"
        . "<p><a href='/' style='color:#c026e8'>Back to xyphros.net</a></p></body>";
    exit;
}

/** Call at the top of any Founder-only page. */
function require_founder(): void
{
    global $isFounder;
    if (!$isFounder) {
        http_response_code(403);
        echo "<!doctype html><meta charset='utf-8'><title>Founder access only</title>"
            . "<body style='font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center;background:#08070d;color:#f5f4f9'>"
            . "<h1>Founder access only</h1>"
            . "<p>This section can only be used by the Founder account.</p>"
            . "<p><a href='/staff' style='color:#c026e8'>Back to dashboard</a></p></body>";
        exit;
    }
}

/** Call at the top of any content-management page (Posts, Products, etc). */
function require_permission(string $permission): void
{
    global $currentStaffUser;
    if (!Permissions::can($currentStaffUser, $permission)) {
        http_response_code(403);
        $label = e(Permissions::ALL[$permission] ?? $permission);
        echo "<!doctype html><meta charset='utf-8'><title>Access denied</title>"
            . "<body style='font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center;background:#08070d;color:#f5f4f9'>"
            . "<h1>You don't have this permission</h1>"
            . "<p>This section needs the &ldquo;{$label}&rdquo; permission. Ask a Founder to grant it from the Dashboard.</p>"
            . "<p><a href='/staff' style='color:#c026e8'>Back to dashboard</a></p></body>";
        exit;
    }
}

/**
 * Staff pages are always behind the login gate above, so the plain
 * $_SESSION-based csrf_field()/csrf_verify() pair from functions.php
 * (already used by contact.php) works fine here too — csrf_ok() is
 * just the short name every ported staff page already calls.
 */
function csrf_ok(): bool
{
    return csrf_verify($_POST['csrf_token'] ?? null);
}
