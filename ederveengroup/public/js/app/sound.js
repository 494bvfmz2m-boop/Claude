// EderveenGroup client: sound
// A soft two-note chime for new mail, made with Web Audio (no sound file). Browsers (and
// iPhones in particular) only allow sound after you've touched the page once, so the audio is
// unlocked on the first tap or key press.
let ctx = null;
function unlock() {
    try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
    } catch {
        ctx = null; // no audio here
    }
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { once: true, capture: true, passive: true });

function chime() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const [freq, at] of [[880, 0], [1318.5, 0.13]]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + at);
        gain.gain.linearRampToValueAtTime(0.12, now + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.65);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + at);
        osc.stop(now + at + 0.7);
    }
}

export { chime };
