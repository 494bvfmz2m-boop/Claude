<?php
/**
 * Tiny JSON data-store layer, used only for site settings and small caches
 * (server status, store listing cache) — never for accounts/posts/tickets,
 * which live in MySQL. Every read/write is lock-protected so two admins
 * editing at once won't corrupt the file.
 */

function db_path($name) {
    return DATA_PATH . '/' . $name . '.json';
}

function db_read($name, $default = []) {
    $path = db_path($name);
    if (!file_exists($path)) {
        return $default;
    }
    $fp = fopen($path, 'r');
    if (!$fp) return $default;
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode($contents, true);
    return is_null($data) ? $default : $data;
}

function db_write($name, $data) {
    $path = db_path($name);
    $fp = fopen($path, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}
