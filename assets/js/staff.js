document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('staff-nav-toggle');
    var sidebar = document.getElementById('staff-sidebar');
    var backdrop = document.getElementById('staff-sidebar-backdrop');
    if (!toggle || !sidebar || !backdrop) return;

    function openSidebar() {
        sidebar.classList.add('is-open');
        backdrop.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
    }
    function closeSidebar() {
        sidebar.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
        sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
    });
    backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });
    // Tapping a nav link navigates away anyway, but close immediately so
    // the drawer doesn't flash open again from a cached scroll position.
    sidebar.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeSidebar);
    });
});
