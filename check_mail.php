<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$discordWebhookUrl = getenv('DISCORD_WEBHOOK_URL');

$mailboxes = [
    [
        'user'  => getenv('BILLING_USER'),
        'pass'  => getenv('BILLING_PASS'),
        'title' => '📬 New Billing Email',
        'color' => 3447003,
        'reply_msg' => "Hello,\n\nWe have received your billing inquiry and our team will look into it shortly.\n\nBest regards,\nBilling Team"
    ],
    [
        'user'  => getenv('HELLO_USER'),
        'pass'  => getenv('HELLO_PASS'),
        'title' => '👋 New Hello Email',
        'color' => 5763719,
        'reply_msg' => "Hello,\n\nThanks for reaching out! We've received your message and someone will get back to you soon.\n\nBest regards,\nTeam"
    ],
    [
        'user'  => getenv('SUPPORT_USER'),
        'pass'  => getenv('SUPPORT_PASS'),
        'title' => '🛠️ New Support Ticket',
        'color' => 15548997,
        'reply_msg' => "Hello,\n\nYour support request has been logged. Our team is looking into it and will follow up with you soon.\n\nBest regards,\nSupport Team"
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

// Lightweight SMTP sender for Purelymail to avoid external dependencies
function sendAutoReply($smtpUser, $smtpPass, $toEmail, $subject, $messageBody) {
    $smtpHost = 'ssl://smtp.purelymail.com';
    $smtpPort = 465;

    $socket = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 10);
    if (!$socket) return false;

    $serverReply = fgets($socket, 512);
    
    fwrite($socket, "EHLO " . parse_url($smtpHost, PHP_URL_HOST) . "\r\n");
    $serverReply = fgets($socket, 512);

    fwrite($socket, "AUTH LOGIN\r\n");
    fgets($socket, 512);

    fwrite($socket, base64_encode($smtpUser) . "\r\n");
    fgets($socket, 512);

    fwrite($socket, base64_encode($smtpPass) . "\r\n");
    $authReply = fgets($socket, 512);

    if (strpos($authReply, '235') === false) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "MAIL FROM: <{$smtpUser}>\r\n");
    fgets($socket, 512);

    fwrite($socket, "RCPT TO: <{$toEmail}>\r\n");
    fgets($socket, 512);

    fwrite($socket, "DATA\r\n");
    fgets($socket, 512);

    $headers  = "From: <{$smtpUser}>\r\n";
    $headers .= "To: <{$toEmail}>\r\n";
    $headers .= "Subject: Re: " . $subject . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "\r\n";

    fwrite($socket, $headers . $messageBody . "\r\n.\r\n");
    fgets($socket, 512);

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
            
            // Extract pure email address from 'Name <email@domain.com>' format for replying
            $rawSenderEmail = '';
            if (isset($headerInfo->from[0]->mailbox) && isset($headerInfo->from[0]->host)) {
                $rawSenderEmail = $headerInfo->from[0]->mailbox . '@' . $headerInfo->from[0]->host;
            }

            $date = isset($overview[0]->date) ? $overview[0]->date : date('Y-m-d H:i:s');
            $bodySnippet = getCleanEmailBody($inbox, $emailId);

            // Send Discord Notification
            $embedData = [
                'username' => 'Mail Notifier',
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

            // Send Auto-Reply to the sender
            if (!empty($rawSenderEmail)) {
                sendAutoReply($mailbox['user'], $mailbox['pass'], $rawSenderEmail, $subject, $mailbox['reply_msg']);
            }

            // Mark as read so it doesn't loop
            imap_setflag_full($inbox, $emailId, '\\Seen');
        }
    }
    imap_close($inbox);
}

exit(0);
?>
