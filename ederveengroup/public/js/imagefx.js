// Effects on the graphics card (WebGL): light, colour, looks, blur, sharpen, grain, vignette,
// glitch and pixelate, plus crop, rotate, straighten and flip, in one pass. Shared by the Photo
// Editor and the Video Editor (where it runs on every frame).
(function () {
    // every adjustment, as people see it (−100…100 or 0…100)
    const PARAMS = [
        ['exposure', 'Exposure', -100, 100],
        ['contrast', 'Contrast', -100, 100],
        ['highlights', 'Highlights', -100, 100],
        ['shadows', 'Shadows', -100, 100],
        ['saturation', 'Saturation', -100, 100],
        ['vibrance', 'Vibrance', -100, 100],
        ['temperature', 'Warmth', -100, 100],
        ['tint', 'Tint', -100, 100],
        ['fade', 'Fade', 0, 100],
        ['vignette', 'Vignette', 0, 100],
        ['sharpen', 'Sharpen', 0, 100],
        ['blur', 'Blur', 0, 100],
        ['grain', 'Grain', 0, 100]
    ];
    const EFFECTS = [
        ['glitch', 'Glitch', 0, 100],
        ['pixelate', 'Pixelate', 0, 100],
        ['sepia', 'Sepia', 0, 100],
        ['teal', 'Teal & orange', 0, 100],
        ['invert', 'Invert', 0, 100]
    ];
    const ALL = [...PARAMS, ...EFFECTS];
    // looks: a starting point for the sliders
    const FILTERS = {
        none: ['Original', {}],
        vivid: ['Vivid', { saturation: 28, vibrance: 25, contrast: 14 }],
        warm: ['Warm', { temperature: 32, saturation: 8, highlights: -6 }],
        cool: ['Cool', { temperature: -30, tint: 4, contrast: 6 }],
        golden: ['Golden', { temperature: 45, tint: 8, saturation: 14, highlights: -12, vignette: 18 }],
        mono: ['Mono', { saturation: -100, contrast: 12 }],
        noir: ['Noir', { saturation: -100, contrast: 42, shadows: -22, vignette: 40, grain: 18 }],
        sepia: ['Sepia', { sepia: 85, contrast: 6, fade: 10 }],
        vintage: ['Vintage', { fade: 32, temperature: 16, saturation: -22, vignette: 32, grain: 26, contrast: -6 }],
        fade: ['Faded', { fade: 42, contrast: -16, saturation: -10 }],
        dramatic: ['Dramatic', { contrast: 38, shadows: -26, highlights: -24, saturation: -8, vignette: 30, sharpen: 20 }],
        cinematic: ['Cinematic', { teal: 65, contrast: 18, saturation: -6, vignette: 20 }],
        pastel: ['Pastel', { fade: 26, saturation: -24, exposure: 10, temperature: 6 }],
        teal: ['Teal', { teal: 100, saturation: 10, contrast: 10 }]
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    /** The look plus your own changes: filter (at a strength) + adjustments + effects */
    function merge(filter, strength = 100, own = {}) {
        const base = (FILTERS[filter] || FILTERS.none)[1];
        const out = {};
        for (const [k, , lo, hi] of ALL) out[k] = clamp((base[k] || 0) * (strength / 100) + (own[k] || 0), lo, hi);
        return out;
    }
    // how much bigger a straightened picture is drawn so no empty corners show
    function straightenZoom(w, h, angle) {
        const a = Math.abs(angle);
        if (!a) return 1;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
    }

    const VS = `attribute vec2 a_uv; varying vec2 v_uv; void main(){ v_uv = a_uv; gl_Position = vec4(a_uv.x * 2.0 - 1.0, 1.0 - a_uv.y * 2.0, 0.0, 1.0); }`;
    const FS = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_crop; uniform vec2 u_rsize; uniform vec2 u_ssize; uniform float u_angle; uniform float u_zoom; uniform float u_quarter; uniform vec2 u_flip; uniform vec2 u_shift; uniform vec2 u_out;
uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_saturation, u_vibrance, u_temp, u_tint, u_fade, u_vignette, u_sharpen, u_blur, u_grain, u_glitch, u_pixel, u_sepia, u_teal, u_invert, u_time;
vec2 srcUV(vec2 uv) {
    vec2 p = (u_crop.xy + uv * u_crop.zw) * u_rsize - u_rsize * 0.5 + u_shift * u_rsize;
    p *= u_flip;
    float s = sin(-u_angle), c = cos(-u_angle);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / u_zoom;
    if (u_quarter > 0.5 && u_quarter < 1.5) p = vec2(p.y, -p.x);
    else if (u_quarter > 1.5 && u_quarter < 2.5) p = -p;
    else if (u_quarter > 2.5) p = vec2(-p.y, p.x);
    return p / u_ssize + 0.5;
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 uv = v_uv;
    if (u_pixel > 0.0) { vec2 cells = u_out / max(2.0, u_pixel * 0.6 * min(u_out.x, u_out.y) / 40.0); uv = (floor(uv * cells) + 0.5) / cells; }
    vec2 st = srcUV(uv);
    if (st.x < 0.0 || st.y < 0.0 || st.x > 1.0 || st.y > 1.0) { gl_FragColor = vec4(0.0); return; }
    vec2 tx = 1.0 / u_ssize;
    vec3 c;
    if (u_glitch > 0.0) {
        float band = step(0.82, hash(vec2(floor(v_uv.y * 24.0), floor(u_time * 8.0))));
        float o = u_glitch * (0.004 + band * 0.02);
        c = vec3(texture2D(u_tex, st + vec2(o, 0.0)).r, texture2D(u_tex, st).g, texture2D(u_tex, st - vec2(o, 0.0)).b);
    } else c = texture2D(u_tex, st).rgb;
    if (u_blur > 0.0) {
        vec3 acc = c; float r = u_blur * 0.012 * max(u_ssize.x, u_ssize.y);
        for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 d = vec2(cos(a), sin(a)) * tx * r; acc += texture2D(u_tex, st + d).rgb + texture2D(u_tex, st + d * 0.5).rgb; }
        c = acc / 25.0;
    }
    if (u_sharpen > 0.0) {
        vec2 k = tx * max(1.0, max(u_ssize.x, u_ssize.y) / max(u_out.x, u_out.y));
        vec3 n = texture2D(u_tex, st + vec2(k.x, 0.0)).rgb + texture2D(u_tex, st - vec2(k.x, 0.0)).rgb + texture2D(u_tex, st + vec2(0.0, k.y)).rgb + texture2D(u_tex, st - vec2(0.0, k.y)).rgb;
        c += (c - n * 0.25) * u_sharpen * 1.6;
    }
    c *= pow(2.0, u_exposure);
    c.r += u_temp * 0.08; c.b -= u_temp * 0.08; c.g += u_tint * 0.06; c.r -= u_tint * 0.02; c.b -= u_tint * 0.02;
    float l = luma(c);
    c += u_shadows * 0.28 * (1.0 - smoothstep(0.0, 0.55, l));
    c += u_highlights * 0.28 * smoothstep(0.45, 1.0, l);
    c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
    l = luma(c);
    c = mix(vec3(l), c, 1.0 + u_saturation);
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3(luma(c)), c, 1.0 + u_vibrance * (1.0 - clamp(sat, 0.0, 1.0)));
    if (u_teal > 0.0) { l = luma(c); vec3 tone = mix(vec3(0.0, 0.42, 0.5), vec3(1.0, 0.62, 0.32), smoothstep(0.15, 0.85, l)); c = mix(c, c + (tone - 0.5) * 0.45, u_teal); }
    if (u_sepia > 0.0) { vec3 sp = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131))); c = mix(c, sp, u_sepia); }
    c = c * (1.0 - u_fade * 0.28) + u_fade * 0.12;
    c = mix(c, 1.0 - c, u_invert);
    if (u_vignette > 0.0) { vec2 d = v_uv - 0.5; float v = 1.0 - smoothstep(0.25, 0.85, length(d * vec2(1.0, u_out.y / u_out.x) * 1.15)); c *= mix(1.0, v, u_vignette); }
    if (u_grain > 0.0) c += (hash(v_uv * u_out + fract(u_time) * 97.0) - 0.5) * u_grain * 0.22;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

    /** A renderer on a canvas. render(source, opts) draws one frame. */
    function create(canvas) {
        const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
        if (!gl) return null;
        const sh = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'a_uv');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        const U = {};
        const u = name => (U[name] = U[name] || gl.getUniformLocation(prog, name));
        const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        let last = null;
        let shrunk = null;
        // a picture bigger than the graphics card takes is drawn smaller first
        function fit(src, sw, sh2) {
            if (Math.max(sw, sh2) <= maxTex) return src;
            if (shrunk && shrunk.src === src) return shrunk.cv;
            const k = maxTex / Math.max(sw, sh2);
            const cv = document.createElement('canvas');
            cv.width = Math.floor(sw * k);
            cv.height = Math.floor(sh2 * k);
            cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
            shrunk = { src, cv };
            return cv;
        }
        return {
            gl,
            maxTex,
            /**
             * source: an image, video, canvas or bitmap. o: { w, h } output size; p: merged params;
             * crop {x,y,w,h} (in the turned picture, 0…1); quarter (0…3, clockwise); angle (radians);
             * flip [±1, ±1]; zoom (extra, ≥ 1, e.g. for video zoom effects); shift [x, y]; time (s)
             */
            render(source, o) {
                const sw = source.videoWidth || source.naturalWidth || source.width;
                const sh2 = source.videoHeight || source.naturalHeight || source.height;
                if (!sw || !sh2) return false;
                if (canvas.width !== o.w || canvas.height !== o.h) {
                    canvas.width = o.w;
                    canvas.height = o.h;
                }
                gl.viewport(0, 0, o.w, o.h);
                const isVideo = !!source.videoWidth;
                if (isVideo || last !== source || o.fresh) {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fit(source, sw, sh2));
                    last = source;
                }
                const q = ((o.quarter || 0) % 4 + 4) % 4;
                const rw = q % 2 ? sh2 : sw;
                const rh = q % 2 ? sw : sh2;
                const crop = o.crop || { x: 0, y: 0, w: 1, h: 1 };
                const angle = o.angle || 0;
                const zoom = straightenZoom(crop.w * rw, crop.h * rh, angle) * (o.zoom || 1);
                const p = o.p || merge('none');
                gl.uniform4f(u('u_crop'), crop.x, crop.y, crop.w, crop.h);
                gl.uniform2f(u('u_rsize'), rw, rh);
                gl.uniform2f(u('u_ssize'), sw, sh2);
                gl.uniform1f(u('u_angle'), angle);
                gl.uniform1f(u('u_zoom'), zoom);
                gl.uniform1f(u('u_quarter'), q);
                gl.uniform2f(u('u_flip'), (o.flip && o.flip[0]) || 1, (o.flip && o.flip[1]) || 1);
                gl.uniform2f(u('u_shift'), (o.shift && o.shift[0]) || 0, (o.shift && o.shift[1]) || 0);
                gl.uniform2f(u('u_out'), o.w, o.h);
                gl.uniform1f(u('u_time'), o.time || 0);
                const f = v => v / 100;
                gl.uniform1f(u('u_exposure'), f(p.exposure) * 1.5);
                gl.uniform1f(u('u_contrast'), f(p.contrast) * (p.contrast > 0 ? 0.9 : 0.6));
                gl.uniform1f(u('u_highlights'), f(p.highlights));
                gl.uniform1f(u('u_shadows'), f(p.shadows));
                gl.uniform1f(u('u_saturation'), f(p.saturation));
                gl.uniform1f(u('u_vibrance'), f(p.vibrance) * 0.9);
                gl.uniform1f(u('u_temp'), f(p.temperature));
                gl.uniform1f(u('u_tint'), f(p.tint));
                gl.uniform1f(u('u_fade'), f(p.fade));
                gl.uniform1f(u('u_vignette'), f(p.vignette));
                gl.uniform1f(u('u_sharpen'), f(p.sharpen));
                gl.uniform1f(u('u_blur'), f(p.blur));
                gl.uniform1f(u('u_grain'), f(p.grain));
                gl.uniform1f(u('u_glitch'), f(p.glitch));
                gl.uniform1f(u('u_pixel'), f(p.pixelate) * 40);
                gl.uniform1f(u('u_sepia'), f(p.sepia));
                gl.uniform1f(u('u_teal'), f(p.teal));
                gl.uniform1f(u('u_invert'), f(p.invert));
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                return true;
            }
        };
    }
    window.EGFX = { PARAMS, EFFECTS, ALL, FILTERS, merge, create, straightenZoom, clamp };
})();
