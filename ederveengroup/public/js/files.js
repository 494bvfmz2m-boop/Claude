// Files: documents, photos and anything else, in folders, with share links.
(function () {
    const { $, $$, esc, ic, call, toast, ask, phone, ago } = window.EG;
    const root = $('#files');
    let items = [];
    let used = 0;
    let quota = 0;
    let maxFile = 0;
    let disk = null;
    let folder = '';
    let q = '';
    let layout = read('files-layout') || (phone() ? 'list' : 'grid');

    function read(k) {
        try {
            return localStorage.getItem(k);
        } catch {
            return null;
        }
    }
    function write(k, v) {
        try {
            localStorage.setItem(k, v);
        } catch {
            // private mode: fine
        }
    }
    const size = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB` : `${(n / 1073741824).toFixed(1)} GB`);
    const ext = name => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
    const isImage = f => /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(f.type);
    // a coloured badge per kind of file
    function kindOf(f) {
        if (f.kind === 'folder') return ['folder', 'Folder'];
        const e = ext(f.name);
        if (isImage(f) || /^(heic|svg|tiff?)$/.test(e)) return ['image', 'Image'];
        if (f.type === 'application/pdf' || e === 'pdf') return ['pdf', 'PDF'];
        if (/^(docx?|odt|rtf|pages|txt|md)$/.test(e)) return ['doc', 'Document'];
        if (/^(xlsx?|ods|csv|numbers)$/.test(e)) return ['sheet', 'Spreadsheet'];
        if (/^(pptx?|odp|key)$/.test(e)) return ['slides', 'Presentation'];
        if (/^audio\//.test(f.type) || /^(mp3|m4a|wav|flac|ogg)$/.test(e)) return ['audio', 'Audio'];
        if (/^video\//.test(f.type) || /^(mp4|mov|webm|mkv|avi)$/.test(e)) return ['video', 'Video'];
        if (/^(zip|rar|7z|gz|tar)$/.test(e)) return ['zip', 'Archive'];
        return ['file', e ? e.toUpperCase() : 'File'];
    }
    const GLYPH = { folder: 'folder', image: 'image', pdf: 'file', doc: 'file', sheet: 'grid', slides: 'laptop', audio: 'bell', video: 'eye', zip: 'archive', file: 'file' };
    const thumb = f => {
        const [k, label] = kindOf(f);
        if (f.thumb) return `<span class="fl-thumb img"><img loading="lazy" alt="" src="/api/files/${encodeURIComponent(f.id)}/thumb"></span>`;
        if (isImage(f) && f.size < 8 * 1048576) return `<span class="fl-thumb img"><img loading="lazy" alt="" src="/api/files/${encodeURIComponent(f.id)}/content?inline=1&v=${f.updatedAt}"></span>`;
        return `<span class="fl-thumb" data-k="${k}">${ic(GLYPH[k])}${k === 'folder' ? '' : `<em>${esc((ext(f.name) || label).toUpperCase().slice(0, 4))}</em>`}</span>`;
    };
    const pathTo = id => {
        const out = [];
        for (let p = id; p; p = (items.find(x => x.id === p) || {}).folder) {
            const f = items.find(x => x.id === p);
            if (!f) break;
            out.unshift(f);
        }
        return out;
    };

    root.innerHTML = `<div class="fl" id="drop">
        <div class="ea-head fl-head">
            <h1>Files</h1>
            <div class="fl-tools">
                <div class="ad-search fl-search">${ic('search')}<input class="input" id="q" placeholder="Search all files" aria-label="Search files"></div>
                <div class="seg fl-layout" role="group" aria-label="View"><button data-l="grid" aria-label="Grid">${ic('grid')}</button><button data-l="list" aria-label="List">${ic('list')}</button></div>
                <button class="btn" id="newfolder">${ic('folder')}<span>New folder</span></button>
                <label class="btn btn-primary fl-upload">${ic('plus')}<span>Upload</span><input type="file" id="pick" multiple hidden></label>
            </div>
        </div>
        <nav class="fl-crumbs" id="crumbs" aria-label="Folder"></nav>
        <div id="uploads" class="fl-uploads"></div>
        <div id="list"></div>
        <div class="fl-meter" id="meter"></div>
        <div class="fl-drop-hint" aria-hidden="true">${ic('download')}<b>Drop to upload</b></div>
    </div>`;
    const list = $('#list');

    function draw() {
        $$('.fl-layout button').forEach(b => b.classList.toggle('on', b.dataset.l === layout));
        const trail = pathTo(folder);
        $('#crumbs').innerHTML = q
            ? `<span>Search results for “${esc(q)}”</span>`
            : [`<button data-go="">${ic('folder')}<span>My files</span></button>`, ...trail.map(f => `<button data-go="${esc(f.id)}">${esc(f.name)}</button>`)].join(`<i>${ic('right')}</i>`);
        const here = (q ? items.filter(f => f.name.toLowerCase().includes(q)) : items.filter(f => f.folder === folder)).sort(
            (a, b) => (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        const count = f => items.filter(x => x.folder === f.id).length;
        const meta = f => (f.kind === 'folder' ? `${count(f)} item${count(f) === 1 ? '' : 's'}` : `${size(f.size)} · ${ago(f.updatedAt)}`);
        list.className = layout === 'grid' ? 'fl-grid' : 'fl-list';
        list.innerHTML = here.length
            ? here
                  .map((f, i) => `<div class="fl-item" data-id="${esc(f.id)}" style="animation-delay:${Math.min(i, 16) * 18}ms" draggable="${phone() ? 'false' : 'true'}">
                    <button class="fl-open" data-open aria-label="Open ${esc(f.name)}">${thumb(f)}<span class="fl-name"><b>${esc(f.name)}</b><small>${esc(meta(f))}${f.shared ? ` · <span class="fl-shared">${ic('link')}Shared</span>` : ''}</small></span></button>
                    <button class="icon-btn fl-menu" data-menu aria-label="More for ${esc(f.name)}">${ic('more')}</button>
                </div>`)
                  .join('')
            : `<div class="ea-empty big">${ic(q ? 'search' : 'folder')}<p>${q ? 'No files match that.' : folder ? 'This folder is empty. Drop files here, or use Upload.' : 'No files yet. Drop files anywhere on this page, or use Upload.'}</p></div>`;
        const room = quota || (disk ? used + disk.free : 0);
        const pct = room ? Math.min(100, (used / room) * 100) : 0;
        $('#meter').innerHTML = `<div class="fl-bar"><i style="width:${pct.toFixed(1)}%"></i></div><span>${size(used)} used${quota ? ` of ${size(quota)}` : disk ? ` · ${size(disk.free)} free on the server` : ''}${maxFile ? ` · files up to ${size(maxFile)}` : ''}</span>`;
    }

    async function load() {
        const r = await call('/api/files');
        ({ items, used, quota, maxFile, disk } = r);
        if (folder && !items.some(f => f.id === folder)) folder = '';
        draw();
    }

    /* ---------- uploads: several at once, each with its own progress ---------- */
    function upload(files) {
        const into = folder;
        for (const file of files) {
            const row = document.createElement('div');
            row.className = 'fl-up';
            row.innerHTML = `<span class="fl-up-name">${esc(file.name)}</span><span class="fl-up-bar"><i></i></span><span class="fl-up-pct">0%</span>`;
            $('#uploads').append(row);
            const fail = msg => {
                row.classList.add('bad');
                $('.fl-up-pct', row).textContent = msg;
                setTimeout(() => row.remove(), 8000);
            };
            if (maxFile && file.size > maxFile) {
                fail(`Too big (max ${size(maxFile)})`);
                continue;
            }
            window.EG.upload(file, {
                folder: into,
                onProgress: p => {
                    $('i', row).style.width = Math.round(p * 100) + '%';
                    $('.fl-up-pct', row).textContent = Math.round(p * 100) + '%';
                }
            })
                .then(f => {
                    items.push(f);
                    used += f.size;
                    row.classList.add('done');
                    $('.fl-up-pct', row).textContent = 'Done';
                    setTimeout(() => row.remove(), 1200);
                    draw();
                    $(`.fl-item[data-id="${f.id}"]`)?.classList.add('fresh');
                    if (window.EG.thumbFor) window.EG.thumbFor(f, file); // a preview for pictures and videos
                })
                .catch(err => fail(err.message || 'Didn’t upload'));
        }
    }
    $('#pick').addEventListener('change', e => {
        upload([...e.target.files]);
        e.target.value = '';
    });
    const drop = $('#drop');
    let depth = 0;
    drop.addEventListener('dragenter', e => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        depth++;
        drop.classList.add('dragging');
    });
    drop.addEventListener('dragleave', () => {
        depth = Math.max(0, depth - 1);
        if (!depth) drop.classList.remove('dragging');
    });
    drop.addEventListener('dragover', e => {
        if ([...e.dataTransfer.types].includes('Files') || [...e.dataTransfer.types].includes('text/eg-file')) e.preventDefault();
    });
    drop.addEventListener('drop', async e => {
        e.preventDefault();
        depth = 0;
        drop.classList.remove('dragging');
        // a file dragged onto a folder moves it there
        const moving = e.dataTransfer.getData('text/eg-file');
        const target = e.target.closest('.fl-item');
        if (moving) {
            const t = target && items.find(f => f.id === target.dataset.id);
            const crumb = e.target.closest('[data-go]');
            const to = t && t.kind === 'folder' ? t.id : crumb ? crumb.dataset.go : null;
            if (to !== null && to !== moving) await move(items.find(f => f.id === moving), to);
            return;
        }
        if (e.dataTransfer.files.length) upload([...e.dataTransfer.files]);
    });
    list.addEventListener('dragstart', e => {
        const it = e.target.closest('.fl-item');
        if (it) e.dataTransfer.setData('text/eg-file', it.dataset.id);
    });
    $('#crumbs').addEventListener('dragover', e => [...e.dataTransfer.types].includes('text/eg-file') && e.preventDefault());

    /* ---------- actions ---------- */
    async function rename(f) {
        const name = await prompt(`Rename ${f.kind === 'folder' ? 'folder' : 'file'}`, f.name, 'Rename');
        if (!name || name === f.name) return;
        try {
            Object.assign(f, await call(`/api/files/${f.id}`, { method: 'PATCH', body: { name } }));
            draw();
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    async function move(f, to) {
        try {
            Object.assign(f, await call(`/api/files/${f.id}`, { method: 'PATCH', body: { folder: to } }));
            draw();
            const dest = to ? items.find(x => x.id === to).name : 'My files';
            toast(`Moved to ${dest}`);
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    async function remove(f) {
        const inside = items.filter(x => x.folder === f.id).length;
        if (!(await ask({ title: `Delete ${f.name}?`, text: f.kind === 'folder' ? (inside ? 'The folder and everything in it will be deleted. This can’t be undone.' : 'This empty folder will be deleted.') : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
        try {
            await call(`/api/files/${f.id}`, { method: 'DELETE' });
            await load();
            toast('Deleted');
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    async function share(f) {
        try {
            const r = await call(`/api/files/${f.id}/share`, { method: 'POST', body: { on: true } });
            f.shared = true;
            draw();
            dialog(`<h2>Share “${esc(f.name)}”</h2><p>Anyone with this link can download the file, without signing in.</p>
                <div class="si-copy"><code>${esc(r.url)}</code><button class="btn" data-copy>${ic('copy')}<span>Copy</span></button></div>`,
                [['Stop sharing', 'btn btn-danger', async close => {
                    await call(`/api/files/${f.id}/share`, { method: 'POST', body: { on: false } });
                    f.shared = false;
                    draw();
                    close();
                    toast('The link doesn’t work any more');
                }], ['Done', 'btn btn-primary', close => close()]]);
            if (navigator.share && phone()) navigator.share({ title: f.name, url: r.url }).catch(() => {});
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    function chooseFolder(f) {
        const folders = items.filter(x => x.kind === 'folder' && x.id !== f.id && !pathTo(x.id).some(p => p.id === f.id));
        const label = x => pathTo(x.id).map(p => p.name).join(' / ');
        dialog(`<h2>Move “${esc(f.name)}” to…</h2><div class="fl-pick">${[`<button data-to="">${ic('folder')}<span>My files</span></button>`, ...folders.sort((a, b) => label(a).localeCompare(label(b))).map(x => `<button data-to="${esc(x.id)}">${ic('folder')}<span>${esc(label(x))}</span></button>`)].join('')}</div>`, [['Cancel', 'btn', close => close()]], (back, close) => {
            $$('[data-to]', back).forEach(b => (b.disabled = b.dataset.to === f.folder));
            back.addEventListener('click', async e => {
                const b = e.target.closest('[data-to]');
                if (!b) return;
                close();
                await move(f, b.dataset.to);
            });
        });
    }
    function preview(f) {
        const url = `/api/files/${encodeURIComponent(f.id)}/content`;
        const [k] = kindOf(f);
        const media = isImage(f)
            ? `<img alt="${esc(f.name)}" src="${url}?inline=1">`
            : /^audio\//.test(f.type)
              ? `<audio controls src="${url}?inline=1"></audio>`
              : /^video\/(mp4|webm|ogg|quicktime)$/.test(f.type)
                ? `<video controls playsinline src="${url}?inline=1"></video>`
                : `<span class="fl-thumb big" data-k="${k}">${ic(GLYPH[k])}</span>`;
        dialog(`<div class="fl-preview">${media}</div><h2 class="fl-pv-name">${esc(f.name)}</h2><p class="ad-muted">${esc(kindOf(f)[1])} · ${size(f.size)} · changed ${esc(ago(f.updatedAt))}</p>`,
            [
                ...(f.type === 'application/pdf' || f.type === 'text/plain' ? [['Open', 'btn', close => (window.open(`${url}?inline=1`, '_blank', 'noopener'), close())]] : []),
                ['Share', 'btn', close => (close(), share(f))],
                ['Download', 'btn btn-primary', close => ((location.href = url), close())]
            ], null, 'fl-dialog');
    }
    // a small dialog: html, then [label, class, onClick(close)] buttons
    function dialog(html, buttons, setup, cls = '') {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ad-ask ${cls}" role="dialog" aria-modal="true">${html}<div class="pf-crop-acts">${buttons.map(([l, c], i) => `<button class="${c}" data-x${i}>${esc(l)}</button>`).join('')}</div></div>`;
        document.body.append(back);
        const onKey = e => e.key === 'Escape' && close();
        const close = () => {
            removeEventListener('keydown', onKey);
            back.classList.add('out');
            setTimeout(() => back.remove(), 250);
        };
        buttons.forEach(([, , fn], i) => ($(`[data-x${i}]`, back).onclick = () => fn(close)));
        back.addEventListener('click', e => e.target === back && close());
        addEventListener('keydown', onKey);
        $('[data-copy]', back)?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText($('code', back).textContent);
                toast('Link copied');
            } catch {
                toast('Select the link and copy it', { bad: true });
            }
        });
        if (setup) setup(back, close);
        ($('[data-copy]', back) || $('.btn-primary', back) || $('button', back))?.focus();
        return close;
    }
    function prompt(title, value, ok) {
        return new Promise(resolve => {
            let done = false;
            const close = dialog(`<h2>${esc(title)}</h2><input class="input" id="pv" maxlength="180" value="${esc(value)}">`, [
                ['Cancel', 'btn', c => (c(), resolve(null))],
                [ok, 'btn btn-primary', c => ((done = true), c(), resolve($('#pv').value.trim()))]
            ], back => {
                const input = $('#pv', back);
                setTimeout(() => {
                    input.focus();
                    const dot = input.value.lastIndexOf('.');
                    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
                }, 30);
                input.addEventListener('keydown', e => e.key === 'Enter' && !done && $('.btn-primary', back).click());
            });
            return close;
        });
    }
    function menu(f, anchor) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        const acts = [
            ...(f.kind === 'file' ? [['download', 'Download'], ['share', f.shared ? 'Share link' : 'Get a share link']] : [['open', 'Open']]),
            ['rename', 'Rename'],
            ['move', 'Move to…'],
            ['delete', 'Delete']
        ];
        pop.innerHTML = acts.map(([a, l]) => `<button data-a="${a}" class="${a === 'delete' ? 'danger' : ''}">${ic({ download: 'download', share: 'link', open: 'folder', rename: 'pen', move: 'folder', delete: 'trash' }[a])}<span>${l}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
        const off = e => {
            if (pop.contains(e.target)) return;
            pop.remove();
            removeEventListener('pointerdown', off, true);
        };
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-a]');
            if (!b) return;
            pop.remove();
            removeEventListener('pointerdown', off, true);
            ({
                download: () => (location.href = `/api/files/${encodeURIComponent(f.id)}/content`),
                share: () => share(f),
                open: () => openItem(f),
                rename: () => rename(f),
                move: () => chooseFolder(f),
                delete: () => remove(f)
            })[b.dataset.a]();
        });
        $('button', pop).focus();
    }
    function openItem(f) {
        if (f.kind === 'folder') {
            folder = f.id;
            q = '';
            $('#q').value = '';
            draw();
            history.pushState({ folder }, '', `#${f.id}`);
        } else preview(f);
    }

    list.addEventListener('click', e => {
        const it = e.target.closest('.fl-item');
        if (!it) return;
        const f = items.find(x => x.id === it.dataset.id);
        if (e.target.closest('[data-menu]')) return menu(f, e.target.closest('[data-menu]'));
        if (e.target.closest('[data-open]')) openItem(f);
    });
    list.addEventListener('contextmenu', e => {
        const it = e.target.closest('.fl-item');
        if (!it) return;
        e.preventDefault();
        menu(items.find(x => x.id === it.dataset.id), it.querySelector('[data-menu]'));
    });
    $('#crumbs').addEventListener('click', e => {
        const b = e.target.closest('[data-go]');
        if (!b) return;
        folder = b.dataset.go;
        draw();
        history.pushState({ folder }, '', folder ? `#${folder}` : location.pathname);
    });
    addEventListener('popstate', () => {
        folder = location.hash.slice(1);
        draw();
    });
    $('#newfolder').onclick = async () => {
        const name = await prompt('New folder', 'New folder', 'Create');
        if (!name) return;
        try {
            const f = await call('/api/files/folders', { method: 'POST', body: { name, folder } });
            items.push(f);
            draw();
            $(`.fl-item[data-id="${f.id}"]`)?.classList.add('fresh');
        } catch (e) {
            toast(e.message, { bad: true });
        }
    };
    $('.fl-layout').addEventListener('click', e => {
        const b = e.target.closest('[data-l]');
        if (!b) return;
        layout = b.dataset.l;
        write('files-layout', layout);
        draw();
    });
    let t;
    $('#q').addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
            q = e.target.value.trim().toLowerCase();
            draw();
        }, 120);
    });

    folder = location.hash.slice(1);
    load().catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your files</h1><p>${esc(e.message)}</p></div>`));
})();
