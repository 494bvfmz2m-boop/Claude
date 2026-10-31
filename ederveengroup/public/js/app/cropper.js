// EderveenGroup client: cropper
import { refreshMe } from './chrome.js';
import { renderList } from './list.js';
import { renderReader } from './reader.js';
import { state } from './state.js';
import { $, api, h, resetPhotos, toast } from './util.js';

function cropPhoto(file, done) {
    if (!/^image\//.test(file.type)) return toast('Pick an image file', { error: true });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Couldn’t read that image. Try a JPG or PNG.', { error: true });
    };
    img.onload = () => {
        const V = 280;
        const base = Math.max(V / img.naturalWidth, V / img.naturalHeight);
        let zoom = 1, s = base, ox = (V - img.naturalWidth * s) / 2, oy = (V - img.naturalHeight * s) / 2;
        const back = h(`<div class="modal-back" style="z-index:65"><div class="modal cropper">
            <div class="modal-head"><h2>Position your photo</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
            <div class="modal-body">
                <div class="crop-stage"><canvas width="${V * 2}" height="${V * 2}"></canvas><div class="crop-ring"></div></div>
                <div class="crop-zoom">${icon('image')}<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">${icon('image')}</div>
                <p class="hint" style="text-align:center;margin:6px 0 0">Drag to reposition · scroll or slide to zoom</p>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-save>${icon('check')} Save photo</button></div>
            </div></div></div>`);
        document.body.append(back);
        const canvas = $('canvas', back);
        const ctx = canvas.getContext('2d');
        const clamp = () => {
            const w = img.naturalWidth * s, hh = img.naturalHeight * s;
            ox = Math.min(0, Math.max(V - w, ox));
            oy = Math.min(0, Math.max(V - hh, oy));
        };
        const paint = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, ox * 2, oy * 2, img.naturalWidth * s * 2, img.naturalHeight * s * 2);
        };
        const setZoom = z => {
            zoom = Math.max(1, Math.min(4, z));
            const cx = (V / 2 - ox) / s, cy = (V / 2 - oy) / s;
            s = base * zoom;
            ox = V / 2 - cx * s;
            oy = V / 2 - cy * s;
            clamp();
            paint();
            $('input[type=range]', back).value = zoom;
        };
        paint();
        let drag = null;
        canvas.addEventListener('pointerdown', e => {
            drag = { x: e.clientX, y: e.clientY, ox, oy };
            canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', e => {
            if (!drag) return;
            const scale = V / canvas.getBoundingClientRect().width;
            ox = drag.ox + (e.clientX - drag.x) * scale;
            oy = drag.oy + (e.clientY - drag.y) * scale;
            clamp();
            paint();
        });
        canvas.addEventListener('pointerup', () => (drag = null));
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
        }, { passive: false });
        $('input[type=range]', back).addEventListener('input', e => setZoom(Number(e.target.value)));
        const close = () => {
            back.remove();
            URL.revokeObjectURL(url);
        };
        back.addEventListener('click', async e => {
            if (e.target === back || e.target.closest('[data-close]')) return close();
            if (!e.target.closest('[data-save]')) return;
            const out = document.createElement('canvas');
            out.width = out.height = 320;
            out.getContext('2d').drawImage(img, -ox / s, -oy / s, V / s, V / s, 0, 0, 320, 320);
            const btn = e.target.closest('[data-save]');
            btn.disabled = true;
            try {
                const r = await api('api/profile/photo', { method: 'PUT', body: { dataUrl: out.toDataURL('image/jpeg', 0.9) } });
                state.me.photo = r.photo;
                resetPhotos(state.me.email);
                close();
                refreshMe();
                renderList();
                if (state.current) renderReader();
                done && done();
                toast('Looking good. Photo updated.');
            } catch (err) {
                btn.disabled = false;
                toast(err.message, { error: true });
            }
        });
    };
    img.src = url;
}

export { cropPhoto };
