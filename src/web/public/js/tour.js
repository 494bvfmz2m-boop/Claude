// Lightweight, dependency-free guided tour. Each step optionally targets an
// element by selector (a spotlight + ring is drawn around it); a step with
// no selector centers the tooltip as a plain welcome/done card. Steps whose
// target doesn't exist on the current page (e.g. a nav link a limited-access
// user can't see) are skipped rather than shown against nothing.
(function () {
  function Tour(steps, opts) {
    this.steps = steps.filter(function (s) { return !s.selector || document.querySelector(s.selector); });
    this.opts = opts || {};
    this.i = 0;
  }

  Tour.prototype.start = function () {
    if (this.steps.length === 0) { if (this.opts.onEnd) this.opts.onEnd(false); return; }

    this.blocker = document.createElement('div');
    this.blocker.className = 'tour-blocker';
    document.body.appendChild(this.blocker);

    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tour-spotlight';
    document.body.appendChild(this.spotlight);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tour-tooltip';
    document.body.appendChild(this.tooltip);

    var self = this;
    this._onResize = function () { self.position(); };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scroll', this._onResize, true);
    this._onKey = function (e) { if (e.key === 'Escape') self.end(false); };
    document.addEventListener('keydown', this._onKey);

    this.render();
  };

  Tour.prototype.currentTarget = function () {
    var step = this.steps[this.i];
    return step.selector ? document.querySelector(step.selector) : null;
  };

  Tour.prototype.render = function () {
    var self = this;
    var step = this.steps[this.i];
    var target = this.currentTarget();

    this.spotlight.style.display = target ? '' : 'none';
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    this.tooltip.innerHTML = '';

    var progressEl = document.createElement('div');
    progressEl.className = 'tour-progress';
    progressEl.textContent = 'Step ' + (this.i + 1) + ' of ' + this.steps.length;

    var titleEl = document.createElement('div');
    titleEl.className = 'tour-title';
    titleEl.textContent = step.title;

    var bodyEl = document.createElement('div');
    bodyEl.className = 'tour-body';
    bodyEl.textContent = step.body;

    var actions = document.createElement('div');
    actions.className = 'tour-actions';

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button'; skipBtn.className = 'btn btn-ghost btn-sm'; skipBtn.textContent = 'Skip tour';
    skipBtn.addEventListener('click', function () { self.end(false); });
    actions.appendChild(skipBtn);

    if (this.i > 0) {
      var backBtn = document.createElement('button');
      backBtn.type = 'button'; backBtn.className = 'btn btn-ghost btn-sm'; backBtn.textContent = 'Back';
      backBtn.addEventListener('click', function () { self.back(); });
      actions.appendChild(backBtn);
    }

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button'; nextBtn.className = 'btn btn-sm';
    nextBtn.textContent = (this.i === this.steps.length - 1) ? 'Done' : 'Next';
    nextBtn.addEventListener('click', function () { self.next(); });
    actions.appendChild(nextBtn);

    this.tooltip.appendChild(progressEl);
    this.tooltip.appendChild(titleEl);
    this.tooltip.appendChild(bodyEl);
    this.tooltip.appendChild(actions);

    requestAnimationFrame(function () { self.position(); });
  };

  Tour.prototype.position = function () {
    var target = this.currentTarget();
    var tt = this.tooltip;

    if (!target) {
      this.spotlight.style.display = 'none';
      tt.style.top = '50%'; tt.style.left = '50%'; tt.style.transform = 'translate(-50%, -50%)';
      return;
    }

    var r = target.getBoundingClientRect();
    var pad = 8;
    this.spotlight.style.top = (r.top - pad) + 'px';
    this.spotlight.style.left = (r.left - pad) + 'px';
    this.spotlight.style.width = (r.width + pad * 2) + 'px';
    this.spotlight.style.height = (r.height + pad * 2) + 'px';

    var ttRect = tt.getBoundingClientRect();
    var top = r.bottom + 14;
    var left = Math.min(Math.max(r.left, 12), window.innerWidth - ttRect.width - 12);
    if (top + ttRect.height > window.innerHeight - 12) {
      top = Math.max(r.top - ttRect.height - 14, 12);
    }
    tt.style.transform = 'none';
    tt.style.top = top + 'px';
    tt.style.left = left + 'px';
  };

  Tour.prototype.next = function () {
    if (this.i < this.steps.length - 1) { this.i++; this.render(); }
    else { this.end(true); }
  };

  Tour.prototype.back = function () {
    if (this.i > 0) { this.i--; this.render(); }
  };

  Tour.prototype.end = function (completed) {
    if (this.blocker) this.blocker.remove();
    if (this.spotlight) this.spotlight.remove();
    if (this.tooltip) this.tooltip.remove();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onResize, true);
    document.removeEventListener('keydown', this._onKey);
    if (this.opts.onEnd) this.opts.onEnd(completed);
  };

  window.XyphrosModTour = Tour;
})();
