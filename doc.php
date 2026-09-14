<?php
require_once __DIR__ . '/includes/functions.php';

$slug = $_GET['slug'] ?? '';
$page = xs_docs_find_by_slug($slug);
$groups = xs_docs_grouped();

if (!$page) {
    http_response_code(404);
    $currentPage = 'docs';
    $pageTitle = 'Page not found';
    require __DIR__ . '/includes/header.php';
    ?>
    <section class="section text-center">
        <div class="container">
            <span class="eyebrow">404</span>
            <h1>We couldn't find that page</h1>
            <p class="lede lede--center">It may have been moved, renamed, or unpublished.</p>
            <div class="btn-row" style="justify-content:center;">
                <a href="/docs" class="btn btn--primary">Back to Docs</a>
            </div>
        </div>
    </section>
    <?php
    require __DIR__ . '/includes/footer.php';
    exit;
}

$rendered = xs_render_doc_body($page['body'] ?? '');
$currentPage = 'docs';
$pageTitle = $page['title'];
$pageDescription = $page['excerpt'] ?: SITE_TAGLINE;

require __DIR__ . '/includes/header.php';
?>

<section class="docs-shell">
    <aside class="docs-sidebar">
        <div class="docs-search">
            <?php echo xs_icon('search', 15); ?>
            <input type="text" id="docs-search-input" placeholder="Search docs&hellip;" autocomplete="off">
        </div>
        <nav class="docs-nav" id="docs-nav">
            <?php foreach ($groups as $group): ?>
                <div class="docs-nav__group">
                    <span class="docs-nav__label"><?php echo e($group['category']); ?></span>
                    <?php foreach ($group['pages'] as $navPage): ?>
                        <a href="/docs/<?php echo urlencode($navPage['slug']); ?>"
                           class="docs-nav__link <?php echo $navPage['slug'] === $page['slug'] ? 'is-active' : ''; ?>"
                           data-search="<?php echo e(mb_strtolower($navPage['title'] . ' ' . ($navPage['excerpt'] ?? ''))); ?>">
                            <?php echo e($navPage['title']); ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endforeach; ?>
            <p class="docs-nav__empty" id="docs-nav-empty" hidden>No pages match.</p>
        </nav>
    </aside>

    <main class="docs-content">
        <nav class="docs-breadcrumb">
            <a href="/docs">Docs</a> <span>/</span> <span><?php echo e($page['category'] ?: 'General'); ?></span>
        </nav>
        <h1><?php echo e($page['title']); ?></h1>
        <?php if (!empty($page['excerpt'])): ?><p class="docs-content__lede"><?php echo e($page['excerpt']); ?></p><?php endif; ?>
        <div class="docs-content__meta">Last updated <?php echo e(format_date($page['updated_at'] ?? $page['created_at'] ?? '')); ?></div>

        <div class="docs-prose">
            <?php echo $rendered['html']; ?>
        </div>
    </main>

    <?php if (!empty($rendered['toc'])): ?>
    <aside class="docs-toc">
        <span class="docs-toc__label">On this page</span>
        <?php foreach ($rendered['toc'] as $item): ?>
            <a href="#<?php echo e($item['id']); ?>" class="docs-toc__link docs-toc__link--<?php echo (int) $item['level']; ?>"><?php echo e($item['text']); ?></a>
        <?php endforeach; ?>
    </aside>
    <?php endif; ?>
</section>

<script>
(function () {
    var input = document.getElementById('docs-search-input');
    var nav = document.getElementById('docs-nav');
    var empty = document.getElementById('docs-nav-empty');
    if (!input || !nav) return;

    input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        var anyVisible = false;
        nav.querySelectorAll('.docs-nav__group').forEach(function (group) {
            var groupHasMatch = false;
            group.querySelectorAll('.docs-nav__link').forEach(function (link) {
                var match = !q || (link.dataset.search || '').indexOf(q) !== -1;
                link.hidden = !match;
                if (match) groupHasMatch = true;
            });
            group.hidden = !groupHasMatch;
            if (groupHasMatch) anyVisible = true;
        });
        empty.hidden = anyVisible;
    });

    // Highlight the on-this-page link matching whichever heading is
    // currently nearest the top of the viewport.
    var tocLinks = document.querySelectorAll('.docs-toc__link');
    if (tocLinks.length && 'IntersectionObserver' in window) {
        var headings = Array.prototype.map.call(tocLinks, function (a) {
            return document.getElementById(a.getAttribute('href').slice(1));
        }).filter(Boolean);
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
                var active = document.querySelector('.docs-toc__link[href="#' + entry.target.id + '"]');
                if (active) active.classList.add('is-active');
            });
        }, { rootMargin: '-10% 0px -70% 0px' });
        headings.forEach(function (h) { observer.observe(h); });
    }

    // Copy button on fenced code blocks.
    document.querySelectorAll('.doc-code__copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var code = btn.closest('.doc-code').querySelector('code');
            if (!code || !navigator.clipboard) return;
            navigator.clipboard.writeText(code.textContent).then(function () {
                var original = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('is-copied');
                setTimeout(function () { btn.textContent = original; btn.classList.remove('is-copied'); }, 1400);
            }).catch(function () {});
        });
    });
})();
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
