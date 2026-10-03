<?php
// Simple customer <-> owner chat. One conversation per customer account.

const CHAT_MAX_LENGTH = 2000;

function chat_for_user(int $userId, bool $create = false): ?array {
    $chat = one('SELECT * FROM chats WHERE user_id = ?', [$userId]);
    if (!$chat && $create) {
        q('INSERT IGNORE INTO chats (user_id) VALUES (?)', [$userId]);
        $chat = one('SELECT * FROM chats WHERE user_id = ?', [$userId]);
    }
    return $chat;
}

/** Store a message and bump the unread counter for the other side. */
function chat_post(int $chatId, bool $fromAdmin, string $body): ?int {
    $body = trim($body);
    if ($body === '') return null;
    $body = mb_substr($body, 0, CHAT_MAX_LENGTH);
    q('INSERT INTO chat_messages (chat_id, from_admin, body) VALUES (?,?,?)', [$chatId, $fromAdmin ? 1 : 0, $body]);
    $id = (int)db()->lastInsertId();
    $col = $fromAdmin ? 'user_unread' : 'admin_unread';
    // A new message from the customer reopens a closed chat.
    q("UPDATE chats SET $col = $col + 1, updated_at = NOW()" . ($fromAdmin ? '' : ', status = "open"') . ' WHERE id = ?', [$chatId]);
    return $id;
}

function chat_messages(int $chatId, int $afterId = 0): array {
    return all('SELECT id, from_admin, body, created_at FROM chat_messages WHERE chat_id = ? AND id > ? ORDER BY id LIMIT 500', [$chatId, $afterId]);
}

function chat_mark_read(int $chatId, bool $byAdmin): void {
    q('UPDATE chats SET ' . ($byAdmin ? 'admin_unread' : 'user_unread') . ' = 0 WHERE id = ?', [$chatId]);
}

function chat_unread_for_admin(): int {
    static $n = null;
    if ($n === null) $n = (int)(one('SELECT COALESCE(SUM(admin_unread),0) n FROM chats')['n'] ?? 0);
    return $n;
}

function chat_unread_for_user(int $userId): int {
    return (int)(one('SELECT user_unread FROM chats WHERE user_id = ?', [$userId])['user_unread'] ?? 0);
}

function chat_message_json(array $m): array {
    return [
        'id'    => (int)$m['id'],
        'admin' => (int)$m['from_admin'] === 1,
        'body'  => $m['body'],
        'time'  => date('d-m H:i', strtotime($m['created_at'])),
    ];
}

/** Plain-text e-mail through the server's mail(). Returns false when the server refuses it. */
function send_mail(string $to, string $subject, string $body): bool {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $store = setting('store_name', 'Ederveen3D');
    $host = parse_url(setting('site_url', ''), PHP_URL_HOST) ?: ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $host = preg_replace('/^www\./', '', (string)$host);
    $headers = [
        'From: ' . mb_encode_mimeheader($store) . ' <noreply@' . $host . '>',
        'Content-Type: text/plain; charset=UTF-8',
        'MIME-Version: 1.0',
    ];
    $reply = setting('contact_email', '');
    if (filter_var($reply, FILTER_VALIDATE_EMAIL)) $headers[] = 'Reply-To: ' . $reply;
    return @mail($to, mb_encode_mimeheader($subject), $body, implode("\r\n", $headers));
}
