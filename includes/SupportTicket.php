<?php
/**
 * SupportTicket — the account-linked support chat. One user can have at
 * most one OPEN ticket at a time; sending a message while their last
 * ticket is closed starts a fresh one, so closed history stays intact
 * and untouched. Only staff can close a ticket (the whole point of the
 * "Close ticket" button) — a user can't close their own.
 */
class SupportTicket
{
    /** The user's current open ticket, if any. */
    public static function openForUser(string $userId): ?array
    {
        $s = XyphrosAuth::db()->prepare(
            "SELECT * FROM support_tickets WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1"
        );
        $s->execute([$userId]);
        return $s->fetch() ?: null;
    }

    /** Every ticket (open or closed) for a user's account, newest first. */
    public static function forUser(string $userId): array
    {
        $s = XyphrosAuth::db()->prepare(
            "SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC"
        );
        $s->execute([$userId]);
        return $s->fetchAll();
    }

    public static function find(string $id): ?array
    {
        $s = XyphrosAuth::db()->prepare('SELECT * FROM support_tickets WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    /** Staff inbox listing, optionally filtered to one status. */
    public static function all(?string $status = null): array
    {
        if ($status !== null) {
            $s = XyphrosAuth::db()->prepare(
                "SELECT * FROM support_tickets WHERE status = ? ORDER BY last_message_at DESC"
            );
            $s->execute([$status]);
        } else {
            $s = XyphrosAuth::db()->query('SELECT * FROM support_tickets ORDER BY last_message_at DESC');
        }
        return $s->fetchAll();
    }

    /** Starts a brand new ticket with its first message, returns the ticket id. */
    public static function create(string $userId, string $userName, string $body): string
    {
        $db = XyphrosAuth::db();
        $id = XyphrosAuth::uuid();
        $now = date('Y-m-d H:i:s');
        $db->prepare(
            'INSERT INTO support_tickets (id, user_id, subject, status, last_message_at, last_sender, unread_by_staff, unread_by_user, created_at)
             VALUES (?, ?, ?, \'open\', ?, \'user\', 1, 0, ?)'
        )->execute([$id, $userId, self::subjectFrom($body), $now, $now]);

        self::insertMessage($id, 'user', $userId, $userName, $body);
        return $id;
    }

    /** Appends a message to an existing ticket and updates its unread/last-activity state. */
    public static function addMessage(string $ticketId, string $senderType, string $senderId, string $senderName, string $body): void
    {
        self::insertMessage($ticketId, $senderType, $senderId, $senderName, $body);

        $db = XyphrosAuth::db();
        $now = date('Y-m-d H:i:s');
        if ($senderType === 'user') {
            $db->prepare('UPDATE support_tickets SET last_message_at = ?, last_sender = \'user\', unread_by_staff = 1 WHERE id = ?')
                ->execute([$now, $ticketId]);
        } else {
            $db->prepare('UPDATE support_tickets SET last_message_at = ?, last_sender = \'staff\', unread_by_user = 1 WHERE id = ?')
                ->execute([$now, $ticketId]);
        }
    }

    private static function insertMessage(string $ticketId, string $senderType, string $senderId, string $senderName, string $body): void
    {
        XyphrosAuth::db()->prepare(
            'INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([XyphrosAuth::uuid(), $ticketId, $senderType, $senderId, $senderName, $body, date('Y-m-d H:i:s')]);
    }

    /** Full thread for one ticket, oldest first. */
    public static function messages(string $ticketId): array
    {
        $s = XyphrosAuth::db()->prepare('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY seq ASC');
        $s->execute([$ticketId]);
        return $s->fetchAll();
    }

    /**
     * Only messages after a given message id — used for polling without
     * re-fetching the whole thread. Cursors on the auto-increment `seq`
     * column rather than created_at: plain DATETIME is only
     * second-precision, so two messages sent in the same second would
     * tie under a timestamp comparison and one could silently vanish
     * from a poll response.
     */
    public static function messagesAfter(string $ticketId, string $afterId): array
    {
        $db = XyphrosAuth::db();
        $anchor = $db->prepare('SELECT seq FROM support_messages WHERE id = ?');
        $anchor->execute([$afterId]);
        $row = $anchor->fetch();
        if (!$row) return self::messages($ticketId);

        $s = $db->prepare('SELECT * FROM support_messages WHERE ticket_id = ? AND seq > ? ORDER BY seq ASC');
        $s->execute([$ticketId, $row['seq']]);
        return $s->fetchAll();
    }

    public static function close(string $ticketId, string $staffId): void
    {
        XyphrosAuth::db()->prepare(
            "UPDATE support_tickets SET status = 'closed', closed_by = ?, closed_at = ? WHERE id = ?"
        )->execute([$staffId, date('Y-m-d H:i:s'), $ticketId]);
    }

    public static function markReadByStaff(string $ticketId): void
    {
        XyphrosAuth::db()->prepare('UPDATE support_tickets SET unread_by_staff = 0 WHERE id = ?')->execute([$ticketId]);
    }

    public static function markReadByUser(string $ticketId): void
    {
        XyphrosAuth::db()->prepare('UPDATE support_tickets SET unread_by_user = 0 WHERE id = ?')->execute([$ticketId]);
    }

    public static function unreadCountForStaff(): int
    {
        return (int) XyphrosAuth::db()->query(
            "SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND unread_by_staff = 1"
        )->fetchColumn();
    }

    /** First few words of the opening message, used as a human-readable ticket subject/preview. */
    private static function subjectFrom(string $body): string
    {
        $body = trim(preg_replace('/\s+/', ' ', $body));
        return mb_strlen($body) > 70 ? mb_substr($body, 0, 69) . '…' : ($body ?: 'New conversation');
    }
}
