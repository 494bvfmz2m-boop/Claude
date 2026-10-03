// Small progressive enhancements: reveals, button feedback and the live chat.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var btn = e.target.querySelector('button[type=submit]');
    if (btn && !btn.disabled) {
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Bezig…';
      setTimeout(function () { btn.disabled = true; }, 0);
      setTimeout(function () {
        btn.disabled = false;
        if (btn.dataset.label) btn.textContent = btn.dataset.label;
      }, 8000);
    }
  });

  // Live chat: poll for new messages and send without reloading the page.
  var thread = document.getElementById('chat-thread');
  var form = document.getElementById('chat-form');
  if (!thread || !window.fetch) return;

  var api = thread.dataset.api;
  var me = thread.dataset.me;
  var after = parseInt(thread.dataset.after || '0', 10);
  var busy = false;

  function scrollDown() { thread.scrollTop = thread.scrollHeight; }

  function add(m) {
    if (m.id <= after) return;
    after = m.id;
    var empty = thread.querySelector('.chat-empty');
    if (empty) empty.remove();
    var mine = (me === 'admin') === m.admin;
    var div = document.createElement('div');
    div.className = 'msg ' + (mine ? 'mine' : 'theirs');
    var p = document.createElement('p');
    p.textContent = m.body; // textContent keeps it safe from HTML injection
    var t = document.createElement('span');
    t.textContent = m.time;
    div.appendChild(p);
    div.appendChild(t);
    thread.appendChild(div);
  }

  function handle(res) {
    return res.json().then(function (data) {
      if (data.error) throw new Error(data.error);
      var near = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
      (data.messages || []).forEach(add);
      if (near) scrollDown();
    });
  }

  function poll() {
    if (busy || document.hidden) return;
    busy = true;
    fetch(api + '&after=' + after, { credentials: 'same-origin' })
      .then(handle).catch(function () {})
      .then(function () { busy = false; });
  }

  scrollDown();
  setInterval(poll, 4000);
  document.addEventListener('visibilitychange', poll);

  if (form) {
    var box = form.querySelector('textarea');
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!box.value.trim()) return;
      var data = new FormData(form);
      var btn = form.querySelector('button');
      btn.disabled = true;
      fetch(api + '&after=' + after, { method: 'POST', body: data, credentials: 'same-origin' })
        .then(handle)
        .then(function () { box.value = ''; scrollDown(); })
        .catch(function (err) { alert(err.message || 'Versturen mislukt. Probeer het opnieuw.'); })
        .then(function () { btn.disabled = false; box.focus(); });
    });
  }
})();
