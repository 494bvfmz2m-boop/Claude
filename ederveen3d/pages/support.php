<?php
$GLOBALS['page_title'] = 'Contact en veelgestelde vragen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Verzenden, ophalen, materialen en levertijden van mijn 3D-prints.';
if (showcase_mode()) {
    $faq = [
        ['Hoe kan ik iets kopen?', 'Klik bij een product op "Bekijk op Marktplaats". Daar kun je het kopen en veilig betalen. Staat er geen link bij? Stuur me dan een bericht.'],
        ['Verzenden of ophalen', 'Ik verstuur binnen Nederland met PostNL. Woon je in de buurt van Ederveen? Dan kun je je print ook ophalen.'],
        ['Levertijd', 'Wat klaarstaat, verstuur ik meestal binnen een paar dagen. Een print op maat duurt langer, afhankelijk van het formaat. Dat hoor je vooraf.'],
        ['Materialen', 'PLA voor mooie details en kleuren, PETG voor stevige en buitenonderdelen, TPU voor flexibele onderdelen.'],
        ['Eigen bestanden', 'Ik accepteer STL, STEP, 3MF, OBJ en ZIP tot 100 MB. Je bestanden blijven privé en gebruik ik alleen voor jouw print.'],
        ['Iets kapot of niet goed?', 'Laat het me weten met een foto, dan zoeken we samen een oplossing.'],
    ];
} else {
    $faq = [
        ['Verzenden', 'Ik verstuur binnen Nederland met PostNL. De verzendkosten zie je bij het afrekenen. Ophalen in Ederveen kan ook.'],
        ['Herroepingsrecht', 'Producten uit de shop mag je binnen 14 dagen na ontvangst zonder reden terugsturen. Mail me binnen die 14 dagen; de kosten van het terugsturen zijn voor jou. Prints op maat (eigen ontwerp of bestand) zijn speciaal voor jou gemaakt en kun je daarom niet retourneren.'],
        ['Levertijd', 'Producten uit de shop verstuur ik meestal binnen 2 tot 4 werkdagen. Een print op maat hangt af van het formaat; dat staat in je offerte.'],
        ['Materialen', 'PLA voor mooie details en kleuren, PETG voor stevige en buitenonderdelen, TPU voor flexibele onderdelen.'],
        ['Eigen bestanden', 'Ik accepteer STL, STEP, 3MF, OBJ en ZIP tot 100 MB. Je bestanden blijven privé en gebruik ik alleen voor jouw bestelling.'],
        ['Betalen', 'Je betaalt via Stripe, met onder andere iDEAL. Ik zie of bewaar je bankgegevens nooit.'],
    ];
}
?>
<h1>Contact en veelgestelde vragen</h1>
<div class="grid cols-2">
  <?php foreach ($faq as [$q, $a]): ?>
    <div class="card hover-lift"><h3><?= e($q) ?></h3><p class="muted"><?= e($a) ?></p></div>
  <?php endforeach; ?>
</div>
<div class="card" style="margin-top:22px">
  <h2>Nog een vraag?</h2>
  <?php if (setting('contact_email', '')): ?>
    <p>Mail naar <a href="mailto:<?= e(setting('contact_email', '')) ?>"><?= e(setting('contact_email', '')) ?></a> of gebruik het <a href="<?= e(url('?p=custom')) ?>">formulier</a>. Ik reageer zo snel mogelijk.</p>
  <?php else: ?>
    <p>Gebruik het <a href="<?= e(url('?p=custom')) ?>">formulier</a>. Ik reageer zo snel mogelijk.</p>
  <?php endif; ?>
</div>
