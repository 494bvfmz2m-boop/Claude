<?php
require_once __DIR__ . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact');
    exit;
}

xs_session_start();

function back_with_error(string $message): void
{
    header('Location: /contact?error=' . rawurlencode($message));
    exit;
}

if (!csrf_verify($_POST['csrf_token'] ?? null)) {
    back_with_error('Your session expired, please try again.');
}

// Honeypot: real visitors never fill this hidden field in.
if (!empty($_POST['company'])) {
    // Pretend it worked so bots don't learn anything; just don't store/send it.
    header('Location: /contact?sent=1');
    exit;
}

$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$subject = trim($_POST['subject'] ?? '');
$message = trim($_POST['message'] ?? '');

if ($name === '' || $email === '' || $subject === '' || $message === '') {
    back_with_error('Please fill in every field.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    back_with_error('That email address doesn\'t look right.');
}
if (str_length($name) > 120 || str_length($subject) > 160 || str_length($message) > 4000) {
    back_with_error('One of those fields is too long.');
}

$saved = true;
try {
    Content::insert('messages', [
        'name' => $name,
        'email' => $email,
        'subject' => $subject,
        'message' => $message,
        'read' => false,
    ]);
} catch (Throwable $e) {
    error_log('Xyphros contact form save failed: ' . $e->getMessage());
    $saved = false;
}

// Best-effort email notification via the studio's real SMTP mailbox. If
// this fails for any reason but the message was saved above, it's still
// visible in the staff Messages panel.
require_once __DIR__ . '/includes/mailer.php';
$to = get_settings()['contact_email'];
$mailSubject = '[' . SITE_NAME . ' contact] ' . $subject;
$body = "New message from the contact form:\n\n"
    . "Name: {$name}\n"
    . "Email: {$email}\n\n"
    . $message;
[$mailSent, $mailError] = send_smtp_mail($to, $mailSubject, $body);
if (!$mailSent) {
    error_log('Xyphros contact form email failed: ' . $mailError);
}

if (!$saved && !$mailSent) {
    back_with_error("Sorry, that didn't go through on our end. Please try emailing {$to} directly.");
}

header('Location: /contact?sent=1');
exit;
