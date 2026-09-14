<?php
/**
 * Permissions — what a given Xyphros staff member is actually allowed to
 * touch, once they have basic access (granted separately, from
 * access.php). Basic access alone used to mean "everything" — this is
 * what lets a Founder say "this person can manage products but not see
 * messages," instead of all-or-nothing.
 *
 * Founders always have every permission, unconditionally — this only
 * ever restricts non-Founder staff.
 */
class Permissions
{
    public const ALL = [
        'manage_posts'      => 'Manage Posts',
        'manage_products'   => 'Manage Products',
        'manage_team'       => 'Manage Team',
        'manage_docs'       => 'Manage Docs & Wiki',
        'manage_settings'   => 'Edit Page Content',
        'view_messages'     => 'View Messages (client contact form submissions)',
        'manage_support'    => 'Support Chat (reply to and close customer conversations)',
        'send_email'        => 'Send Email',
        'manage_broadcasts' => 'Manage Broadcasts',
        'manage_accounts'   => 'Manage Accounts (search, lock/unlock, reset passwords, view/revoke sessions)',
        'manage_orders'     => 'Manage Orders (view purchases, delete orders)',
        'manage_licenses'   => 'Manage License Keys (generate, view, delete)',
    ];

    private static function record(string $userId): ?array
    {
        $stmt = XyphrosAuth::db()->prepare("SELECT row_id, data FROM collections WHERE collection = 'xyphros_staff_permissions' AND ref_a = ? LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $rec = json_decode($row['data'], true);
        if (!is_array($rec)) return null;
        $rec['_row_id'] = $row['row_id'];
        return $rec;
    }

    public static function get(string $userId): array
    {
        $rec = self::record($userId);
        $perms = [];
        foreach (array_keys(self::ALL) as $key) {
            $perms[$key] = !empty($rec['permissions'][$key]);
        }
        return $perms;
    }

    public static function set(string $userId, array $perms): void
    {
        $clean = [];
        foreach (array_keys(self::ALL) as $key) {
            $clean[$key] = !empty($perms[$key]);
        }
        $existing = self::record($userId);
        $db = XyphrosAuth::db();
        if ($existing) {
            $db->prepare("UPDATE collections SET data = ? WHERE collection = 'xyphros_staff_permissions' AND row_id = ?")
                ->execute([json_encode(['user_id' => $userId, 'permissions' => $clean], JSON_UNESCAPED_UNICODE), $existing['_row_id']]);
        } else {
            $id = XyphrosAuth::uuid();
            $db->prepare("INSERT INTO collections (row_id, collection, ref_a, data, created_at) VALUES (?, 'xyphros_staff_permissions', ?, ?, ?)")
                ->execute([$id, $userId, json_encode(['user_id' => $userId, 'permissions' => $clean], JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);
        }
    }

    /** Founders can do everything; everyone else needs the specific permission. */
    public static function can(array $currentStaffUser, string $permission): bool
    {
        if (!empty($currentStaffUser['is_super_admin'])) return true;
        $perms = self::get($currentStaffUser['id']);
        return !empty($perms[$permission]);
    }
}
