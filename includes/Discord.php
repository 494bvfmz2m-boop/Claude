<?php
/**
 * Discord — OAuth2 account linking.
 *
 * Lets a customer link their Discord account to their Xyphros account
 * (see /discord-link + /discord-callback, and the "Connections" tab in
 * account.php) so it's visible on their profile. Store checkout and
 * role granting are handled entirely by Tebex's own Discord
 * integration (configured in the Tebex creator dashboard) — this class
 * only ever reads a "who is this" identity via the `identify` OAuth
 * scope, it doesn't act as the customer or touch roles.
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
}
