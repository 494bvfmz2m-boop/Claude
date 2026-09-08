<?php
/**
 * Informational cookie notice — not a consent gate. We only ever set
 * strictly-necessary cookies (session/auth + CSRF + a short-lived
 * Discord-linking state cookie), so there's nothing here that legally
 * requires an opt-in click; this just tells visitors what's set and
 * links to the full breakdown. Dismissal is remembered in
 * localStorage by assets/js/main.js.
 */
?>
<div class="cookie-notice" id="cookie-notice" hidden>
    <p>We only use strictly-necessary cookies (signing you in, protecting forms). No analytics or ad tracking. See our <a href="/cookies">Cookies Policy</a> for the full list.</p>
    <div class="cookie-notice__actions">
        <button type="button" class="btn btn--primary btn--sm" id="cookie-notice-dismiss">Got it</button>
    </div>
</div>
