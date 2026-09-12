<?php
require_once __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Staff';
$pageDescription = 'Meet the team keeping the server running.';
require_once __DIR__ . '/includes/header.php';

$staffList = get_staff_list();
?>
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2>🦥 Staff</h2>
      <p>The team keeping the server running</p>
    </div>

    <?php if (empty($staffList)): ?>
      <p class="muted" style="text-align:center;">No staff roles are set up yet.</p>
    <?php else: ?>
      <div class="card">
        <div class="staff-list">
          <?php foreach ($staffList as $entry): ?>
            <div class="staff-row" data-reveal>
              <?php if ($entry['role']): ?>
                <span class="role-pill" style="<?= role_pill_style($entry['role']) ?>"><?= e($entry['role']['name']) ?></span>
              <?php else: ?>
                <span class="role-pill" style="color:var(--gold); background:var(--gold-soft); border-color:rgba(242,169,30,.45);">👑 Super Op</span>
              <?php endif; ?>
              <span class="staff-row-name"><?= e($entry['user']['username']) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
