<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_team');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    $member = Content::find('team', $id);
    if ($member) {
        delete_uploaded_file($member['photo'] ?? null);
        Content::delete('team', $id);
    }
}
header('Location: /staff/team');
exit;
