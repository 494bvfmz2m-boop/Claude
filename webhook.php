<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$discordWebhookUrl = getenv('DISCORD_WEBHOOK_URL');

// Read the incoming JSON payload from Coolify
$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true);

if (!$data) {
    http_response_code(400);
    exit('Invalid payload');
}

// Coolify sends different event structures; extract what we need safely
$event = $data['event'] ?? 'unknown_event';
$appName = $data['application_name'] ?? $data['name'] ?? 'Xyphros Service';
$status = $data['status'] ?? 'triggered';

$title = '📦 Coolify Event';
$color = 3447003; // Default blue
$description = "An event occurred on Coolify.";

// Customize based on Coolify's event types
if (strpos($event, 'deployment.success') !== false || $status === 'success') {
    $title = '✅ Deployment Successful';
    $color = 5763719; // Green
    $description = "The application **{$appName}** has successfully deployed and is now live.";
} elseif (strpos($event, 'deployment.failed') !== false || $status === 'failed') {
    $title = '❌ Deployment Failed';
    $color = 15548997; // Red
    $description = "An error occurred while deploying **{$appName}**. Check Coolify logs for details.";
} elseif (strpos($event, 'update') !== false) {
    $title = '🔄 Coolify System Update';
    $color = 16776960; // Yellow
    $description = "A system update or notification is available for Coolify.";
}

$embedData = [
    'username' => 'Xyphros Ops',
    'embeds' => [
        [
            'title'       => $title,
            'description' => $description,
            'color'       => $color,
            'fields'      => [
                ['name' => 'Event Type', 'value' => '`' . $event . '`', 'inline' => true],
                ['name' => 'Service', 'value' => '`' . $appName . '`', 'inline' => true]
            ],
            'footer'      => ['text' => 'Coolify Webhook • ' . date('Y-m-d H:i:s')]
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

http_response_code(200);
echo "Webhook processed successfully.";
?>
