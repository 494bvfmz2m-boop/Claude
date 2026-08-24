document.addEventListener('DOMContentLoaded', function () {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // =========================================================================
    // Scroll reveal: progressive enhancement only. Elements start fully
    // visible in plain HTML/CSS; this only ever adds motion, never hides
    // content if something here fails or IntersectionObserver is missing.
    // =========================================================================
    if ('IntersectionObserver' in window && !reducedMotion) {
        var revealTargets = document.querySelectorAll(
            '.page-head h1, .page-head .lede, .section h2, .product-card, .post-card, ' +
            '.team-card, .contact-method, .empty-state, .shop-card, .card, .alert, ' +
            '.footer-col, .hero + .section .eyebrow'
        );
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        // Group siblings so a row of cards staggers together instead of
        // every revealed element on the page sharing one global counter.
        var groupCounts = new Map();
        revealTargets.forEach(function (el) {
            el.classList.add('reveal');
            var parent = el.parentElement;
            var i = groupCounts.get(parent) || 0;
            groupCounts.set(parent, i + 1);
            el.style.transitionDelay = (Math.min(i, 5) * 0.07) + 's';
            observer.observe(el);
        });
    }

    // =========================================================================
    // Scroll progress bar
    // =========================================================================
    var progressBar = document.getElementById('scroll-progress');
    var siteHeader = document.querySelector('.site-header');
    var backToTop = document.getElementById('back-to-top');
    var ticking = false;

    function onScroll() {
        var doc = document.documentElement;
        var scrollTop = window.pageYOffset || doc.scrollTop;
        var max = (doc.scrollHeight - doc.clientHeight) || 1;
        var pct = Math.min(100, Math.max(0, (scrollTop / max) * 100));

        if (progressBar) progressBar.style.width = pct + '%';
        if (siteHeader) siteHeader.classList.toggle('site-header--scrolled', scrollTop > 8);
        if (backToTop) backToTop.classList.toggle('is-visible', scrollTop > 500);

        ticking = false;
    }

    if (progressBar || siteHeader || backToTop) {
        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(onScroll);
                ticking = true;
            }
        }, { passive: true });
        onScroll();
    }

    if (backToTop) {
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    }

    // =========================================================================
    // Hero mouse parallax — desktop, fine-pointer devices only, and never
    // when the visitor has asked for reduced motion.
    // =========================================================================
    var hero = document.querySelector('.hero');
    if (hero && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
        hero.addEventListener('mousemove', function (e) {
            var rect = hero.getBoundingClientRect();
            var relX = (e.clientX - rect.left) / rect.width - 0.5;
            var relY = (e.clientY - rect.top) / rect.height - 0.5;
            hero.style.setProperty('--mx', (relX * 24).toFixed(2));
            hero.style.setProperty('--my', (relY * 24).toFixed(2));
        });
        hero.addEventListener('mouseleave', function () {
            hero.style.setProperty('--mx', 0);
            hero.style.setProperty('--my', 0);
        });
    }

    // =========================================================================
    // Button ripple — a small, self-cleaning span positioned at the pointer.
    // =========================================================================
    if (!reducedMotion) {
        document.addEventListener('pointerdown', function (e) {
            var btn = e.target.closest ? e.target.closest('.btn') : null;
            if (!btn || btn.classList.contains('is-loading')) return;

            var rect = btn.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height);
            var span = document.createElement('span');
            span.className = 'ripple';
            span.style.width = span.style.height = size + 'px';
            span.style.left = (e.clientX - rect.left - size / 2) + 'px';
            span.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(span);
            span.addEventListener('animationend', function () { span.remove(); });
        });
    }

    // =========================================================================
    // Submit-button loading state. Fires on the 'submit' event, which the
    // browser only dispatches after native HTML5 validation already passed
    // — so this never masks a validation error behind a spinning button.
    // =========================================================================
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!(form instanceof HTMLFormElement) || form.classList.contains('no-loading-state')) return;
        var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) submitBtn.classList.add('is-loading');
    });
});
