<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

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
        'title' => '🛠️ New Support Ticket',
        'color' => 15548997
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

    // Keep it tight so it doesn't spam the channel
    $bodySnippet = mb_substr($cleanBody, 0, 250);
    if (mb_strlen($cleanBody) > 250) {
        $bodySnippet .= '...';
    }
    return empty($bodySnippet) ? '*[No text content]*' : $bodySnippet;
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
            $date    = isset($overview[0]->date) ? $overview[0]->date : date('Y-m-d H:i:s');

            $bodySnippet = getCleanEmailBody($inbox, $emailId);

            // Using description for the body and inline fields for metadata
            $embedData = [
                'username' => 'Mail Notifier',
                'embeds' => [
                    [
                        'title'       => $mailbox['title'] . ': ' . $subject,
                        'description' => "> " . str_replace("\n", "\n> ", $bodySnippet), // Blockquote format for preview
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

            imap_setflag_full($inbox, $emailId, '\\Seen');
        }
    }
    imap_close($inbox);
}

exit(0);
?>
