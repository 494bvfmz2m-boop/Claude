<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// --- CONFIGURATION ---
$discordWebhookUrl = getenv('DISCORD_WEBHOOK_URL');

$mailboxes = [
    [
        'user'  => getenv('BILLING_USER'),
        'pass'  => getenv('BILLING_PASS'),
        'title' => '📬 New Billing Email',
        'color' => 3447003
    ],
    [
        'user'  => getenv('HELLO_USER'),
        'pass'  => getenv('HELLO_PASS'),
        'title' => '👋 New Hello Email',
        'color' => 5763719
    ],
    [
        'user'  => getenv('SUPPORT_USER'),
        'pass'  => getenv('SUPPORT_PASS'),
        'title' => '🛠️ New Support Ticket Email',
        'color' => 15548997
    ]
];

$imapHost = '{imap.purelymail.com:993/imap/ssl/novalidate-cert}INBOX';

// Helper function to extract and clean up email body cleanly
function getCleanEmailBody($inbox, $emailId) {
    $structure = @imap_fetchstructure($inbox, $emailId);
    $rawBody = '';

    // If it's a multi-part email, look for the plain text section (part 1 or 1.1)
    if (isset($structure->parts) && count($structure->parts) > 0) {
        // Try to fetch part 1 (usually text/plain)
        $rawBody = @imap_fetchbody($inbox, $emailId, '1');
        
        // If part 1 was actually HTML, try part 1.2 or 2 if available, or fallback
        if (empty(trim($rawBody))) {
            $rawBody = @imap_fetchbody($inbox, $emailId, '1.1');
        }
    } else {
        // Simple non-multipart email
        $rawBody = @imap_body($inbox, $emailId, FT_PEEK);
    }

    // Decode quoted-printable if present
    if ($structure && isset($structure->encoding) && $structure->encoding == 4) {
        $rawBody = quoted_printable_decode($rawBody);
    } else {
        // Fallback safety decode
        $decoded = quoted_printable_decode($rawBody);
        if (!empty(trim($decoded))) {
            $rawBody = $decoded;
        }
    }

    $cleanBody = trim(strip_tags($rawBody));
    
    if (empty($cleanBody)) {
        // Absolute fallback if parsing fails
        $fallback = @imap_body($inbox, $emailId, FT_PEEK);
        $cleanBody = trim(strip_tags($fallback));
    }

    $bodySnippet = mb_substr($cleanBody, 0, 450);
    if (mb_strlen($cleanBody) > 450) {
        $bodySnippet .= '...';
    }
    if (empty($bodySnippet)) {
        $bodySnippet = '*[No text content or attachment-only]*';
    }

    return $bodySnippet;
}

foreach ($mailboxes as $mailbox) {
    if (empty($mailbox['user']) || empty($mailbox['pass'])) {
        continue;
    }

    echo "Checking mailbox: " . $mailbox['user'] . "\n";
    $inbox = @imap_open($imapHost, $mailbox['user'], $mailbox['pass']);

    if (!$inbox) {
        echo "Failed to connect to " . $mailbox['user'] . ": " . imap_last_error() . "\n";
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
            $date    = isset($overview[0]->date) ? $overview[0]->date : date('Y-m-d H:i:s');

            $bodySnippet = getCleanEmailBody($inbox, $emailId);

            $embedData = [
                'username' => 'Mail Notifier',
                'embeds' => [
                    [
                        'title' => $mailbox['title'],
                        'color' => $mailbox['color'],
                        'fields' => [
                            ['name' => 'To Inbox', 'value' => '`' . $mailbox['user'] . '`', 'inline' => false],
                            ['name' => 'From', 'value' => '`' . $from . '`', 'inline' => false],
                            ['name' => 'Subject', 'value' => '**' . $subject . '**', 'inline' => false],
                            ['name' => 'Preview', 'value' => $bodySnippet, 'inline' => false]
                        ],
                        'footer' => ['text' => 'Received • ' . $date]
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

            imap_setflag_full($inbox, $emailId, '\\Seen');
        }
    }
    imap_close($inbox);
}
?>
