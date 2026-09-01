<?php
/**
 * A small, self-contained SMTP client. No external dependencies, so it
 * works on plain shared hosting without composer/PHPMailer.
 *
 * Supports implicit TLS (port 465) with AUTH LOGIN, which matches the
 * SMTP_* settings in includes/config.php.
 */

/**
 * Send an email via SMTP — plain text, or plain text + HTML together
 * (recommended for anything user-facing; mail clients that can't render
 * HTML fall back to the plain text automatically).
 *
 * @param array{username?: string, password?: string, from_email?: string, from_name?: string, host?: string, port?: int} $account
 *        Optional overrides to send as a different mailbox (e.g. contact@
 *        instead of no-reply@). Defaults to the SMTP_* constants.
 * @param string|null $htmlBody Optional HTML version. When given, the message
 *        is sent as multipart/alternative with $body as the plain-text part.
 * @return array{0: bool, 1: string} [success, message] — message is a
 *         short human-readable status, safe to log (never includes the
 *         SMTP password).
 */
function send_smtp_mail(string $to, string $subject, string $body, array $account = [], ?string $htmlBody = null): array
{
    $host = $account['host'] ?? SMTP_HOST;
    $port = $account['port'] ?? SMTP_PORT;
    $username = $account['username'] ?? SMTP_USERNAME;
    $password = $account['password'] ?? SMTP_PASSWORD;
    $fromEmail = $account['from_email'] ?? SMTP_FROM_EMAIL;
    $fromName = $account['from_name'] ?? SMTP_FROM_NAME;
    $timeout = 12;

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $socket = @stream_socket_client(
        "ssl://{$host}:{$port}",
        $errno,
        $errstr,
        $timeout,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        return [false, "Could not connect to {$host}:{$port} ({$errstr})"];
    }
    stream_set_timeout($socket, $timeout);

    $read = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            // Multi-line SMTP responses have a '-' after the code on all
            // but the last line, e.g. "250-foo" then "250 bar".
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        return $data;
    };

    $write = function (string $command) use ($socket): void {
        fwrite($socket, $command . "\r\n");
    };

    $expect = function (string $response, array $codes) {
        $code = (int) substr($response, 0, 3);
        return in_array($code, $codes, true);
    };

    try {
        $greeting = $read();
        if (!$expect($greeting, [220])) {
            return [false, 'Unexpected greeting from mail server'];
        }

        $write('EHLO ' . parse_url(SITE_URL, PHP_URL_HOST));
        $ehloResponse = $read();
        if (!$expect($ehloResponse, [250])) {
            return [false, 'EHLO was rejected'];
        }

        $write('AUTH LOGIN');
        if (!$expect($read(), [334])) {
            return [false, 'Server does not support AUTH LOGIN'];
        }

        $write(base64_encode($username));
        if (!$expect($read(), [334])) {
            return [false, 'SMTP username rejected'];
        }

        $write(base64_encode($password));
        $authResponse = $read();
        if (!$expect($authResponse, [235])) {
            return [false, 'SMTP authentication failed — check SMTP_USERNAME/SMTP_PASSWORD in config.php'];
        }

        $write('MAIL FROM:<' . $fromEmail . '>');
        if (!$expect($read(), [250])) {
            return [false, 'MAIL FROM was rejected'];
        }

        $write('RCPT TO:<' . $to . '>');
        if (!$expect($read(), [250, 251])) {
            return [false, 'RCPT TO was rejected (check the recipient address)'];
        }

        $write('DATA');
        if (!$expect($read(), [354])) {
            return [false, 'DATA was rejected'];
        }

        $headers = [
            'From: ' . $fromName . ' <' . $fromEmail . '>',
            'To: <' . $to . '>',
            'Subject: ' . $subject,
            'Date: ' . date('r'),
            'MIME-Version: 1.0',
        ];

        // RFC 5321 requires CRLF line endings throughout the message.
        $normalize = fn(string $s) => preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $s));

        if ($htmlBody !== null) {
            $boundary = 'xyphros-' . bin2hex(random_bytes(12));
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
            $message = implode("\r\n", $headers) . "\r\n\r\n"
                . "--{$boundary}\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
                . $normalize($body) . "\r\n\r\n"
                . "--{$boundary}\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
                . $normalize($htmlBody) . "\r\n\r\n"
                . "--{$boundary}--\r\n.";
        } else {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $message = implode("\r\n", $headers) . "\r\n\r\n" . $normalize($body) . "\r\n.";
        }

        $write($message);
        $dataResponse = $read();
        if (!$expect($dataResponse, [250])) {
            return [false, 'Message was rejected by the mail server'];
        }

        $write('QUIT');
        $read();

        return [true, 'Sent'];
    } finally {
        fclose($socket);
    }
}
