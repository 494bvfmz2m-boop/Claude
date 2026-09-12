<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_once __DIR__ . '/../includes/mailer.php';
require_permission('send_email');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_ok()) {
    header('Location: /staff/email');
    exit;
}

$from = $_POST['from'] ?? 'contact';
$to = trim($_POST['to'] ?? '');
$subject = trim($_POST['subject'] ?? '');
$body = trim($_POST['body'] ?? '');

$redirectBack = '/staff/email?to=' . rawurlencode($to) . '&subject=' . rawurlencode($subject);

if (!filter_var($to, FILTER_VALIDATE_EMAIL) || $subject === '' || $body === '') {
    header('Location: ' . $redirectBack . '&error=' . rawurlencode('Enter a valid recipient, subject, and message.'));
    exit;
}

$account = $from === 'noreply'
    ? ['username' => SMTP_USERNAME, 'password' => SMTP_PASSWORD, 'from_email' => SMTP_FROM_EMAIL, 'from_name' => SMTP_FROM_NAME]
    : ['username' => CONTACT_SMTP_USERNAME, 'password' => CONTACT_SMTP_PASSWORD, 'from_email' => CONTACT_FROM_EMAIL, 'from_name' => CONTACT_FROM_NAME];

$htmlBody = render_notice_email(
    $subject,
    nl2br(e($body)),
    null, null,
    "This email was sent by a Xyphros staff member. Reply directly to get in touch."
);

[$ok, $sendError] = send_smtp_mail($to, $subject, $body, $account, $htmlBody);

if (!$ok) {
    error_log('Xyphros staff email failed: ' . $sendError);
    header('Location: ' . $redirectBack . '&error=' . rawurlencode($sendError));
    exit;
}

Content::insert('sent_emails', [
    'to' => $to,
    'subject' => $subject,
    'from_email' => $account['from_email'],
    'sent_by' => $currentStaffUser['name'] ?? $currentStaffUser['username'],
]);
AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'email_sent', null, $to, 'Sent an email: ' . $subject);

// If this was a reply from the Messages page, mark the original as replied.
$messages = Content::all('messages');
foreach ($messages as $m) {
    if (($m['email'] ?? '') === $to && empty($m['replied_at'])) {
        Content::update('messages', $m['id'], ['replied_at' => date('c'), 'read' => true]);
        break;
    }
}

header('Location: /staff/email?sent=1');
exit;
