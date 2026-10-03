<?php
$GLOBALS['page_title'] = 'Eigen idee laten printen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Vertel wat je wilt laten printen. Je hoort snel of het kan en wat het kost.';

$errors = [];
$sent = false;
$allowed = ['stl', 'step', 'stp', '3mf', 'obj', 'zip'];
$maxBytes = 100 * 1024 * 1024;
$about = trim((string)($_GET['about'] ?? ''));
$user = current_user();
$materials = ['PLA Basic' => 'PLA Basic', 'PETG Basic' => 'PETG Basic', 'Weet ik niet' => 'Weet ik niet', 'Ander filament' => 'Ander filament (meerprijs)'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = $user ? $user['email'] : trim((string)($_POST['email'] ?? ''));
    $name  = $user ? (string)$user['full_name'] : trim((string)($_POST['full_name'] ?? ''));
    $material = (string)($_POST['material'] ?? 'Weet ik niet');
    if (!array_key_exists($material, $materials)) $material = 'Weet ik niet';
    $other = mb_substr(trim((string)($_POST['material_other'] ?? '')), 0, 60);
    if ($material === 'Ander filament') $material = $other !== '' ? 'Anders: ' . $other : 'Ander filament';
    $qty = max(1, min(999, (int)($_POST['quantity'] ?? 1)));
    $details = trim((string)($_POST['details'] ?? ''));
    $stored = null; $original = null;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Vul een geldig e-mailadres in.';
    if ($details === '' && empty($_FILES['model']['name'])) $errors[] = 'Vertel kort wat je wilt laten printen, of voeg een bestand toe.';

    if (!$errors && !empty($_FILES['model']['name'])) {
        $f = $_FILES['model'];
        if ($f['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Het bestand kon niet worden geüpload. Misschien is het te groot.';
        } elseif ($f['size'] > $maxBytes) {
            $errors[] = 'Bestanden mogen maximaal 100 MB zijn.';
        } else {
            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true)) {
                $errors[] = 'Dit bestandstype kan ik niet openen. Gebruik STL, STEP, 3MF, OBJ of ZIP.';
            } else {
                $dir = __DIR__ . '/../uploads/models';
                if (!is_dir($dir)) @mkdir($dir, 0755, true);
                $fileName = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
                if (move_uploaded_file($f['tmp_name'], $dir . '/' . $fileName)) {
                    $stored = 'uploads/models/' . $fileName;
                    $original = mb_substr($f['name'], 0, 190);
                } else {
                    $errors[] = 'Het bestand kon niet worden opgeslagen. Probeer het later nog eens.';
                }
            }
        }
    }

    if (!$errors) {
        q('INSERT INTO custom_requests (user_id, email, full_name, material, quantity, details, file_path, original_filename)
           VALUES (?,?,?,?,?,?,?,?)', [$user['id'] ?? null, $email, $name, $material, $qty, $details, $stored, $original]);
        // Logged-in customers also get the request in their chat, so the conversation continues there.
        if ($user && !is_staff()) {
            $chat = chat_for_user((int)$user['id'], true);
            $summary = "📐 Printverzoek\n" . ($details !== '' ? $details . "\n" : '')
                     . "Materiaal: $material · Aantal: $qty" . ($original ? "\nBestand: $original" : '');
            chat_post((int)$chat['id'], false, $summary);
        }
        $sent = true;
    }
}
$picked = $_POST['material'] ?? 'Weet ik niet';
?>
<div class="narrow">
<span class="kicker">Eigen idee</span>
<h1>Wat wil je laten printen?</h1>
<p class="lead muted">Vertel het in je eigen woorden. Een bestand is handig, maar hoeft niet. Je hoort van me of het kan en wat het kost — je zit nergens aan vast.</p>

<?php if ($sent): ?>
  <div class="card anim-pop" style="text-align:center">
    <div class="success-ring"><svg viewBox="0 0 48 48"><path d="M12 25l9 9 16-18"/></svg></div>
    <h2>Top, je verzoek is binnen!</h2>
    <?php if ($user && !is_staff()): ?>
      <p class="muted">Ik antwoord in je chat. Je kunt daar ook alvast meer vertellen.</p>
      <a class="btn" href="<?= e(url('?p=chat')) ?>">Naar je chat</a>
    <?php else: ?>
      <p class="muted">Ik stuur je zo snel mogelijk een mailtje terug.</p>
      <a class="btn" href="<?= e(url('?p=shop')) ?>">Verder kijken</a>
    <?php endif; ?>
  </div>
<?php else: ?>
  <?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <form class="card request-form" method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <label>Je idee
      <textarea name="details" rows="5" placeholder="Bijv.: een sleutelhanger met mijn naam, ongeveer 6 cm, in het blauw."><?= e($_POST['details'] ?? ($about !== '' ? 'Vraag over: ' . $about . "\n" : '')) ?></textarea></label>

    <label class="dropzone">
      <input type="file" name="model" accept=".stl,.step,.stp,.3mf,.obj,.zip">
      <span>📎 <strong>Bestand toevoegen</strong> (optioneel)<br><small class="muted">STL, STEP, 3MF, OBJ of ZIP · max. 100 MB</small></span>
    </label>

    <?php if (!$user): ?>
      <div class="row">
        <label>Je naam <input name="full_name" value="<?= e($_POST['full_name'] ?? '') ?>"></label>
        <label>E-mail <input type="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>"></label>
      </div>
      <p class="small muted">Tip: met een <a href="<?= e(url('?p=register')) ?>">account</a> praten we verder in de chat in plaats van per mail.</p>
    <?php else: ?>
      <p class="small muted">Je verstuurt dit als <strong><?= e($user['email']) ?></strong>. Mijn antwoord komt in je chat.</p>
    <?php endif; ?>

    <details class="extra" <?= isset($_POST['material']) && $picked !== 'Weet ik niet' ? 'open' : '' ?>>
      <summary>Materiaal en aantal kiezen (optioneel)</summary>
      <div class="chips">
        <?php foreach ($materials as $v => $l): ?>
          <label class="chip"><input type="radio" name="material" value="<?= e($v) ?>" <?= $picked === $v ? 'checked' : '' ?>><span><?= e($l) ?></span></label>
        <?php endforeach; ?>
      </div>
      <div class="row">
        <label>Welk ander filament? <input name="material_other" placeholder="Bijv. PLA Matte, PLA Silk+" value="<?= e($_POST['material_other'] ?? '') ?>"></label>
        <label>Aantal <input type="number" name="quantity" min="1" max="999" value="<?= e((string)($_POST['quantity'] ?? '1')) ?>"></label>
      </div>
      <p class="small muted">Standaard print ik in PLA Basic of PETG Basic van Bambu Lab. Ander filament kan ook, maar dan is de prijs hoger.</p>
    </details>

    <button class="btn" type="submit">Verstuur mijn idee</button>
  </form>
<?php endif; ?>
</div>
