<?php
/**
 * Site-wide broadcast bar. Managed entirely from staff.xyphros.net —
 * nothing here to configure, it just displays whatever's currently live.
 */
$__broadcast = get_active_broadcast();
if ($__broadcast):
    $__icons = ['info' => '&#9679;', 'success' => '&#10003;', 'warning' => '&#9888;', 'error' => '&#9888;'];
    $__icon = $__icons[$__broadcast['style'] ?? 'info'] ?? $__icons['info'];
?>
<div class="xbcast" id="xbcast" data-type="<?php echo e($__broadcast['style'] ?? 'info'); ?>" data-id="<?php echo e($__broadcast['id']); ?>">
    <span class="xbcast__icon"><?php echo $__icon; ?></span>
    <span class="xbcast__text">
        <?php echo e($__broadcast['message']); ?>
        <?php if (!empty($__broadcast['link'])): ?>
            <a href="<?php echo e($__broadcast['link']); ?>" class="xbcast__link">Learn more &rarr;</a>
        <?php endif; ?>
    </span>
    <button type="button" class="xbcast__close" onclick="xbcastDismiss()" aria-label="Dismiss">&times;</button>
</div>
<script>
(function(){
    try {
        var id = <?php echo json_encode($__broadcast['id']); ?>;
        if (localStorage.getItem('xb_dismissed') !== id) {
            var bar = document.getElementById('xbcast');
            if (bar) bar.classList.add('is-visible');
        }
    } catch (e) {}
})();
function xbcastDismiss() {
    var bar = document.getElementById('xbcast');
    if (!bar) return;
    try { localStorage.setItem('xb_dismissed', bar.dataset.id); } catch (e) {}
    bar.classList.add('is-leaving');
    setTimeout(function(){ bar.remove(); }, 250);
}
</script>
<?php endif; ?>
