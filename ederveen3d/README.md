# Ederveen3D

Website voor Ederveen3D, een kleine 3D-printstudio uit Maarn. Gemaakt met PHP en MySQL.
Je hebt geen Node.js, build-stap of Composer nodig.

De site heeft twee standen. Je wisselt tussen de twee onder **Beheer → Instellingen**:

- **Portfolio** (standaard): je laat je werk zien en elk product linkt naar je
  Marktplaats-advertentie. Er is geen winkelwagen en je kunt niet online betalen.
- **Webshop**: met winkelwagen, afrekenen en online betalen via Stripe (met iDEAL).
  Zet deze stand pas aan als je bij de KvK bent ingeschreven.

## Wat heb je nodig?

- PHP 8.0 of nieuwer, met PDO MySQL en cURL. Bij bijna elke hostingpartij staat dat standaard aan.
- Een MySQL- of MariaDB-database.

## Installeren (5 minuten)

1. Upload de zip naar je hosting en pak hem uit in `public_html`.
2. Maak in het hostingpaneel een MySQL-database en een gebruiker aan, en geef die gebruiker
   alle rechten op de database.
3. Open `https://ederveen.xyz/install.php` in je browser.
4. Vul de databasegegevens, je e-mailadres, een wachtwoord en het websiteadres in.
   Klik daarna op Installeren.
5. **Verwijder `install.php`** van de server.
6. Log in via de link "Inloggen" onderaan de pagina. Zet onder Account → Beveiliging
   tweestapsverificatie aan.

## Producten toevoegen

Ga naar **Beheer → Producten**. Hier vul je per product de naam, beschrijving, prijs en categorie in
en upload je een foto. Plak bij **Marktplaats-link** de link naar je advertentie. Op de productpagina
verschijnt dan de knop "Bekijk op Marktplaats". Heeft een product geen link? Dan krijgen bezoekers
een knop om je een bericht te sturen.

Onder **Beheer → Instellingen** vul je ook je Marktplaats-profiel, Instagram en TikTok in.
Die links komen in de footer en op de homepage.

Op elke productpagina staat een blok **Bestellen**. Klanten kiezen daar tussen Marktplaats en
creditcard/debitcard. Kiezen ze kaart, dan zien ze knoppen om je een bericht te sturen via
Discord, e-mail, Instagram, TikTok en WhatsApp. Vul je Discord-link en (later) je WhatsApp-nummer in bij
**Beheer → Instellingen**. Zonder WhatsApp-nummer verschijnt er geen WhatsApp-knop.

## Chat

Bezoekers kunnen een account aanmaken en via **💬 Chat** (rechtsboven) met je chatten. Nieuwe
berichten zie je onder **Beheer → Chats**. Het getal achter "Beheer" en "Chats" is het aantal
ongelezen berichten. Je antwoord verschijnt binnen een paar seconden bij de klant, zonder herladen.

- **🔔 Krijg aandacht** stuurt de klant een e-mail dat er een bericht klaarstaat, met een link naar de chat.
  De mail gaat via de mailfunctie van je hosting (PHP `mail()`). Komt hij niet aan, kijk dan in de
  spammap of vraag je hosting of "PHP mail" aanstaat.
- **Archiveren** haalt een afgeronde chat uit de lijst. Stuurt de klant later weer iets, dan komt
  de chat vanzelf terug.

## Printverzoeken

Onder **Beheer → Printverzoeken** zie je alle verzoeken met een gekleurde streep per status
(Nieuw, In gesprek, Wordt geprint, Klaar, Afgewezen). Klik een status aan, vul eventueel een prijs
in en klik op Opslaan. Stuurt een ingelogde klant een verzoek, dan komt het ook in zijn chat, zodat
je daar meteen kunt antwoorden.

## Later: de webshop aanzetten

1. Vul onder **Beheer → Instellingen → Bedrijfsgegevens** je naam, adres, KvK-nummer en btw-id in.
   Deze gegevens verschijnen automatisch in de footer.
2. Zet het btw-tarief op `0` als je de kleineondernemersregeling (KOR) gebruikt.
   Gebruik je die niet, zet het dan op `0.21`.
3. Kies bij **Modus** voor Webshop.
4. Ga naar **Beheer → Betalingen** en plak je Stripe-sleutels. Zet in Stripe onder
   Settings → Payment methods iDEAL aan.
5. Voeg in Stripe een webhook toe naar `https://ederveen.xyz/webhook.php` die luistert naar
   `checkout.session.completed` en `checkout.session.async_payment_succeeded`.
   Plak daarna het signing secret bij Betalingen.

## Logo

- `assets/logo.svg`: het logo voor de website
- `assets/logo.png`: hetzelfde logo als afbeelding (512×512), bijvoorbeeld als profielfoto
- `assets/logo-wide.png`: het brede logo met naam (1200×400), voor banners

## Back-up

Producten, verzoeken, instellingen en accounts staan in de database. Foto's en geüploade
3D-bestanden staan in `uploads/`. Maak van allebei een back-up.
