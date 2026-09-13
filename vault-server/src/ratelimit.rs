use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// A simple in-memory, fixed-window rate limiter for login/register attempts.
/// Single-process only (fine for a personal vault); a multi-instance deployment
/// would need a shared store (e.g. Redis) instead.
pub struct RateLimiter {
    attempts: Mutex<HashMap<String, (u32, Instant)>>,
    max_attempts: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_attempts: u32, window: Duration) -> Self {
        Self {
            attempts: Mutex::new(HashMap::new()),
            max_attempts,
            window,
        }
    }

    /// Returns true if `key` is currently allowed to make an attempt.
    pub fn check(&self, key: &str) -> bool {
        let map = self.attempts.lock().unwrap();
        match map.get(key) {
            Some((count, since)) if since.elapsed() <= self.window => *count < self.max_attempts,
            _ => true,
        }
    }

    pub fn record_failure(&self, key: &str) {
        let mut map = self.attempts.lock().unwrap();
        let entry = map.entry(key.to_string()).or_insert((0, Instant::now()));
        if entry.1.elapsed() > self.window {
            *entry = (0, Instant::now());
        }
        entry.0 += 1;
    }

    pub fn record_success(&self, key: &str) {
        let mut map = self.attempts.lock().unwrap();
        map.remove(key);
    }
}
