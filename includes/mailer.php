<?php
/**
 * Very small mail wrapper built on PHP's native mail(). Most shared hosts
 * (cPanel, Pebble Host-adjacent hosts) have this working out of the box as
 * long as your domain's mail records are set up.
 *
 * If verification emails don't arrive, switch this to SMTP via PHPMailer —
 * see README.md for a drop-in snippet.
 */

function send_site_email($toEmail, $subject, $body) {
    $headers = [
        'From: ' . SITE_NAME . ' <' . SITE_EMAIL . '>',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    // mail() returns true if it was handed off to the MTA, not that it was delivered.
    return @mail($toEmail, $subject, $body, implode("\r\n", $headers));
}

function send_verification_email($toEmail, $username, $token) {
    $link = SITE_URL . '/verify?token=' . urlencode($token);
    $body = "Hey {$username},\n\n"
        . "Welcome to " . SITE_NAME . "! Click the link below to verify your email and activate your account:\n\n"
        . $link . "\n\n"
        . "If you didn't sign up, you can ignore this email.\n";
    return send_site_email($toEmail, 'Verify your ' . SITE_NAME . ' account', $body);
}

/** Sent to a guest right after they submit a ticket, so they have a link even if they close the tab. */
function send_ticket_created_email($toEmail, $subject, $ticketUrl) {
    $body = "Thanks for reaching out!\n\n"
        . "We've received your ticket \"{$subject}\". Bookmark this link to check for replies or add more details:\n\n"
        . $ticketUrl . "\n\n"
        . "The " . SITE_NAME . " team will get back to you soon.\n";
    return send_site_email($toEmail, 'Your ' . SITE_NAME . ' support ticket: ' . $subject, $body);
}

/** Sent when staff (or the other side) posts a new reply on a ticket. */
function send_ticket_reply_email($toEmail, $subject, $ticketUrl) {
    $body = "There's a new reply on your ticket \"{$subject}\":\n\n"
        . $ticketUrl . "\n\n"
        . "Reply on that page to keep the conversation going.\n";
    return send_site_email($toEmail, 'New reply on your ' . SITE_NAME . ' ticket: ' . $subject, $body);
}

/** Sent when someone requests a password reset. Link expires in 1 hour. */
function send_password_reset_email($toEmail, $username, $token) {
    $link = SITE_URL . '/reset-password?token=' . urlencode($token);
    $body = "Hey {$username},\n\n"
        . "Someone (hopefully you) asked to reset your " . SITE_NAME . " password. Click the link below to set a new one — it expires in 1 hour:\n\n"
        . $link . "\n\n"
        . "If you didn't request this, you can safely ignore this email — your password won't change.\n";
    return send_site_email($toEmail, 'Reset your ' . SITE_NAME . ' password', $body);
}

/** Sent with a login 2FA code. Expires in 10 minutes. */
function send_two_factor_email($toEmail, $code) {
    $body = "Your login code is:\n\n"
        . "    {$code}\n\n"
        . "It expires in 10 minutes. If you didn't just try to log in, you can ignore this — your account is still safe.\n";
    return send_site_email($toEmail, 'Your ' . SITE_NAME . ' login code: ' . $code, $body);
}
