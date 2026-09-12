<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('send_email');

$navPage = 'email';
$pageTitle = 'Email';
$error = $_GET['error'] ?? null;
$sent = isset($_GET['sent']);

$accounts = [
    'contact' => ['label' => 'Contact', 'email' => CONTACT_FROM_EMAIL],
    'noreply' => ['label' => 'No-reply', 'email' => SMTP_FROM_EMAIL],
];

$prefillTo = $_GET['to'] ?? '';
$prefillSubject = $_GET['subject'] ?? '';

$sentLog = Content::all('sent_emails', 'created_at', 'DESC');

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Email</h1>
        <p>Send a one-off email from the studio's mailboxes.</p>
    </div>
</div>

<?php if ($sent): ?><div class="alert alert--success">Sent.</div><?php endif; ?>
<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

<form class="staff-form" method="post" action="/staff/email-send" style="max-width:640px;">
    <?php csrf_field(); ?>

    <div class="field">
        <label for="from">From</label>
        <select id="from" name="from">
            <?php foreach ($accounts as $key => $acc): ?>
                <option value="<?php echo e($key); ?>" <?php echo $key === 'contact' ? 'selected' : ''; ?>><?php echo e($acc['label']); ?> &lt;<?php echo e($acc['email']); ?>&gt;</option>
            <?php endforeach; ?>
        </select>
        <div class="field--hint">Contact is the everyday sending address. No-reply is the same one used for verification codes: only use it if you don't want a reply.</div>
    </div>
    <div class="field"><label for="to">To</label><input type="email" id="to" name="to" required value="<?php echo e($prefillTo); ?>"></div>
    <div class="field"><label for="subject">Subject</label><input type="text" id="subject" name="subject" required value="<?php echo e($prefillSubject); ?>"></div>
    <div class="field"><label for="body">Message</label><textarea id="body" name="body" style="min-height:200px;" required></textarea></div>

    <div class="btn-row"><button type="submit" class="btn btn--primary">Send email</button></div>
</form>

<div style="max-width:640px;margin-top:32px;">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('clock', 18); ?></div>
        <h3 style="margin-bottom:0;">Recently sent</h3>
    </div>
    <?php if (empty($sentLog)): ?>
        <p style="color:var(--text-faint);font-size:13px;">Nothing sent yet.</p>
    <?php else: ?>
        <?php foreach (array_slice($sentLog, 0, 20) as $entry): ?>
            <div class="staff-card" style="padding:14px 18px;">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <strong style="font-size:13.5px;"><?php echo e($entry['subject']); ?></strong>
                    <span style="color:var(--text-faint);font-size:12px;"><?php echo e(format_date($entry['created_at'] ?? '')); ?></span>
                </div>
                <div style="color:var(--text-faint);font-size:12px;margin-top:3px;">To <?php echo e($entry['to']); ?> &middot; from <?php echo e($entry['from_email']); ?></div>
            </div>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>
