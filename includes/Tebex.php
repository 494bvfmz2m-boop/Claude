<?php
/**
 * Tebex — thin client for the Headless API. Two different trust levels:
 *
 *   - Listing categories/packages needs nothing but the public token,
 *     safe to call from anywhere.
 *   - Creating a basket happens server-side and passes the *customer's*
 *     real IP (not the server's), which requires HTTP Basic auth with
 *     the public token + private key. The private key never reaches
 *     the browser.
 */
class Tebex
{
    private static function request(string $method, string $url, ?array $body = null, bool $authed = false): array
    {
        $ch = curl_init($url);
        $headers = ['Content-Type: application/json', 'Accept: application/json'];

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 12,
        ];
        if ($authed) {
            $opts[CURLOPT_USERPWD] = TEBEX_PUBLIC_TOKEN . ':' . TEBEX_PRIVATE_KEY;
        }
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $opts);

        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return [false, null, "Could not reach Tebex: {$err}"];
        }
        $data = json_decode($raw, true);
        if ($status < 200 || $status >= 300) {
            $msg = '';
            foreach (['detail', 'error_message', 'message'] as $key) {
                if (is_array($data) && isset($data[$key]) && is_string($data[$key]) && $data[$key] !== '') {
                    $msg = $data[$key];
                    break;
                }
            }
            // Tebex returns Laravel-style validation errors as
            // {"errors": {"field": ["message", ...]}} with detail/message
            // often blank in that case — flatten those out instead.
            if ($msg === '' && is_array($data) && !empty($data['errors']) && is_array($data['errors'])) {
                $flat = [];
                foreach ($data['errors'] as $field => $fieldMsgs) {
                    foreach ((array) $fieldMsgs as $fieldMsg) {
                        $flat[] = "{$field}: {$fieldMsg}";
                    }
                }
                $msg = implode('; ', $flat);
            }
            if ($msg === '') {
                $bodyPreview = $raw !== '' ? (' — ' . substr($raw, 0, 300)) : '';
                $msg = "Tebex returned HTTP {$status}{$bodyPreview}";
            }
            return [false, $data, $msg];
        }
        return [true, $data['data'] ?? $data, null];
    }

    /** All categories, with their packages nested inside. */
    public static function getCategories(): array
    {
        if (empty(TEBEX_PUBLIC_TOKEN)) return [];
        $url = TEBEX_API_BASE . '/accounts/' . TEBEX_PUBLIC_TOKEN . '/categories?includePackages=1';
        [$ok, $data] = self::request('GET', $url);
        return $ok && is_array($data) ? $data : [];
    }

    public static function getPackage(int $packageId): ?array
    {
        $url = TEBEX_API_BASE . '/accounts/' . TEBEX_PUBLIC_TOKEN . '/packages/' . $packageId;
        [$ok, $data] = self::request('GET', $url);
        return $ok ? $data : null;
    }

    /**
     * Create a basket for a customer. We deliberately do NOT pass a
     * "username" here — for a Game Server-type Tebex project, that field
     * is validated against a real player identity on the configured
     * platform (Minecraft/FiveM/Steam/etc.), not a free-form ID, and
     * Xyphros accounts aren't tied to any such player identity. It's
     * optional per Tebex's docs. The reliable link back to a Xyphros
     * account is $custom — Tebex confirms this is included in the
     * post-completion webhook payload.
     */
    public static function createBasket(string $completeUrl, string $cancelUrl, string $customerIp, array $custom = []): array
    {
        $url = TEBEX_API_BASE . '/accounts/' . TEBEX_PUBLIC_TOKEN . '/baskets';
        $body = [
            'complete_url' => $completeUrl,
            'cancel_url' => $cancelUrl,
            'complete_auto_redirect' => true,
            'ip_address' => $customerIp,
        ];
        if ($custom) $body['custom'] = $custom;
        return self::request('POST', $url, $body, true);
    }

    /**
     * $variableData: option name => value, for packages with customer-
     * facing custom options (e.g. a required "discord_id" option) —
     * sent as-is in the request body's variable_data object. Untested
     * against Tebex's built-in "discord_id" option type specifically
     * (that's normally filled in by their own OAuth session, not a
     * client-supplied value) — this is an experiment, not a confirmed
     * working path. Check the response/error if you're relying on it.
     */
    public static function addPackage(string $basketIdent, int $packageId, int $qty = 1, array $variableData = []): array
    {
        $url = TEBEX_API_BASE . '/baskets/' . $basketIdent . '/packages';
        // Tebex's own docs show package_id as a quoted string in the JSON
        // body (e.g. "package_id": "6276316"), not a bare number — send it
        // that way explicitly rather than trusting json_encode on an int.
        $body = ['package_id' => (string) $packageId, 'quantity' => $qty];
        if ($variableData) {
            $body['variable_data'] = $variableData;
        }
        return self::request('POST', $url, $body);
    }

    /**
     * Lists the login provider(s) this store requires the customer to
     * authenticate with (e.g. Steam, FiveM, Minecraft) before packages
     * can be added to a basket. Returns [ [ "name" => ..., "url" => ... ], ... ].
     */
    public static function getBasketAuthOptions(string $basketIdent, string $returnUrl): array
    {
        $url = TEBEX_API_BASE . '/accounts/' . TEBEX_PUBLIC_TOKEN . '/baskets/' . $basketIdent . '/auth?returnUrl=' . rawurlencode($returnUrl);
        [$ok, $data, $err] = self::request('GET', $url);

        // Logged unconditionally (not just on failure) while this is
        // actively being debugged — a store showing "Couldn't start
        // login" needs to see exactly what Tebex sent back, since the
        // documented response shape (a list of {name,url} objects) isn't
        // what every account/platform type appears to actually return.
        error_log('Tebex basket auth response for ' . $basketIdent . ': ok=' . ($ok ? '1' : '0') . ' data=' . json_encode($data) . ($err ? " err={$err}" : ''));

        if (!$ok) {
            return [];
        }
        if (!is_array($data)) {
            return [];
        }
        // Normalize: the documented shape is a list of {name,url}
        // objects, but a single-provider response has been observed
        // coming back as one bare object instead of a one-item list —
        // wrap it so callers can always just foreach() the result.
        if (!array_is_list($data) && isset($data['url'])) {
            return [$data];
        }
        return $data;
    }

    public static function getBasket(string $basketIdent): ?array
    {
        $url = TEBEX_API_BASE . '/accounts/' . TEBEX_PUBLIC_TOKEN . '/baskets/' . $basketIdent;
        [$ok, $data] = self::request('GET', $url);
        return $ok ? $data : null;
    }
}

