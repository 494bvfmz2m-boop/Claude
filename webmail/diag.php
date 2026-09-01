<?php
declare(strict_types=1);

/**
 * One-off connectivity diagnostic. Upload this next to api.php, load it in
 * your browser, run the checks, read the results, then DELETE this file —
 * it is not meant to stay on the server (it accepts a password in a POST
 * field, purely to test imap_open(); it is never written to disk or logged).
 */

$config = @require __DIR__ . '/src/config.php';
$host   = $config['imap_host'] ?? 'imap.purelymail.com';
$port   = (int)($config['imap_port'] ?? 993);

$email = trim($_POST['email'] ?? '');
$pass  = $_POST['pass'] ?? '';
$ran   = $_SERVER['REQUEST_METHOD'] === 'POST';

header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Mail connectivity diagnostic</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}
code,pre{background:#f2f2f2;padding:2px 6px;border-radius:4px}pre{padding:12px;overflow-x:auto}
.ok{color:#1a7f37;font-weight:600}.bad{color:#c0392b;font-weight:600}.warn{color:#a86400;font-weight:600}
input{width:100%;padding:8px;margin:6px 0 14px;box-sizing:border-box}
button{padding:9px 18px;cursor:pointer}
.card{border:1px solid #ddd;border-radius:8px;padding:16px 20px;margin:16px 0}
</style></head><body>
<h1>Mail server connectivity diagnostic</h1>
<p><b>Delete this file once you're done.</b> It never writes your password to disk or to any log.</p>

<div class="card">
<h3>1. PHP environment</h3>
<?php
function chk(bool $ok, string $label): void {
    echo '<div>' . ($ok ? '<span class="ok">✔</span> ' : '<span class="bad">✘</span> ') . htmlspecialchars($label) . '</div>';
}
chk(function_exists('imap_open'), 'imap extension loaded (function imap_open exists)');
chk(extension_loaded('openssl'), 'openssl extension loaded');
echo '<div>PHP version: ' . htmlspecialchars(PHP_VERSION) . '</div>';
if (function_exists('imap_open')) {
    // Not all builds expose this constant/function, guard it.
    if (defined('PHP_VERSION')) {
        echo '<div>c-client / imap build info: ';
        if (function_exists('phpversion') && ($v = phpversion('imap'))) {
            echo htmlspecialchars((string)$v);
        } else {
            echo '<span class="warn">unknown (older PHP)</span>';
        }
        echo '</div>';
    }
}
?>
</div>

<div class="card">
<h3>2. Config being used</h3>
<div>imap_host: <code><?= htmlspecialchars($host) ?></code></div>
<div>imap_port: <code><?= htmlspecialchars((string)$port) ?></code></div>
</div>

<div class="card">
<h3>3. Raw network reachability (no auth, no IMAP — just "can this server open a TCP socket to port <?= htmlspecialchars((string)$port) ?>")</h3>
<?php
$start = microtime(true);
$errno = 0; $errstr = '';
$sock = @stream_socket_client(
    "ssl://$host:$port",
    $errno, $errstr, 8,
    STREAM_CLIENT_CONNECT,
    stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]])
);
$elapsed = round((microtime(true) - $start) * 1000);
if ($sock) {
    $banner = fread($sock, 512);
    fclose($sock);
    chk(true, "TLS socket to $host:$port opened in {$elapsed}ms");
    echo '<div>Server banner: <pre>' . htmlspecialchars(trim((string)$banner)) . '</pre></div>';
} else {
    chk(false, "TLS socket to $host:$port FAILED after {$elapsed}ms");
    echo '<div class="bad">Error ' . htmlspecialchars((string)$errno) . ': ' . htmlspecialchars($errstr) . '</div>';
    echo '<p><b>If this step fails</b>, nothing above the network layer matters yet — your
    hosting provider is blocking outbound connections on port ' . htmlspecialchars((string)$port) . '.
    This is extremely common on shared hosting. Contact your host and ask them to allow
    outbound TCP on port ' . htmlspecialchars((string)$port) . ' (and 465 for sending), or ask
    if they have a specific allowlist process for this.</p>';
}
?>
</div>

<div class="card">
<h3>3b. Which outbound ports are actually blocked (for your host's support ticket)</h3>
<p>Run once you know step 3 fails, so you can tell your host exactly what to unblock.</p>
<?php
function portCheck(string $label, string $host, int $port, bool $tls): void {
    $start = microtime(true);
    $errno = 0; $errstr = '';
    $target = ($tls ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $sock = @stream_socket_client(
        $target, $errno, $errstr, 5,
        STREAM_CLIENT_CONNECT,
        $tls ? stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]) : null
    );
    $elapsed = round((microtime(true) - $start) * 1000);
    if ($sock) {
        fclose($sock);
        chk(true, "$label ($host:$port) — reachable in {$elapsed}ms");
    } else {
        chk(false, "$label ($host:$port) — BLOCKED (\"$errstr\", after {$elapsed}ms)");
    }
}
portCheck('General HTTPS baseline', 'www.google.com', 443, true);
portCheck('IMAP SSL (imap.purelymail.com)', 'imap.purelymail.com', 993, true);
portCheck('SMTP SSL (smtp.purelymail.com)', 'smtp.purelymail.com', 465, true);
portCheck('SMTP submission (smtp.purelymail.com)', 'smtp.purelymail.com', 587, false);
?>
<p>If the HTTPS baseline succeeds but the Purelymail ports fail, that's conclusive: your
host allows normal web traffic out but is specifically blocking mail ports. Give your host
this exact list of what's blocked when you ask them to open it up.</p>
</div>

<div class="card">
<h3>4. Actual IMAP login test</h3>
<?php if (!$ran): ?>
<form method="post">
  <label>Full email address</label>
  <input type="email" name="email" placeholder="you@yourdomain.com" required>
  <label>Password (the one used for IMAP/SMTP — check your provider's mail app-password settings if unsure)</label>
  <input type="password" name="pass" required>
  <button type="submit">Test IMAP login</button>
</form>
<?php else: ?>
<?php
if (!function_exists('imap_open')) {
    echo '<p class="bad">Cannot test — the imap extension is not loaded (see step 1).</p>';
} else {
    $dsn = "{{$host}:{$port}/imap/ssl/novalidate-cert}INBOX";
    imap_errors(); // clear
    $start = microtime(true);
    $conn = @imap_open($dsn, $email, $pass, 0, 1);
    $elapsed = round((microtime(true) - $start) * 1000);
    if ($conn) {
        chk(true, "imap_open() succeeded in {$elapsed}ms — credentials and connection are both fine.");
        imap_close($conn);
    } else {
        chk(false, "imap_open() failed after {$elapsed}ms");
        $errors = imap_errors();
        $alert  = imap_last_error();
        echo '<div>imap_last_error(): <pre>' . htmlspecialchars($alert ?: '(empty)') . '</pre></div>';
        echo '<div>imap_errors(): <pre>' . htmlspecialchars($errors ? implode("\n", $errors) : '(none)') . '</pre></div>';
        echo '<p>Read the text above carefully:</p><ul>
          <li>Anything mentioning <code>AUTHENTICATIONFAILED</code>, <code>LOGIN failed</code>, or
          <code>invalid credentials</code> → the password really is wrong for IMAP. Many providers
          (Purelymail included) use a separate mailbox/app password, not your account login password —
          check your provider\'s mail client settings page for it.</li>
          <li>Anything mentioning <code>certificate</code>, <code>SSL</code>, or <code>TLS</code> → your
          server\'s c-client/openssl build can\'t negotiate modern TLS with the mail server. This usually
          means the php-imap package on your host is outdated; ask your host to update it, or consider
          hosting on PHP with a current php-imap build.</li>
          <li><code>(empty)</code> on both, but step 3 above succeeded → likely a very old or broken
          c-client library that fails silently. Same fix as above (update php-imap on the host).</li>
        </ul>';
    }
}
?>
<?php endif; ?>
</div>

</body></html>
