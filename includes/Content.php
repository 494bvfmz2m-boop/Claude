<?php
/**
 * Content — posts, products, team, page settings, and contact messages
 * for xyphros.net, stored in the same shared `collections` table
 * XyphrosPortal already uses (one row per record, JSON body). This is
 * what lets staff.xyphros.net manage xyphros.net's content even though
 * they're different subdomains/deployments — it's not reading files off
 * xyphros.net's disk, everything lives in the shared database instead.
 *
 * Collection names are prefixed with "xyphros_" so they can never
 * collide with Portal's own collections (workspaces, tasks, etc.) even
 * though they share one physical table.
 */
class Content
{
    private static function prefixed(string $collection): string
    {
        return 'xyphros_' . $collection;
    }

    public static function all(string $collection, string $orderBy = 'created_at', string $dir = 'ASC'): array
    {
        $dir = strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';
        $orderClause = $dir === 'DESC' ? 'created_at DESC' : 'created_at ASC';
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT row_id, data FROM collections WHERE collection = ? ORDER BY {$orderClause}"
        );
        $stmt->execute([self::prefixed($collection)]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (is_array($rec)) $out[] = $rec;
        }
        return $out;
    }

    public static function find(string $collection, string $id): ?array
    {
        $stmt = XyphrosAuth::db()->prepare('SELECT data FROM collections WHERE collection = ? AND row_id = ?');
        $stmt->execute([self::prefixed($collection), $id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $rec = json_decode($row['data'], true);
        return is_array($rec) ? $rec : null;
    }

    /** For single-document collections like page settings — the one row, or an empty array if never saved. */
    public static function singleton(string $collection, string $id = 'main'): array
    {
        return self::find($collection, $id) ?? [];
    }

    public static function insert(string $collection, array $record): string
    {
        if (empty($record['id'])) $record['id'] = self::uuid();
        if (empty($record['created_at'])) $record['created_at'] = date('c');
        $record['updated_at'] = date('c');

        XyphrosAuth::db()->prepare(
            'INSERT INTO collections (row_id, collection, data, created_at) VALUES (?,?,?,?)'
        )->execute([$record['id'], self::prefixed($collection), json_encode($record, JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);

        return $record['id'];
    }

    public static function update(string $collection, string $id, array $fields): bool
    {
        $existing = self::find($collection, $id);
        if ($existing === null) return false;
        $merged = array_merge($existing, $fields, ['id' => $id, 'updated_at' => date('c')]);

        $stmt = XyphrosAuth::db()->prepare(
            'UPDATE collections SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE collection = ? AND row_id = ?'
        );
        $stmt->execute([json_encode($merged, JSON_UNESCAPED_UNICODE), self::prefixed($collection), $id]);
        return true;
    }

    /** Set the whole document at once — used for the single-row settings collection. */
    public static function put(string $collection, array $data, string $id = 'main'): void
    {
        if (self::find($collection, $id) === null) {
            $data['id'] = $id;
            self::insert($collection, $data);
        } else {
            self::update($collection, $id, $data);
        }
    }

    public static function delete(string $collection, string $id): bool
    {
        $stmt = XyphrosAuth::db()->prepare('DELETE FROM collections WHERE collection = ? AND row_id = ?');
        $stmt->execute([self::prefixed($collection), $id]);
        return $stmt->rowCount() > 0;
    }

    public static function count(string $collection): int
    {
        $stmt = XyphrosAuth::db()->prepare('SELECT COUNT(*) FROM collections WHERE collection = ?');
        $stmt->execute([self::prefixed($collection)]);
        return (int) $stmt->fetchColumn();
    }

    private static function uuid(): string
    {
        return XyphrosAuth::uuid();
    }
}
