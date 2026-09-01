(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Splash: play once per browser session ----
  var splash = document.getElementById('xyphros-splash');
  if (splash) {
    var skip = false;
    try {
      skip = Boolean(sessionStorage.getItem('xyphrosSplashShown')) || reduceMotion;
      if (!skip) sessionStorage.setItem('xyphrosSplashShown', '1');
    } catch (e) {}
    if (skip) {
      splash.remove();
    } else {
      window.addEventListener('load', function () {
        // The impact GIF plays at its normal (original, ~2.7s) speed, but
        // this only shows once per browser session, so we don't hold the
        // page hostage waiting for the whole clip -- a short fixed wait
        // clears it quickly, then the animation keeps quietly playing out
        // underneath while the fade finishes.
        setTimeout(function () {
          splash.classList.add('xyphros-splash--out');
          setTimeout(function () { splash.remove(); }, 400);
        }, 650);
      });
    }
  }

  // ---- Impact flourishes: small badges that replay the impact GIF on a
  // loose, staggered timer, then sit idle on the static logo between plays
  // instead of looping continuously ----
  if (!reduceMotion) {
    document.querySelectorAll('.impact-flourish').forEach(function (el, i) {
      var idle = el.getAttribute('data-idle');
      var impact = el.getAttribute('data-impact');
      if (!idle || !impact) return;
      var playing = false;
      var play = function () {
        if (playing) return;
        playing = true;
        el.src = impact;
        setTimeout(function () {
          el.src = idle;
          playing = false;
        }, 2820);
      };
      var scheduleNext = function () {
        var gap = 9000 + Math.random() * 8000; // 9-17s breather between plays
        setTimeout(function () { play(); scheduleNext(); }, gap);
      };
      // Stagger each badge's first play so they don't all fire together, then
      // let scheduleNext take over for the randomized breaks after that.
      setTimeout(function () { play(); scheduleNext(); }, 1500 + i * 2200);
    });
  }

  // ---- Reveal-on-scroll, staggered within each group ----
  var groups = document.querySelectorAll('[data-reveal-group]');
  groups.forEach(function (group) {
    var items = group.querySelectorAll('.reveal');
    items.forEach(function (el, i) { el.style.setProperty('--i', i); });
  });

  var targets = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { observer.observe(el); });
  }

  // ---- Hero logo parallax tilt (follows the cursor) ----
  var heroLogo = document.querySelector('.hero-logo');
  var heroLogoWrap = document.querySelector('.hero-logo-wrap');
  if (heroLogo && heroLogoWrap && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    heroLogoWrap.addEventListener('mousemove', function (e) {
      var rect = heroLogoWrap.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      heroLogo.style.transform = 'rotateY(' + (x * 24) + 'deg) rotateX(' + (y * -24) + 'deg)';
    });
    heroLogoWrap.addEventListener('mouseleave', function () {
      heroLogo.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  }

  // ---- Beta slot count-up + progress bar ----
  // Starts from the fallback numbers baked into the HTML, then tries to
  // replace them with a live count from the bot's /api/beta-status. That
  // fetch is best-effort (offline, CORS, bot down) -- on failure the page
  // just keeps showing the static fallback, nothing breaks.
  var betaEl = document.querySelector('[data-beta-total]');
  if (betaEl) {
    var total = parseInt(betaEl.getAttribute('data-beta-total'), 10) || 0;
    var taken = parseInt(betaEl.getAttribute('data-beta-taken'), 10) || 0;
    var remaining = Math.max(0, total - taken);
    var countEl = betaEl.querySelector('.beta-remaining');
    var fillEl = betaEl.querySelector('.beta-bar-fill');
    var heroLeftEl = document.getElementById('hero-spots-left');
    var betaTotalEl = document.getElementById('beta-total-num');
    var ctaLeftEl = document.getElementById('cta-spots-left');
    var ctaTotalEl = document.getElementById('cta-spots-total');
    var hasAnimated = false;

    var setFill = function () {
      if (fillEl) fillEl.style.width = (total > 0 ? (taken / total) * 100 : 0) + '%';
    };

    var updateStaticText = function () {
      remaining = Math.max(0, total - taken);
      if (heroLeftEl) heroLeftEl.textContent = remaining;
      if (betaTotalEl) betaTotalEl.textContent = total;
      if (ctaLeftEl) ctaLeftEl.textContent = remaining;
      if (ctaTotalEl) ctaTotalEl.textContent = total;
    };
    updateStaticText();

    var animateCount = function () {
      hasAnimated = true;
      setFill();
      if (!countEl) return;
      if (reduceMotion) { countEl.textContent = remaining; return; }
      var start = null;
      var duration = 900;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        countEl.textContent = Math.round(eased * remaining);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      var betaObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { animateCount(); betaObserver.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      betaObserver.observe(betaEl);
    } else {
      animateCount();
    }

    fetch('https://bot.xyphros.site/api/beta-status', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || typeof data.taken !== 'number' || typeof data.total !== 'number') return;
        total = data.total;
        taken = data.taken;
        updateStaticText();
        setFill();
        // The count-up either hasn't run yet (it'll use the updated numbers
        // when it does) or already finished -- either way just snap the
        // displayed number to the live value instead of re-animating.
        if (hasAnimated && countEl) countEl.textContent = remaining;
      })
      .catch(function () {});
  }

  // ---- Smooth page transition between same-site pages ----
  if (!reduceMotion) {
    document.querySelectorAll('a[href]').forEach(function (link) {
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      var href = link.getAttribute('href');
      if (!href || href.indexOf('://') !== -1 || href.indexOf('mailto:') === 0) return;
      var url;
      try { url = new URL(href, window.location.href); } catch (e) { return; }
      // A link to a fragment on the page we're already on should just scroll,
      // not trigger a full-page fade + reload.
      if (url.pathname === window.location.pathname && url.hash) return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        document.body.classList.add('is-leaving');
        setTimeout(function () { window.location.href = href; }, 220);
      });
    });
  }

  // ---- Footer year ----
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
