<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_posts');
$me = current_user();

$error = null;
$editingPost = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        db_execute("DELETE FROM posts WHERE id = ?", [$id]);
        redirect(SITE_URL . '/admin/posts');
    }

    if ($action === 'save') {
        $title = trim($_POST['title'] ?? '');
        $content = trim($_POST['content'] ?? '');
        $type = in_array($_POST['type'] ?? '', ['announcement', 'post'], true) ? $_POST['type'] : 'post';
        $id = (int)($_POST['id'] ?? 0);

        if ($title === '' || $content === '') {
            $error = 'Title and content are required.';
        } else {
            if ($id > 0) {
                db_execute(
                    "UPDATE posts SET title = ?, content = ?, type = ? WHERE id = ?",
                    [$title, $content, $type, $id]
                );
            } else {
                db_execute(
                    "INSERT INTO posts (title, content, type, author_id, author_name) VALUES (?, ?, ?, ?, ?)",
                    [$title, $content, $type, $me['id'], $me['username']]
                );
            }
            redirect(SITE_URL . '/admin/posts');
        }
    }
}

if (isset($_GET['edit'])) {
    $editingPost = find_post_by_id((int)$_GET['edit']);
}

$pageTitle = 'Manage Posts';
$activeAdminPage = 'posts';
require_once __DIR__ . '/../includes/header.php';

$posts = get_posts();
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1><?= $editingPost ? 'Edit post' : 'Posts &amp; announcements' ?></h1>

    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save">
        <?php if ($editingPost): ?><input type="hidden" name="id" value="<?= (int)$editingPost['id'] ?>"><?php endif; ?>
        <div class="field">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required value="<?= e($editingPost['title'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="type">Type</label>
          <select id="type" name="type">
            <option value="announcement" <?= (($editingPost['type'] ?? '') === 'announcement') ? 'selected' : '' ?>>Announcement</option>
            <option value="post" <?= (($editingPost['type'] ?? 'post') === 'post') ? 'selected' : '' ?>>Post</option>
          </select>
        </div>
        <div class="field">
          <label for="content">Content</label>
          <textarea id="content" name="content" required rows="8"><?= e($editingPost['content'] ?? '') ?></textarea>
        </div>
        <button type="submit" class="btn btn-primary"><?= $editingPost ? 'Save changes' : 'Publish' ?></button>
        <?php if ($editingPost): ?><a href="<?= SITE_URL ?>/admin/posts" class="btn btn-outline">Cancel</a><?php endif; ?>
      </form>
    </div>

    <h2 style="margin-top:36px;">All posts</h2>
    <table>
      <tr><th>Title</th><th>Type</th><th>Author</th><th>Posted</th><th></th></tr>
      <?php foreach ($posts as $p): ?>
        <tr>
          <td><a href="<?= SITE_URL ?>/post?id=<?= (int)$p['id'] ?>" target="_blank"><?= e($p['title']) ?></a></td>
          <td><?= e($p['type'] ?? 'post') ?></td>
          <td><?= author_badge_html($p['author_id'] ?? null, $p['author_name']) ?></td>
          <td class="muted"><?= e(time_ago($p['created_at'])) ?></td>
          <td>
            <a href="<?= SITE_URL ?>/admin/posts?edit=<?= (int)$p['id'] ?>" class="btn btn-outline btn-sm">Edit</a>
            <form method="post" class="inline-form" data-confirm="Delete this post?">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
              <button type="submit" class="btn btn-danger btn-sm">Delete</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (empty($posts)): ?><tr><td colspan="5" class="muted">No posts yet.</td></tr><?php endif; ?>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
