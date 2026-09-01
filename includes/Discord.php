<?php
/**
 * Discord — OAuth2 account linking + role granting.
 *
 * Why this exists: Tebex can only hand out a Discord role automatically
 * if it knows which Discord account a customer is. Relying on Tebex's
 * own per-purchase "log in with Discord" step (see the old
 * requiredOptions flow that used to live in store-buy.php) meant a
 * customer had to reconnect Discord on every single purchase, and any
 * hiccup in that flow surfaced as a confusing "couldn't find account"
 * error with nothing to act on.
 *
 * Instead, a customer links their Discord account to their Xyphros
 * account ONCE (see /discord-link + /discord-callback below, and the
 * "Connections" tab in account.php). From then on, every basket we
 * create for them carries their Discord ID as custom data, and once
 * Tebex confirms payment (webhook-tebex.php) we grant the purchased
 * role ourselves via the bot token — no per-purchase Discord prompt,
 * and no dependency on Tebex's own Discord integration at all.
 */
class Discord
{
    private static function request(string $method, string $url, array $headers = [], ?array $body = null): array
    {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ];
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
            $opts[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return [false, null, $status, "Could not reach Discord: {$err}"];
        }
        $data = json_decode($raw, true);
        if ($status < 200 || $status >= 300) {
            $msg = is_array($data) ? ($data['message'] ?? json_encode($data)) : "HTTP {$status}";
            return [false, $data, $status, $msg];
        }
        return [true, $data, $status, null];
    }

    public static function configured(): bool
    {
        return DISCORD_CLIENT_ID !== '' && DISCORD_CLIENT_SECRET !== '';
    }

    /** Where to send the browser to start linking. */
    public static function authorizeUrl(string $state): string
    {
        $params = [
            'client_id' => DISCORD_CLIENT_ID,
            'redirect_uri' => DISCORD_OAUTH_REDIRECT_URI,
            'response_type' => 'code',
            'scope' => 'identify',
            'state' => $state,
            'prompt' => 'consent',
        ];
        return 'https://discord.com/oauth2/authorize?' . http_build_query($params);
    }

    /** Exchanges a one-time OAuth code for a short-lived access token. */
    public static function exchangeCode(string $code): array
    {
        $url = 'https://discord.com/api/v10/oauth2/token';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'client_id' => DISCORD_CLIENT_ID,
                'client_secret' => DISCORD_CLIENT_SECRET,
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => DISCORD_OAUTH_REDIRECT_URI,
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) return [false, null, "Could not reach Discord: {$err}"];
        $data = json_decode($raw, true);
        if ($status < 200 || $status >= 300 || empty($data['access_token'])) {
            return [false, null, is_array($data) ? ($data['error_description'] ?? 'Discord rejected that request.') : 'Discord rejected that request.'];
        }
        return [true, $data['access_token'], null];
    }

    /** The logged-in Discord user for a fresh access token — id, username, avatar hash. */
    public static function fetchIdentity(string $accessToken): ?array
    {
        [$ok, $data] = self::request('GET', 'https://discord.com/api/v10/users/@me', [
            'Authorization: Bearer ' . $accessToken,
        ]);
        if (!$ok || empty($data['id'])) return null;
        return [
            'id' => (string) $data['id'],
            // Discord dropped discriminators for most accounts; global_name is the
            // modern display name, fall back to username for older accounts.
            'username' => $data['global_name'] ?? $data['username'] ?? ('user' . $data['id']),
            'avatar' => $data['avatar'] ?? null,
        ];
    }

    public static function avatarUrl(string $discordId, ?string $avatarHash): ?string
    {
        if (!$avatarHash) return null;
        $ext = str_starts_with($avatarHash, 'a_') ? 'gif' : 'png';
        return "https://cdn.discordapp.com/avatars/{$discordId}/{$avatarHash}.{$ext}?size=128";
    }

    /** Grants one role to one guild member using the bot token. Idempotent — Discord no-ops if they already have it. */
    public static function grantRole(string $discordUserId, string $roleId): array
    {
        if (empty(DISCORD_BOT_TOKEN) || empty(DISCORD_GUILD_ID)) {
            return [false, 'Discord role granting is not configured yet (missing bot token or guild ID).'];
        }
        $url = "https://discord.com/api/v10/guilds/" . DISCORD_GUILD_ID . "/members/{$discordUserId}/roles/{$roleId}";
        [$ok, , $status, $err] = self::request('PUT', $url, ['Authorization: Bot ' . DISCORD_BOT_TOKEN]);
        if (!$ok) {
            if ($status === 404) {
                return [false, "That Discord account isn't a member of the server, so the role couldn't be granted yet."];
            }
            return [false, $err ?? 'Discord rejected the role grant.'];
        }
        return [true, null];
    }

    /**
     * Called from webhook-tebex.php once a payment completes. Looks up
     * whether the purchased package grants a Discord role and, if so,
     * grants it to the buyer's linked Discord account. Entirely
     * best-effort and non-fatal — a failure here never affects order
     * status, it's only logged so staff can grant the role by hand.
     */
    public static function grantRoleForOrder(array $order, ?array $buyer): void
    {
        $packageId = (int) ($order['package_id'] ?? 0);
        $roleId = TEBEX_DISCORD_ROLES[$packageId] ?? null;
        if (!$roleId) return; // this package doesn't grant a Discord role

        $discordId = $order['discord_id'] ?? ($buyer['discord_id'] ?? null);
        if (!$discordId) {
            error_log("Discord role grant skipped for order {$order['id']}: buyer has no linked Discord account.");
            return;
        }

        [$ok, $err] = self::grantRole((string) $discordId, (string) $roleId);
        if ($ok) {
            error_log("Discord role {$roleId} granted for order {$order['id']} (discord user {$discordId}).");
        } else {
            error_log("Discord role grant failed for order {$order['id']} (discord user {$discordId}): {$err}");
        }
    }
}
