<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_settings');

$navPage = 'settings';
$pageTitle = 'Page content';
$error = null;
$success = null;
if ($flash = get_flash()) {
    if ($flash['type'] === 'error') $error = $flash['message']; else $success = $flash['message'];
}

$groups = [
    ['title' => 'Homepage', 'note' => 'The big intro section visitors see first at /', 'preview_url' => 'https://xyphros.net/',
        'fields' => [
            'tagline' => ['label' => 'Site tagline', 'hint' => 'Used in the browser tab description and the footer blurb.', 'type' => 'text'],
            'hero_headline' => ['label' => 'Headline', 'hint' => 'The last word is automatically highlighted in gradient.', 'type' => 'text'],
            'hero_subtext' => ['label' => 'Subtext', 'hint' => 'The paragraph under the headline.', 'type' => 'textarea'],
        ]],
    ['title' => 'About page', 'note' => 'The intro and the two text blocks at /about', 'preview_url' => 'https://xyphros.net/about',
        'fields' => [
            'about_intro_heading' => ['label' => 'Intro heading', 'type' => 'text'],
            'about_intro_text' => ['label' => 'Intro text', 'type' => 'textarea'],
            'why_heading' => ['label' => 'Left column heading', 'type' => 'text'],
            'why_text' => ['label' => 'Left column text', 'hint' => 'Leave a blank line between paragraphs.', 'type' => 'textarea'],
            'how_heading' => ['label' => 'Right column heading', 'type' => 'text'],
            'how_text' => ['label' => 'Right column text', 'type' => 'textarea'],
        ]],
    ['title' => 'Contact page', 'note' => 'The contact form and the "Direct lines" box at /contact', 'preview_url' => 'https://xyphros.net/contact',
        'fields' => [
            'contact_email' => ['label' => 'Public contact email', 'type' => 'text'],
            'product_support_heading' => ['label' => 'Support box heading', 'type' => 'text'],
            'product_support_text' => ['label' => 'Support box text', 'type' => 'textarea'],
        ]],
];

$fields = [];
foreach ($groups as $group) $fields += $group['fields'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $current = get_settings();
        foreach ($fields as $key => $meta) {
            $current[$key] = trim($_POST[$key] ?? $current[$key]);
        }
        if ($current['contact_email'] !== '' && !filter_var($current['contact_email'], FILTER_VALIDATE_EMAIL)) {
            $error = "That contact email doesn't look valid.";
        } else {
            Content::put('settings', $current);
            redirect_with_flash('/staff/settings', 'success', 'Saved. Changes are live immediately.');
        }
    }
}

$settings = get_settings();
require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Page content</h1>
        <p>Edit the text shown on the Home, About, and Contact pages.</p>
    </div>
</div>

<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

<form class="staff-form" method="post" style="max-width:720px;">
    <?php csrf_field(); ?>
    <?php foreach ($groups as $group): ?>
        <div class="staff-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div style="display:flex;gap:12px;align-items:flex-start;">
                    <div class="staff-card__icon" style="margin-top:2px;"><?php echo xs_icon('sliders', 18); ?></div>
                    <div><h3 style="margin-bottom:2px;"><?php echo e($group['title']); ?></h3><p style="color:var(--text-muted);font-size:13px;margin:0;"><?php echo e($group['note']); ?></p></div>
                </div>
                <a href="<?php echo e($group['preview_url']); ?>" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">View page &rarr;</a>
            </div>
            <?php foreach ($group['fields'] as $key => $meta): ?>
                <div class="field">
                    <label for="<?php echo e($key); ?>"><?php echo e($meta['label']); ?></label>
                    <?php if ($meta['type'] === 'textarea'): ?>
                        <textarea id="<?php echo e($key); ?>" name="<?php echo e($key); ?>" style="min-height:120px;"><?php echo e($_POST[$key] ?? $settings[$key]); ?></textarea>
                    <?php else: ?>
                        <input type="text" id="<?php echo e($key); ?>" name="<?php echo e($key); ?>" value="<?php echo e($_POST[$key] ?? $settings[$key]); ?>">
                    <?php endif; ?>
                    <?php if (!empty($meta['hint'])): ?><div class="field--hint"><?php echo e($meta['hint']); ?></div><?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endforeach; ?>
    <div class="btn-row"><button type="submit" class="btn btn--primary">Save changes</button></div>
</form>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>
