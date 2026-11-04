'use strict';

// Auto editing for admins. An AI looks at a photo, or at frames sampled from video clips, and answers
// with an edit as JSON that the Photo and Video Editors apply. Every value is checked here before it
// reaches an editor. Claude goes through Anthropic's own SDK (with structured outputs); Gemini, Groq,
// OpenAI, OpenRouter, Mistral, xAI and any other OpenAI-compatible service go through the
// OpenAI-style chat completions API.

const Anthropic = require('@anthropic-ai/sdk').default;

const MODELS = {
    'claude-opus-5-5': 'Claude Opus 5.5 (best results)',
    'claude-sonnet-5-5': 'Claude Sonnet 5.5 (faster, cheaper)',
    'claude-haiku-5-5': 'Claude Haiku 5.5 (fastest, cheapest)'
};
const DEFAULT_MODEL = 'claude-opus-5-5';
// models whose refusals can be re-run on a fallback model by the API itself
const FALLBACK = ['claude-opus-5-5', 'claude-sonnet-5-5'];

// the services an admin can pick in Admin → AI (each with its own key)
// The services, grouped the way Admin → AI shows them (and in which order Jarvis tries backups):
// free ones first, then those with free trial credits, then paid ones, then your own.
// tier: free · trial · paid · own; free: what's free about it (as of November 2026; it changes often)
const PROVIDERS = {
    gemini: { name: 'Gemini', by: 'Google', tier: 'free', free: 'Free tier for the Flash models, limits per project (see AI Studio). Free-tier prompts may be used to improve Google’s products.', kind: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GEMINI_API_KEY', keys: 'https://aistudio.google.com/apikey', model: 'gemini-flash-latest', maxImages: 90, hint: 'AIza…' },
    groq: { name: 'Groq', by: 'Groq', tier: 'free', free: 'Free, no card: per model about 30 requests a minute and 1,000 a day (Llama 3.3 70B). Very fast.', kind: 'openai', base: 'https://api.groq.com/openai/v1', env: 'GROQ_API_KEY', keys: 'https://console.groq.com/keys', model: 'meta-llama/llama-4-scout-17b-16e-instruct', maxImages: 5, hint: 'gsk_…' },
    mistral: { name: 'Mistral', by: 'Mistral AI', tier: 'free', free: 'Free Experiment plan: a phone number, no card. Requests may be used to train their models.', kind: 'openai', base: 'https://api.mistral.ai/v1', env: 'MISTRAL_API_KEY', keys: 'https://console.mistral.ai/api-keys', model: 'mistral-medium-latest', maxImages: 8, hint: '' },
    openrouter: { name: 'OpenRouter', by: 'OpenRouter', tier: 'free', free: 'Dozens of free models (names end in :free): 20 a minute, 50 a day, or 1,000 a day once you’ve bought $10 of credit.', kind: 'openai', base: 'https://openrouter.ai/api/v1', env: 'OPENROUTER_API_KEY', keys: 'https://openrouter.ai/keys', model: '', maxImages: 30, hint: 'sk-or-…' },
    sambanova: { name: 'SambaNova', by: 'SambaNova Cloud', tier: 'free', free: 'Free while no payment method is on the account: about 20 requests a minute per model, 200K tokens a day.', kind: 'openai', base: 'https://api.sambanova.ai/v1', env: 'SAMBANOVA_API_KEY', keys: 'https://cloud.sambanova.ai/apis', model: 'Meta-Llama-3.3-70B-Instruct', maxImages: 5, hint: '' },
    cohere: { name: 'Cohere', by: 'Cohere', tier: 'free', free: 'Free trial key: 1,000 calls a month, 20 a minute, for trying out (not for production).', kind: 'openai', base: 'https://api.cohere.ai/compatibility/v1', env: 'COHERE_API_KEY', keys: 'https://dashboard.cohere.com/api-keys', model: 'command-a-03-2025', maxImages: 5, hint: '' },
    nvidia: { name: 'NVIDIA', by: 'build.nvidia.com', tier: 'free', free: 'Free with the NVIDIA Developer Program: about 40 requests a minute, 100+ models. For trying out, not production.', kind: 'openai', base: 'https://integrate.api.nvidia.com/v1', env: 'NVIDIA_API_KEY', keys: 'https://build.nvidia.com/settings/api-keys', model: 'meta/llama-3.3-70b-instruct', maxImages: 5, hint: 'nvapi-…' },
    huggingface: { name: 'Hugging Face', by: 'Inference Providers', tier: 'free', free: 'A small amount of free credit every month for thousands of open models (more with PRO).', kind: 'openai', base: 'https://router.huggingface.co/v1', env: 'HF_TOKEN', keys: 'https://huggingface.co/settings/tokens', model: 'moonshotai/Kimi-K2-Instruct-0905', maxImages: 5, hint: 'hf_…' },
    zai: { name: 'Z.ai (GLM)', by: 'Zhipu', tier: 'free', free: 'The GLM Flash models (glm-4.7-flash, glm-4.5-flash) are free to use.', kind: 'openai', base: 'https://api.z.ai/api/paas/v4', env: 'ZAI_API_KEY', keys: 'https://z.ai/manage-apikey/apikey-list', model: 'glm-4.7-flash', maxImages: 5, hint: '' },
    cerebras: { name: 'Cerebras', by: 'Cerebras', tier: 'trial', free: 'The fastest of all. New accounts get trial credits (a card may be asked for); then paid per use.', kind: 'openai', base: 'https://api.cerebras.ai/v1', env: 'CEREBRAS_API_KEY', keys: 'https://cloud.cerebras.ai', model: 'gpt-oss-120b', maxImages: 5, hint: 'csk-…' },
    alibaba: { name: 'Qwen', by: 'Alibaba Cloud Model Studio', tier: 'trial', free: 'New users: 1 million free tokens per model for 90 days (international region). Turn on “Free quota only” to never pay.', kind: 'openai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', env: 'DASHSCOPE_API_KEY', keys: 'https://www.alibabacloud.com/en/product/modelstudio', model: 'qwen-plus', maxImages: 10, hint: 'sk-…' },
    fireworks: { name: 'Fireworks', by: 'Fireworks AI', tier: 'trial', free: 'A little free credit for new accounts; then paid per use.', kind: 'openai', base: 'https://api.fireworks.ai/inference/v1', env: 'FIREWORKS_API_KEY', keys: 'https://fireworks.ai/account/api-keys', model: '', maxImages: 10, hint: '' },
    claude: { name: 'Claude', by: 'Anthropic', tier: 'paid', free: 'Paid per use (separate from a Claude.ai subscription). The best edits and the most capable Jarvis.', kind: 'anthropic', env: 'ANTHROPIC_API_KEY', keys: 'https://console.anthropic.com/settings/keys', model: DEFAULT_MODEL, maxImages: 90, hint: 'sk-ant-…' },
    openai: { name: 'OpenAI', by: 'OpenAI', tier: 'paid', free: 'Paid per use (separate from a ChatGPT subscription).', kind: 'openai', base: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY', keys: 'https://platform.openai.com/api-keys', model: 'gpt-4.1-mini', maxImages: 60, hint: 'sk-…' },
    deepseek: { name: 'DeepSeek', by: 'DeepSeek', tier: 'paid', free: 'Paid, but very cheap. Can’t look at pictures (no auto edit).', kind: 'openai', base: 'https://api.deepseek.com/v1', env: 'DEEPSEEK_API_KEY', keys: 'https://platform.deepseek.com/api_keys', model: 'deepseek-chat', maxImages: 1, hint: 'sk-…' },
    xai: { name: 'Grok', by: 'xAI', tier: 'paid', free: 'Paid per use.', kind: 'openai', base: 'https://api.x.ai/v1', env: 'XAI_API_KEY', keys: 'https://console.x.ai', model: '', maxImages: 10, hint: 'xai-…' },
    together: { name: 'Together AI', by: 'Together', tier: 'paid', free: 'Paid per use, many open models.', kind: 'openai', base: 'https://api.together.xyz/v1', env: 'TOGETHER_API_KEY', keys: 'https://api.together.ai/settings/api-keys', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', maxImages: 10, hint: '' },
    custom: { name: 'Other', by: 'any OpenAI-compatible service (Ollama, LM Studio, Cloudflare…)', tier: 'own', free: 'Ollama or LM Studio on your own computer are free forever and private.', kind: 'openai', base: '', env: 'AI_API_KEY', keys: '', model: '', maxImages: 10, hint: '', custom: true }
};
// an address for a self-hosted or other service: https anywhere, plain http only on this machine or
// the local network (so a key never crosses the internet unencrypted)
function checkBaseUrl(v) {
    let u;
    try {
        u = new URL(String(v || '').trim());
    } catch {
        return null;
    }
    const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|host\.docker\.internal|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i.test(u.hostname);
    if (u.username || u.password || !(u.protocol === 'https:' || (u.protocol === 'http:' && local))) return null;
    return u.toString().replace(/\/+$/, '');
}

const FILTERS = ['none', 'vivid', 'warm', 'cool', 'golden', 'mono', 'noir', 'sepia', 'vintage', 'fade', 'dramatic', 'cinematic', 'pastel', 'teal'];
const ADJUST = { exposure: [-100, 100], contrast: [-100, 100], highlights: [-100, 100], shadows: [-100, 100], saturation: [-100, 100], vibrance: [-100, 100], temperature: [-100, 100], tint: [-100, 100], fade: [0, 100], vignette: [0, 100], sharpen: [0, 100], grain: [0, 100] };
const CROPS = ['none', '1:1', '4:5', '16:9', '9:16', '3:2', '2:3'];
const ASPECTS = ['16:9', '9:16', '1:1', '4:5'];
// the Video Editor's effects, transitions and title looks (the editor and saved projects use these lists too)
const EFFECTS = ['none', 'zoom_in', 'zoom_out', 'slow_zoom', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'pulse', 'heartbeat', 'shake', 'earthquake', 'wobble', 'spin_in', 'glitch', 'vhs', 'rgb_split', 'film', 'pixel_in', 'flash', 'strobe', 'invert_flash', 'bw', 'color_in', 'dream', 'rainbow', 'blur_in', 'blur_out'];
const TRANSITIONS = ['none', 'fade', 'dip_black', 'dip_white', 'flash', 'slide_left', 'slide_right', 'slide_up', 'slide_down', 'cover', 'zoom', 'zoom_out', 'spin', 'wipe', 'wipe_up', 'wipe_diag', 'circle', 'split', 'blur', 'whip', 'glitch', 'pixelate'];
const POSITIONS = ['top', 'center', 'bottom'];
const TEXT_STYLES = ['plain', 'shadow', 'outline', 'box', 'title', 'neon', 'highlight', 'retro', 'gradient'];
const TEXT_ANIMS = ['none', 'fade', 'pop', 'slide', 'slide_left', 'drop', 'bounce', 'zoom', 'type', 'wave', 'blur', 'flicker'];

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

/* ---------- talking to the AI ---------- */
class AiError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}
function client(apiKey, baseURL) {
    return new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000, ...(baseURL ? { baseURL } : {}) });
}
// one request, to whichever service is set up; answers { out (the JSON), usage, model }
async function ask(o) {
    return PROVIDERS[o.provider] && PROVIDERS[o.provider].kind === 'openai' ? askOpenAI(o) : askClaude(o);
}
async function askClaude({ apiKey, baseURL, model, system, content, schema, effort, maxTokens = 16000 }) {
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
        throw claudeError(e);
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

// the OpenAI-style chat completions API (Gemini, Groq, OpenAI, OpenRouter, Mistral, xAI, Ollama…)
const toOpenAI = b => (b.type === 'image' ? { type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } } : { type: 'text', text: b.text });
async function chat({ provider, apiKey, baseURL, model, messages, json, timeout = 5 * 60 * 1000 }) {
    const name = (PROVIDERS[provider] || PROVIDERS.custom).name;
    if (!baseURL) throw new AiError(`Set the address of the ${name} service in Admin → AI.`, 409);
    if (!model) throw new AiError(`Pick a ${name} model in Admin → AI.`, 409);
    const send = async withFormat => {
        let res;
        try {
            res = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(provider === 'openrouter' ? { 'X-Title': 'EderveenGroup' } : {}) },
                body: JSON.stringify({ model, messages, ...(withFormat ? { response_format: { type: 'json_object' } } : {}) }),
                signal: AbortSignal.timeout(timeout)
            });
        } catch (e) {
            throw new AiError(e && e.name === 'TimeoutError' ? `${name} took too long to answer. Try fewer clips.` : `Couldn’t reach ${name}. Check the server’s internet connection${PROVIDERS[provider] && PROVIDERS[provider].custom ? ' and the address' : ''}.`, 502);
        }
        const data = await res.json().catch(() => ({}));
        return { res, data };
    };
    let { res, data } = await send(json);
    // not every model takes "answer in JSON": ask again without it (the answer is still checked)
    if (json && res.status === 400 && /response_format|json/i.test(JSON.stringify(data))) ({ res, data } = await send(false));
    if (!res.ok) {
        const said = line((data.error && (data.error.message || data.error)) || data.message || '', 200);
        if (res.status === 401 || res.status === 403) throw new AiError(`${name} doesn’t accept this API key. Check it in Admin → AI.`, 502);
        if (res.status === 404) throw new AiError(`${name} doesn’t know the model “${model}”${said ? ` (${said})` : ''}. Pick another in Admin → AI.`, 400);
        if (res.status === 429) throw new AiError(`${name} is busy or the key’s limit is reached. Try again in a minute.`, 429);
        if (res.status === 400 || res.status === 413 || res.status === 422) throw new AiError(`${name} couldn’t take this request${said ? `: ${said}` : ''}.`, 400);
        throw new AiError(`${name} had a problem (${res.status}). Try again.`, 502);
    }
    const choice = (data.choices || [])[0] || {};
    const msg = choice.message || {};
    const text = Array.isArray(msg.content) ? msg.content.map(x => x.text || '').join('') : String(msg.content || '');
    if (choice.finish_reason === 'content_filter' || (!text && msg.refusal)) throw new AiError(`${name} declined to edit this.`, 422);
    if (choice.finish_reason === 'length' && !text.trim().endsWith('}')) throw new AiError(`${name}’s answer was cut off. Try fewer clips.`, 502);
    const u = data.usage || {};
    return { text, usage: { input_tokens: u.prompt_tokens || u.input_tokens || 0, output_tokens: u.completion_tokens || u.output_tokens || 0 }, model: data.model || model };
}
// the JSON in an answer, also when it's wrapped in ```json fences or a sentence
function jsonIn(text) {
    const t = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
        return JSON.parse(t.slice(a, b + 1));
    } catch {
        return null;
    }
}
async function askOpenAI({ provider, apiKey, baseURL, model, system, content, schema }) {
    const r = await chat({
        provider,
        apiKey,
        baseURL,
        model,
        json: true,
        messages: [
            { role: 'system', content: `${system}\n\nAnswer with one JSON object and nothing else. It must match this JSON Schema exactly (every property is required):\n${JSON.stringify(schema)}` },
            { role: 'user', content: content.map(toOpenAI) }
        ]
    });
    const out = jsonIn(r.text);
    if (!out) throw new AiError(`${(PROVIDERS[provider] || PROVIDERS.custom).name}’s answer couldn’t be read. Try again, or pick a stronger model.`, 502);
    return { out, usage: r.usage, model: r.model };
}

/* ---------- a conversation with tools (Jarvis) ---------- */
// The AI may call tools (look things up, add a task…) before it answers. `run(name, input)` does
// the work and returns what it found; the loop goes on until the AI answers in words.
function claudeError(e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AiError('The Claude API key isn’t accepted. Check it in Admin → AI.', 502);
    if (e instanceof Anthropic.RateLimitError) return new AiError('Claude is busy (rate limit). Try again in a minute.', 429);
    if (e instanceof Anthropic.BadRequestError) return new AiError(`Claude couldn’t take this request: ${e.message}`, 400);
    if (e instanceof Anthropic.APIError) return new AiError(`Claude had a problem (${e.status || 'no answer'}). Try again.`, 502);
    return new AiError('Couldn’t reach Claude. Check the server’s internet connection.', 502);
}
const asText = out => {
    const t = JSON.stringify(out === undefined ? null : out);
    return t.length > 24000 ? `${t.slice(0, 24000)}…` : t;
};
async function runTool(run, used, name, input) {
    try {
        const out = await run(name, input || {});
        used.push({ name, input, ok: true });
        return { out, error: false };
    } catch (e) {
        used.push({ name, input, ok: false });
        return { out: { error: (e && e.message) || 'That didn’t work' }, error: true };
    }
}
async function converseClaude({ apiKey, baseURL, model, system, messages, tools, run, maxSteps = 6, effort = 'low', timeoutMs = 120 * 1000, retries = 2 }) {
    const c = client(apiKey, baseURL);
    const msgs = messages.map(m => ({ role: m.role, content: m.content }));
    const usage = { input_tokens: 0, output_tokens: 0 };
    const used = [];
    let served = model;
    for (let step = 0; step < maxSteps; step++) {
        let msg;
        try {
            msg = await c.messages.create({ model, max_tokens: 8000, system, messages: msgs, tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })), output_config: { effort } }, { timeout: timeoutMs, maxRetries: retries });
        } catch (e) {
            throw claudeError(e);
        }
        served = msg.model || model;
        usage.input_tokens += (msg.usage && msg.usage.input_tokens) || 0;
        usage.output_tokens += (msg.usage && msg.usage.output_tokens) || 0;
        const said = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
        if (msg.stop_reason === 'refusal') return { text: said || 'I’m afraid I can’t help with that one.', used, usage, model: served };
        if (msg.stop_reason === 'pause_turn') {
            msgs.push({ role: 'assistant', content: msg.content });
            continue;
        }
        const calls = msg.content.filter(b => b.type === 'tool_use');
        if (msg.stop_reason !== 'tool_use' || !calls.length) return { text: said || (msg.stop_reason === 'max_tokens' ? 'I lost my train of thought there. Could you ask that again?' : '…'), used, usage, model: served };
        // the turn goes back as it came (thinking included), then what each tool found
        msgs.push({ role: 'assistant', content: msg.content });
        const results = [];
        for (const call of calls) {
            const r = await runTool(run, used, call.name, call.input);
            results.push({ type: 'tool_result', tool_use_id: call.id, content: asText(r.out), ...(r.error ? { is_error: true } : {}) });
        }
        msgs.push({ role: 'user', content: results });
    }
    return { text: 'That took more steps than I allow myself. Could you ask it more simply?', used, usage, model: served };
}
// the same over the OpenAI-style API, with function calling
async function converseOpenAI({ provider, apiKey, baseURL, model, system, messages, tools, run, maxSteps = 6, timeoutMs = 120 * 1000 }) {
    const name = (PROVIDERS[provider] || PROVIDERS.custom).name;
    if (!baseURL) throw new AiError(`Set the address of the ${name} service in Admin → AI.`, 409);
    if (!model) throw new AiError(`Pick a ${name} model in Admin → AI.`, 409);
    const msgs = [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: m.content }))];
    // (Gemini turns down a tool with an empty list of parameters, so those go without)
    const fns = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, ...(provider === 'gemini' && !Object.keys(t.parameters.properties || {}).length ? {} : { parameters: t.parameters }) } }));
    const usage = { input_tokens: 0, output_tokens: 0 };
    const used = [];
    let served = model;
    let retried = false;
    for (let step = 0; step < maxSteps; step++) {
        let res;
        try {
            res = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(provider === 'openrouter' ? { 'X-Title': 'EderveenGroup' } : {}) },
                body: JSON.stringify({ model, messages: msgs, tools: fns, tool_choice: 'auto' }),
                signal: AbortSignal.timeout(timeoutMs)
            });
        } catch (e) {
            throw new AiError(e && e.name === 'TimeoutError' ? `${name} took too long to answer.` : `Couldn’t reach ${name}. Check the server’s internet connection.`, 502);
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const said = line((data.error && (data.error.message || data.error)) || data.message || '', 200);
            if (res.status === 401 || res.status === 403) throw new AiError(`${name} doesn’t accept this API key. Check it in Admin → AI.`, 502);
            if (res.status === 404) throw new AiError(`${name} doesn’t know the model “${model}”. Pick another in Admin → AI.`, 400);
            if (res.status === 429) throw new AiError(`${name} is busy or the free limit is reached for now. Try again in a minute.`, 429);
            // the model wrote a broken tool call (Groq says so): one more go usually works
            if (res.status === 400 && data.error && data.error.code === 'tool_use_failed') {
                if (!retried) {
                    retried = true;
                    step--;
                    continue;
                }
                throw new AiError(`${name}’s model “${model}” got muddled using its tools. Try again, or pick a bigger model in Admin → AI.`, 502);
            }
            if (res.status === 400 && /tool|function/i.test(said)) throw new AiError(`${name}’s model “${model}” can’t use tools. Pick another model in Admin → AI.`, 400);
            throw new AiError(`${name} had a problem (${res.status})${said ? `: ${said}` : ''}.`, res.status >= 500 ? 502 : 400);
        }
        served = data.model || model;
        const u = data.usage || {};
        usage.input_tokens += u.prompt_tokens || u.input_tokens || 0;
        usage.output_tokens += u.completion_tokens || u.output_tokens || 0;
        const choice = (data.choices || [])[0] || {};
        const m = choice.message || {};
        const said = (Array.isArray(m.content) ? m.content.map(x => x.text || '').join('') : String(m.content || '')).trim();
        const calls = Array.isArray(m.tool_calls) ? m.tool_calls.filter(c => c && c.function && c.function.name) : [];
        if (!calls.length) return { text: said || (choice.finish_reason === 'content_filter' ? 'I’m afraid I can’t help with that one.' : '…'), used, usage, model: served };
        msgs.push({ role: 'assistant', content: m.content || '', tool_calls: calls });
        for (const call of calls) {
            let input = {};
            try {
                input = JSON.parse(call.function.arguments || '{}') || {};
            } catch {
                input = {};
            }
            const r = await runTool(run, used, call.function.name, input);
            msgs.push({ role: 'tool', tool_call_id: call.id, content: asText(r.out) });
        }
    }
    return { text: 'That took more steps than I allow myself. Could you ask it more simply?', used, usage, model: served };
}
function converse(o) {
    return PROVIDERS[o.provider] && PROVIDERS[o.provider].kind === 'openai' ? converseOpenAI(o) : converseClaude(o);
}

// "is this key working?": a one-word answer
async function ping(cfg) {
    if (PROVIDERS[cfg.provider] && PROVIDERS[cfg.provider].kind === 'openai') {
        const r = await chat({ ...cfg, json: false, timeout: 60 * 1000, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] });
        return { model: r.model, reply: line(r.text, 60), usage: r.usage };
    }
    const c = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 1, timeout: 60 * 1000, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
    try {
        const msg = await c.messages.create({ model: cfg.model, max_tokens: 400, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] });
        return { model: msg.model, reply: line(msg.content.filter(x => x.type === 'text').map(x => x.text).join(''), 60), usage: msg.usage || {} };
    } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('Anthropic doesn’t accept this key. Check it and try again.', 400);
        if (e instanceof Anthropic.NotFoundError) throw new AiError('This key can’t use that model. Pick another model.', 400);
        if (e instanceof Anthropic.RateLimitError) throw new AiError('The key works, but it’s rate limited right now.', 429);
        if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic answered with an error (${e.status || 'no answer'}).`, 502);
        throw new AiError('Couldn’t reach Anthropic from the server. Check its internet connection.', 502);
    }
}
// the models a key can use, to pick from (OpenAI-style services list them at /models)
async function listModels(cfg) {
    if (!PROVIDERS[cfg.provider] || PROVIDERS[cfg.provider].kind !== 'openai') return Object.keys(MODELS);
    const name = PROVIDERS[cfg.provider].name;
    if (!cfg.baseURL) throw new AiError(`Set the address of the ${name} service first.`, 409);
    let res;
    try {
        res = await fetch(`${cfg.baseURL}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(30 * 1000) });
    } catch {
        throw new AiError(`Couldn’t reach ${name}.`, 502);
    }
    if (res.status === 401 || res.status === 403) throw new AiError(`${name} doesn’t accept this API key.`, 400);
    if (!res.ok) throw new AiError(`${name} didn’t list its models (${res.status}). Type the model’s name instead.`, 502);
    const data = await res.json().catch(() => ({}));
    const ids = [].concat(data.data || data.models || []).map(m => String((m && (m.id || m.name)) || '').replace(/^models\//, '')).filter(id => /^[A-Za-z0-9._:\/@+-]{1,120}$/.test(id));
    return [...new Set(ids)].sort().slice(0, 400);
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const image = dataUrl => {
    const m = IMAGE.exec(String(dataUrl || ''));
    if (!m || m[2].length > 1.6 * 1024 * 1024) return null;
    return { type: 'image', source: { type: 'base64', media_type: `image/${m[1]}`, data: m[2] } };
};

async function editPhoto({ photo, wish, size, ...svc }) {
    const img = image(photo);
    if (!img) throw new AiError('Send the photo as a JPEG, PNG or WebP picture.', 400);
    const content = [img, { type: 'text', text: `${size ? `The full photo is ${size.w} × ${size.h} pixels. ` : ''}${line(wish, 600) ? `The owner’s wish: “${line(wish, 600)}”` : 'Make it look its best.'}` }];
    const r = await ask({ ...svc, system: PHOTO_SYSTEM, content, schema: PHOTO_SCHEMA, effort: 'medium', maxTokens: 8000 });
    return { edit: checkPhoto(r.out), usage: r.usage, model: r.model };
}

const MAX_FRAMES = 90;
// which frames to send when a service takes only so many pictures: spread over every clip
function pickFrames(media, budget) {
    const per = media.map(m => [].concat(m.frames || []).slice(0, 16));
    const total = per.reduce((n, f) => n + f.length, 0);
    if (total <= budget) return per;
    const share = Math.max(1, Math.floor(budget / Math.max(1, media.length)));
    let left = budget;
    return per.map(f => {
        const k = Math.min(f.length, share, left);
        left -= k;
        return Array.from({ length: k }, (_, i) => f[Math.floor(((i + 0.5) * f.length) / k)]);
    });
}
async function editVideo({ brief, length, aspect, captions, media, music, ...svc }) {
    media = [].concat(media || []).slice(0, 40);
    music = [].concat(music || []).slice(0, 4);
    if (!media.length) throw new AiError('Add some clips first.', 400);
    const content = [];
    let frames = 0;
    const clean = [];
    const budget = Math.min(MAX_FRAMES, Math.max(1, Math.round(clamp(svc.maxImages, 1, MAX_FRAMES, MAX_FRAMES))));
    const chosen = pickFrames(media, budget);
    for (const [mi, m] of media.entries()) {
        const id = line(m.id, 40);
        const dur = clamp(m.dur, 0.1, 6 * 3600, 5);
        const kind = m.kind === 'image' ? 'image' : 'video';
        clean.push({ id, dur: kind === 'image' ? Math.max(dur, 30) : dur });
        const loud = [].concat(m.loud || []).slice(0, 600).map(v => Math.round(clamp(v, 0, 9))).join('');
        content.push({ type: 'text', text: `Clip ${id} (“${line(m.name, 80)}”): ${kind === 'image' ? 'a photo, use for up to 30 s' : `video, ${dur.toFixed(1)} s`}${m.w ? `, ${m.w}×${m.h}` : ''}${loud ? `. Loudness per second (0 quiet – 9 loud): ${loud}` : ''}` });
        for (const f of chosen[mi]) {
            if (frames >= budget) break;
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
    const r = await ask({ ...svc, system: VIDEO_SYSTEM, content, schema: VIDEO_SCHEMA, effort: 'high', maxTokens: 24000 });
    const plan = checkVideo(r.out, { media: clean, music: songs });
    if (!plan.clips.length) throw new AiError(`${(PROVIDERS[svc.provider] || PROVIDERS.claude).name} didn’t pick any usable moments. Try another brief or a stronger model.`, 502);
    return { plan, usage: r.usage, model: r.model, frames };
}

module.exports = { PROVIDERS, checkBaseUrl, ping, listModels, converse, MODELS, DEFAULT_MODEL, FILTERS, EFFECTS, TRANSITIONS, ASPECTS, TEXT_STYLES, TEXT_ANIMS, editPhoto, editVideo, checkPhoto, checkVideo, AiError, PHOTO_SCHEMA, VIDEO_SCHEMA };
