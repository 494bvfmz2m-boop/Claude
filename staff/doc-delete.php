<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_docs');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    if (Content::find('docs', $id)) {
        Content::delete('docs', $id);
    }
}
header('Location: /staff/docs');
exit;
