// The holding page at the root of the domain.
(function () {
    'use strict';
    const fx = window.egFx;
    document.getElementById('year').textContent = new Date().getFullYear();
    fx.splitChars(document.querySelector('.l-hero h1 .split'));
    fx.parallax(document.getElementById('rings'));
    fx.starfield(document.getElementById('stars'));
    fx.magnetic(document.querySelectorAll('[data-magnetic]'));
    fx.cursorGlow();
})();
