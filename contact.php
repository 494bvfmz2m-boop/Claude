<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'contact';
$pageTitle = 'Contact';
$pageDescription = 'Get in touch with Xyphros Studios.';

$sent = isset($_GET['sent']);
$error = $_GET['error'] ?? null;
$settings = get_settings();
$contactEmail = $settings['contact_email'];

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Let's talk</span>
        <h1>Get in touch</h1>
        <p class="lede lede--center">Questions, feedback, or a project you want to talk through &mdash; we read every message.</p>
    </div>
</section>

<section class="section section--glow-r">
    <div class="container two-col">
        <div>
            <?php if ($sent): ?>
                <div class="alert alert--success">Thanks &mdash; your message is in. We'll get back to you soon.</div>
            <?php elseif ($error): ?>
                <div class="alert alert--error"><?php echo e($error); ?></div>
            <?php endif; ?>

            <form action="/contact-handler" method="post" novalidate>
                <?php csrf_field(); ?>
                <input type="text" name="company" class="hp-field" tabindex="-1" autocomplete="off">

                <div class="field">
                    <label for="name">Name</label>
                    <input type="text" id="name" name="name" required maxlength="120">
                </div>
                <div class="field">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required maxlength="160">
                </div>
                <div class="field">
                    <label for="subject">Subject</label>
                    <input type="text" id="subject" name="subject" required maxlength="160">
                </div>
                <div class="field">
                    <label for="message">Message</label>
                    <textarea id="message" name="message" required maxlength="4000"></textarea>
                </div>
                <button type="submit" class="btn btn--primary btn--block">Send message</button>
            </form>
        </div>

        <div>
            <span class="eyebrow">Other ways to reach us</span>
            <h2 style="font-size:24px;">Direct lines</h2>
            <div class="contact-methods">
                <div class="contact-method">
                    <div class="contact-method__icon">@</div>
                    <div>
                        <strong style="display:block; margin-bottom:2px;">Email</strong>
                        <a href="mailto:<?php echo e($contactEmail); ?>" style="color:var(--text-muted);"><?php echo e($contactEmail); ?></a>
                    </div>
                </div>
                <div class="contact-method">
                    <div class="contact-method__icon">&#9881;</div>
                    <div>
                        <strong style="display:block; margin-bottom:2px;"><?php echo e($settings['product_support_heading']); ?></strong>
                        <span style="color:var(--text-muted);"><?php echo e($settings['product_support_text']); ?></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
