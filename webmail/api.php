<?php
declare(strict_types=1);

ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', '3600');

session_start();

require_once __DIR__ . '/src/Mail.php';
$config = require __DIR__ . '/src/config.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

function json_ok(mixed $data): never {
    echo json_encode(['ok' => true, 'data' => $data]);
    exit;
}

function json_err(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function verify_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf'] ?? '', $token)) json_err('Invalid CSRF token', 403);
}

function require_auth(): array {
    global $config;
    if (empty($_SESSION['email']) || empty($_SESSION['pass_enc'])) json_err('Not authenticated', 401);
    if (time() - ($_SESSION['last_active'] ?? 0) > ($config['session_lifetime'] ?? 3600)) {
        session_destroy();
        json_err('Session expired', 401);
    }
    $_SESSION['last_active'] = time();
    session_regenerate_id(false);
    return ['email' => $_SESSION['email'], 'pass' => base64_decode($_SESSION['pass_enc'])];
}

function make_mail(array $creds, string $host, int $imap, int $smtp, string $folder = 'INBOX'): Mail {
    $mail = new Mail($host, $imap, $smtp, $creds['email'], $creds['pass']);
    if (!$mail->connect($folder)) json_err('Could not connect to mail server.', 503);
    return $mail;
}

function identity_file(string $email): string {
    $dir = __DIR__ . '/src/identities/';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir . preg_replace('/[^a-z0-9@._-]/', '', $email) . '.json';
}

function read_identity(string $email): array {
    $file = identity_file($email);
    $data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
    return [
        'name'      => $data['name'] ?? '',
        'signature' => $data['signature'] ?? '',
        'avatar'    => $data['avatar'] ?? '',
    ];
}

function rate_limit(string $key, int $max, int $window): void {
    $now  = time();
    $data = $_SESSION['rl'][$key] ?? ['count' => 0, 'start' => $now];
    if ($now - $data['start'] > $window) $data = ['count' => 0, 'start' => $now];
    $data['count']++;
    $_SESSION['rl'][$key] = $data;
    if ($data['count'] > $max) json_err('Too many requests. Please wait.', 429);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    case 'csrf':
        json_ok(['token' => csrf_token()]);

    case 'login':
        rate_limit('login', 5, 60);
        verify_csrf();
        $email  = strtolower(trim($_POST['email'] ?? ''));
        $pass   = $_POST['pass'] ?? '';
        if (!$email || !$pass) json_err('Email and password required.');
        if (!str_contains($email, '@')) json_err('Please enter a valid email address.');
        $domain = substr($email, strrpos($email, '@') + 1);
        if (!in_array($domain, $config['allowed_domains'] ?? [], true)) json_err('This domain is not allowed.');
        $mail = new Mail($config['imap_host'], $config['imap_port'], $config['smtp_port'], $email, $pass);
        if (!$mail->connect()) {
            $imapErr = $mail->getLastError();
            error_log("[webmail login] IMAP connect failed for $email: $imapErr");
            // Only blame the password when the server actually rejected the credentials.
            // Anything else (TLS handshake, DNS, timeout, server down) gets its own message
            // instead of being reported as "invalid password", which was misleading.
            if ($imapErr !== '' && !preg_match('/auth|login|password|credential|denied/i', $imapErr)) {
                json_err('Could not connect to the mail server. Please try again shortly.', 503);
            }
            json_err('Invalid email or password.');
        }
        $mail->disconnect();
        session_regenerate_id(true);
        $_SESSION['email']       = $email;
        $_SESSION['pass_enc']    = base64_encode($pass);
        $_SESSION['last_active'] = time();
        $_SESSION['csrf']        = bin2hex(random_bytes(32));
        json_ok(['email' => $email, 'csrf' => $_SESSION['csrf']]);

    case 'logout':
        verify_csrf();
        session_unset();
        session_destroy();
        json_ok(null);

    case 'folders':
        $creds = require_auth();
        $mail  = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port']);
        $res   = $mail->getFolders();
        $mail->disconnect();
        json_ok($res);

    case 'messages':
        $creds  = require_auth();
        $folder = $_GET['folder'] ?? 'INBOX';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $mail   = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port'], $folder);
        $res    = $mail->getMessages($page);
        $mail->disconnect();
        json_ok($res);

    case 'message':
        $creds  = require_auth();
        $uid    = (int)($_GET['uid'] ?? 0);
        $folder = $_GET['folder'] ?? 'INBOX';
        if (!$uid) json_err('Missing UID');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port'], $folder);
        $res  = $mail->getMessage($uid);
        $mail->disconnect();
        json_ok($res);

    case 'send':
        verify_csrf();
        $creds   = require_auth();
        rate_limit('send', 20, 60);
        $to      = trim($_POST['to']      ?? '');
        $subject = trim($_POST['subject'] ?? '');
        $body    = trim($_POST['body']    ?? '');
        $cc      = trim($_POST['cc']      ?? '');
        if (!$to || !$subject || !$body) json_err('To, subject, and body are required.');
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) json_err('Invalid recipient address.');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port']);
        $res  = $mail->sendMessage($to, $subject, $body, $cc);
        $mail->disconnect();
        if (!$res) json_err('Failed to send. Please try again.', 500);
        json_ok(null);

    case 'delete':
        verify_csrf();
        $creds  = require_auth();
        $uid    = (int)($_POST['uid'] ?? 0);
        $folder = $_POST['folder'] ?? 'INBOX';
        if (!$uid) json_err('Missing UID');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port'], $folder);
        $mail->deleteMessage($uid);
        $mail->disconnect();
        json_ok(null);

    case 'flag':
        verify_csrf();
        $creds  = require_auth();
        $uid    = (int)($_POST['uid'] ?? 0);
        $flag   = $_POST['flag'] ?? '';
        $folder = $_POST['folder'] ?? 'INBOX';
        if (!$uid || !in_array($flag, ['flagged', 'seen'], true)) json_err('Invalid params');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port'], $folder);
        $mail->toggleFlag($uid, $flag);
        $mail->disconnect();
        json_ok(null);

    case 'rename_folder':
        verify_csrf();
        $creds   = require_auth();
        $oldName = trim($_POST['old_name'] ?? '');
        $newName = trim($_POST['new_name'] ?? '');
        if (!$oldName || !$newName) json_err('Old and new folder names required.');
        // Protect system folders
        $protected = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam', 'Junk'];
        if (in_array($oldName, $protected, true)) json_err('Cannot rename system folders.');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port']);
        $res  = $mail->renameFolder($oldName, $newName);
        $mail->disconnect();
        if (!$res) json_err('Failed to rename folder.');
        json_ok(null);

    case 'create_folder':
        verify_csrf();
        $creds = require_auth();
        $name  = trim($_POST['name'] ?? '');
        if (!$name) json_err('Folder name required.');
        $mail = make_mail($creds, $config['imap_host'], $config['imap_port'], $config['smtp_port']);
        $res  = $mail->createFolder($name);
        $mail->disconnect();
        if (!$res) json_err('Failed to create folder.');
        json_ok(null);

    case 'me':
        if (!empty($_SESSION['email'])) json_ok(['email' => $_SESSION['email']]);
        json_err('Not authenticated', 401);


    case 'get_identity':
        $creds = require_auth();
        json_ok(read_identity($creds['email']));

    case 'save_identity':
        verify_csrf();
        $creds    = require_auth();
        $existing = read_identity($creds['email']);
        $data     = [
            'name'      => substr(trim($_POST['name'] ?? ''), 0, 100),
            'signature' => substr(trim($_POST['signature'] ?? ''), 0, 2000),
            'avatar'    => $existing['avatar'],
        ];
        file_put_contents(identity_file($creds['email']), json_encode($data));
        json_ok(null);

    case 'save_avatar':
        verify_csrf();
        $creds   = require_auth();
        $dataUrl = $_POST['avatar'] ?? '';
        if (strlen($dataUrl) > 700 * 1024) json_err('Image too large.');
        if (!preg_match('/^data:image\/(png|jpe?g|webp);base64,([a-zA-Z0-9+\/=]+)$/', $dataUrl, $m)) {
            json_err('Invalid image data.');
        }
        $raw = base64_decode($m[2], true);
        if ($raw === false || strlen($raw) > 500 * 1024 || !@getimagesizefromstring($raw)) {
            json_err('Invalid or oversized image.');
        }
        $existing            = read_identity($creds['email']);
        $existing['avatar']  = $dataUrl;
        file_put_contents(identity_file($creds['email']), json_encode($existing));
        json_ok(['avatar' => $dataUrl]);

    case 'remove_avatar':
        verify_csrf();
        $creds              = require_auth();
        $existing           = read_identity($creds['email']);
        $existing['avatar'] = '';
        file_put_contents(identity_file($creds['email']), json_encode($existing));
        json_ok(null);

    default:
        json_err('Unknown action', 404);
}
