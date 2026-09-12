<?php
/**
 * AJAX endpoint used by both the floating support widget and the
 * Account -> Support tab. Always returns JSON — there's no non-JS
 * fallback, since a support chat is inherently a live-updating thing.
 */
require_once __DIR__ . '/includes/functions.php';

header('Content-Type: application/json');

$me = XyphrosAuth::currentUser();
if (!$me) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Sign in to use support chat.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$csrfToken = $input['csrf_token'] ?? '';
$body = trim((string) ($input['body'] ?? ''));

if (!XyphrosAuth::csrfVerify($csrfToken)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Your session expired. Refresh the page and try again.']);
    exit;
}

if ($body === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Type a message first.']);
    exit;
}
if (mb_strlen($body) > 4000) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'That message is too long.']);
    exit;
}

$senderName = $me['name'] ?: $me['username'];
$ticket = SupportTicket::openForUser($me['id']);
if ($ticket) {
    SupportTicket::addMessage($ticket['id'], 'user', $me['id'], $senderName, $body);
    $ticketId = $ticket['id'];
} else {
    $ticketId = SupportTicket::create($me['id'], $senderName, $body);
}

echo json_encode([
    'ok' => true,
    'ticket' => SupportTicket::find($ticketId),
    'messages' => SupportTicket::messages($ticketId),
]);
