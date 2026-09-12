<?php
/**
 * Returns live server status as JSON: { java: {...}, bedrock: {...} }
 * Powered by the free api.mcsrvstat.us lookup service — no API key needed,
 * you just give it the raw server IP (and port, for Bedrock).
 *
 * Results are cached to data/status_cache.json for CACHE_SECONDS so we don't
 * hammer the external API on every page load.
 */
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json');

const CACHE_SECONDS = 45;

function fetch_json($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_USERAGENT => 'SlothSMP-StatusWidget/1.0',
    ]);
    $body = curl_exec($ch);
    $ok = $body !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if (!$ok) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

$settings = db_read('settings', []);
$javaIp = trim($settings['java_ip'] ?? '');
$bedrockIp = trim($settings['bedrock_ip'] ?? $javaIp);
$bedrockPort = trim($settings['bedrock_port'] ?? '');

$cacheFile = 'status_cache';
$cache = db_read($cacheFile, null);
if ($cache && isset($cache['fetched_at']) && (time() - $cache['fetched_at']) < CACHE_SECONDS
    && ($cache['java_ip'] ?? '') === $javaIp
    && ($cache['bedrock_ip'] ?? '') === $bedrockIp
    && ($cache['bedrock_port'] ?? '') === $bedrockPort) {
    echo json_encode($cache['result']);
    exit;
}

$result = ['java' => null, 'bedrock' => null];

if ($javaIp !== '') {
    $j = fetch_json('https://api.mcsrvstat.us/3/' . rawurlencode($javaIp));
    if ($j) {
        $playerList = [];
        foreach (($j['players']['list'] ?? []) as $p) {
            if (is_array($p) && isset($p['name'])) {
                $playerList[] = $p['name'];
            } elseif (is_string($p)) {
                $playerList[] = $p;
            }
        }
        $result['java'] = [
            'online' => !empty($j['online']),
            'players_online' => $j['players']['online'] ?? 0,
            'players_max' => $j['players']['max'] ?? 0,
            'players_list' => $playerList,
            'version' => $j['version'] ?? null,
            'motd' => isset($j['motd']['clean'][0]) ? $j['motd']['clean'][0] : null,
        ];
    }
}

if ($bedrockIp !== '') {
    $target = $bedrockPort !== '' ? $bedrockIp . ':' . $bedrockPort : $bedrockIp;
    $b = fetch_json('https://api.mcsrvstat.us/bedrock/3/' . rawurlencode($target));
    if ($b) {
        $playerList = [];
        foreach (($b['players']['list'] ?? []) as $p) {
            if (is_array($p) && isset($p['name'])) {
                $playerList[] = $p['name'];
            } elseif (is_string($p)) {
                $playerList[] = $p;
            }
        }
        $result['bedrock'] = [
            'online' => !empty($b['online']),
            'players_online' => $b['players']['online'] ?? 0,
            'players_max' => $b['players']['max'] ?? 0,
            'players_list' => $playerList, // usually empty — Bedrock's ping protocol doesn't expose names
            'version' => $b['version'] ?? null,
        ];
    }
}

db_write($cacheFile, [
    'fetched_at' => time(),
    'java_ip' => $javaIp,
    'bedrock_ip' => $bedrockIp,
    'bedrock_port' => $bedrockPort,
    'result' => $result,
]);

echo json_encode($result);
