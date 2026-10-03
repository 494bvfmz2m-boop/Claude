<?php
require_login();
if (is_staff()) redirect('?p=admin_chats');
$GLOBALS['page_title'] = 'Chat - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Stel je vraag of bestel direct via de chat.';
$u = current_user();
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $body = (string)($_POST['body'] ?? '');
    if (trim($body) === '') {
        $error = 'Typ eerst een bericht.';
    } elseif (!throttle('chat', 30, 600)) {
        $error = 'Je stuurt wel heel veel berichten achter elkaar. Wacht even en probeer het opnieuw.';
    } else {
        $chat = chat_for_user((int)$u['id'], true);
        chat_post((int)$chat['id'], false, $body);
        redirect('?p=chat');
    }
}

$chat = chat_for_user((int)$u['id']);
$messages = $chat ? chat_messages((int)$chat['id']) : [];
if ($chat) chat_mark_read((int)$chat['id'], false);
$lastId = $messages ? (int)end($messages)['id'] : 0;
$about = trim((string)($_GET['about'] ?? ''));
$draft = $_POST['body'] ?? ($about !== '' ? 'Hoi! Ik heb interesse in: ' . $about : '');
?>
<div class="chat-page">
  <div class="chat-head">
    <img src="<?= e(url('assets/logo.svg')) ?>" alt="">
    <div>
      <h1>Chat met <?= e(setting('store_name', 'Ederveen3D')) ?></h1>
      <p class="muted small">Stel je vraag, vraag een prijs of bestel iets. Je krijgt hier antwoord, meestal binnen een dag.</p>
    </div>
  </div>

  <div class="chat-thread" id="chat-thread"
       data-api="<?= e(url('?p=chat_api')) ?>" data-after="<?= $lastId ?>" data-me="user">
    <?php if (!$messages): ?>
      <p class="chat-empty muted">Nog geen berichten. Zeg hallo! 👋</p>
    <?php endif; ?>
    <?php foreach ($messages as $m): ?>
      <div class="msg <?= (int)$m['from_admin'] === 1 ? 'theirs' : 'mine' ?>">
        <p><?= nl2br(e($m['body'])) ?></p>
        <span><?= e(date('d-m H:i', strtotime($m['created_at']))) ?></span>
      </div>
    <?php endforeach; ?>
  </div>

  <?php if ($error): ?><div class="note err"><?= e($error) ?></div><?php endif; ?>
  <form method="post" class="chat-form" id="chat-form">
    <?= csrf_field() ?>
    <textarea name="body" rows="2" maxlength="<?= CHAT_MAX_LENGTH ?>" placeholder="Typ je bericht..." required><?= e($draft) ?></textarea>
    <button class="btn" type="submit">Versturen</button>
  </form>
  <p class="small muted">Liever een bestand sturen? Gebruik <a href="<?= e(url('?p=custom')) ?>">Eigen idee laten printen</a>, dan komt je verzoek ook in deze chat.</p>
</div>
