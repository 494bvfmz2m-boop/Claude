<?php
$GLOBALS['page_title'] = 'Custom 3D print quote - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Upload your STL, STEP or 3MF model and get a quote with price and lead time.';

$errors = [];
$sent = false;
$allowed = ['stl', 'step', 'stp', '3mf', 'obj', 'zip'];
$materials = ['PLA', 'PETG', 'ABS', 'TPU'];
$maxBytes = 100 * 1024 * 1024;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim((string)($_POST['email'] ?? ''));
    $name  = trim((string)($_POST['full_name'] ?? ''));
    $material = trim((string)($_POST['material'] ?? 'PLA'));
    if (!in_array($material, $materials, true)) $material = 'PLA';
    $qty = max(1, (int)($_POST['quantity'] ?? 1));
    $details = trim((string)($_POST['details'] ?? ''));
    $stored = null; $original = null;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';

    if (!empty($_FILES['model']['name'])) {
        $f = $_FILES['model'];
        if ($f['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'The file could not be uploaded. It may be too large for your server.';
        } elseif ($f['size'] > $maxBytes) {
            $errors[] = 'Files must be 100 MB or smaller.';
        } else {
            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true)) {
                $errors[] = 'Accepted file types: ' . implode(', ', $allowed) . '.';
            } else {
                $dir = __DIR__ . '/../uploads/models';
                if (!is_dir($dir)) @mkdir($dir, 0755, true);
                $fileName = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
                if (move_uploaded_file($f['tmp_name'], $dir . '/' . $fileName)) {
                    $stored = 'uploads/models/' . $fileName;
                    $original = mb_substr($f['name'], 0, 190);
                } else {
                    $errors[] = 'Could not save the file. Check that the uploads folder is writable.';
                }
            }
        }
    }

    if (!$errors) {
        $u = current_user();
        q('INSERT INTO custom_requests (user_id, email, full_name, material, quantity, details, file_path, original_filename)
           VALUES (?,?,?,?,?,?,?,?)', [$u['id'] ?? null, $email, $name, $material, $qty, $details, $stored, $original]);
        $sent = true;
    }
}
?>
<h1>Custom print request</h1>
<p class="muted">Send us your model and we will reply with a price and lead time. Nothing is charged until you accept the quote.</p>

<?php if ($sent): ?>
  <div class="card anim-pop" style="text-align:center">
    <div class="success-ring"><svg viewBox="0 0 48 48"><path d="M12 25l9 9 16-18"/></svg></div>
    <h2>Request received</h2>
    <p class="muted">We will email you a quote shortly.</p>
    <a class="btn" href="<?= e(url('?p=shop')) ?>">Back to the shop</a>
  </div>
<?php else: ?>
  <?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <form class="card" method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="row">
      <label>Your name <input name="full_name" value="<?= e(current_user()['full_name'] ?? '') ?>"></label>
      <label>Email <input type="email" name="email" required value="<?= e(current_user()['email'] ?? '') ?>"></label>
      <label>Material
        <select name="material">
          <?php foreach ($materials as $m): ?>
            <option><?= $m ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Quantity <input type="number" name="quantity" value="1" min="1"></label>
    </div>
    <label>Model file (STL, STEP, 3MF, OBJ or ZIP, max 100 MB)
      <input type="file" name="model" accept=".stl,.step,.stp,.3mf,.obj,.zip"></label>
    <label>Anything we should know? <textarea name="details" placeholder="Size, colour, finish, deadline..."></textarea></label>
    <button class="btn hover-sheen" type="submit">Send request</button>
  </form>
<?php endif; ?>
