<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_licenses');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    if ($id) {
        $deleted = License::delete($id);
        if ($deleted) {
            AuditLog::log(
                $currentStaffUser['id'],
                $currentStaffUser['name'] ?: $currentStaffUser['email'],
                'license.delete',
                $id,
                'License key',
                'Deleted license key ' . $id
            );
        }
    }
}

$showAll = isset($_POST['all']);
header('Location: /staff/licenses' . ($showAll ? '?all=1' : ''));
exit;
