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

Er is een verborgen beheerpagina die nergens op de site gelinkt staat: `admin/index.html` (op een webserver: `/admin/`). Daar pas je zonder code aan:

- alle teksten: titel, inleiding, getallen, de vijf deelvragen, de teksten in de 3D-animatie, conclusie, bronnen en voettekst;
- per tekst een eigen tijd voor de rondleiding (leeg = automatisch op basis van het aantal woorden), en het algemene leestempo;
- bronnen toevoegen, verwijderen en verschuiven. In teksten verwijs je naar een bron met de code tussen dubbele haken, bijvoorbeeld `[[npo]]`; op de site wordt dat vanzelf een genummerde link zoals [3].

**Opslaan** bewaart de teksten in deze browser; de site gebruikt ze meteen (een open tabblad werkt zichzelf bij). Wil je ze op een andere computer of in de zip hebben, klik dan op **Opslaan als content.js** en vervang daarmee `js/content.js`. **Terugzetten** gooit de aanpassingen in de browser weg.

Alle teksten staan in `js/content.js`; `js/render.js` bouwt daar de pagina mee op.

## 3D-animatie aanpassen

De broncode staat in `src/car3d.js`; `js/car3d.js` en `js/car-model.js` worden daaruit gebouwd:

```
npm install
npm run build
```

3D-automodel: "Car Concept" door Eric Chadwick / Darmstadt Graphics Group, via de [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), licentie [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Het model is gecomprimeerd en in losse onderdelen opgedeeld voor de montage-animatie.
