# Hoe wordt een auto gemaakt?

Schoolproject-website over het ontwerp- en productieproces van een auto, met een 3D-animatie van een autofabriek waarin een auto stap voor stap wordt opgebouwd.

## Bekijken

Open `index.html` in een browser (dubbelklikken is genoeg, er is geen internet of server nodig). Alle gebruikte informatie staat met bronvermelding onderaan de pagina.

- De 3D-animatie bovenaan start vanzelf en begint na afloop opnieuw.
- **W** zet de rondleiding aan/uit (voor een scherm of beamer op een markt). Hij wacht tot de auto klaar is en bladert dan scherm voor scherm door de pagina: eerst het grote beeld met het kopje, daarna elk stuk tekst dat op het scherm past. Hoe lang hij blijft staan hangt af van hoeveel nieuwe tekst er te zien is (rechtsonder telt hij af). Onderaan gaat hij terug naar boven en begint alles opnieuw.
- Tijdens de rondleiding: **pijltje rechts** of **spatie** = meteen verder, **pijltje links** = terug.
- De 3D-animatie past zich aan de computer aan: laptops met een ingebouwde grafische chip beginnen op een lichtere stand, en als het toch hapert gaat eerst de scherpte en daarna de effecten omlaag. Met `index.html?q=low`, `?q=mid` of `?q=high` zet je een vaste stand.
- De afbeeldingen in `img/` zijn renders uit de 3D-animatie zelf. Lettertypes staan in `fonts/` (zie `fonts/LICENSE.txt`).
- Computers zonder WebGL krijgen automatisch een eenvoudigere 2D-animatie.

## Teksten en tijden aanpassen (beheerpagina)

Er is een verborgen beheerpagina die nergens op de site gelinkt staat: `/admin/` (of `admin/index.html` als je de map op de computer opent). Daar pas je zonder code aan:

- alle teksten: titel, inleiding, getallen, de vijf deelvragen, de teksten in de 3D-animatie, conclusie, bronnen en voettekst;
- per tekst een eigen tijd voor de rondleiding (leeg = automatisch op basis van het aantal woorden), en het algemene leestempo;
- bronnen toevoegen, verwijderen en verschuiven. In teksten verwijs je naar een bron met de code tussen dubbele haken, bijvoorbeeld `[[npo]]`; op de site wordt dat vanzelf een genummerde link zoals [3].

Alle standaardteksten staan in `js/content.js`; `js/render.js` bouwt daar de pagina mee op. Met **Opslaan als content.js** maak je een nieuw bestand om `js/content.js` mee te vervangen (handig voor een versie zonder internet).

## Inloggen en beheerders

Zodra er een Firebase-project is gekoppeld (gratis), moet je inloggen op de beheerpagina en worden de teksten online opgeslagen. Dan ziet iedereen die de site opent de nieuwe teksten, ook op andere computers. Een site die al openstaat werkt zichzelf binnen twee minuten bij (tijdens de rondleiding pas als hij weer bovenaan begint). Zonder internet gebruikt de site de laatst opgehaalde teksten, of anders `js/content.js`.

- **Hoofdbeheerder:** `622521@nxt.eu`. Alleen dit account kan beheerders toevoegen en verwijderen (menu **Beheerders**).
- **Beheerder toevoegen:** de hoofdbeheerder vult een e-mailadres in en klikt op **Uitnodigen**. Diegene krijgt een mail met een link, kiest daar een eigen wachtwoord en kan daarna inloggen en alle teksten aanpassen.
- **Wachtwoord vergeten:** klik op het inlogscherm op "Wachtwoord vergeten?". Je krijgt dan een mail.

Het wachtwoord staat nergens in de bestanden van de site. Het wordt alleen in Firebase ingesteld (stap 3).

### Eenmalig instellen (ongeveer 10 minuten)

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com), log in met een Google-account en klik op **Project maken** (Google Analytics mag uit).
2. **Authentication** → Aan de slag → tab **Sign-in method**: zet **E-mail/wachtwoord** aan, en zet in hetzelfde venster ook **E-maillink (inloggen zonder wachtwoord)** aan. Die is nodig voor de uitnodigingen.
3. **Authentication** → tab **Users** → **Gebruiker toevoegen**: e-mail `622521@nxt.eu` en het wachtwoord van de hoofdbeheerder. Doe dit meteen, vóór de site online gaat.
4. (Aanrader) **Authentication** → tab **Templates** → taal van de sjablonen op **Nederlands** zetten.
5. **Firestore Database** → Database maken → productiemodus → locatie in Europa. Open het tabblad **Regels**, vervang alles door de inhoud van `firestore.rules` en klik op **Publiceren**.
6. Projectinstellingen (tandwiel) → **Jouw apps** → web-app toevoegen (`</>`). Kopieer `apiKey`, `authDomain`, `projectId` en `appId` naar `js/firebase-config.js` (daar staat een voorbeeld).
7. Zet de site online. Dat is nodig voor de uitnodigingsmails. Twee manieren:
   - het makkelijkst: sleep de map met `index.html` naar [app.netlify.com/drop](https://app.netlify.com/drop);
   - of met Firebase Hosting: `npx firebase-tools login` en daarna `npx firebase-tools deploy --project <project-id>` (zet meteen ook de regels uit `firestore.rules` online).
8. **Authentication** → **Settings** → **Authorized domains**: voeg het webadres van de site toe (bijvoorbeeld `jullie-site.netlify.app`).
9. Ga naar `https://<jullie-adres>/admin/` en log in als hoofdbeheerder.

Het adres van de hoofdbeheerder staat in `firestore.rules` en in `src/admin-cloud.js`. Pas het op beide plekken aan en draai daarna `npm run build`.

## 3D-animatie aanpassen

De broncode staat in `src/car3d.js`; `js/car3d.js` en `js/car-model.js` worden daaruit gebouwd (en `admin/firebase.js` uit `src/admin-cloud.js`):

```
npm install
npm run build
```

3D-automodel: "Car Concept" door Eric Chadwick / Darmstadt Graphics Group, via de [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), licentie [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Het model is gecomprimeerd en in losse onderdelen opgedeeld voor de montage-animatie.
