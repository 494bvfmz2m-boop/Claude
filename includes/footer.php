</main>

<footer class="site-footer">
    <div class="container">
        <div class="site-footer__top">
            <div class="site-footer__brand">
                <img src="<?php echo e(asset_url('/assets/img/logo-full.png')); ?>" alt="Xyphros Studios">
                <p><?php echo e(get_settings()['tagline']); ?></p>
                <div class="beacon"><span class="beacon__dot"></span> All systems operational</div>
            </div>

            <div class="footer-cols">
                <div class="footer-col">
                    <h4>Studio</h4>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/posts">Posts</a>
                    <a href="/contact">Contact</a>
                </div>
                <div class="footer-col">
                    <h4>Studio access</h4>
                    <a href="https://staff.xyphros.net">Staff login</a>
                </div>
            </div>
        </div>

        <div class="site-footer__bottom">
            <span>&copy; <?php echo date('Y'); ?> <?php echo e(SITE_NAME); ?>. All rights reserved.</span>
            <span>Built in-house.</span>
        </div>
    </div>
</footer>

<script src="<?php echo e(asset_url('/assets/js/main.js')); ?>"></script>
</body>
</html>
