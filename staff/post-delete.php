<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_posts');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    $post = Content::find('posts', $id);
    if ($post) {
        delete_uploaded_file($post['cover'] ?? null);
        Content::delete('posts', $id);
    }
}
header('Location: /staff/posts');
exit;
