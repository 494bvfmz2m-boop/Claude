<?php
$GLOBALS['page_title'] = 'Support and shipping - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Shipping, returns, materials and lead times for our 3D printed products.';
$faq = [
    ['Shipping', 'We ship world wide, depending on your location shipping costs will differ.'],
    ['Returns', "Our Catalog and custom prints can't be returned."],
    ['Lead times', 'Catalog items usually leave within 2-4 business days. Custom prints depend on size and the queue; your quote will say.'],
    ['Materials', 'PLA for detail and colour, PETG for strength and outdoor use, TPU for flexible parts, resin for fine detail.'],
    ['Custom files', 'We accept STL, STEP, 3MF, OBJ and ZIP up to 100 MB. Your files stay private and are only used for your order.'],
    ['Payments', 'Card payments are handled by Stripe. We never see or store your card details.'],
];
?>
<h1>Support</h1>
<div class="grid cols-2">
  <?php foreach ($faq as [$q, $a]): ?>
    <div class="card hover-lift"><h3><?= e($q) ?></h3><p class="muted"><?= e($a) ?></p></div>
  <?php endforeach; ?>
</div>
<div class="card" style="margin-top:22px">
  <h2>Still stuck?</h2>
  <p>Email us at <a href="mailto:<?= e(setting('contact_email', '')) ?>"><?= e(setting('contact_email', '')) ?></a> and we will get back to you.</p>
</div>
