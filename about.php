<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'about';
$pageTitle = 'About';
$pageDescription = 'The studio behind XyphrosPortal and what we\'re trying to build.';

$settings = get_settings();
$team = get_team();

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">About the studio</span>
        <h1><?php echo highlight_last_word($settings['about_intro_heading']); ?></h1>
        <p class="lede lede--center"><?php echo e($settings['about_intro_text']); ?></p>
    </div>
</section>

<section class="section section--border-top section--glow-l">
    <div class="container two-col">
        <div>
            <span class="eyebrow">Why we exist</span>
            <h2 style="font-size:28px;"><?php echo e($settings['why_heading']); ?></h2>
            <?php echo render_paragraphs($settings['why_text']); ?>
        </div>
        <div>
            <span class="eyebrow">How we work</span>
            <h2 style="font-size:28px;"><?php echo e($settings['how_heading']); ?></h2>
            <?php echo render_paragraphs($settings['how_text']); ?>
            <p><a href="/contact" style="color:var(--magenta); font-weight:700;">Get in touch</a> any time.</p>
        </div>
    </div>
</section>

<?php if (!empty($team)): ?>
<section class="section section--border-top section--tint">
    <div class="container">
        <span class="eyebrow">The team</span>
        <h2 style="font-size:28px; margin-bottom:36px;">Who's behind this</h2>
        <div class="grid grid--3">
            <?php foreach ($team as $member): ?>
                <div class="card team-card">
                    <div class="team-card__avatar">
                        <?php if (!empty($member['photo'])): ?>
                            <img src="<?php echo e($member['photo']); ?>" alt="">
                        <?php else: ?>
                            <?php echo e($member['initials']); ?>
                        <?php endif; ?>
                    </div>
                    <h3><?php echo e($member['name']); ?></h3>
                    <div class="role"><?php echo e($member['role']); ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
