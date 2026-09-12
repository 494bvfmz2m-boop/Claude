<?php
/** Staff-side polling endpoint for tickets.php — same idea as the
 * customer-facing support-poll.php, but gated on staff permission
 * instead of ticket ownership. */
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_support');

header('Content-Type: application/json');

$ticketId = $_GET['ticket'] ?? '';
$after = $_GET['after'] ?? '';

$ticket = $ticketId ? SupportTicket::find($ticketId) : null;
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Ticket not found.']);
    exit;
}

$newMessages = $after !== '' ? SupportTicket::messagesAfter($ticketId, $after) : SupportTicket::messages($ticketId);

$html = [];
foreach ($newMessages as $m) {
    $html[$m['id']] = xs_render_support_message($m);
}

echo json_encode(['ok' => true, 'ticket' => $ticket, 'messages' => $newMessages, 'html' => $html]);
