<?php
/**
 * License — generation side of the shared license-key system for
 * Portal workspace-limit boosts. Stored in the `license_keys`
 * collection in the shared `collections` table.
 *
 * DELIBERATELY unprefixed (unlike Content, which prefixes everything
 * "xyphros_") so XyphrosPortal's own License.php (via its native DB
 * layer, also unprefixed) reads/writes the exact same rows. This class
 * is copied identically into xyphros-site and staff-xyphros, same
 * convention as XyphrosAuth.
 *
 * Tiers and the Tebex package -> tier mapping are BOTH hardcoded here on
 * purpose — no self-service staff UI for either. Add/change tiers via
 * tiers() below; map a new package via TEBEX_LICENSE_PACKAGES in
 * config.php.
 */
class License
{
    /**
     * [tier_key => ['label'=>, 'delta'=>, 'unlimited'=>, 'redeem_url'=>, 'redeem_product'=>]].
     * Hardcoded — add a new tier here and redeploy if you need one that
     * doesn't exist yet. redeem_url/redeem_product are generic so any
     * email or admin UI that mentions "redeem this in X" stays correct
     * without special-casing a product name — this is what let
     * XyphrosEditor's 'editor_pro' tier slot in here without touching
     * XyphrosPortal's own tiers() (which deliberately does NOT know about
     * 'editor_pro' — see its own file's docstring for why).
     */
    public static function tiers(): array
    {
        return [
            'ws5'       => ['label' => '+5 Workspaces',        'delta' => 5,  'unlimited' => false, 'redeem_url' => 'https://portal.xyphros.net/redeem', 'redeem_product' => 'XyphrosPortal'],
            'ws10'      => ['label' => '+10 Workspaces',       'delta' => 10, 'unlimited' => false, 'redeem_url' => 'https://portal.xyphros.net/redeem', 'redeem_product' => 'XyphrosPortal'],
            'unlimited' => ['label' => 'Unlimited Workspaces', 'delta' => 0,  'unlimited' => true,  'redeem_url' => 'https://portal.xyphros.net/redeem', 'redeem_product' => 'XyphrosPortal'],
            'editor_pro'=> ['label' => 'XyphrosEditor Pro',     'delta' => 0,  'unlimited' => false, 'redeem_url' => 'https://editor.xyphros.net/license.php', 'redeem_product' => 'XyphrosEditor'],
        ];
    }

    /** Tebex package_id -> tier_key, or null if this package doesn't issue a license. Hardcoded in config.php. */
    public static function tierForPackage(int $packageId): ?string
    {
        return TEBEX_LICENSE_PACKAGES[$packageId] ?? null;
    }

    public static function all(): array
    {
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT data FROM collections WHERE collection = 'license_keys' ORDER BY created_at DESC"
        );
        $stmt->execute();
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (is_array($rec)) $out[] = $rec;
        }
        return $out;
    }

    public static function findByKey(string $key): ?array
    {
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT data FROM collections WHERE collection = 'license_keys' AND ref_a = ? LIMIT 1"
        );
        $stmt->execute([strtoupper(trim($key))]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $rec = json_decode($row['data'], true);
        return is_array($rec) ? $rec : null;
    }

    /** The license key generated for a specific purchase, if any — used by account.php's order history. */
    public static function findByBasketIdent(string $basketIdent): ?array
    {
        if (!$basketIdent) return null;
        foreach (self::all() as $rec) {
            if (($rec['basket_ident'] ?? null) === $basketIdent) return $rec;
        }
        return null;
    }

    /** Same, but by order ID — for staff support/recovery when someone's lost their key. */
    public static function findByOrderId(string $orderId): ?array
    {
        if (!$orderId) return null;
        foreach (self::all() as $rec) {
            if (($rec['order_id'] ?? null) === $orderId) return $rec;
        }
        return null;
    }

    /**
     * Generates $qty new unredeemed keys for the given tier. $meta is
     * merged into every record (e.g. source, package_id, basket_ident,
     * purchased_by_user_id) so the staff dashboard can show provenance.
     * Returns the array of generated key strings.
     */
    public static function generate(string $tier, int $qty, array $meta = []): array
    {
        if (!isset(self::tiers()[$tier])) {
            throw new InvalidArgumentException("Unknown license tier: {$tier}");
        }

        $keys = [];
        $db = XyphrosAuth::db();
        $stmt = $db->prepare(
            'INSERT INTO collections (row_id, collection, ref_a, ref_b, data, created_at) VALUES (?,?,?,?,?,?)'
        );

        for ($i = 0; $i < $qty; $i++) {
            $key = self::randomKey();
            $id = XyphrosAuth::uuid();
            $record = array_merge([
                'email_sent' => false,
            ], $meta, [
                'id' => $id,
                'key' => $key,
                'tier' => $tier,
                'redeemed' => false,
                'redeemed_by_user_id' => null,
                'redeemed_at' => null,
                'created_at' => date('c'),
            ]);
            // ref_a = key (indexed lookup), ref_b = purchased_by_user_id if set
            $stmt->execute([
                $id,
                'license_keys',
                $key,
                $meta['purchased_by_user_id'] ?? null,
                json_encode($record, JSON_UNESCAPED_UNICODE),
                date('Y-m-d H:i:s'),
            ]);
            $keys[] = $key;
        }

        return $keys;
    }

    /** All unemailed keys generated from a purchase (source=purchase), for the deferred email sender. */
    public static function pendingPurchaseEmails(int $limit = 20): array
    {
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT data FROM collections WHERE collection = 'license_keys' ORDER BY created_at ASC"
        );
        $stmt->execute();
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (!is_array($rec)) continue;
            if (($rec['source'] ?? '') !== 'purchase') continue;
            if (!empty($rec['email_sent'])) continue;
            $out[] = $rec;
            if (count($out) >= $limit) break;
        }
        return $out;
    }

    public static function markEmailSent(string $id): void
    {
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT data FROM collections WHERE collection = 'license_keys' AND row_id = ? LIMIT 1"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return;
        $rec = json_decode($row['data'], true);
        if (!is_array($rec)) return;
        $rec['email_sent'] = true;

        XyphrosAuth::db()->prepare(
            "UPDATE collections SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE collection = 'license_keys' AND row_id = ?"
        )->execute([json_encode($rec, JSON_UNESCAPED_UNICODE), $id]);
    }

    public static function delete(string $id): bool
    {
        $stmt = XyphrosAuth::db()->prepare(
            "DELETE FROM collections WHERE collection = 'license_keys' AND row_id = ?"
        );
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    private static function randomKey(): string
    {
        $groups = [];
        for ($i = 0; $i < 4; $i++) {
            $groups[] = strtoupper(bin2hex(random_bytes(2)));
        }
        return 'XYPH-' . implode('-', $groups);
    }
}
