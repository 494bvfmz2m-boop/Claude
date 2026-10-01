<?php
$GLOBALS['page_title'] = 'Eigen idee laten printen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Stuur je STL-, STEP- of 3MF-bestand of beschrijf je idee. Je hoort snel of het kan en wat het kost.';

$errors = [];
$sent = false;
$allowed = ['stl', 'step', 'stp', '3mf', 'obj', 'zip'];
$maxBytes = 100 * 1024 * 1024;
$about = trim((string)($_GET['about'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim((string)($_POST['email'] ?? ''));
    $name  = trim((string)($_POST['full_name'] ?? ''));
    $material = trim((string)($_POST['material'] ?? 'PLA'));
    $qty = max(1, (int)($_POST['quantity'] ?? 1));
    $details = trim((string)($_POST['details'] ?? ''));
    $stored = null; $original = null;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Vul een geldig e-mailadres in.';
    if ($details === '' && empty($_FILES['model']['name'])) $errors[] = 'Beschrijf je idee of voeg een bestand toe.';

    if (!empty($_FILES['model']['name'])) {
        $f = $_FILES['model'];
        if ($f['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Het bestand kon niet worden geüpload. Misschien is het te groot.';
        } elseif ($f['size'] > $maxBytes) {
            $errors[] = 'Bestanden mogen maximaal 100 MB zijn.';
        } else {
            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true)) {
                $errors[] = 'Toegestane bestandstypen: ' . implode(', ', $allowed) . '.';
            } else {
                $dir = __DIR__ . '/../uploads/models';
                if (!is_dir($dir)) @mkdir($dir, 0755, true);
                $fileName = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
                if (move_uploaded_file($f['tmp_name'], $dir . '/' . $fileName)) {
                    $stored = 'uploads/models/' . $fileName;
                    $original = mb_substr($f['name'], 0, 190);
                } else {
                    $errors[] = 'Het bestand kon niet worden opgeslagen. Controleer of de map uploads beschrijfbaar is.';
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
<h1>Eigen idee laten printen</h1>
<p class="muted">Heb je een 3D-bestand, of een idee voor iets wat je graag geprint wilt hebben? Stuur het op. Je hoort per e-mail of het kan, wat het kost en hoe lang het duurt. Je zit nergens aan vast.</p>

<?php if ($sent): ?>
  <div class="card anim-pop" style="text-align:center">
    <div class="success-ring"><svg viewBox="0 0 48 48"><path d="M12 25l9 9 16-18"/></svg></div>
    <h2>Bedankt, je bericht is binnen!</h2>
    <p class="muted">Ik stuur je zo snel mogelijk een mailtje terug.</p>
    <a class="btn" href="<?= e(url('?p=shop')) ?>">Terug naar het overzicht</a>
  </div>
<?php else: ?>
  <?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <form class="card" method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="row">
      <label>Je naam <input name="full_name" value="<?= e($_POST['full_name'] ?? (current_user()['full_name'] ?? '')) ?>"></label>
      <label>E-mail <input type="email" name="email" required value="<?= e($_POST['email'] ?? (current_user()['email'] ?? '')) ?>"></label>
      <label>Materiaal
        <select name="material">
          <?php foreach (['PLA', 'PETG', 'TPU (flexibel)', 'Weet ik niet'] as $m): ?>
            <option><?= e($m) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Aantal <input type="number" name="quantity" value="1" min="1"></label>
    </div>
    <label>3D-bestand (optioneel: STL, STEP, 3MF, OBJ of ZIP, max. 100 MB)
      <input type="file" name="model" accept=".stl,.step,.stp,.3mf,.obj,.zip"></label>
    <label>Vertel over je idee <textarea name="details" placeholder="Wat wil je laten printen? Denk aan formaat, kleur en wanneer je het nodig hebt."><?= e($_POST['details'] ?? ($about !== '' ? 'Vraag over: ' . $about . "\n" : '')) ?></textarea></label>
    <button class="btn hover-sheen" type="submit">Versturen</button>
  </form>
<?php endif; ?>
