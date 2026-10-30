// The holding page at the root of the domain.
(function () {
    'use strict';
    document.getElementById('year').textContent = new Date().getFullYear();
    window.egFx.parallax(document.getElementById('rings'));
    window.egFx.starfield(document.getElementById('stars'));
})();
