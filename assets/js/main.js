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
            '.page-head h1, .page-head .lede, .section h2, .product-card, .post-card, .team-card, .contact-method, .empty-state, .shop-card, .store-gate'
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
});
