'use strict';

// Auto editing with Claude (the Anthropic API), for admins. Claude looks at a photo, or at frames
// sampled from video clips, and answers with an edit as JSON (structured outputs) that the Photo
// and Video Editors apply. Every value is checked here before it reaches an editor.

const Anthropic = require('@anthropic-ai/sdk').default;

const MODELS = {
    'claude-opus-5-5': 'Claude Opus 5.5 (best results)',
    'claude-sonnet-5-5': 'Claude Sonnet 5.5 (faster, cheaper)',
    'claude-haiku-5-5': 'Claude Haiku 5.5 (fastest, cheapest)'
};
const DEFAULT_MODEL = 'claude-opus-5-5';
// models whose refusals can be re-run on a fallback model by the API itself
const FALLBACK = ['claude-opus-5-5', 'claude-sonnet-5-5'];

const FILTERS = ['none', 'vivid', 'warm', 'cool', 'golden', 'mono', 'noir', 'sepia', 'vintage', 'fade', 'dramatic', 'cinematic', 'pastel', 'teal'];
const ADJUST = { exposure: [-100, 100], contrast: [-100, 100], highlights: [-100, 100], shadows: [-100, 100], saturation: [-100, 100], vibrance: [-100, 100], temperature: [-100, 100], tint: [-100, 100], fade: [0, 100], vignette: [0, 100], sharpen: [0, 100], grain: [0, 100] };
const CROPS = ['none', '1:1', '4:5', '16:9', '9:16', '3:2', '2:3'];
const ASPECTS = ['16:9', '9:16', '1:1', '4:5'];
const EFFECTS = ['none', 'zoom_in', 'zoom_out', 'pulse', 'shake', 'glitch', 'flash', 'bw', 'blur_in'];
const TRANSITIONS = ['none', 'fade', 'dip_black', 'dip_white', 'slide_left', 'slide_up', 'zoom', 'wipe'];
const POSITIONS = ['top', 'center', 'bottom'];
const TEXT_STYLES = ['plain', 'shadow', 'outline', 'box', 'title'];
const TEXT_ANIMS = ['none', 'fade', 'pop', 'slide', 'type'];

const clamp = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const num = { type: 'number' };
const str = { type: 'string' };
const enumOf = list => ({ type: 'string', enum: list });

/* ---------- a photo ---------- */
const PHOTO_SCHEMA = obj({
    adjust: obj(Object.fromEntries(Object.keys(ADJUST).map(k => [k, num]))),
    filter: enumOf(FILTERS),
    filter_strength: num,
    crop: obj({ aspect: enumOf(CROPS), x: num, y: num, w: num, h: num }),
    straighten: num,
    note: str
});
const PHOTO_SYSTEM = `You are an expert photo editor. You get one photo and, sometimes, a wish from its owner. Decide how to edit it so it looks its best (or as asked), the way a skilled person would in Lightroom.

The editor has these controls:
- adjust: exposure, contrast, highlights, shadows, saturation, vibrance, temperature (warmth), tint: each −100 to 100, 0 = unchanged. fade, vignette, sharpen, grain: 0 to 100.
- filter: a look applied first (${FILTERS.join(', ')}); filter_strength 0–100. Use "none" unless a look clearly helps; the adjustments are added on top.
- crop: aspect "none" keeps the frame; otherwise give the crop as x, y, w, h fractions (0–1) of the photo, matching that aspect, to improve the composition (straighten horizons, cut distractions, centre the subject). Keep at least 60% of the photo unless asked.
- straighten: degrees, −15 to 15, to level a tilted horizon (positive turns the picture clockwise). 0 if level.

Be natural: small, purposeful changes beat heavy ones. Fix exposure and white balance first. note: one short sentence for the owner saying what you did and why.`;

function checkPhoto(r) {
    const adjust = {};
    for (const [k, [lo, hi]] of Object.entries(ADJUST)) adjust[k] = Math.round(clamp(r.adjust && r.adjust[k], lo, hi));
    const c = r.crop || {};
    let crop = null;
    if (c.aspect && c.aspect !== 'none') {
        const x = clamp(c.x, 0, 1);
        const y = clamp(c.y, 0, 1);
        const w = clamp(c.w, 0.05, 1 - x, 1 - x);
        const h = clamp(c.h, 0.05, 1 - y, 1 - y);
        if (w * h >= 0.2) crop = { aspect: oneOf(c.aspect, CROPS, 'none'), x, y, w, h };
    }
    return { adjust, filter: oneOf(r.filter, FILTERS, 'none'), strength: Math.round(clamp(r.filter_strength, 0, 100, 100)), crop, straighten: clamp(r.straighten, -15, 15), note: line(r.note, 400) };
}

/* ---------- a video: an edit decision list ---------- */
const VIDEO_SCHEMA = obj({
    title: str,
    aspect: enumOf(ASPECTS),
    clips: {
        type: 'array',
        items: obj({ media: str, in: num, out: num, speed: num, filter: enumOf(FILTERS), effect: enumOf(EFFECTS), transition: enumOf(TRANSITIONS) })
    },
    texts: {
        type: 'array',
        items: obj({ text: str, start: num, duration: num, position: enumOf(POSITIONS), style: enumOf(TEXT_STYLES), animation: enumOf(TEXT_ANIMS) })
    },
    music: { anyOf: [{ type: 'null' }, obj({ media: str, offset: num, volume: num })] },
    clip_volume: num,
    summary: str
});
const VIDEO_SYSTEM = `You are an expert video editor, like a great CapCut or Premiere editor. You get the owner's footage as frames sampled from each clip (labelled with the clip's id and the time in that clip), each clip's length and loudness, sometimes music with its beat times, and a brief. Build the edit.

How the editor works:
- clips: the main track, played in your order. Each takes media (a clip id), in and out (seconds inside that clip, out > in, both within its length), speed (0.25–4; 1 is normal, use 0.5 for slow motion of a great moment, 2–3 to rush through), filter (a colour look: ${FILTERS.join(', ')}), effect (${EFFECTS.join(', ')}) and transition into the next clip (${TRANSITIONS.join(', ')}; "none" is a hard cut). You may use one clip several times for different moments. Photos (shown as one frame) can be used for any in/out within their length.
- texts: on-screen titles and captions over the whole timeline: text, start and duration (seconds on the final timeline), position, style and animation. Keep them short and readable.
- music: one of the given music tracks or null; offset is where in the song to start; volume 0–100. clip_volume (0–100) is the volume of the clips' own sound (lower it under music, keep it up for speech).

Editing well:
- Pick the strongest moments: faces, action, beauty, peaks in loudness (cheering, laughter, speech). Skip shaky, dark, blurry or empty moments.
- Order for a story or a flow: an opener that hooks, a build, a satisfying end.
- Match the pace to the brief; for fast edits make cuts land on the music's beats (the final timeline time where each clip starts should fall on a beat).
- Mostly hard cuts; transitions where they mean something. Use effects sparingly.
- Keep the total close to the requested length (sum of (out − in) / speed, minus transition overlaps of 0.5 s each).
- The aspect is what the owner asked for; otherwise choose by where it will be shown.
summary: two or three sentences for the owner about the edit you made.`;

function checkVideo(r, { media, music }) {
    const lens = new Map(media.map(m => [m.id, m]));
    const clips = [];
    for (const c of [].concat(r.clips || []).slice(0, 80)) {
        const m = lens.get(String(c.media));
        if (!m) continue;
        const dur = m.dur || 5;
        const inn = clamp(c.in, 0, Math.max(0, dur - 0.3));
        const out = clamp(c.out, inn + 0.3, dur, Math.min(dur, inn + 3));
        if (out - inn < 0.3) continue;
        clips.push({ media: m.id, in: Math.round(inn * 100) / 100, out: Math.round(out * 100) / 100, speed: Math.round(clamp(c.speed, 0.25, 4, 1) * 100) / 100, filter: oneOf(c.filter, FILTERS, 'none'), effect: oneOf(c.effect, EFFECTS, 'none'), transition: oneOf(c.transition, TRANSITIONS, 'none') });
    }
    const total = clips.reduce((n, c) => n + (c.out - c.in) / c.speed, 0);
    const texts = [].concat(r.texts || []).slice(0, 40).map(t => ({
        text: line(t.text, 120),
        start: Math.round(clamp(t.start, 0, Math.max(0, total - 0.3)) * 100) / 100,
        duration: Math.round(clamp(t.duration, 0.5, 30, 2) * 100) / 100,
        position: oneOf(t.position, POSITIONS, 'bottom'),
        style: oneOf(t.style, TEXT_STYLES, 'shadow'),
        animation: oneOf(t.animation, TEXT_ANIMS, 'fade')
    })).filter(t => t.text);
    const song = r.music && music.find(x => x.id === String(r.music.media));
    return {
        title: line(r.title, 120),
        aspect: oneOf(r.aspect, ASPECTS, '16:9'),
        clips,
        texts,
        music: song ? { media: song.id, offset: Math.round(clamp(r.music.offset, 0, Math.max(0, song.dur - 1)) * 100) / 100, volume: Math.round(clamp(r.music.volume, 0, 100, 80)) } : null,
        clipVolume: Math.round(clamp(r.clip_volume, 0, 100, 100)),
        summary: line(r.summary, 1200)
    };
}

/* ---------- talking to Claude ---------- */
class AiError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}
function client(apiKey, baseURL) {
    return new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000, ...(baseURL ? { baseURL } : {}) });
}
async function ask({ apiKey, baseURL, model, system, content, schema, effort, maxTokens = 16000 }) {
    const c = client(apiKey, baseURL);
    const params = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
        output_config: { effort, format: { type: 'json_schema', schema } }
    };
    let msg;
    try {
        // a refused request is re-run on Anthropic's recommended fallback model, server-side
        msg = FALLBACK.includes(model)
            ? await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
            : await c.messages.create(params);
    } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('The Claude API key isn’t accepted. Check it in Admin → AI.', 502);
        if (e instanceof Anthropic.RateLimitError) throw new AiError('Claude is busy (rate limit). Try again in a minute.', 429);
        if (e instanceof Anthropic.BadRequestError) throw new AiError(`Claude couldn’t take this request: ${e.message}`, 400);
        if (e instanceof Anthropic.APIError) throw new AiError(`Claude had a problem (${e.status || 'no answer'}). Try again.`, 502);
        throw new AiError('Couldn’t reach Claude. Check the server’s internet connection.', 502);
    }
    if (msg.stop_reason === 'refusal') throw new AiError('Claude declined to edit this.', 422);
    if (msg.stop_reason === 'max_tokens') throw new AiError('Claude’s answer was cut off. Try fewer clips.', 502);
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let out;
    try {
        out = JSON.parse(text);
    } catch {
        throw new AiError('Claude’s answer couldn’t be read. Try again.', 502);
    }
    return { out, usage: msg.usage || {}, model: msg.model || model };
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const image = dataUrl => {
    const m = IMAGE.exec(String(dataUrl || ''));
    if (!m || m[2].length > 1.6 * 1024 * 1024) return null;
    return { type: 'image', source: { type: 'base64', media_type: `image/${m[1]}`, data: m[2] } };
};

async function editPhoto({ apiKey, baseURL, model, photo, wish, size }) {
    const img = image(photo);
    if (!img) throw new AiError('Send the photo as a JPEG, PNG or WebP picture.', 400);
    const content = [img, { type: 'text', text: `${size ? `The full photo is ${size.w} × ${size.h} pixels. ` : ''}${line(wish, 600) ? `The owner’s wish: “${line(wish, 600)}”` : 'Make it look its best.'}` }];
    const r = await ask({ apiKey, baseURL, model, system: PHOTO_SYSTEM, content, schema: PHOTO_SCHEMA, effort: 'medium', maxTokens: 8000 });
    return { edit: checkPhoto(r.out), usage: r.usage, model: r.model };
}

const MAX_FRAMES = 90;
async function editVideo({ apiKey, baseURL, model, brief, length, aspect, captions, media, music }) {
    media = [].concat(media || []).slice(0, 40);
    music = [].concat(music || []).slice(0, 4);
    if (!media.length) throw new AiError('Add some clips first.', 400);
    const content = [];
    let frames = 0;
    const clean = [];
    for (const m of media) {
        const id = line(m.id, 40);
        const dur = clamp(m.dur, 0.1, 6 * 3600, 5);
        const kind = m.kind === 'image' ? 'image' : 'video';
        clean.push({ id, dur: kind === 'image' ? Math.max(dur, 30) : dur });
        const loud = [].concat(m.loud || []).slice(0, 600).map(v => Math.round(clamp(v, 0, 9))).join('');
        content.push({ type: 'text', text: `Clip ${id} (“${line(m.name, 80)}”): ${kind === 'image' ? 'a photo, use for up to 30 s' : `video, ${dur.toFixed(1)} s`}${m.w ? `, ${m.w}×${m.h}` : ''}${loud ? `. Loudness per second (0 quiet – 9 loud): ${loud}` : ''}` });
        for (const f of [].concat(m.frames || []).slice(0, 16)) {
            if (frames >= MAX_FRAMES) break;
            const img = image(f.data);
            if (!img) continue;
            content.push({ type: 'text', text: `${id} at ${clamp(f.t, 0, dur).toFixed(1)} s:` }, img);
            frames++;
        }
    }
    const songs = music.map(s => ({ id: line(s.id, 40), name: line(s.name, 80), dur: clamp(s.dur, 1, 3600, 60), bpm: clamp(s.bpm, 0, 300, 0), beats: [].concat(s.beats || []).slice(0, 400).map(b => Math.round(clamp(b, 0, 3600) * 100) / 100) }));
    for (const s of songs) content.push({ type: 'text', text: `Music ${s.id} (“${s.name}”): ${s.dur.toFixed(1)} s${s.bpm ? `, about ${Math.round(s.bpm)} BPM` : ''}${s.beats.length ? `. Beats at (s): ${s.beats.join(', ')}` : ''}` });
    content.push({
        type: 'text',
        text: `The brief: ${line(brief, 1500) || 'Make a good, watchable edit of the best moments.'}
Length: ${Number(length) > 0 ? `about ${Math.round(clamp(length, 5, 600))} seconds` : 'your choice'}. Aspect: ${ASPECTS.includes(aspect) ? aspect : 'your choice'}. On-screen captions: ${captions ? 'yes, add titles/captions that fit' : 'only a title if it really helps'}. ${songs.length ? 'Music is available.' : 'No music was given: set music to null.'}`
    });
    const r = await ask({ apiKey, baseURL, model, system: VIDEO_SYSTEM, content, schema: VIDEO_SCHEMA, effort: 'high', maxTokens: 24000 });
    const plan = checkVideo(r.out, { media: clean, music: songs });
    if (!plan.clips.length) throw new AiError('Claude didn’t pick any usable moments. Try another brief.', 502);
    return { plan, usage: r.usage, model: r.model, frames };
}

module.exports = { MODELS, DEFAULT_MODEL, FILTERS, EFFECTS, TRANSITIONS, ASPECTS, editPhoto, editVideo, checkPhoto, checkVideo, AiError, PHOTO_SCHEMA, VIDEO_SCHEMA };
