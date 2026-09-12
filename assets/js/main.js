(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Mobile nav toggle ---- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      mainNav.classList.toggle('open');
    });
  }

  /* ---- "More" overflow menu: collapse nav links that don't fit ---- */
  (function setupNavOverflow() {
    var links = document.getElementById('navLinks');
    var moreWrap = document.getElementById('navMore');
    var moreBtn = document.getElementById('navMoreBtn');
    var moreMenu = document.getElementById('navMoreMenu');
    if (!links || !moreWrap || !moreBtn || !moreMenu) return;

    var allLinks = Array.prototype.slice.call(links.children);

    function recalc() {
      if (window.innerWidth <= 760) { moreWrap.hidden = true; return; }
      moreWrap.hidden = false;
      allLinks.forEach(function (a) { a.style.display = ''; });
      moreMenu.innerHTML = '';
      moreMenu.classList.remove('open');

      var nav = links.parentElement;
      var available = nav.clientWidth - moreBtn.offsetWidth - 12;
      var used = 0;
      var overflowed = [];
      allLinks.forEach(function (a) {
        used += a.offsetWidth + 4;
        if (used > available) overflowed.push(a);
      });

      if (overflowed.length === 0) {
        moreWrap.style.display = 'none';
        return;
      }
      moreWrap.style.display = '';
      overflowed.forEach(function (a) {
        a.style.display = 'none';
        var clone = a.cloneNode(true);
        moreMenu.appendChild(clone);
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
})();
