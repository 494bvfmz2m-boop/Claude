<?php
/**
 * Special Love 3D Print Shop - installer
 * Open this file in your browser once, fill in the database details,
 * then delete install.php.
 */
session_start();
$configPath = __DIR__ . '/config.php';
$done = false;
$errors = [];

if (file_exists($configPath) && empty($_GET['force'])) {
    $already = true;
} else {
    $already = false;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$already) {
    $host = trim($_POST['db_host'] ?? 'localhost');
    $port = trim($_POST['db_port'] ?? '3306');
    $name = trim($_POST['db_name'] ?? '');
    $user = trim($_POST['db_user'] ?? '');
    $pass = (string)($_POST['db_pass'] ?? '');
    $email = trim($_POST['admin_email'] ?? '');
    $pw    = (string)($_POST['admin_pass'] ?? '');
    $siteUrl = rtrim(trim($_POST['site_url'] ?? ''), '/');

    if ($name === '' || $user === '') $errors[] = 'Database name and user are required.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid owner email address.';
    if (strlen($pw) < 10) $errors[] = 'Owner password must be at least 10 characters.';

    if (!$errors) {
        try {
            $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (PDOException $e) {
            $errors[] = 'Could not connect to the database: ' . $e->getMessage();
        }
    }

    if (!$errors) {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(190) NULL,
  role ENUM('customer','staff','owner') NOT NULL DEFAULT 'customer',
  totp_secret VARCHAR(64) NULL,
  totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  description TEXT NULL,
  category VARCHAR(80) NULL,
  material VARCHAR(80) NULL,
  product_details TEXT NULL,
  colours TEXT NULL,
  size_text VARCHAR(190) NULL,
  promo_badge VARCHAR(80) NULL,
  is_best_seller TINYINT(1) NOT NULL DEFAULT 0,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  price_cents INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image VARCHAR(255) NULL,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(40) NOT NULL UNIQUE,
  user_id INT NULL,
  email VARCHAR(190) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  phone VARCHAR(60) NULL,
  address1 VARCHAR(190) NULL,
  address2 VARCHAR(190) NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(80) NULL,
  postcode VARCHAR(20) NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'Australia',
  notes TEXT NULL,
  shipping_method VARCHAR(30) NOT NULL DEFAULT 'standard',
  subtotal_cents INT NOT NULL DEFAULT 0,
  shipping_cents INT NOT NULL DEFAULT 0,
  gst_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  stripe_session_id VARCHAR(255) NULL,
  tracking VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  name VARCHAR(190) NOT NULL,
  unit_price_cents INT NOT NULL,
  qty INT NOT NULL,
  INDEX (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS custom_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  email VARCHAR(190) NOT NULL,
  full_name VARCHAR(190) NULL,
  material VARCHAR(80) NULL,
  quantity INT NOT NULL DEFAULT 1,
  details TEXT NULL,
  file_path VARCHAR(255) NULL,
  original_filename VARCHAR(190) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  quote_cents INT NULL,
  staff_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  skey VARCHAR(80) PRIMARY KEY,
  svalue TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ident VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX (ident)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL;
        try {
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                $pdo->exec($stmt);
            }

            $defaults = [
                'store_name' => 'Special Love 3D',
                'tagline' => 'Fun, unique and colourful products made with care',
                'contact_email' => $email,
                'currency' => 'aud',
                'gst_rate' => '0.10',
                'shipping_standard_cents' => '995',
                'shipping_express_cents' => '1995',
                'free_shipping_over_cents' => '15000',
                'site_url' => $siteUrl,
                'stripe_enabled' => '0',
                'stripe_mode' => 'test',
                'promo_bar_enabled' => '1',
                'promo_bar_text' => 'Free gift with high priced orders',
            ];
            $st = $pdo->prepare('INSERT IGNORE INTO settings (skey, svalue) VALUES (?, ?)');
            foreach ($defaults as $k => $v) $st->execute([$k, $v]);

            $st = $pdo->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, "owner")
                ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = "owner"');
            $st->execute([$email, password_hash($pw, PASSWORD_DEFAULT), 'Shop owner']);

            $count = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
            if ($count === 0) {
                $seed = [
                    ['Sloth Desk Buddy', 'sloth-desk-buddy', 'A colourful sloth companion for your desk.', 'Animals', 'PLA', 3500, 12],
                    ['Frog Planter', 'frog-planter', 'A cheeky frog planter with a drainage insert.', 'Animals', 'PETG', 4200, 8],
                    ['Cable Wrangler (3 pack)', 'cable-wrangler-3-pack', 'Keep your desk tidy with three flexible cable clips.', 'Other', 'TPU', 1500, 40],
                    ['Headphone Hook', 'headphone-hook', 'An under-desk headphone hanger with a felt pad.', 'Other', 'PETG', 1900, 25],
                ];
                $st = $pdo->prepare('INSERT INTO products (name, slug, description, category, material, price_cents, stock) VALUES (?,?,?,?,?,?,?)');
                foreach ($seed as $row) $st->execute($row);
            }

            $cfg = "<?php\nreturn " . var_export([
                'db_host' => $host,
                'db_port' => $port,
                'db_name' => $name,
                'db_user' => $user,
                'db_pass' => $pass,
            ], true) . ";\n";
            if (@file_put_contents($configPath, $cfg) === false) {
                $errors[] = 'Could not write config.php. Make the site folder writable and try again.';
            } else {
                @chmod($configPath, 0640);
                $done = true;
            }
        } catch (PDOException $e) {
            $errors[] = 'Setup failed: ' . $e->getMessage();
        }
    }
}
?><!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install - Special Love 3D Print Shop</title>
<link rel="stylesheet" href="assets/style.css">
</head><body class="install-page">
<div class="install-card anim-rise">
  <img src="assets/logo.png" alt="Special Love" class="install-logo">
  <h1>Set up your shop</h1>
  <?php if ($already): ?>
    <p class="note ok">This shop is already installed. Delete <code>install.php</code> from your server.</p>
    <p><a class="btn" href="index.php">Open the shop</a></p>
  <?php elseif ($done): ?>
    <p class="note ok">All done! Your shop is ready.</p>
    <p class="note warn">Important: delete <code>install.php</code> from your server now.</p>
    <p><a class="btn" href="index.php">Open the shop</a> <a class="btn ghost" href="index.php?p=login">Sign in as owner</a></p>
  <?php else: ?>
    <?php foreach ($errors as $err): ?><p class="note err"><?= htmlspecialchars($err) ?></p><?php endforeach; ?>
    <form method="post">
      <h2>Database</h2>
      <label>Host <input name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>" required></label>
      <label>Port <input name="db_port" value="<?= htmlspecialchars($_POST['db_port'] ?? '3306') ?>"></label>
      <label>Database name <input name="db_name" value="<?= htmlspecialchars($_POST['db_name'] ?? '') ?>" required></label>
      <label>Database user <input name="db_user" value="<?= htmlspecialchars($_POST['db_user'] ?? '') ?>" required></label>
      <label>Database password <input type="password" name="db_pass"></label>
      <h2>Owner account</h2>
      <label>Email <input type="email" name="admin_email" value="<?= htmlspecialchars($_POST['admin_email'] ?? '') ?>" required></label>
      <label>Password (min 10 characters) <input type="password" name="admin_pass" required></label>
      <h2>Website address</h2>
      <label>Full address, e.g. https://yourshop.com
        <input name="site_url" placeholder="https://yourshop.com" value="<?= htmlspecialchars($_POST['site_url'] ?? '') ?>"></label>
      <button class="btn" type="submit">Install</button>
    </form>
  <?php endif; ?>
</div>
</body></html>
