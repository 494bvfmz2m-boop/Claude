// Photos: every picture and video in Files, by the day it was taken, with albums (folders).
(function () {
    const { $, $$, esc, ic, call, toast, ask, phone } = window.EG;
    const root = $('#photos');
    let items = []; // all files
    let media = []; // the pictures and videos, newest first
    let tab = 'library';
    let album = null; // a folder id when looking inside one
    const count = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const isMedia = f => f.kind === 'file' && /^(image|video)\//.test(f.type);
    const isVideo = f => /^video\//.test(f.type);
    const when = f => f.taken || f.createdAt;
    const size = n => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
    const thumbUrl = f => `/api/files/${encodeURIComponent(f.id)}/thumb`;
    const contentUrl = f => `/api/files/${encodeURIComponent(f.id)}/content?inline=1`;

    root.innerHTML = `<div class="ph" id="drop">
        <div class="ea-head ph-head">
            <h1>Photos</h1>
            <div class="ph-tools">
                <div class="seg ph-tabs" role="tablist"><button data-tab="library" class="on">Library</button><button data-tab="albums">Albums</button></div>
                <label class="btn btn-primary ph-upload">${ic('plus')}<span>Add photos</span><input type="file" id="pick" accept="image/*,video/*" multiple hidden></label>
            </div>
        </div>
        <div class="ph-status" id="status" hidden></div>
        <div id="body"></div>
        <div class="fl-drop-hint" aria-hidden="true">${ic('image')}<b>Drop photos and videos to add them</b></div>
    </div>`;
    const body = $('#body');

    /* ---------- library: by month, newest first ---------- */
    function library() {
        const list = album ? media.filter(f => f.folder === album) : media;
        const folder = album && items.find(f => f.id === album);
        if (!list.length) {
            body.innerHTML = `${album ? `<button class="btn btn-ghost ph-back" data-back>${ic('left')}<span>Albums</span></button>` : ''}<div class="ea-empty big">${ic('image')}<p>${album ? 'No photos in this album.' : 'No photos yet. Add some with the button above, or drop them here. On your phone, choose them straight from your camera roll.'}</p></div>`;
            return;
        }
        const groups = [];
        for (const f of list) {
            const d = new Date(when(f));
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), items: [] });
            groups[groups.length - 1].items.push(f);
        }
        body.innerHTML = `${album ? `<div class="ph-album-head"><button class="btn btn-ghost ph-back" data-back>${ic('left')}<span>Albums</span></button><h2>${esc(folder ? folder.name : '')}</h2></div>` : ''}
            <p class="ph-count">${count(list.filter(f => !isVideo(f)).length, 'photo')}${list.some(isVideo) ? `, ${count(list.filter(isVideo).length, 'video')}` : ''}</p>
            ${groups.map(g => `<section class="ph-month"><h2>${esc(g.label)}</h2><div class="ph-grid">${g.items.map(tile).join('')}</div></section>`).join('')}`;
        watchTiles();
    }
    function tile(f) {
        return `<button class="ph-tile${f.thumb ? '' : ' wait'}" data-id="${esc(f.id)}" aria-label="${esc(f.name)}">${f.thumb ? `<img loading="lazy" alt="" src="${thumbUrl(f)}">` : ''}${isVideo(f) ? `<span class="ph-play">${ic('eye')}</span>` : ''}</button>`;
    }
    // previews are made by the browser, a few at a time, for tiles that come into view
    const queue = [];
    let busy = 0;
    function pump() {
        while (busy < 2 && queue.length) {
            const f = queue.shift();
            busy++;
            window.EG.thumbFor(f)
                .then(ok => {
                    const el = $(`.ph-tile[data-id="${f.id}"]`);
                    if (!el) return;
                    if (ok) {
                        el.classList.remove('wait');
                        el.insertAdjacentHTML('afterbegin', `<img alt="" src="${thumbUrl(f)}">`);
                    } else el.classList.add('none');
                })
                .finally(() => {
                    busy--;
                    pump();
                });
        }
    }
    let io;
    function watchTiles() {
        if (io) io.disconnect();
        io = new IntersectionObserver(entries => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                io.unobserve(e.target);
                const f = media.find(x => x.id === e.target.dataset.id);
                if (f && !f.thumb && !queue.includes(f)) queue.push(f);
            }
            pump();
        }, { rootMargin: '400px' });
        $$('.ph-tile.wait', body).forEach(t => io.observe(t));
    }

    /* ---------- albums: the folders that have pictures in them ---------- */
    function albums() {
        const byFolder = new Map();
        for (const f of media) {
            if (!byFolder.has(f.folder)) byFolder.set(f.folder, []);
            byFolder.get(f.folder).push(f);
        }
        const list = [...byFolder.entries()].map(([id, list]) => ({ id, name: id ? (items.find(x => x.id === id) || {}).name || 'Folder' : 'My files', list })).sort((a, b) => when(b.list[0]) - when(a.list[0]));
        body.innerHTML = list.length
            ? `<div class="ph-albums">${list.map(a => {
                  const cover = a.list.find(f => f.thumb);
                  return `<button class="ph-album" data-album="${esc(a.id)}"><span class="ph-cover">${cover ? `<img loading="lazy" alt="" src="${thumbUrl(cover)}">` : ic('image')}</span><b>${esc(a.name)}</b><small>${a.list.length}</small></button>`;
              }).join('')}</div><p class="ad-muted ph-hint">Albums are your folders in Files. Make a folder there and move photos into it.</p>`
            : `<div class="ea-empty big">${ic('folder')}<p>No albums yet.</p></div>`;
    }

    function draw() {
        $$('.ph-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        if (tab === 'albums' && !album) albums();
        else library();
    }

    /* ---------- the viewer ---------- */
    function view(list, i) {
        const back = document.createElement('div');
        back.className = 'ph-viewer';
        back.setAttribute('role', 'dialog');
        back.setAttribute('aria-modal', 'true');
        document.body.append(back);
        document.body.classList.add('sheet-open');
        const show = () => {
            const f = list[i];
            const d = new Date(when(f));
            back.innerHTML = `<div class="ph-v-bar">
                    <button class="icon-btn" data-close aria-label="Close">${ic('x')}</button>
                    <span class="ph-v-title"><b>${esc(d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b><small>${esc(d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))} · ${esc(f.name)} · ${size(f.size)}</small></span>
                    <a class="icon-btn" href="/api/files/${encodeURIComponent(f.id)}/content" aria-label="Download" title="Download">${ic('download')}</a>
                    <button class="icon-btn" data-share aria-label="Share" title="Share link">${ic('link')}</button>
                    <button class="icon-btn" data-del aria-label="Delete" title="Delete">${ic('trash')}</button>
                </div>
                <div class="ph-v-stage">${isVideo(f) ? `<video controls autoplay playsinline src="${contentUrl(f)}"${f.thumb ? ` poster="${thumbUrl(f)}"` : ''}></video>` : `<img alt="${esc(f.name)}" src="${f.thumb ? thumbUrl(f) : ''}" data-full="${contentUrl(f)}">`}</div>
                ${i > 0 ? `<button class="ph-v-nav prev" data-prev aria-label="Previous">${ic('left')}</button>` : ''}
                ${i < list.length - 1 ? `<button class="ph-v-nav next" data-next aria-label="Next">${ic('right')}</button>` : ''}`;
            // the small preview first, then the full picture once it's loaded
            const img = $('img[data-full]', back);
            if (img) {
                const full = new Image();
                full.onload = () => img.isConnected && (img.src = full.src);
                full.onerror = () => img.isConnected && !img.src && back.querySelector('.ph-v-stage').insertAdjacentHTML('beforeend', '<p class="ph-v-cant">This browser can’t show this kind of picture. Download it to look at it.</p>');
                full.src = img.dataset.full;
            }
        };
        const close = () => {
            removeEventListener('keydown', onKey);
            document.body.classList.remove('sheet-open');
            back.classList.add('out');
            setTimeout(() => back.remove(), 220);
        };
        const go = d => {
            if (i + d < 0 || i + d >= list.length) return;
            i += d;
            show();
        };
        const onKey = e => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
        };
        addEventListener('keydown', onKey);
        back.addEventListener('click', async e => {
            if (e.target.closest('[data-close]') || e.target === back || e.target.classList.contains('ph-v-stage')) return close();
            if (e.target.closest('[data-prev]')) return go(-1);
            if (e.target.closest('[data-next]')) return go(1);
            const f = list[i];
            if (e.target.closest('[data-share]')) {
                try {
                    const r = await call(`/api/files/${f.id}/share`, { method: 'POST', body: { on: true } });
                    if (navigator.share && phone()) await navigator.share({ title: f.name, url: r.url }).catch(() => {});
                    else {
                        await navigator.clipboard.writeText(r.url).catch(() => {});
                        toast('Link copied: anyone with it can see this one');
                    }
                } catch (err) {
                    toast(err.message, { bad: true });
                }
            }
            if (e.target.closest('[data-del]')) {
                if (!(await ask({ title: `Delete this ${isVideo(f) ? 'video' : 'photo'}?`, text: 'It’s removed from Files too. This can’t be undone.', ok: 'Delete', danger: true }))) return;
                try {
                    await call(`/api/files/${f.id}`, { method: 'DELETE' });
                    items = items.filter(x => x.id !== f.id);
                    media = media.filter(x => x.id !== f.id);
                    list.splice(i, 1);
                    draw();
                    if (!list.length) return close();
                    i = Math.min(i, list.length - 1);
                    show();
                } catch (err) {
                    toast(err.message, { bad: true });
                }
            }
        });
        // swipe on a phone
        let sx = null;
        back.addEventListener('touchstart', e => (sx = e.touches[0].clientX), { passive: true });
        back.addEventListener('touchend', e => {
            if (sx == null) return;
            const dx = e.changedTouches[0].clientX - sx;
            sx = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        });
        show();
    }

    /* ---------- adding photos ---------- */
    async function photosFolder() {
        let f = items.find(x => x.kind === 'folder' && !x.folder && x.name === 'Photos');
        if (!f) {
            f = await call('/api/files/folders', { method: 'POST', body: { name: 'Photos', folder: '' } });
            items.push(f);
        }
        return f.id;
    }
    let total = 0;
    let done = 0;
    let bytes = 0;
    let sent = 0;
    const status = $('#status');
    function showStatus() {
        status.hidden = done >= total;
        status.innerHTML = `<span class="spinner sm"></span><span>Adding ${done + 1 > total ? total : done + 1} of ${total}</span><span class="fl-up-bar"><i style="width:${bytes ? Math.round((sent / bytes) * 100) : 0}%"></i></span>`;
    }
    async function add(files) {
        files = [...files].filter(f => /^(image|video)\//.test(f.type) || /\.(heic|heif|jpe?g|png|gif|webp|mov|mp4|m4v)$/i.test(f.name));
        if (!files.length) return toast('Only photos and videos can go here', { bad: true });
        const folder = album || (await photosFolder());
        total += files.length;
        files.forEach(f => (bytes += f.size));
        showStatus();
        // two at a time
        let next = 0;
        const worker = async () => {
            while (next < files.length) {
                const file = files[next++];
                let last = 0;
                try {
                    const f = await window.EG.upload(file, {
                        folder,
                        onProgress: p => {
                            sent += p * file.size - last;
                            last = p * file.size;
                            showStatus();
                        }
                    });
                    sent += file.size - last;
                    items.push(f);
                    if (isMedia(f)) {
                        media.push(f);
                        media.sort((a, b) => when(b) - when(a));
                        window.EG.thumbFor(f, file).then(() => draw());
                    }
                } catch (err) {
                    toast(`${file.name}: ${err.message}`, { bad: true });
                }
                done++;
                showStatus();
            }
        };
        await Promise.all([worker(), worker()]);
        if (done >= total) {
            toast(`Added ${total} ${total === 1 ? 'item' : 'items'}`);
            total = done = bytes = sent = 0;
            showStatus();
        }
        draw();
    }
    $('#pick').addEventListener('change', e => {
        add(e.target.files);
        e.target.value = '';
    });
    const drop = $('#drop');
    let depth = 0;
    drop.addEventListener('dragenter', e => [...e.dataTransfer.types].includes('Files') && (depth++, drop.classList.add('dragging')));
    drop.addEventListener('dragleave', () => (depth = Math.max(0, depth - 1)) || drop.classList.remove('dragging'));
    drop.addEventListener('dragover', e => [...e.dataTransfer.types].includes('Files') && e.preventDefault());
    drop.addEventListener('drop', e => {
        e.preventDefault();
        depth = 0;
        drop.classList.remove('dragging');
        if (e.dataTransfer.files.length) add(e.dataTransfer.files);
    });

    $('.ph-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        tab = b.dataset.tab;
        album = null;
        draw();
    });
    body.addEventListener('click', e => {
        const t = e.target.closest('.ph-tile');
        if (t) {
            const list = album ? media.filter(f => f.folder === album) : media;
            return view(list, list.findIndex(f => f.id === t.dataset.id));
        }
        const a = e.target.closest('[data-album]');
        if (a) {
            album = a.dataset.album;
            return draw();
        }
        if (e.target.closest('[data-back]')) {
            album = null;
            tab = 'albums';
            draw();
        }
    });

    call('/api/files')
        .then(r => {
            items = r.items.filter(f => !/^\.(_|DS_Store$)/.test(f.name));
            media = items.filter(isMedia).sort((a, b) => when(b) - when(a));
            draw();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your photos</h1><p>${esc(e.message)}</p></div>`));
})();
