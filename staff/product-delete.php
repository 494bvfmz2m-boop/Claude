<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_products');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? '';
    $product = Content::find('products', $id);
    if ($product) {
        delete_uploaded_file($product['icon'] ?? null);
        Content::delete('products', $id);
    }
}
header('Location: /staff/products');
exit;
