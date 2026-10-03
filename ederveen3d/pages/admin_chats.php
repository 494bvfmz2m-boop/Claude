<?php
require_staff();
$GLOBALS['page_title'] = 'Chats - beheer';
$GLOBALS['page_desc'] = 'Chatberichten van klanten beantwoorden.';

$id = (int)($_GET['id'] ?? $_POST['chat_id'] ?? 0);
$chat = $id ? one('SELECT c.*, u.email, u.full_name FROM chats c JOIN users u ON u.id = c.user_id WHERE c.id = ?', [$id]) : null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $chat) {
    csrf_check();
    $action = $_POST['action'] ?? 'reply';
    if ($action === 'reply') {
        if (chat_post((int)$chat['id'], true, (string)($_POST['body'] ?? '')) === null) flash('Typ eerst een bericht.', 'warn');
    } elseif ($action === 'nudge') {
        $store = setting('store_name', 'Ederveen3D');
        $name = $chat['full_name'] ?: 'daar';
        $body = "Hoi {$name},\n\nJe hebt een nieuw bericht van {$store} in je chat.\n"
              . "Log in om het te lezen en te antwoorden:\n" . url('?p=chat') . "\n\nGroetjes,\n{$store}\n";
        if (send_mail($chat['email'], 'Je hebt een nieuw bericht van ' . $store, $body)) {
            q('UPDATE chats SET last_nudge_at = NOW() WHERE id = ?', [$chat['id']]);
            flash('E-mail verstuurd naar ' . $chat['email'] . '.');
        } else {
            flash('De e-mail kon niet worden verstuurd. Je hosting staat e-mail via PHP misschien niet toe.', 'err');
        }
    } elseif ($action === 'close' || $action === 'reopen') {
        q('UPDATE chats SET status = ? WHERE id = ?', [$action === 'close' ? 'closed' : 'open', $chat['id']]);
        flash($action === 'close' ? 'Chat gearchiveerd.' : 'Chat weer geopend.');
    }
    redirect('?p=admin_chats&id=' . (int)$chat['id']);
}

$showClosed = isset($_GET['archief']);
$chats = all('SELECT c.*, u.email, u.full_name,
                (SELECT body FROM chat_messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body
              FROM chats c JOIN users u ON u.id = c.user_id
              WHERE c.status = ? AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.chat_id = c.id)
              ORDER BY c.admin_unread > 0 DESC, c.updated_at DESC LIMIT 200', [$showClosed ? 'closed' : 'open']);

$messages = [];
if ($chat) {
    $messages = chat_messages((int)$chat['id']);
    chat_mark_read((int)$chat['id'], true);
}
$lastId = $messages ? (int)end($messages)['id'] : 0;
$requests = $chat ? all('SELECT * FROM custom_requests WHERE user_id = ? OR email = ? ORDER BY created_at DESC LIMIT 5', [$chat['user_id'], $chat['email']]) : [];
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_chats'); ?>

<div class="chat-admin">
  <aside class="chat-list card">
    <div class="chat-list-head">
      <h2><?= $showClosed ? 'Archief' : 'Chats' ?></h2>
      <a class="small" href="<?= e(url($showClosed ? '?p=admin_chats' : '?p=admin_chats&archief=1')) ?>"><?= $showClosed ? '← Open chats' : 'Archief' ?></a>
    </div>
    <?php if (!$chats): ?><p class="muted small"><?= $showClosed ? 'Geen gearchiveerde chats.' : 'Nog geen chatverzoeken.' ?></p><?php endif; ?>
    <?php foreach ($chats as $c): ?>
      <a class="chat-item <?= $chat && (int)$chat['id'] === (int)$c['id'] ? 'active' : '' ?>" href="<?= e(url('?p=admin_chats&id=' . (int)$c['id'] . ($showClosed ? '&archief=1' : ''))) ?>">
        <strong><?= e($c['full_name'] ?: $c['email']) ?></strong>
        <?php if ((int)$c['admin_unread'] > 0): ?><span class="count"><?= (int)$c['admin_unread'] ?></span><?php endif; ?>
        <span class="small muted"><?= e(mb_strimwidth((string)$c['last_body'], 0, 60, '…')) ?></span>
      </a>
    <?php endforeach; ?>
  </aside>

  <section class="chat-main card">
    <?php if (!$chat): ?>
      <p class="muted">Kies links een chat om te lezen en te antwoorden.</p>
    <?php else: ?>
      <div class="chat-main-head">
        <div>
          <h2><?= e($chat['full_name'] ?: $chat['email']) ?></h2>
          <p class="small muted"><?= e($chat['email']) ?><?= $chat['last_nudge_at'] ? ' · laatste e-mail ' . e(date('d-m H:i', strtotime($chat['last_nudge_at']))) : '' ?></p>
        </div>
        <div class="chat-actions">
          <form method="post"><?= csrf_field() ?><input type="hidden" name="chat_id" value="<?= (int)$chat['id'] ?>"><input type="hidden" name="action" value="nudge">
            <button class="btn small" type="submit" title="Stuurt de klant een e-mail dat er een bericht klaarstaat">🔔 Krijg aandacht</button></form>
          <form method="post"><?= csrf_field() ?><input type="hidden" name="chat_id" value="<?= (int)$chat['id'] ?>"><input type="hidden" name="action" value="<?= $chat['status'] === 'closed' ? 'reopen' : 'close' ?>">
            <button class="btn ghost small" type="submit"><?= $chat['status'] === 'closed' ? 'Heropenen' : 'Archiveren' ?></button></form>
        </div>
      </div>

      <?php if ($requests): ?>
        <details class="chat-requests">
          <summary class="small">Printverzoeken van deze klant (<?= count($requests) ?>)</summary>
          <?php foreach ($requests as $r): ?>
            <p class="small"><?= e(date('d-m-Y', strtotime($r['created_at']))) ?> · <?= e($r['material']) ?> · <?= e(mb_strimwidth((string)$r['details'], 0, 90, '…')) ?>
              <?php if ($r['file_path']): ?> · <a href="<?= e(url($r['file_path'])) ?>" download>bestand</a><?php endif; ?></p>
          <?php endforeach; ?>
          <a class="small" href="<?= e(url('?p=admin_requests')) ?>">Alle printverzoeken →</a>
        </details>
      <?php endif; ?>

      <div class="chat-thread" id="chat-thread"
           data-api="<?= e(url('?p=chat_api&chat=' . (int)$chat['id'])) ?>" data-after="<?= $lastId ?>" data-me="admin">
        <?php foreach ($messages as $m): ?>
          <div class="msg <?= (int)$m['from_admin'] === 1 ? 'mine' : 'theirs' ?>">
            <p><?= nl2br(e($m['body'])) ?></p>
            <span><?= e(date('d-m H:i', strtotime($m['created_at']))) ?></span>
          </div>
        <?php endforeach; ?>
      </div>
      <form method="post" class="chat-form" id="chat-form">
        <?= csrf_field() ?><input type="hidden" name="chat_id" value="<?= (int)$chat['id'] ?>"><input type="hidden" name="action" value="reply">
        <textarea name="body" rows="2" maxlength="<?= CHAT_MAX_LENGTH ?>" placeholder="Typ je antwoord..." required></textarea>
        <button class="btn" type="submit">Versturen</button>
      </form>
    <?php endif; ?>
  </section>
</div>
