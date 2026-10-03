// Small progressive enhancements: staggered reveals and button feedback.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var items = document.querySelectorAll('.card, .product-card, tbody tr');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        entry.target.style.animation = 'rise .5s cubic-bezier(.2,.7,.3,1) both';
        entry.target.style.animationDelay = Math.min(i * 0.05, 0.3) + 's';
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener('submit', function (e) {
    var btn = e.target.querySelector('button[type=submit], .btn[type=submit]');
    if (btn && !btn.disabled) {
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Working\u2026';
      setTimeout(function () { btn.disabled = true; }, 0);
      setTimeout(function () {
        btn.disabled = false;
        if (btn.dataset.label) btn.textContent = btn.dataset.label;
      }, 8000);
    }
  });
})();
