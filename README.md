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

Alle standaardteksten staan in `js/content.js`; `js/render.js` bouwt daar de pagina mee op. **Opslaan** bewaart de teksten in deze browser; de site gebruikt ze meteen. Met **Opslaan als content.js** maak je een nieuw bestand om `js/content.js` mee te vervangen, zodat de teksten ook op andere computers werken.

## Inloggen en beheerders

De beheerpagina heeft een eigen login, zonder externe dienst of instellingen.

- **Hoofdbeheerder:** `622521@nxt.eu`. Het wachtwoord staat niet leesbaar in de bestanden, alleen als versleutelde hash in `admin/accounts.js`.
- **Beheerder toevoegen:** log in als hoofdbeheerder → **Beheerders** → vul een e-mailadres in → **Uitnodigen**. Je mailprogramma opent met een kant-en-klare uitnodiging (of kopieer de link). Via die link kiest de nieuwe beheerder een eigen wachtwoord en kan daarna inloggen.
- **Wachtwoord wijzigen** kan onder **Beheerders**. Wachtwoord vergeten? De hoofdbeheerder stuurt een nieuwe link (die zet het account opnieuw klaar).
- Nieuwe accounts en wachtwoorden worden in de browser bewaard, net als de teksten. Moeten ze ook op een andere computer of online werken? Klik op **Accounts opslaan als bestand** en vervang daarmee `admin/accounts.js` (en op dezelfde manier `js/content.js` voor de teksten).
- Een uitnodigingslink werkt op de computer waar de uitnodiging is gemaakt, of overal nadat het nieuwe `admin/accounts.js` op de site staat.

Let op: dit is een eenvoudige login voor een schoolsite zonder server. Hij houdt bezoekers van de beheerpagina weg, maar is geen bankbeveiliging.

## 3D-animatie aanpassen

De broncode staat in `src/car3d.js`; `js/car3d.js` en `js/car-model.js` worden daaruit gebouwd:

```
npm install
npm run build
```

3D-automodel: "Car Concept" door Eric Chadwick / Darmstadt Graphics Group, via de [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), licentie [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Het model is gecomprimeerd en in losse onderdelen opgedeeld voor de montage-animatie.
