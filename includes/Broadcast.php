<?php
/**
 * Broadcast — site-wide announcement bars for every Xyphros product,
 * all managed from here. Each product reads its own collection directly
 * from the shared `collections` table (the same one Content:: and
 * Portal's DB:: class both already use), so nothing needs an API to
 * talk to this site — they just read the database.
 *
 * Portal already had its own working announcement system before this
 * existed (Announcement::class, collection "announcements") — that one
 * is left completely alone on purpose, and this uses the exact same
 * collection name and field shape so it can manage Portal's broadcasts
 * too without Portal needing to change anything.
 */
class Broadcast
{
    public const STYLES = ['info', 'success', 'warning', 'error'];

    private const COLLECTIONS = [
        'xyphros'    => 'broadcast_xyphros',
        'portal'     => 'announcements',       // Portal's own pre-existing collection name
        'subtracker' => 'broadcast_subtracker',
    ];

    public static function collectionFor(string $product): string
    {
        return self::COLLECTIONS[$product] ?? 'broadcast_' . $product;
    }

    public static function all(string $product): array
    {
        $stmt = XyphrosAuth::db()->prepare('SELECT row_id, data FROM collections WHERE collection = ? ORDER BY created_at DESC');
        $stmt->execute([self::collectionFor($product)]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (is_array($rec)) $out[] = $rec;
        }
        return $out;
    }

    public static function create(string $product, string $authorId, string $message, string $style = 'info', ?string $link = null): string
    {
        // Only one broadcast shows at a time per product — deactivate any others first.
        self::deactivateAll($product);

        $style = in_array($style, self::STYLES, true) ? $style : 'info';
        $id = XyphrosAuth::uuid();
        $record = [
            'id' => $id, 'message' => $message, 'style' => $style, 'link' => $link ?: null,
            'active' => true, 'author_id' => $authorId, 'created_at' => date('c'),
        ];
        XyphrosAuth::db()->prepare('INSERT INTO collections (row_id, collection, data, created_at) VALUES (?,?,?,?)')
            ->execute([$id, self::collectionFor($product), json_encode($record, JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);
        return $id;
    }

    public static function deactivateAll(string $product): void
    {
        foreach (self::all($product) as $b) {
            if (!empty($b['active'])) self::setActive($product, $b['id'], false);
        }
    }

    public static function setActive(string $product, string $id, bool $active): void
    {
        $collection = self::collectionFor($product);
        $stmt = XyphrosAuth::db()->prepare('SELECT data FROM collections WHERE collection = ? AND row_id = ?');
        $stmt->execute([$collection, $id]);
        $row = $stmt->fetch();
        if (!$row) return;
        $rec = json_decode($row['data'], true);
        $rec['active'] = $active;
        XyphrosAuth::db()->prepare('UPDATE collections SET data = ? WHERE collection = ? AND row_id = ?')
            ->execute([json_encode($rec, JSON_UNESCAPED_UNICODE), $collection, $id]);
    }

    public static function delete(string $product, string $id): void
    {
        XyphrosAuth::db()->prepare('DELETE FROM collections WHERE collection = ? AND row_id = ?')
            ->execute([self::collectionFor($product), $id]);
    }
}
