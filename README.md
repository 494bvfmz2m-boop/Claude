# Hoe wordt een auto gemaakt?

Schoolproject-website over het ontwerp- en productieproces van een auto, met een 3D-animatie van een autofabriek waarin een auto stap voor stap wordt opgebouwd.

## Bekijken

Open `index.html` in een browser (dubbelklikken is genoeg, er is geen internet of server nodig). Alle gebruikte informatie staat met bronvermelding onderaan de pagina.

- De 3D-animatie bovenaan start vanzelf en begint na afloop opnieuw.
- **W** zet de rondleiding aan/uit (voor een scherm of beamer op een markt). Hij wacht tot de auto klaar is, scrolt dan van kopje naar kopje en blijft bij elk kopje even staan (hoe lang hangt af van de hoeveelheid tekst; het gele balkje onder het menu laat zien hoe lang nog). Onderaan gaat hij terug naar boven en begint alles opnieuw.
- De afbeeldingen in `img/` zijn renders uit de 3D-animatie zelf.
- Computers zonder WebGL krijgen automatisch een eenvoudigere 2D-animatie.
- `index.html?q=low` forceert de lichtste 3D-kwaliteit (de pagina schakelt ook zelf terug als het te traag loopt).

## 3D-animatie aanpassen

De broncode staat in `src/car3d.js`; `js/car3d.js` en `js/car-model.js` worden daaruit gebouwd:

```
npm install
npm run build
```

3D-automodel: "Car Concept" door Eric Chadwick / Darmstadt Graphics Group, via de [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), licentie [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Het model is gecomprimeerd en in losse onderdelen opgedeeld voor de montage-animatie.
