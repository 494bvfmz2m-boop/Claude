<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$discordWebhookUrl = getenv('DISCORD_WEBHOOK_URL');

$mailboxes = [
    [
        'user'      => getenv('BILLING_USER'),
        'pass'      => getenv('BILLING_PASS'),
        'title'     => '📬 New Billing Email',
        'bot_name'  => 'Xyphros Billing',
        'color'     => 3447003,
        'reply_msg' => "Hello,\n\nThis is an automated reply. We have received your billing inquiry and our team will look into it shortly.\n\nBest regards,\nBilling Team\nXyphros Studios"
    ],
    [
        'user'      => getenv('HELLO_USER'),
        'pass'      => getenv('HELLO_PASS'),
        'title'     => '👋 New Hello Email',
        'bot_name'  => 'Xyphros Hello',
        'color'     => 5763719,
        'reply_msg' => "Hello,\n\nThis is an automated reply. Thanks for reaching out! We've received your message and someone will get back to you soon.\n\nBest regards,\nTeam\nXyphros Studios"
    ],
    [
        'user'      => getenv('SUPPORT_USER'),
        'pass'      => getenv('SUPPORT_PASS'),
        'title'     => '🛠️ New Support Ticket',
        'bot_name'  => 'Xyphros Support',
        'color'     => 15548997,
        'reply_msg' => "Hello,\n\nThis is an automated reply. Your support request has been logged. Our team is looking into it and will follow up with you soon.\n\nBest regards,\nSupport Team\nXyphros Studios"
    ]
];

$imapHost = '{imap.purelymail.com:993/imap/ssl/novalidate-cert}INBOX';

function getCleanEmailBody($inbox, $emailId) {
    $structure = @imap_fetchstructure($inbox, $emailId);
    $rawBody = '';

    if (isset($structure->parts) && count($structure->parts) > 0) {
        $rawBody = @imap_fetchbody($inbox, $emailId, '1');
        if (empty(trim($rawBody))) {
            $rawBody = @imap_fetchbody($inbox, $emailId, '1.1');
        }
    } else {
        $rawBody = @imap_body($inbox, $emailId, FT_PEEK);
    }

    if ($structure && isset($structure->encoding) && $structure->encoding == 4) {
        $rawBody = quoted_printable_decode($rawBody);
    } else {
        $decoded = quoted_printable_decode($rawBody);
        if (!empty(trim($decoded))) {
            $rawBody = $decoded;
        }
    }

    $cleanBody = trim(strip_tags($rawBody));
    
    if (empty($cleanBody)) {
        $fallback = @imap_body($inbox, $emailId, FT_PEEK);
        $cleanBody = trim(strip_tags($fallback));
    }

    $bodySnippet = mb_substr($cleanBody, 0, 250);
    if (mb_strlen($cleanBody) > 250) {
        $bodySnippet .= '...';
    }
    return empty($bodySnippet) ? '*[No text content]*' : $bodySnippet;
}

function sendAutoReply($smtpUser, $smtpPass, $toEmail, $subject, $messageBody, $senderName = '') {
    $smtpHost = 'smtp.purelymail.com';
    $smtpPort = 465;

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ]);

    $socket = @stream_socket_client("ssl://{$smtpHost}:{$smtpPort}", $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        echo "SMTP Connection Failed for {$smtpUser}: $errstr ($errno)\n";
        return false;
    }

    stream_set_timeout($socket, 20);

    $helperRead = function($sock) {
        $data = '';
        while (($line = fgets($sock, 512)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };

    $greeting = $helperRead($socket);
    if (strpos($greeting, '220') === false) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "EHLO [127.0.0.1]\r\n");
    $helperRead($socket);

    fwrite($socket, "AUTH LOGIN\r\n");
    $helperRead($socket);

    fwrite($socket, base64_encode($smtpUser) . "\r\n");
    $helperRead($socket);

    fwrite($socket, base64_encode($smtpPass) . "\r\n");
    $passResp = $helperRead($socket);
    if (strpos($passResp, '235') === false) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "MAIL FROM: <{$smtpUser}>\r\n");
    $helperRead($socket);

    fwrite($socket, "RCPT TO: <{$toEmail}>\r\n");
    $rcptResp = $helperRead($socket);
    if (strpos($rcptResp, '250') === false && strpos($rcptResp, '251') === false) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "DATA\r\n");
    $helperRead($socket);

    $cleanSubject = str_replace(["\r", "\n"], '', $subject);
    $fromHeader = !empty($senderName) ? "From: {$senderName} <{$smtpUser}>" : "From: <{$smtpUser}>";
    
    $headers  = $fromHeader . "\r\n";
    $headers .= "To: <{$toEmail}>\r\n";
    $headers .= "Subject: Automated Reply to - " . $cleanSubject . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "\r\n";

    fwrite($socket, $headers . $messageBody . "\r\n.\r\n");
    $finishResp = $helperRead($socket);
    if (strpos($finishResp, '250') === false) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);
    return true;
}

foreach ($mailboxes as $mailbox) {
    if (empty($mailbox['user']) || empty($mailbox['pass'])) {
        continue;
    }

    $inbox = @imap_open($imapHost, $mailbox['user'], $mailbox['pass']);
    if (!$inbox) {
        continue; 
    }

    $emails = @imap_search($inbox, 'UNSEEN');
    if ($emails) {
        rsort($emails);
        foreach ($emails as $emailId) {
            $headerInfo = imap_headerinfo($inbox, $emailId);
            $overview   = imap_fetch_overview($inbox, $emailId, 0);

            $subject = isset($headerInfo->subject) ? mb_decode_mimeheader($headerInfo->subject) : 'No Subject';
            $from    = isset($headerInfo->fromaddress) ? mb_decode_mimeheader($headerInfo->fromaddress) : 'Unknown Sender';
            
            $rawSenderEmail = '';
            if (isset($headerInfo->from[0]->mailbox) && isset($headerInfo->from[0]->host)) {
                $rawSenderEmail = $headerInfo->from[0]->mailbox . '@' . $headerInfo->from[0]->host;
            }

            $date = isset($overview[0]->date) ? $overview[0]->date : date('Y-m-d H:i:s');
            $bodySnippet = getCleanEmailBody($inbox, $emailId);

            $embedData = [
                'username' => $mailbox['bot_name'],
                'embeds' => [
                    [
                        'title'       => $mailbox['title'] . ': ' . $subject,
                        'description' => "> " . str_replace("\n", "\n> ", $bodySnippet),
                        'color'       => $mailbox['color'],
                        'fields'      => [
                            ['name' => 'From', 'value' => $from, 'inline' => true],
                            ['name' => 'To', 'value' => '`' . $mailbox['user'] . '`', 'inline' => true]
                        ],
                        'footer'      => ['text' => 'Received • ' . $date]
                    ]
                ]
            ];

            $ch = curl_init($discordWebhookUrl);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($embedData));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_exec($ch);
            curl_close($ch);

            if (!empty($rawSenderEmail)) {
                sendAutoReply($mailbox['user'], $mailbox['pass'], $rawSenderEmail, $subject, $mailbox['reply_msg'], $mailbox['bot_name']);
            }

            imap_setflag_full($inbox, $emailId, '\\Seen');
        }
    }
    imap_close($inbox);
}

exit(0);
?>
