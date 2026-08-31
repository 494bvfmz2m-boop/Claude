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
            $rawBody    = imap_body($inbox, $emailId, FT_PEEK);

            $subject = isset($headerInfo->subject) ? mb_decode_mimeheader($headerInfo->subject) : 'No Subject';
            $from    = isset($headerInfo->fromaddress) ? mb_decode_mimeheader($headerInfo->fromaddress) : 'Unknown Sender';
            $date    = isset($overview[0]->date) ? $overview[0]->date : date('Y-m-d H:i:s');

            $cleanBody = trim(strip_tags($rawBody));
            $bodySnippet = mb_substr($cleanBody, 0, 450);
            if (mb_strlen($cleanBody) > 450) { $bodySnippet .= '...'; }

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