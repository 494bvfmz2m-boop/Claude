<?php
require_once __DIR__ . '/mailer.php';

/**
 * Attempts to register a new user.
 * Returns ['ok' => bool, 'error' => string|null]
 */
function register_user($email, $username, $password, $passwordConfirm) {
    $email = trim($email);
    $username = trim($username);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'That email address doesn\'t look valid.'];
    }
    $usernameError = validate_username($username);
    if ($usernameError) {
        return ['ok' => false, 'error' => $usernameError];
    }
    if (strlen($password) < 8) {
        return ['ok' => false, 'error' => 'Password must be at least 8 characters.'];
    }
    if ($password !== $passwordConfirm) {
        return ['ok' => false, 'error' => 'Passwords do not match.'];
    }
    if (find_user_by_email($email)) {
        return ['ok' => false, 'error' => 'An account with that email already exists.'];
    }

    $token = bin2hex(random_bytes(32));

    try {
        db_execute(
            "INSERT INTO users (email, username, password_hash, verified, verify_token) VALUES (?, ?, ?, 0, ?)",
            [$email, $username, password_hash($password, PASSWORD_DEFAULT), $token]
        );
    } catch (PDOException $e) {
        // Race condition: someone else grabbed the same email/username between our check and this insert.
        return ['ok' => false, 'error' => 'That email or username was just taken. Please try again.'];
    }

    send_verification_email($email, $username, $token);

    return ['ok' => true, 'error' => null];
}

function verify_email_token($token) {
    if (empty($token)) return false;
    $row = db_query_one("SELECT id, verify_token FROM users WHERE verify_token = ?", [$token]);
    if (!$row || !hash_equals((string)$row['verify_token'], $token)) {
        return false;
    }
    db_execute("UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?", [$row['id']]);
    return true;
}

/**
 * Returns ['ok' => bool, 'error' => string|null, 'needs_2fa' => bool]
 * Accepts either an email address or a username in $identifier.
 * If the account has 2FA enabled, this does NOT log the person in yet — it
 * stores a pending state in the session and returns needs_2fa = true so the
 * caller can redirect to /two-factor. For email 2FA, the code is sent here.
 */
function login_user($identifier, $password) {
    $identifier = trim($identifier);
    $user = strpos($identifier, '@') !== false
        ? find_user_by_email($identifier)
        : find_user_by_username($identifier);

    // Constant-shape response so a failed attempt never reveals whether the account exists.
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return ['ok' => false, 'error' => 'Incorrect email/username or password.', 'needs_2fa' => false];
    }
    if (empty($user['verified'])) {
        return ['ok' => false, 'error' => 'Please verify your email before logging in. Check your inbox for the verification link.', 'needs_2fa' => false];
    }

    if (!empty($user['two_factor_method'])) {
        session_regenerate_id(true);
        $_SESSION['2fa_pending_uid'] = $user['id'];
        if ($user['two_factor_method'] === 'email') {
            send_two_factor_email_code($user);
        }
        return ['ok' => true, 'error' => null, 'needs_2fa' => true];
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    return ['ok' => true, 'error' => null, 'needs_2fa' => false];
}

/** Generates + sends a fresh 6-digit email 2FA code for a pending login, storing it in the session. */
function send_two_factor_email_code($user) {
    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $_SESSION['2fa_email_code'] = $code;
    $_SESSION['2fa_email_expires'] = time() + 600; // 10 minutes
    send_two_factor_email($user['email'], $code);
}

/**
 * Verifies the code entered on /two-factor for the pending login in session.
 * Returns ['ok' => bool, 'error' => string|null]. On success, completes login.
 */
function verify_two_factor_login($code) {
    if (empty($_SESSION['2fa_pending_uid'])) {
        return ['ok' => false, 'error' => 'Your login session expired. Please log in again.'];
    }
    $user = find_user_by_id($_SESSION['2fa_pending_uid']);
    if (!$user || empty($user['two_factor_method'])) {
        return ['ok' => false, 'error' => 'Something went wrong. Please log in again.'];
    }

    $valid = false;
    if ($user['two_factor_method'] === 'totp') {
        $valid = !empty($user['totp_secret']) && verify_totp_code($user['totp_secret'], $code);
    } elseif ($user['two_factor_method'] === 'email') {
        $codeFresh = !empty($_SESSION['2fa_email_expires']) && time() <= $_SESSION['2fa_email_expires'];
        $valid = $codeFresh && !empty($_SESSION['2fa_email_code']) && hash_equals((string)$_SESSION['2fa_email_code'], trim($code));
    }

    if (!$valid) {
        return ['ok' => false, 'error' => 'Incorrect or expired code. Please try again.'];
    }

    unset($_SESSION['2fa_pending_uid'], $_SESSION['2fa_email_code'], $_SESSION['2fa_email_expires']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    return ['ok' => true, 'error' => null];
}

/** Starts authenticator-app setup: generates and stores a new secret (not active until confirmed). */
function begin_totp_setup($userId) {
    $secret = generate_totp_secret();
    db_execute("UPDATE users SET totp_secret = ? WHERE id = ?", [$secret, $userId]);
    return $secret;
}

/** Confirms authenticator-app setup by checking one real code from the app, then turns 2FA on. */
function confirm_totp_setup($userId, $code) {
    $user = find_user_by_id($userId);
    if (!$user || empty($user['totp_secret'])) return false;
    if (!verify_totp_code($user['totp_secret'], $code)) return false;
    db_execute("UPDATE users SET two_factor_method = 'totp' WHERE id = ?", [$userId]);
    return true;
}

/** Turns on email-code 2FA immediately (no setup confirmation needed — it's just their existing account email). */
function enable_email_two_factor($userId) {
    db_execute("UPDATE users SET two_factor_method = 'email', totp_secret = NULL WHERE id = ?", [$userId]);
}

/** Turns off 2FA entirely and clears the stored secret. */
function disable_two_factor($userId) {
    db_execute("UPDATE users SET two_factor_method = NULL, totp_secret = NULL WHERE id = ?", [$userId]);
}

function logout_user() {
    $_SESSION = [];
    session_destroy();
}

/**
 * Renames a user's username. Returns ['ok' => bool, 'error' => string|null]
 */
function rename_user($userId, $newUsername) {
    $newUsername = trim($newUsername);
    $error = validate_username($newUsername, $userId);
    if ($error) {
        return ['ok' => false, 'error' => $error];
    }
    $affected = db_execute("UPDATE users SET username = ? WHERE id = ?", [$newUsername, (int)$userId]);
    if ($affected === 0 && !find_user_by_id($userId)) {
        return ['ok' => false, 'error' => 'Account not found.'];
    }
    return ['ok' => true, 'error' => null];
}

/**
 * Changes a logged-in user's password given their CURRENT password (as
 * opposed to reset_password_with_token(), which is for the forgot-password
 * email flow). Returns ['ok' => bool, 'error' => string|null]
 */
function change_password($userId, $currentPassword, $newPassword, $confirmPassword) {
    $user = find_user_by_id($userId);
    if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
        return ['ok' => false, 'error' => 'Current password is incorrect.'];
    }
    if (strlen($newPassword) < 8) {
        return ['ok' => false, 'error' => 'New password must be at least 8 characters.'];
    }
    if ($newPassword !== $confirmPassword) {
        return ['ok' => false, 'error' => 'New passwords do not match.'];
    }
    db_execute("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash($newPassword, PASSWORD_DEFAULT), $userId]);
    return ['ok' => true, 'error' => null];
}

/**
 * Sets (or clears, if blank) the Minecraft username attached to this
 * account, used to pre-fill the store checkout so returning members don't
 * have to retype it every time. Returns ['ok' => bool, 'error' => string|null]
 */
function set_account_minecraft_username($userId, $minecraftUsername) {
    $minecraftUsername = trim($minecraftUsername);
    if ($minecraftUsername !== '' && !is_valid_minecraft_username($minecraftUsername)) {
        return ['ok' => false, 'error' => 'That doesn\'t look like a valid Minecraft username (3-16 characters: letters, numbers, underscores — Bedrock players can leave the leading "." from Geyser).'];
    }
    db_execute("UPDATE users SET minecraft_username = ? WHERE id = ?", [$minecraftUsername !== '' ? $minecraftUsername : null, (int)$userId]);
    return ['ok' => true, 'error' => null];
}

/**
 * Starts a password reset for the given email, if an account exists for it.
 * Always call this and show the SAME message to the person regardless of the
 * return value — never reveal whether an email address has an account.
 */
function request_password_reset($email) {
    $user = find_user_by_email(trim($email));
    if (!$user) return false;

    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 3600); // 1 hour
    db_execute("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?", [$token, $expires, $user['id']]);
    send_password_reset_email($user['email'], $user['username'], $token);
    return true;
}

/** Looks up a user by a valid, unexpired reset token. Returns the user array or null. */
function find_user_by_reset_token($token) {
    if (empty($token)) return null;
    $row = db_query_one("SELECT id, reset_token, reset_expires FROM users WHERE reset_token = ?", [$token]);
    if (!$row || !hash_equals((string)$row['reset_token'], $token)) return null;
    if (empty($row['reset_expires']) || strtotime($row['reset_expires']) < time()) return null;
    return find_user_by_id($row['id']);
}

/**
 * Completes a password reset. Returns ['ok' => bool, 'error' => string|null]
 */
function reset_password_with_token($token, $newPassword, $confirmPassword) {
    $user = find_user_by_reset_token($token);
    if (!$user) {
        return ['ok' => false, 'error' => 'This reset link is invalid or has expired. Request a new one below.'];
    }
    if (strlen($newPassword) < 8) {
        return ['ok' => false, 'error' => 'Password must be at least 8 characters.'];
    }
    if ($newPassword !== $confirmPassword) {
        return ['ok' => false, 'error' => 'Passwords do not match.'];
    }
    db_execute(
        "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, verified = 1 WHERE id = ?",
        [password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]
    );
    return ['ok' => true, 'error' => null];
}
