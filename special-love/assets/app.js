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
    if (e.defaultPrevented) return; // e.g. a cancelled "are you sure?" box
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

// Product gallery: click a thumbnail to show that photo or video.
(function () {
  document.querySelectorAll('[data-gallery]').forEach(function (g) {
    var slides = g.querySelectorAll('.gallery-slide');
    var thumbs = g.querySelectorAll('.gallery-thumb');
    thumbs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        slides.forEach(function (s, j) {
          s.classList.toggle('active', i === j);
          var v = s.querySelector('video');
          if (v && i !== j) v.pause();
        });
        thumbs.forEach(function (x, j) { x.classList.toggle('active', i === j); });
      });
    });
  });
})();

// Custom print chat: fetch new messages every 10 seconds without reloading the page.
(function () {
  var chat = document.querySelector('[data-chat]');
  if (!chat) return;
  chat.scrollTop = chat.scrollHeight;
  setInterval(function () {
    if (document.hidden) return;
    fetch(window.location.href, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-chat]');
        if (!fresh || fresh.dataset.count === chat.dataset.count) return;
        var atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
        chat.innerHTML = fresh.innerHTML;
        chat.dataset.count = fresh.dataset.count;
        if (atBottom) chat.scrollTop = chat.scrollHeight;
        // A new quote may have arrived: refresh the quote box too.
        var q = document.querySelector('[data-quote]'), fq = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-quote]');
        if (q && fq && !q.contains(document.activeElement)) q.innerHTML = fq.innerHTML;
      })
      .catch(function () {});
  }, 10000);
})();
