<?php
/**
 * AuditLog — every sensitive action taken from this site gets recorded
 * here: who did it, to which account, when. Stored in the same shared
 * `collections` table as everything else (collection = "audit_log").
 *
 * This is intentionally append-only from the UI's perspective — there's
 * no edit/delete exposed anywhere. If entries ever need pruning, that's
 * a direct database job, not something exposed to staff.
 */
class AuditLog
{
    public static function log(string $actorId, string $actorName, string $action, ?string $targetId, ?string $targetLabel, string $detail = ''): void
    {
        $record = [
            'id'           => XyphrosAuth::uuid(),
            'actor_id'     => $actorId,
            'actor_name'   => $actorName,
            'action'       => $action,       // e.g. 'password_reset', 'account_locked', 'staff_granted'
            'target_id'    => $targetId,
            'target_label' => $targetLabel,  // human-readable, e.g. an email — kept even if the account is later deleted
            'detail'       => $detail,
            'ip'           => $_SERVER['REMOTE_ADDR'] ?? null,
            'created_at'   => date('c'),
        ];
        XyphrosAuth::db()->prepare(
            'INSERT INTO collections (row_id, collection, data, created_at) VALUES (?,?,?,?)'
        )->execute([$record['id'], 'audit_log', json_encode($record, JSON_UNESCAPED_UNICODE), date('Y-m-d H:i:s')]);
    }

    /** Most recent entries first, optionally filtered to one actor or one target account. */
    public static function recent(int $limit = 100, ?string $actorId = null, ?string $targetId = null): array
    {
        $stmt = XyphrosAuth::db()->prepare(
            "SELECT data FROM collections WHERE collection = 'audit_log' ORDER BY created_at DESC LIMIT " . (int) max(1, min($limit, 500))
        );
        $stmt->execute();
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $rec = json_decode($row['data'], true);
            if (!is_array($rec)) continue;
            if ($actorId !== null && ($rec['actor_id'] ?? null) !== $actorId) continue;
            if ($targetId !== null && ($rec['target_id'] ?? null) !== $targetId) continue;
            $out[] = $rec;
        }
        return $out;
    }
}
