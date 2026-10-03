<?php
// How to order in portfolio mode: Marktplaats, or credit/debit card after getting in touch.
// Expects $product (array) and $mpUrl (string).
$about = 'Ik wil graag bestellen: ' . $product['name'];
$email = setting('contact_email', '');
$whatsapp = preg_replace('/\D+/', '', (string)setting('whatsapp_number', ''));
$contacts = array_filter([
    'Discord'   => setting('discord_url', ''),
    'E-mail'    => $email !== '' ? 'mailto:' . $email . '?subject=' . rawurlencode($about) : '',
    'Instagram' => setting('instagram_url', ''),
    'WhatsApp'  => $whatsapp !== '' ? 'https://wa.me/' . $whatsapp . '?text=' . rawurlencode($about) : '',
]);
$hasMp = $mpUrl !== '';
?>
<div class="order-box">
  <h2>Bestellen</h2>
  <p class="small muted">Betalen kan via <strong>Marktplaats</strong> of <strong>creditcard/debitcard</strong>. Verzendkosten zijn voor de klant; ophalen in Maarn is gratis.</p>
  <div class="pay-choice" role="radiogroup" aria-label="Hoe wil je betalen?">
    <?php if ($hasMp): ?>
      <input type="radio" name="pay" id="pay-mp" checked>
      <label for="pay-mp">Marktplaats</label>
    <?php endif; ?>
    <input type="radio" name="pay" id="pay-direct" <?= $hasMp ? '' : 'checked' ?>>
    <label for="pay-direct">Creditcard/debitcard</label>

    <?php if ($hasMp): ?>
      <div class="pay-panel pay-panel-mp">
        <p class="small muted">Koop dit product veilig via mijn advertentie op Marktplaats.</p>
        <a class="btn hover-sheen" href="<?= e($mpUrl) ?>" target="_blank" rel="noopener">Bekijk op Marktplaats ↗</a>
      </div>
    <?php endif; ?>
    <div class="pay-panel pay-panel-direct">
      <p class="small muted">Stuur me een bericht. Ik laat weten wat het met verzending kost en stuur je een betaallink voor je creditcard of debitcard.</p>
      <div class="contact-buttons">
        <?php foreach ($contacts as $label => $link): ?>
          <a class="btn ghost small" href="<?= e($link) ?>" <?= str_starts_with($link, 'mailto:') ? '' : 'target="_blank" rel="noopener"' ?>><?= e($label) ?></a>
        <?php endforeach; ?>
        <?php if ($whatsapp === ''): ?><span class="btn ghost small is-soon" aria-disabled="true">WhatsApp (binnenkort)</span><?php endif; ?>
        <?php if (!$contacts): ?><a class="btn ghost small" href="<?= e(url('?p=custom&about=' . urlencode($product['name']))) ?>">Contactformulier</a><?php endif; ?>
      </div>
    </div>
  </div>
</div>
