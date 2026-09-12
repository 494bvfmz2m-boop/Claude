<?php
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/totp.php';
require_once __DIR__ . '/rate_limit.php';

function e($str) {
    return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
}

/** True unless an admin has explicitly turned the store off (missing key = on, for sites set up before this existed). */
function store_is_enabled($settings) {
    return !array_key_exists('store_enabled', $settings) || !empty($settings['store_enabled']);
}

function redirect($url) {
    header('Location: ' . $url);
    exit;
}

function csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field() {
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function verify_csrf() {
    $sent = $_POST['csrf_token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $sent)) {
        http_response_code(403);
        die('Security check failed. Please go back and try again.');
    }
}

/** Roles helpers **/
function hydrate_role_row($row) {
    if (!$row) return null;
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'color' => $row['color'],
        'color2' => $row['color2'],
        'protected' => (bool)$row['protected'],
        'staff' => (bool)$row['staff'],
        'weight' => (int)$row['weight'],
        'permissions' => [
            'manage_posts' => (bool)$row['perm_manage_posts'],
            'manage_users' => (bool)$row['perm_manage_users'],
            'manage_roles' => (bool)$row['perm_manage_roles'],
            'manage_settings' => (bool)$row['perm_manage_settings'],
            'manage_tickets' => (bool)$row['perm_manage_tickets'],
            'manage_store' => (bool)$row['perm_manage_store'],
        ],
    ];
}

function get_roles() {
    $rows = db_query("SELECT * FROM roles ORDER BY weight DESC, name ASC");
    return array_map('hydrate_role_row', $rows);
}

function get_role($roleId) {
    if (!$roleId) return null;
    return hydrate_role_row(db_query_one("SELECT * FROM roles WHERE id = ?", [$roleId]));
}

/** Users / auth helpers **/
function hydrate_user_row($row) {
    if (!$row) return null;
    $roleRows = db_query("SELECT role_id FROM user_roles WHERE user_id = ?", [$row['id']]);
    return [
        'id' => (int)$row['id'],
        'email' => $row['email'],
        'username' => $row['username'],
        'password_hash' => $row['password_hash'],
        'roles' => array_map(fn($r) => $r['role_id'], $roleRows),
        'verified' => (bool)$row['verified'],
        'verify_token' => $row['verify_token'],
        'is_super_op' => !empty($row['is_super_op']),
        'staff_sort_order' => isset($row['staff_sort_order']) && $row['staff_sort_order'] !== null ? (int)$row['staff_sort_order'] : null,
        'two_factor_method' => $row['two_factor_method'] ?? null,
        'totp_secret' => $row['totp_secret'] ?? null,
        'minecraft_username' => $row['minecraft_username'] ?? null,
        'created_at' => $row['created_at'],
    ];
}

function get_users($search = null) {
    if ($search !== null && trim($search) !== '') {
        $like = '%' . trim($search) . '%';
        $rows = db_query("SELECT * FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY username ASC", [$like, $like]);
    } else {
        $rows = db_query("SELECT * FROM users ORDER BY id ASC");
    }
    return array_map('hydrate_user_row', $rows);
}

function find_user_by_email($email) {
    // utf8mb4_unicode_ci collation makes this comparison case-insensitive already.
    return hydrate_user_row(db_query_one("SELECT * FROM users WHERE email = ?", [$email]));
}

function find_user_by_username($username) {
    return hydrate_user_row(db_query_one("SELECT * FROM users WHERE username = ?", [$username]));
}

function find_user_by_id($id) {
    if (!$id) return null;
    return hydrate_user_row(db_query_one("SELECT * FROM users WHERE id = ?", [(int)$id]));
}

/**
 * Validates a username for format + uniqueness. Pass $excludeUserId when
 * checking a rename so the account isn't flagged as clashing with itself.
 * Returns an error string, or null if the username is valid.
 */
function validate_username($username, $excludeUserId = null) {
    $username = trim($username);
    if (strlen($username) < 3 || strlen($username) > 24 || !preg_match('/^[A-Za-z0-9_]+$/', $username)) {
        return 'Usernames must be 3-24 characters: letters, numbers, and underscores only.';
    }
    if ($excludeUserId !== null) {
        $existing = db_query_one("SELECT id FROM users WHERE username = ? AND id != ?", [$username, (int)$excludeUserId]);
    } else {
        $existing = db_query_one("SELECT id FROM users WHERE username = ?", [$username]);
    }
    if ($existing) {
        return 'That username is already taken.';
    }
    return null;
}

function current_user() {
    if (empty($_SESSION['user_id'])) return null;
    static $cached = null;
    if ($cached && $cached['id'] === $_SESSION['user_id']) return $cached;
    $cached = find_user_by_id($_SESSION['user_id']);
    return $cached;
}

function is_logged_in() {
    return current_user() !== null;
}

/**
 * True if this account is a "super op" — either flagged in the database
 * (users.is_super_op) or listed by email in SUPER_OP_EMAILS in config.php.
 * Super ops always pass every permission check, always outrank every role,
 * and can assign/remove protected roles freely — regardless of what roles
 * are actually assigned to them.
 */
function is_super_op($user) {
    if (!$user) return false;
    if (!empty($user['is_super_op'])) return true;
    if (empty($user['email'])) return false;
    foreach (SUPER_OP_EMAILS as $superEmail) {
        if (strcasecmp($user['email'], $superEmail) === 0) return true;
    }
    return false;
}

/** Returns true if the given user (array) holds a permission via any of their roles. */
function user_has_permission($user, $permission) {
    if (!$user) return false;
    if (is_super_op($user)) return true;
    foreach ($user['roles'] ?? [] as $roleId) {
        $role = get_role($roleId);
        if ($role && !empty($role['permissions'][$permission])) return true;
    }
    return false;
}

/** True if the user holds any permission at all — used to show/hide the "Staff Panel" nav link. */
function user_has_any_admin_permission($user) {
    foreach (['manage_posts', 'manage_users', 'manage_roles', 'manage_settings', 'manage_tickets', 'manage_store'] as $perm) {
        if (user_has_permission($user, $perm)) return true;
    }
    return false;
}

function require_login() {
    if (!is_logged_in()) {
        redirect(SITE_URL . '/login');
    }
}

function require_permission($permission) {
    require_login();
    if (!user_has_permission(current_user(), $permission)) {
        http_response_code(403);
        die('You do not have permission to view this page.');
    }
}

function user_holds_protected_role($user) {
    if (is_super_op($user)) return true;
    foreach ($user['roles'] ?? [] as $roleId) {
        $role = get_role($roleId);
        if ($role && !empty($role['protected'])) return true;
    }
    return false;
}

function role_color_or_default($role) {
    return $role['color'] ?? '#f4b342';
}

/** Convert a #rrggbb hex color to an rgba() string for use in inline styles. */
function hex_to_rgba($hex, $alpha = 1) {
    $hex = ltrim((string)$hex, '#');
    if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
        return "rgba(244,179,66,$alpha)"; // fallback to gold
    }
    [$r, $g, $b] = sscanf($hex, "%02x%02x%02x");
    return "rgba($r,$g,$b,$alpha)";
}

/**
 * Inline CSS (ready for style="...") for a role's badge/pill. Solid-color
 * roles get the usual tinted-background pill; roles with a color2 set get a
 * real 2-color gradient background instead.
 */
function role_pill_style($role) {
    if (!$role) return '';
    $color = role_color_or_default($role);
    $color2 = $role['color2'] ?? null;
    if (!empty($color2)) {
        return 'background: linear-gradient(135deg, ' . e($color) . ', ' . e($color2) . '); color: var(--void); border-color: ' . hex_to_rgba($color2, 0.6) . ';';
    }
    return 'color:' . e($color) . '; background:' . hex_to_rgba($color, 0.16) . '; border-color:' . hex_to_rgba($color, 0.45) . ';';
}

/**
 * Renders "[Role] Username" for showing who posted something. Looks up the
 * user's CURRENT role live, falling back to the stored name if the account
 * no longer exists.
 */
function author_badge_html($authorId, $fallbackName) {
    $user = $authorId ? find_user_by_id($authorId) : null;
    $name = $user ? $user['username'] : $fallbackName;
    $role = $user ? primary_role_for_user($user) : null;

    $html = '<span class="author-tag">';
    if ($role) {
        $html .= '<span class="role-pill" style="' . role_pill_style($role) . '">' . e($role['name']) . '</span>';
    }
    $html .= '<span class="author-name">' . e($name) . '</span>';
    $html .= '</span>';
    return $html;
}

/** Highest-priority role for badge display (protected role wins, else first role). */
function primary_role_for_user($user) {
    $roles = [];
    foreach ($user['roles'] ?? [] as $roleId) {
        $r = get_role($roleId);
        if ($r) $roles[] = $r;
    }
    if (empty($roles)) return null;
    foreach ($roles as $r) {
        if (!empty($r['protected'])) return $r;
    }
    return $roles[0];
}

/** All roles a user holds that are flagged for the public Staff page. */
function staff_roles_for_user($user) {
    $result = [];
    foreach ($user['roles'] ?? [] as $roleId) {
        $r = get_role($roleId);
        if ($r && !empty($r['staff'])) $result[] = $r;
    }
    return $result;
}

/** The user's highest-weight staff role (used to place them on the Staff page), or null. */
function highest_staff_role_for_user($user) {
    $roles = staff_roles_for_user($user);
    if (empty($roles)) return null;
    usort($roles, fn($a, $b) => ($b['weight'] ?? 0) <=> ($a['weight'] ?? 0));
    return $roles[0];
}

/**
 * Builds the ordered public Staff list: ['user' => ..., 'role' => role-or-null][].
 * Eligible: anyone holding a staff-flagged role, plus every super op (even
 * with zero roles). Anyone with a manually-set staff_sort_order (dragged on
 * Admin -> Staff Order) is placed first by that number; everyone else falls
 * back to weight (highest first), then alphabetically.
 */
function get_staff_list() {
    $ordered = [];
    $unordered = [];

    foreach (get_users() as $u) {
        $role = highest_staff_role_for_user($u);
        if (!$role && !is_super_op($u)) continue;

        $entry = ['user' => $u, 'role' => $role];
        if ($u['staff_sort_order'] !== null) {
            $ordered[] = $entry;
        } else {
            $unordered[] = $entry;
        }
    }

    usort($ordered, fn($a, $b) => $a['user']['staff_sort_order'] <=> $b['user']['staff_sort_order']);
    usort($unordered, function ($a, $b) {
        $weightA = $a['role']['weight'] ?? -1;
        $weightB = $b['role']['weight'] ?? -1;
        $weightDiff = $weightB <=> $weightA;
        if ($weightDiff !== 0) return $weightDiff;
        return strcasecmp($a['user']['username'], $b['user']['username']);
    });

    return array_merge($ordered, $unordered);
}

/**
 * Highest weight among ALL roles a user holds. Used for the hierarchy check:
 * an admin can only add/remove/delete/edit roles at or below their own max
 * weight, even with the raw manage_roles/manage_users permission. A super
 * op always returns PHP_INT_MAX regardless of assigned roles.
 */
function user_max_weight($user) {
    if (is_super_op($user)) return PHP_INT_MAX;
    $max = 0;
    foreach ($user['roles'] ?? [] as $roleId) {
        $r = get_role($roleId);
        if ($r) $max = max($max, (int)($r['weight'] ?? 0));
    }
    return $max;
}

/** True if $actor is not allowed to touch (grant/remove/edit/delete) this role, by weight. */
function role_outranks_user($role, $actorUser) {
    if (!$role) return false;
    return (int)($role['weight'] ?? 0) > user_max_weight($actorUser);
}

/** Posts / announcements **/
function get_posts() {
    return db_query("SELECT * FROM posts ORDER BY created_at DESC");
}

function find_post_by_id($id) {
    return db_query_one("SELECT * FROM posts WHERE id = ?", [(int)$id]);
}

/** Support tickets **/
function get_tickets($status = null) {
    if ($status !== null) {
        return db_query("SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC", [$status]);
    }
    return db_query("SELECT * FROM tickets ORDER BY created_at DESC");
}

function find_ticket_by_id($id) {
    return db_query_one("SELECT * FROM tickets WHERE id = ?", [(int)$id]);
}

function count_open_tickets() {
    $row = db_query_one("SELECT COUNT(*) AS c FROM tickets WHERE status = 'open'");
    return $row ? (int)$row['c'] : 0;
}

function generate_ticket_token() {
    return bin2hex(random_bytes(24));
}

/** Best email address to notify about activity on this ticket, or null. */
function ticket_contact_email($ticket) {
    if (!empty($ticket['guest_email'])) return $ticket['guest_email'];
    if (!empty($ticket['user_id'])) {
        $u = find_user_by_id($ticket['user_id']);
        return $u ? $u['email'] : null;
    }
    return null;
}

function get_ticket_replies($ticketId) {
    return db_query("SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC", [(int)$ticketId]);
}

function add_ticket_reply($ticketId, $authorId, $authorName, $message, $isStaff) {
    db_execute(
        "INSERT INTO ticket_replies (ticket_id, author_id, author_name, is_staff, message) VALUES (?, ?, ?, ?, ?)",
        [(int)$ticketId, $authorId, $authorName, $isStaff ? 1 : 0, $message]
    );
}

/** Truncate plain text to $length chars, breaking on a word boundary. No mbstring dependency. */
function truncate_text($text, $length = 180) {
    $text = trim(preg_replace('/\s+/', ' ', strip_tags($text)));
    if (strlen($text) <= $length) return $text;
    $cut = substr($text, 0, $length);
    $lastSpace = strrpos($cut, ' ');
    if ($lastSpace !== false) $cut = substr($cut, 0, $lastSpace);
    return $cut . '…';
}

function time_ago($timestamp) {
    $diff = time() - strtotime($timestamp);
    if ($diff < 60) return 'just now';
    if ($diff < 3600) return floor($diff / 60) . 'm ago';
    if ($diff < 86400) return floor($diff / 3600) . 'h ago';
    if ($diff < 2592000) return floor($diff / 86400) . 'd ago';
    return date('M j, Y', strtotime($timestamp));
}
