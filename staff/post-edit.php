<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_posts');

$editId = $_GET['id'] ?? null;
$existing = $editId ? Content::find('posts', $editId) : null;

$navPage = 'posts';
$pageTitle = $existing ? 'Edit post' : 'New post';
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $title = trim($_POST['title'] ?? '');
        $excerpt = trim($_POST['excerpt'] ?? '');
        $body = trim($_POST['body'] ?? '');
        $published = isset($_POST['published']);
        $id = $_POST['id'] ?? null;

        if ($title === '' || $body === '') {
            $error = 'Title and body are required.';
        } else {
            try {
                $cover = handle_image_upload('cover', UPLOADS_DIR . '/posts', SITE_URL . UPLOADS_URL . '/posts');
            } catch (RuntimeException $ex) {
                $error = $ex->getMessage();
                $cover = null;
            }

            if (!$error) {
                $allPosts = Content::all('posts');

                if (!$id) {
                    $slug = unique_slug(slugify($title), $allPosts);
                    Content::insert('posts', [
                        'slug' => $slug,
                        'title' => $title,
                        'excerpt' => $excerpt,
                        'body' => $body,
                        'cover' => $cover,
                        'published' => $published,
                        'author_id' => $currentStaffUser['id'],
                        'author_name' => $currentStaffUser['name'] ?: $currentStaffUser['username'],
                    ]);
                } else {
                    $updates = ['title' => $title, 'excerpt' => $excerpt, 'body' => $body, 'published' => $published];
                    if ($cover) {
                        delete_uploaded_file($existing['cover'] ?? null);
                        $updates['cover'] = $cover;
                    }
                    Content::update('posts', $id, $updates);
                }
                header('Location: /staff/posts');
                exit;
            }
        }
    }
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1><?php echo $existing ? 'Edit post' : 'New post'; ?></h1>
        <p>Plain text only &mdash; leave a blank line between paragraphs.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

<form class="staff-form" method="post" enctype="multipart/form-data">
    <?php csrf_field(); ?>
    <?php if ($existing): ?><input type="hidden" name="id" value="<?php echo e($existing['id']); ?>"><?php endif; ?>

    <div class="field">
        <label for="title">Title</label>
        <input type="text" id="title" name="title" required maxlength="160" value="<?php echo e($_POST['title'] ?? $existing['title'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="excerpt">Excerpt</label>
        <input type="text" id="excerpt" name="excerpt" maxlength="220" value="<?php echo e($_POST['excerpt'] ?? $existing['excerpt'] ?? ''); ?>">
        <div class="field--hint">Shown on post cards and link previews.</div>
    </div>
    <div class="field">
        <label for="body">Body</label>
        <textarea id="body" name="body" required style="min-height:260px;"><?php echo e($_POST['body'] ?? $existing['body'] ?? ''); ?></textarea>
    </div>
    <div class="field">
        <label for="cover">Cover image</label>
        <?php if (!empty($existing['cover'])): ?>
            <div class="current-image">
                <img src="<?php echo e($existing['cover']); ?>" alt="">
                <span class="field--hint">Current cover &mdash; upload a new file to replace it.</span>
            </div>
        <?php endif; ?>
        <input type="file" id="cover" name="cover" accept=".jpg,.jpeg,.png,.gif,.webp">
    </div>
    <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="published" name="published" style="width:auto;" <?php echo !empty($_POST['published']) || !empty($existing['published']) ? 'checked' : ''; ?>>
        <label for="published" style="margin:0;">Published (visible on the site)</label>
    </div>

    <div class="btn-row">
        <button type="submit" class="btn btn--primary"><?php echo $existing ? 'Save changes' : 'Create post'; ?></button>
        <a href="/staff/posts" class="btn btn--ghost">Cancel</a>
    </div>
</form>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>
