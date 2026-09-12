<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_orders');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    if ($id && Content::find('shop_orders', $id)) {
        Content::delete('shop_orders', $id);
        AuditLog::log(
            $currentStaffUser['id'],
            $currentStaffUser['name'] ?: $currentStaffUser['email'],
            'order.delete',
            $id,
            'Order',
            'Deleted order ' . $id
        );
    }
}

$status = $_POST['status'] ?? '';
header('Location: /staff/orders' . ($status !== '' ? '?status=' . rawurlencode($status) : ''));
exit;
