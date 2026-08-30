// Sitewide "instant delete, then Save/Revert" behavior for any delete form
// marked with class="js-pending-delete". Clicking Delete doesn't touch the
// server at all -- it just hides the row (its closest [data-delete-item]
// ancestor) and remembers the form's action/csrf, then shows a bottom bar.
// "Revert" un-hides everything with zero network calls. "Save changes"
// fires the real delete requests (the same routes the forms already posted
// to) and reloads once they're done, so the page always ends up reflecting
// the server's actual state even if one of several deletes fails.
//
// A form with more than one submit button (e.g. "Save" + "Delete role",
// where Delete uses formaction to point elsewhere) can't be marked on the
// <form> itself, since that would stage *every* submit including Save.
// Mark just the delete <button> with class="js-pending-delete-btn" instead
// -- only that button's clicks get staged, Save still submits normally.
(function () {
  var pending = [];
  var bar = null;
  var countEl = null;
  var saveBtn = null;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'pending-changes-bar';
    bar.innerHTML =
      '<span class="pending-changes-count"></span>' +
      '<span class="pending-changes-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-pending-revert>Revert</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-pending-save>Save changes</button>' +
      '</span>';
    document.body.appendChild(bar);
    countEl = bar.querySelector('.pending-changes-count');
    saveBtn = bar.querySelector('[data-pending-save]');
    bar.querySelector('[data-pending-revert]').addEventListener('click', revertAll);
    saveBtn.addEventListener('click', saveAll);
    return bar;
  }

  function updateBar() {
    if (pending.length === 0) {
      if (bar) bar.classList.remove('is-visible');
      return;
    }
    ensureBar();
    countEl.textContent = pending.length === 1
      ? '1 pending deletion'
      : pending.length + ' pending deletions';
    bar.classList.add('is-visible');
  }

  function revertAll() {
    pending.forEach(function (p) {
      p.item.classList.remove('pending-delete-hidden');
    });
    pending = [];
    updateBar();
  }

  function saveAll() {
    var toSave = pending.slice();
    saveBtn.disabled = true;
    bar.querySelector('[data-pending-revert]').disabled = true;
    saveBtn.textContent = 'Saving…';
    Promise.all(toSave.map(function (p) {
      var body = new URLSearchParams();
      if (p.csrf) body.set('_csrf', p.csrf);
      return fetch(p.url, { method: 'POST', body: body, credentials: 'same-origin' }).catch(function () {});
    })).then(function () {
      window.location.reload();
    });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    var submitter = e.submitter;
    var isFormDelete = form.classList && form.classList.contains('js-pending-delete');
    var isButtonDelete = submitter && submitter.classList && submitter.classList.contains('js-pending-delete-btn');
    if (!isFormDelete && !isButtonDelete) return;
    var item = form.closest('[data-delete-item]');
    if (!item) return; // no wrapper marked -- fall back to a normal submit
    e.preventDefault();
    var csrfInput = form.querySelector('input[name="_csrf"]');
    var url = (isButtonDelete && submitter.getAttribute('formaction')) || form.getAttribute('action');
    item.classList.add('pending-delete-hidden');
    pending.push({ url: url, csrf: csrfInput ? csrfInput.value : '', item: item });
    updateBar();
  });
})();
