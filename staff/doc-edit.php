<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_docs');

$editId = $_GET['id'] ?? null;
$existing = $editId ? Content::find('docs', $editId) : null;

$navPage = 'docs';
$pageTitle = $existing ? 'Edit page' : 'New page';
$error = null;

$existingCategories = array_values(array_unique(array_filter(array_map(
    fn($p) => $p['category'] ?? '',
    xs_docs_all()
))));
sort($existingCategories);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $title = trim($_POST['title'] ?? '');
        $category = trim($_POST['category'] ?? '') ?: 'General';
        $categoryOrder = (int) ($_POST['category_order'] ?? 0);
        $sortOrder = (int) ($_POST['sort_order'] ?? 0);
        $excerpt = trim($_POST['excerpt'] ?? '');
        $body = trim($_POST['body'] ?? '');
        $published = isset($_POST['published']);
        $id = $_POST['id'] ?? null;

        if ($title === '' || $body === '') {
            $error = 'Title and content are required.';
        } else {
            $allDocs = xs_docs_all();

            if (!$id) {
                $slug = unique_slug(slugify($title), $allDocs);
                Content::insert('docs', [
                    'slug' => $slug,
                    'title' => $title,
                    'category' => $category,
                    'category_order' => $categoryOrder,
                    'sort_order' => $sortOrder,
                    'excerpt' => $excerpt,
                    'body' => $body,
                    'published' => $published,
                    'author_id' => $currentStaffUser['id'],
                    'author_name' => $currentStaffUser['name'] ?: $currentStaffUser['username'],
                ]);
            } else {
                Content::update('docs', $id, [
                    'title' => $title,
                    'category' => $category,
                    'category_order' => $categoryOrder,
                    'sort_order' => $sortOrder,
                    'excerpt' => $excerpt,
                    'body' => $body,
                    'published' => $published,
                ]);
            }
            header('Location: /staff/docs');
            exit;
        }
    }
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1><?php echo $existing ? 'Edit page' : 'New page'; ?></h1>
        <p>Supports headings, **bold**, *italic*, `code`, ``` code blocks ```, lists, &gt; quotes, and [links](https://...).</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

<div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start;">
    <form class="staff-form" method="post" id="doc-form">
        <?php csrf_field(); ?>
        <?php if ($existing): ?><input type="hidden" name="id" value="<?php echo e($existing['id']); ?>"><?php endif; ?>

        <div class="field">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" required maxlength="160" value="<?php echo e($_POST['title'] ?? $existing['title'] ?? ''); ?>">
            <?php if ($existing): ?><div class="field--hint">/docs/<?php echo e($existing['slug'] ?? ''); ?> &mdash; the URL doesn't change when you rename a page.</div><?php endif; ?>
        </div>
        <div class="field">
            <label for="excerpt">Short description</label>
            <input type="text" id="excerpt" name="excerpt" maxlength="220" value="<?php echo e($_POST['excerpt'] ?? $existing['excerpt'] ?? ''); ?>">
            <div class="field--hint">Shown under the title in the sidebar and search.</div>
        </div>
        <div class="field">
            <label for="body">Content</label>
            <textarea id="body" name="body" required class="doc-editor" style="min-height:420px;"><?php echo e($_POST['body'] ?? $existing['body'] ?? ''); ?></textarea>
        </div>

        <div class="btn-row">
            <button type="submit" class="btn btn--primary"><?php echo $existing ? 'Save changes' : 'Create page'; ?></button>
            <a href="/staff/docs" class="btn btn--ghost">Cancel</a>
        </div>
    </form>

    <div class="staff-card">
        <h2 style="font-size:15px;margin-bottom:16px;">Organize</h2>
        <div class="field">
            <label for="category">Category</label>
            <input type="text" id="category" name="category" form="doc-form" list="doc-categories" maxlength="80"
                value="<?php echo e($_POST['category'] ?? $existing['category'] ?? 'General'); ?>">
            <datalist id="doc-categories">
                <?php foreach ($existingCategories as $cat): ?><option value="<?php echo e($cat); ?>"><?php endforeach; ?>
            </datalist>
            <div class="field--hint">Groups pages in the sidebar. Reuse an existing name to add to that group.</div>
        </div>
        <div class="field">
            <label for="category_order">Category order</label>
            <input type="number" id="category_order" name="category_order" form="doc-form"
                value="<?php echo e($_POST['category_order'] ?? $existing['category_order'] ?? 0); ?>">
            <div class="field--hint">Lower numbers show first. Give every page in a category the same number.</div>
        </div>
        <div class="field">
            <label for="sort_order">Page order</label>
            <input type="number" id="sort_order" name="sort_order" form="doc-form"
                value="<?php echo e($_POST['sort_order'] ?? $existing['sort_order'] ?? 0); ?>">
            <div class="field--hint">Order within the category. Lower shows first.</div>
        </div>
        <div class="field" style="display:flex;align-items:center;gap:8px;margin-bottom:0;">
            <input type="checkbox" id="published" name="published" form="doc-form" style="width:auto;" <?php echo !empty($_POST['published']) || !empty($existing['published']) || !$existing ? 'checked' : ''; ?>>
            <label for="published" style="margin:0;">Published (visible at /docs)</label>
        </div>
    </div>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>
