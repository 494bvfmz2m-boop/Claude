(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Header shadow once the page scrolls ---- */
  (function setupHeaderShadow() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  })();

  /* ---- Scroll-reveal for [data-reveal] elements ---- */
  (function setupScrollReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    // Only hide-then-reveal if we can actually observe and reveal things —
    // otherwise (no IntersectionObserver, or reduced motion) show everything
    // immediately rather than risk content stuck invisible.
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('reveal-visible'); });
      return;
    }

    document.documentElement.classList.add('js-reveal');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { observer.observe(el); });
  })();

  /* ---- Loading feedback on form submit ---- */
  (function setupSubmitLoading() {
    document.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return; // a data-confirm dialog the user cancelled, etc.
      var form = e.target;
      if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-loading')) return;
      var btn = e.submitter || form.querySelector('button[type="submit"], button:not([type])');
      // pointer-events (not the disabled attribute) so a named submit button's
      // value is still included in the submitted form data.
      if (btn) btn.classList.add('is-loading');
    });
  })();

  /* ---- Mobile nav toggle ---- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  var siteHeader = document.querySelector('.site-header');
  if (navToggle && mainNav) {
    // The header can grow a second row (the cart/auth buttons wrap under it
    // once the slide-out panel is open on a narrow phone), so the panel's
    // position is computed from the header's real height rather than a
    // fixed guess — otherwise the two can drift apart and overlap.
    function positionMobileNav() {
      if (!siteHeader) return;
      // This inline sizing is only meant for the slide-out phone menu
      // (see the max-width:760px rule for .main-nav). Media queries don't
      // scope inline styles set from JS, so without this guard the same
      // code would also run on desktop and stretch the whole header to
      // fill the screen.
      if (window.innerWidth > 760) {
        mainNav.style.top = '';
        mainNav.style.height = '';
        return;
      }
      var h = siteHeader.getBoundingClientRect().height;
      mainNav.style.top = h + 'px';
      mainNav.style.height = (window.innerHeight - h) + 'px';
    }
    navToggle.addEventListener('click', function () {
      mainNav.classList.toggle('open');
      positionMobileNav();
    });
    window.addEventListener('resize', positionMobileNav);
    positionMobileNav();
  }

  /* ---- "More" overflow menu: collapse nav links that don't fit ---- */
  (function setupNavOverflow() {
    var links = document.getElementById('navLinks');
    var moreWrap = document.getElementById('navMore');
    var moreBtn = document.getElementById('navMoreBtn');
    var moreMenu = document.getElementById('navMoreMenu');
    var moreDynamic = document.getElementById('navMoreDynamic');
    if (!links || !moreWrap || !moreBtn || !moreMenu || !moreDynamic) return;

    // Rules/Announcements live permanently in the dropdown (see header.php) and
    // have a hidden desktop duplicate in the main row just so the mobile
    // slide-out menu still lists them — exclude that duplicate from the
    // overflow measurement below since it's never actually visible here.
    var allLinks = Array.prototype.slice.call(links.children).filter(function (a) {
      return !a.classList.contains('mobile-only-link');
    });

    function recalc() {
      if (window.innerWidth <= 760) { moreWrap.hidden = true; return; }
      moreWrap.hidden = false;
      // The dropdown always holds Rules & Announcements regardless of
      // overflow, so the button itself always stays visible on desktop.
      moreWrap.style.display = '';
      allLinks.forEach(function (a) { a.style.display = ''; });
      moreDynamic.innerHTML = '';
      moreMenu.classList.remove('open');

      var nav = links.parentElement;
      var available = nav.clientWidth - moreBtn.offsetWidth - 12;
      var used = 0;
      var overflowed = [];
      allLinks.forEach(function (a) {
        used += a.offsetWidth + 4;
        if (used > available) overflowed.push(a);
      });

      overflowed.forEach(function (a) {
        var clone = a.cloneNode(true);
        clone.style.display = ''; // cloneNode copies the inline style below, which would otherwise hide it too
        moreDynamic.appendChild(clone);
        a.style.display = 'none';
      });
    }

    moreBtn.addEventListener('click', function () {
      moreMenu.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!moreWrap.contains(e.target)) moreMenu.classList.remove('open');
    });

    window.addEventListener('resize', recalc);
    window.addEventListener('load', recalc);
    // Fallback-font metrics during the very first measurement can be
    // narrower than the real webfont, making links look like they fit when
    // they won't once Pixelify Sans/Inter actually swap in — recheck then.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(recalc);
    }
    recalc();
  })();

  /* ---- Rules tabs ---- */
  var tabButtons = document.querySelectorAll('[data-rules-tab]');
  if (tabButtons.length) {
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-rules-tab');
        tabButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.querySelectorAll('[data-rules-panel]').forEach(function (panel) {
          panel.classList.toggle('active', panel.getAttribute('data-rules-panel') === target);
        });
      });
    });
  }

  /* ---- Confirm dialogs on destructive forms ---- */
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });

  /* ---- Live server status widget (homepage) ---- */
  (function loadServerStatus() {
    var overallPill = document.getElementById('overallPill');
    if (!overallPill) return;

    fetch('/api/server_status')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var javaOnline = data.java && data.java.online;
        var bedrockOnline = data.bedrock && data.bedrock.online;

        if (javaOnline || bedrockOnline) {
          overallPill.textContent = 'Online';
          overallPill.className = 'status-pill online';
        } else {
          overallPill.textContent = 'Offline';
          overallPill.className = 'status-pill offline';
        }

        fillBlock('java', data.java);
        fillBlock('bedrock', data.bedrock);
      })
      .catch(function () {
        overallPill.textContent = 'Unavailable';
      });

    function fillBlock(prefix, info) {
      var playersEl = document.getElementById(prefix + 'Players');
      var listEl = document.getElementById(prefix + 'PlayerList');
      if (!playersEl) return;
      if (!info) {
        playersEl.textContent = '—';
        return;
      }
      playersEl.textContent = info.online
        ? info.players_online + ' / ' + info.players_max + ' players'
        : 'Offline';
      if (listEl && info.players_list && info.players_list.length) {
        listEl.textContent = info.players_list.slice(0, 12).join(', ');
      }
    }
  })();

  /* ---- Staff drag-and-drop reorder (Admin -> Staff Order) ---- */
  (function setupStaffOrder() {
    var list = document.getElementById('staffOrderList');
    var orderInput = document.getElementById('orderInput');
    if (!list || !orderInput) return;

    var dragged = null;
    list.querySelectorAll('.staff-order-item').forEach(function (item) {
      item.addEventListener('dragstart', function () {
        dragged = item;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('dragging');
        syncOrder();
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        var after = getDragAfterElement(list, e.clientY);
        if (after == null) {
          list.appendChild(dragged);
        } else {
          list.insertBefore(dragged, after);
        }
      });
    });

    function getDragAfterElement(container, y) {
      var items = Array.prototype.slice.call(container.querySelectorAll('.staff-order-item:not(.dragging)'));
      return items.reduce(function (closest, child) {
        var box = child.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        }
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function syncOrder() {
      var ids = Array.prototype.map.call(list.querySelectorAll('.staff-order-item'), function (el) {
        return el.getAttribute('data-user-id');
      });
      orderInput.value = ids.join(',');
    }
    syncOrder();

    var saveForm = document.getElementById('saveOrderForm');
    if (saveForm) saveForm.addEventListener('submit', syncOrder);
  })();

  /* ---- Role editor: toggle gradient color picker ---- */
  (function setupRoleForm() {
    var form = document.getElementById('roleForm');
    if (!form) return;
    var checkbox = document.getElementById('use_gradient');
    var wrap = document.getElementById('color2Wrap');
    if (!checkbox || !wrap) return;
    function sync() { wrap.style.display = checkbox.checked ? '' : 'none'; }
    checkbox.addEventListener('change', sync);
    sync();
  })();

  /* ---- Theme falling-particle effects ---- */
  (function setupThemeEffects() {
    if (prefersReducedMotion) return;
    var theme = document.body.getAttribute('data-theme');
    var effectsOn = document.body.getAttribute('data-effects') === '1';
    if (!effectsOn || theme === 'default') return;

    var particles = { halloween: '🦇', christmas: '❄️', valentines: '💗', summer: '🌊' };
    var symbol = particles[theme];
    if (!symbol) return;

    var layer = document.createElement('div');
    layer.className = 'fx-layer';
    document.body.appendChild(layer);

    for (var i = 0; i < 24; i++) {
      var p = document.createElement('span');
      p.className = 'fx-particle';
      p.textContent = symbol;
      p.style.left = Math.random() * 100 + 'vw';
      p.style.fontSize = (12 + Math.random() * 14) + 'px';
      p.style.opacity = String(0.35 + Math.random() * 0.5);
      p.style.animationDuration = (8 + Math.random() * 10) + 's';
      p.style.animationDelay = (Math.random() * -15) + 's';
      layer.appendChild(p);
    }
  })();

  /* ---- Store package preview modal ---- */
  (function setupPackageModal() {
    var overlay = document.getElementById('packageModalOverlay');
    if (!overlay) return;

    var closeBtn = document.getElementById('packageModalClose');
    var buyBtn = document.getElementById('packageModalBuy');
    var titleEl = document.getElementById('packageModalTitle');
    var introEl = document.getElementById('packageModalIntro');
    var featuresEl = document.getElementById('packageModalFeatures');
    var priceEl = document.getElementById('packageModalPrice');
    var tagsEl = document.getElementById('packageModalTags');
    var imageEl = document.getElementById('packageModalImage');

    function openModalFor(card) {
      titleEl.textContent = card.getAttribute('data-name') || '';
      introEl.textContent = card.getAttribute('data-intro') || '';
      introEl.hidden = !introEl.textContent;

      var features = [];
      try { features = JSON.parse(card.getAttribute('data-features') || '[]'); } catch (e) { features = []; }
      featuresEl.innerHTML = '';
      features.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        featuresEl.appendChild(li);
      });

      var tags = [];
      try { tags = JSON.parse(card.getAttribute('data-tags') || '[]'); } catch (e) { tags = []; }
      tagsEl.innerHTML = '';
      tags.forEach(function (t) {
        var span = document.createElement('span');
        span.className = 'pkg-tag pkg-tag-' + t.toLowerCase();
        span.textContent = t;
        tagsEl.appendChild(span);
      });

      priceEl.innerHTML = card.getAttribute('data-price-html') || '';

      var image = card.getAttribute('data-image');
      if (image) {
        imageEl.src = image;
        imageEl.hidden = false;
      } else {
        imageEl.hidden = true;
        imageEl.removeAttribute('src');
      }

      buyBtn.setAttribute('data-package-id', card.getAttribute('data-package-id') || '');
      overlay.classList.add('open');
    }

    function closeModal() {
      overlay.classList.remove('open');
    }

    document.querySelectorAll('[data-package-card]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('form')) return; // let the card's own Buy now button submit normally
        openModalFor(card);
      });
    });

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    buyBtn.addEventListener('click', function () {
      var id = buyBtn.getAttribute('data-package-id');
      var form = document.querySelector('form[data-package-form="' + id + '"]');
      if (form) form.submit();
    });
  })();

  /* ---- Cart icon "bump" after something is added (see store.php's #cartJustAdded marker) ---- */
  (function bumpCartOnAdd() {
    if (prefersReducedMotion) return;
    if (!document.getElementById('cartJustAdded')) return;
    var chip = document.querySelector('.cart-chip');
    if (!chip) return;
    chip.classList.add('bump');
    chip.addEventListener('animationend', function () { chip.classList.remove('bump'); }, { once: true });
  })();

  /* ---- Count up from 0 to a number already rendered in an element's text
     (never from a data-attribute placeholder — the real value must already
     be there for anyone without JS, this just animates toward it). ---- */
  function countUpElement(el, duration) {
    var text = el.textContent;
    var match = text.match(/[\d.,]+/);
    if (!match) return;
    var target = parseFloat(match[0].replace(/,/g, ''));
    if (isNaN(target)) return;
    var prefix = text.slice(0, match.index);
    var suffix = text.slice(match.index + match[0].length);
    var decimals = (match[0].split('.')[1] || '').length;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  if (!prefersReducedMotion) {
    var basketTotalEl = document.getElementById('basketTotal');
    if (basketTotalEl) countUpElement(basketTotalEl, 600);

    document.querySelectorAll('.stat-number').forEach(function (el) {
      countUpElement(el, 900);
    });
  }
})();
