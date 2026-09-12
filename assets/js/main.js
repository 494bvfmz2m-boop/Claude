document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('nav-toggle');
    var nav = document.getElementById('site-nav');
    var signinToggle = document.getElementById('signin-toggle');
    var signinMenu = document.getElementById('signin-menu');

    function closeNav() {
        if (!nav) return;
        nav.classList.remove('nav--open');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.innerHTML = '&#9776;';
        }
    }

    function closeSignin() {
        if (!signinMenu) return;
        signinMenu.classList.remove('is-open');
        if (signinToggle) signinToggle.setAttribute('aria-expanded', 'false');
    }

    if (toggle && nav) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = nav.classList.toggle('nav--open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.innerHTML = isOpen ? '&times;' : '&#9776;';
            if (isOpen) closeSignin();
        });
    }

    if (signinToggle && signinMenu) {
        signinToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = signinMenu.classList.toggle('is-open');
            signinToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) closeNav();
        });
    }

    document.addEventListener('click', function (e) {
        if (nav && !nav.contains(e.target)) closeNav();
        if (signinMenu && !signinMenu.contains(e.target)) closeSignin();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeNav();
            closeSignin();
        }
    });

    // Avoid a stuck-open mobile menu if the viewport grows past the
    // breakpoint (e.g. rotating a tablet, or resizing a desktop window).
    window.addEventListener('resize', function () {
        if (window.innerWidth > 860) closeNav();
    });

    // Scroll reveal: progressive enhancement only. Elements start fully
    // visible in plain HTML/CSS; this only ever adds motion, never hides
    // content if something here fails or IntersectionObserver is missing.
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var revealTargets = document.querySelectorAll(
            '.page-head h1, .page-head .lede, .section h2, .product-card, .post-card, .team-card, .contact-method, .empty-state, .shop-card, .store-gate, .store-category__head, .legal-content h2, .gate-card'
        );
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        revealTargets.forEach(function (el, i) {
            el.classList.add('reveal');
            // Tiny stagger within each row/group so cards don't all pop
            // in at the exact same millisecond.
            el.style.transitionDelay = (Math.min(i % 3, 2) * 0.08) + 's';
            observer.observe(el);
        });
    }

    // Cookie notice: show once until dismissed. Wrapped in try/catch
    // since localStorage can throw in some privacy modes — if it does,
    // the notice just shows every visit instead of breaking the page.
    var cookieNotice = document.getElementById('cookie-notice');
    var cookieDismiss = document.getElementById('cookie-notice-dismiss');
    if (cookieNotice) {
        var alreadySeen = false;
        try { alreadySeen = localStorage.getItem('xs_cookie_notice_dismissed') === '1'; } catch (e) {}
        if (!alreadySeen) cookieNotice.hidden = false;

        if (cookieDismiss) {
            cookieDismiss.addEventListener('click', function () {
                cookieNotice.hidden = true;
                try { localStorage.setItem('xs_cookie_notice_dismissed', '1'); } catch (e) {}
            });
        }
    }

    // 2FA / verification code boxes: one card per digit. Typing a digit
    // advances to the next card, Backspace on an empty card goes back,
    // pasting a full code fills every card at once, and the real value
    // is kept in sync on a hidden input the form actually submits.
    document.querySelectorAll('.otp-boxes[data-otp]').forEach(function (group) {
        var boxes = Array.prototype.slice.call(group.querySelectorAll('.otp-box'));
        var hidden = group.querySelector('.otp-hidden');
        var form = group.closest('form');
        if (!boxes.length || !hidden) return;

        function syncHidden() {
            hidden.value = boxes.map(function (b) { return b.value; }).join('');
        }
        function focusBox(i) {
            if (boxes[i]) boxes[i].focus();
        }
        function maybeAutoSubmit() {
            if (form && boxes.every(function (b) { return b.value; })) {
                form.requestSubmit();
            }
        }

        boxes.forEach(function (box, i) {
            box.addEventListener('input', function () {
                box.value = box.value.replace(/\D/g, '').slice(-1);
                box.classList.toggle('is-filled', !!box.value);
                syncHidden();
                if (box.value && i < boxes.length - 1) focusBox(i + 1);
                maybeAutoSubmit();
            });
            box.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && !box.value && i > 0) {
                    focusBox(i - 1);
                    boxes[i - 1].value = '';
                    boxes[i - 1].classList.remove('is-filled');
                    syncHidden();
                } else if (e.key === 'ArrowLeft' && i > 0) {
                    e.preventDefault();
                    focusBox(i - 1);
                } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
                    e.preventDefault();
                    focusBox(i + 1);
                }
            });
            box.addEventListener('paste', function (e) {
                var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (!text) return;
                e.preventDefault();
                text.slice(0, boxes.length).split('').forEach(function (ch, idx) {
                    boxes[idx].value = ch;
                    boxes[idx].classList.add('is-filled');
                });
                syncHidden();
                focusBox(Math.min(text.length, boxes.length - 1));
                maybeAutoSubmit();
            });
            box.addEventListener('focus', function () { box.select(); });
        });

        if (form) {
            form.addEventListener('submit', function (e) {
                syncHidden();
                if (hidden.value.length < 6) {
                    e.preventDefault();
                    var emptyIdx = boxes.findIndex(function (b) { return !b.value; });
                    focusBox(emptyIdx === -1 ? 0 : emptyIdx);
                    group.classList.add('shake-once');
                    setTimeout(function () { group.classList.remove('shake-once'); }, 400);
                    return;
                }
                group.classList.add('is-checking');
            });
        }
    });

    // Give every plain form submit (login, buy now, checkout forms, staff
    // forms, etc.) an immediate loading state on its submit button instead
    // of leaving the page looking frozen until the next page loads. Skipped
    // when something upstream already called preventDefault (e.g. a
    // confirm() dialog that was cancelled, or a page with its own AJAX
    // submit handler) since by the time this bubbles up to document, an
    // earlier handler's preventDefault() is already reflected here.
    document.addEventListener('submit', function (e) {
        if (e.defaultPrevented) return;
        var form = e.target;
        if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-loading')) return;
        var btn = e.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
        if (!btn || !btn.classList || !btn.classList.contains('btn') || btn.classList.contains('is-loading')) return;
        btn.classList.add('is-loading');
        btn.disabled = true;
        var spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        btn.appendChild(spinner);
    });
});
