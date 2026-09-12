<?php
require_once __DIR__ . '/includes/bootstrap.php';

$me = current_user();
$error = null;
$success = false;
$ticketLink = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $subject = trim($_POST['subject'] ?? '');
    $message = trim($_POST['message'] ?? '');
    $guestName = trim($_POST['guest_name'] ?? '');
    $guestEmail = trim($_POST['guest_email'] ?? '');

    $submittedName = $me ? $me['username'] : $guestName;
    $ip = client_ip();

    if (!empty($_POST['website'])) {
        // Honeypot field — invisible to real visitors, bots fill in every field.
        // Pretend it worked so bots don't learn to leave it blank; nothing is inserted.
        $success = true;
    } elseif (rate_limit_exceeded('ticket_create', $ip, 10, 3600)) {
        $error = 'Too many tickets submitted from your network recently. Please try again later.';
    } elseif ($subject === '' || $message === '') {
        $error = 'Please fill in both the subject and your message.';
    } elseif (!$me && $submittedName === '') {
        $error = 'Please enter your name.';
    } elseif (!$me && !filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
        $error = "Please enter a valid email — that's how you'll get back to this ticket and see replies.";
    } elseif (!$me && strlen($submittedName) > 64) {
        $error = 'Name must be 64 characters or fewer.';
    } elseif (strlen($subject) > 200) {
        $error = 'Subject must be 200 characters or fewer.';
    } else {
        rate_limit_record('ticket_create', $ip);
        $token = generate_ticket_token();
        db_execute(
            "INSERT INTO tickets (user_id, submitted_name, subject, message, guest_email, access_token) VALUES (?, ?, ?, ?, ?, ?)",
            [$me ? $me['id'] : null, $submittedName, $subject, $message, $me ? null : $guestEmail, $token]
        );
        $ticketId = db_last_insert_id();

        if (!$me) {
            $ticketLink = SITE_URL . '/ticket?id=' . $ticketId . '&token=' . $token;
            send_ticket_created_email($guestEmail, $subject, $ticketLink);
        } else {
            $ticketLink = SITE_URL . '/ticket?id=' . $ticketId;
        }

        $success = true;
    }
}

// Logged-in members can see their own ticket history right here.
$myTickets = [];
if ($me) {
    $myTickets = db_query("SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC", [$me['id']]);
}

$pageTitle = 'Support';
$pageDescription = 'Got an issue or a question for the team? Send us a support ticket.';
require_once __DIR__ . '/includes/header.php';
?>
<section class="section">
  <div class="wrap" style="max-width: 640px;">
    <div class="section-head">
      <h2>🎫 Support</h2>
      <p>Got an issue or a question for the team? Send us a ticket.</p>
    </div>

    <?php if ($success): ?>
      <div class="card">
        <div class="alert alert-success" style="margin-bottom:12px;">Ticket sent! The team will get back to you.</div>
        <?php if ($me): ?>
          <p class="muted">You can find this ticket any time under "Your past tickets" below, or go straight to it:</p>
        <?php else: ?>
          <p class="muted">We also emailed you this link — bookmark it or save the email, since it's the only way to get back to this ticket without an account:</p>
        <?php endif; ?>
        <?php if ($ticketLink): ?>
          <div class="ticket-guest-link"><a href="<?= e($ticketLink) ?>"><?= e($ticketLink) ?></a></div>
        <?php endif; ?>
      </div>
    <?php else: ?>
      <div class="card">
        <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
        <form method="post" novalidate>
          <?= csrf_field() ?>
          <div class="hp-field" aria-hidden="true"><label for="website">Leave this field blank</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></div>

          <?php if ($me): ?>
            <div class="field">
              <label>Submitting as</label>
              <input type="text" value="<?= e($me['username']) ?>" disabled>
              <div class="hint">You're logged in, so this ticket will be linked to your account automatically.</div>
            </div>
          <?php else: ?>
            <div class="field">
              <label for="guest_name">Your name</label>
              <input type="text" id="guest_name" name="guest_name" required maxlength="64" value="<?= e($_POST['guest_name'] ?? '') ?>" placeholder="What should we call you?">
            </div>
            <div class="field">
              <label for="guest_email">Your email</label>
              <input type="email" id="guest_email" name="guest_email" required value="<?= e($_POST['guest_email'] ?? '') ?>" placeholder="so we can send you a link back to this ticket">
              <div class="hint"><a href="<?= SITE_URL ?>/login">Log in</a> first if you'd rather this be linked to your account instead.</div>
            </div>
          <?php endif; ?>

          <div class="field">
            <label for="subject">Subject</label>
            <input type="text" id="subject" name="subject" required maxlength="200" value="<?= e($_POST['subject'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="message">Message</label>
            <textarea id="message" name="message" required rows="6"><?= e($_POST['message'] ?? '') ?></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Send ticket</button>
        </form>
      </div>
    <?php endif; ?>

    <?php if ($me && !empty($myTickets)): ?>
      <h2 style="margin-top:36px;">Your past tickets</h2>
      <div class="user-list">
        <?php foreach ($myTickets as $t): ?>
          <a href="<?= SITE_URL ?>/ticket?id=<?= (int)$t['id'] ?>" class="user-row" style="text-decoration:none;">
            <div class="user-row-info">
              <span class="post-type-tag<?= $t['status'] === 'open' ? ' announcement' : '' ?>"><?= e($t['status']) ?></span>
              <strong style="color:var(--text);"><?= e($t['subject']) ?></strong>
              <span class="muted user-row-email">· <?= e(time_ago($t['created_at'])) ?></span>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
