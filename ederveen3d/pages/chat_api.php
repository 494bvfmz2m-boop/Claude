<?php
// JSON endpoint used by assets/app.js to send and poll chat messages.
// Customers can only reach their own chat; staff pass ?chat=<id>.
if (!is_logged_in()) json_out(['error' => 'Log opnieuw in.'], 401);

$staff = is_staff();
if ($staff) {
    $chat = one('SELECT * FROM chats WHERE id = ?', [(int)($_GET['chat'] ?? 0)]);
} else {
    $chat = chat_for_user((int)current_user()['id'], $_SERVER['REQUEST_METHOD'] === 'POST');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!$chat) json_out(['error' => 'Chat niet gevonden.'], 404);
    if (!$staff && !throttle('chat', 30, 600)) json_out(['error' => 'Even wachten, je stuurt te veel berichten.'], 429);
    if (chat_post((int)$chat['id'], $staff, (string)($_POST['body'] ?? '')) === null) json_out(['error' => 'Typ eerst een bericht.'], 422);
}

if (!$chat) json_out(['messages' => []]);
$after = max(0, (int)($_GET['after'] ?? 0));
chat_mark_read((int)$chat['id'], $staff);
json_out(['messages' => array_map('chat_message_json', chat_messages((int)$chat['id'], $after))]);
