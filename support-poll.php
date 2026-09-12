<?php
/**
 * Polling endpoint for the support widget / Account -> Support tab —
 * returns anything new since the last message the client already has,
 * plus the ticket's current status (so the UI can react the moment
 * staff closes it). No websockets in this stack, so a short poll
 * interval is the simple, honest way to get a "live" feel.
 */
require_once __DIR__ . '/includes/functions.php';

header('Content-Type: application/json');

$me = XyphrosAuth::currentUser();
if (!$me) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Signed out.']);
    exit;
}

$ticketId = $_GET['ticket'] ?? '';
$after = $_GET['after'] ?? '';

$ticket = $ticketId ? SupportTicket::find($ticketId) : null;
if (!$ticket || $ticket['user_id'] !== $me['id']) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Ticket not found.']);
    exit;
}

$newMessages = $after !== '' ? SupportTicket::messagesAfter($ticketId, $after) : SupportTicket::messages($ticketId);

$hasStaffReply = false;
foreach ($newMessages as $m) {
    if ($m['sender_type'] === 'staff') { $hasStaffReply = true; break; }
}
if ($hasStaffReply) {
    SupportTicket::markReadByUser($ticketId);
}

echo json_encode([
    'ok' => true,
    'ticket' => $ticket,
    'messages' => $newMessages,
]);
