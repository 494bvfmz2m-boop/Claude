// EderveenGroup client: composer
import { addFlag, patchLocal } from './actions.js';
import { askConfirm, askText, restoreSelection, saveSelection } from './dialogs.js';
import { loadFolders } from './folders.js';
import { loadMessages, renderList } from './list.js';
import { saveSettings } from './look.js';
import { showMenu } from './menus.js';
import { openSettings } from './settings.js';
import { isDrafts, isSentLike, specialPath, state } from './state.js';
import { $, $$, api, avatar, calm, catchIn, debounce, esc, fmtAddr, fmtAddrList, fmtDate, fmtSize, h, morphFrom, morphTo, qs, recentPress, toast, visibleRect } from './util.js';

let composer = null;

const SIG_NONE = '';
function signatureHtml(id) {
    const s = state.settings.signatures.find(x => x.id === id);
    return s ? s.html : '';
}

function cleanQuoted(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    $$('style,script,link,meta,title', doc).forEach(n => n.remove());
    if (!state.settings.loadRemoteImages) $$('img', doc).forEach(img => /^https?:/i.test(img.getAttribute('src') || '') && img.remove());
    return doc.body.innerHTML;
}
function quotedBody(m) {
    return m.html ? cleanQuoted(m.html) : esc(m.text).replace(/\n/g, '<br>');
}

// opts.mount: render inline inside that element (replying from a conversation) instead of floating
function openComposer(mode, m, preset = {}, { mount = null, onClose = null, onSent = null } = {}) {
    // only one composer at a time: park the current one in Drafts
    if (composer && !composer.sending) composer.close({ save: true });
    const me = state.me.email.toLowerCase();
    const notMe = list => list.filter(p => p.address.toLowerCase() !== me);
    const uniq = list => {
        const seen = new Set();
        return list.filter(p => {
            const k = p.address.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };

    let to = preset.to || [];
    let cc = [];
    let bcc = [];
    let subject = preset.subject || '';
    let quote = '';
    let meta = {};
    let sigId = state.settings.defaultSignature || SIG_NONE;

    if (m && (mode === 'reply' || mode === 'replyAll')) {
        const fromMe = (m.from[0] || {}).address?.toLowerCase() === me;
        const primary = fromMe ? m.to : m.replyTo.length ? m.replyTo : m.from;
        to = mode === 'replyAll' ? uniq(notMe([...primary, ...(fromMe ? [] : m.to)])) : primary;
        if (mode === 'replyAll') cc = uniq(notMe(m.cc)).filter(p => !to.some(t => t.address.toLowerCase() === p.address.toLowerCase()));
        subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
        quote = `<br><div class="pm-quote">On ${esc(fmtDate(m.date, true))}, ${esc(fmtAddr(m.from[0] || { address: '' }))} wrote:<blockquote>${quotedBody(m)}</blockquote></div>`;
        meta = { inReplyTo: m.messageId, references: [...m.references, m.messageId].filter(Boolean).join(' '), answeredUid: m.uid, answeredFolder: m.folder };
        sigId = state.settings.replySignature || state.settings.defaultSignature || SIG_NONE;
    } else if (m && mode === 'forward') {
        subject = /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`;
        quote = `<br><div class="pm-quote">---------- Forwarded message ---------<br>From: ${esc(fmtAddrList(m.from))}<br>Date: ${esc(fmtDate(m.date, true))}<br>Subject: ${esc(m.subject)}<br>To: ${esc(fmtAddrList(m.to))}${m.cc.length ? `<br>Cc: ${esc(fmtAddrList(m.cc))}` : ''}<br><br>${quotedBody(m)}</div>`;
        meta = m.attachments.length ? { forwardFolder: m.folder, forwardUid: m.uid } : {};
        sigId = state.settings.replySignature || state.settings.defaultSignature || SIG_NONE;
    } else if (m && mode === 'draft') {
        to = m.to;
        cc = m.cc;
        bcc = m.bcc;
        subject = m.subject;
        meta = { draftUid: m.uid, ...(m.attachments.length ? { forwardFolder: m.folder, forwardUid: m.uid } : {}) };
    }

    let body;
    if (mode === 'draft') body = m.html ? cleanQuoted(m.html) : esc(m.text).replace(/\n/g, '<br>');
    else {
        const sig = signatureHtml(sigId);
        body = `<div><br></div>${sig ? `<br><div class="pm-signature">${sig}</div>` : ''}${quote}`;
    }

    const title = { reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }[mode] || 'New message';
    const el = h(`<div class="composer">
        <div class="composer-head"><b>${esc(subject || title)}</b><span class="status"></span>
            <button class="icon-btn" data-c="min" title="Minimize">${icon('minimize')}</button>
            <button class="icon-btn" data-c="max" title="Full screen">${icon('maximize')}</button>
            <button class="icon-btn" data-c="close" title="Close (saves draft)">${icon('x')}</button></div>
        <div class="c-field" data-field="to"><label>To</label><div class="recips"></div><div class="toggles"><button data-c="show-cc">Cc</button><button data-c="show-bcc">Bcc</button></div></div>
        <div class="c-field hidden" data-field="cc"><label>Cc</label><div class="recips"></div></div>
        <div class="c-field hidden" data-field="bcc"><label>Bcc</label><div class="recips"></div></div>
        <div class="c-field"><label>Subject</label><input class="plain" data-c="subject" value="${esc(subject)}" placeholder="What’s this about?"></div>
        <div class="toolbar">
            <button class="icon-btn" data-cmd="bold" title="Bold (Ctrl B)">${icon('bold')}</button>
            <button class="icon-btn" data-cmd="italic" title="Italic (Ctrl I)">${icon('italic')}</button>
            <button class="icon-btn" data-cmd="underline" title="Underline (Ctrl U)">${icon('underline')}</button>
            <button class="icon-btn" data-cmd="strikeThrough" title="Strikethrough">${icon('strike')}</button>
            <span class="sep"></span>
            <select data-c="size" title="Text size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="5">Large</option><option value="6">Huge</option></select>
            <label class="icon-btn" title="Text color" style="cursor:pointer">${icon('palette')}<input type="color" data-c="color" style="position:absolute;opacity:0;width:0;height:0"></label>
            <span class="sep"></span>
            <button class="icon-btn" data-cmd="insertUnorderedList" title="Bulleted list">${icon('list')}</button>
            <button class="icon-btn" data-cmd="insertOrderedList" title="Numbered list">${icon('listOl')}</button>
            <button class="icon-btn" data-cmd="quote" title="Quote">${icon('quote')}</button>
            <button class="icon-btn" data-cmd="link" title="Link (Ctrl K)">${icon('link')}</button>
            <label class="icon-btn" title="Insert image" style="cursor:pointer">${icon('image')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple data-c="images" hidden></label>
            <button class="icon-btn" data-cmd="removeFormat" title="Clear formatting">${icon('eraser')}</button>
        </div>
        <div class="editor" contenteditable="true" data-placeholder="Write your message…">${body}</div>
        <div class="c-attachments"></div>
        <div class="composer-foot">
            <div class="send-split"><button class="btn btn-primary send-btn" data-c="send" title="Send (Ctrl Enter)">${icon('send')} Send</button>${onSent && m && mode !== 'draft' ? `<button class="btn btn-primary send-more" data-c="send-more" title="More send options" aria-label="More send options">${icon('down')}</button>` : ''}</div>
            <label class="icon-btn" title="Attach files" style="cursor:pointer">${icon('clip')}<input type="file" multiple data-c="files" hidden></label>
            <button class="icon-btn" data-c="templates" title="Templates">${icon('file')}</button>
            <select data-c="sig" title="Signature"><option value="">No signature</option>${state.settings.signatures.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
            <span class="spacer"></span>
            <button class="icon-btn" data-c="discard" title="Discard">${icon('trash')}</button>
        </div></div>`);
    if (mount) {
        el.classList.add('inline');
        mount.append(el);
        requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }));
    } else {
        document.body.append(el);
        morphFrom(el, recentPress() || visibleRect($('#compose-btn')) || visibleRect($('#fab')));
    }

    const editor = $('.editor', el);
    const files = [];
    const c = {
        el,
        mode,
        dirty: false,
        meta,
        fields: {},
    };
    composer = c;
    $('[data-c=sig]', el).value = state.settings.signatures.some(s => s.id === sigId) ? sigId : '';

    // recipients
    ['to', 'cc', 'bcc'].forEach(name => (c.fields[name] = recipientField($(`[data-field=${name}] .recips`, el), () => (c.dirty = true))));
    c.fields.to.set(to);
    c.fields.cc.set(cc);
    c.fields.bcc.set(bcc);
    if (cc.length) $('[data-field=cc]', el).classList.remove('hidden');
    if (bcc.length) $('[data-field=bcc]', el).classList.remove('hidden');

    const renderFiles = () => {
        const orig = meta.forwardUid && m ? m.attachments : [];
        $('.c-attachments', el).innerHTML =
            orig.map(a => `<span class="c-att" title="Included from original">${icon('clip')}${esc(a.filename)} <small style="color:var(--text-3)">${fmtSize(a.size)}</small></span>`).join('') +
            files.map((f, i) => `<span class="c-att">${icon('clip')}${esc(f.name)} <small style="color:var(--text-3)">${fmtSize(f.size)}</small><button class="icon-btn" style="width:22px;height:22px" data-rm="${i}">${icon('x')}</button></span>`).join('');
    };
    const addFiles = list => {
        for (const f of list) {
            if (f.size > 25 * 1024 * 1024) toast(`${f.name} is over 25 MB`, { error: true });
            else files.push(f);
        }
        c.dirty = true;
        renderFiles();
    };
    renderFiles();
    $('.c-attachments', el).addEventListener('click', e => {
        const b = e.target.closest('[data-rm]');
        if (b) {
            files.splice(Number(b.dataset.rm), 1);
            renderFiles();
        }
    });
    $('[data-c=files]', el).addEventListener('change', e => {
        addFiles(e.target.files);
        e.target.value = '';
    });

    // inline images: shown from blob: URLs while editing, sent as cid: parts of the email
    const inlineImages = new Map();
    const addInline = file => {
        const cid = `img${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@eg`;
        const url = URL.createObjectURL(file);
        inlineImages.set(cid, { file, url });
        return `<img src="${url}" data-cid="${cid}" alt="" style="max-width:100%">`;
    };
    async function insertImages(list, at) {
        const imgs = [...list].filter(f => /^image\/(png|jpeg|gif|webp)$/.test(f.type));
        if (!imgs.length) return false;
        const html = [];
        for (const f of imgs) {
            if (f.size > 15 * 1024 * 1024) {
                toast(`${f.name || 'That image'} is too large to place inline`, { error: true });
                continue;
            }
            html.push(addInline(await fitImage(f)));
        }
        if (!html.length) return true;
        editor.focus();
        if (at) {
            getSelection().removeAllRanges();
            getSelection().addRange(at);
        }
        document.execCommand('insertHTML', false, html.join('<br>'));
        $$('img[data-cid]', editor).forEach(img => img.complete || img.classList.add('arriving'));
        c.dirty = true;
        return true;
    }
    // quoted or drafted images arrive as data: URLs; turn them back into real inline parts
    for (const img of $$('img[src^="data:image/"]', editor)) {
        const file = dataUrlFile(img.getAttribute('src'));
        if (!file) continue;
        const tmp = h(addInline(file));
        img.src = tmp.src;
        img.dataset.cid = tmp.dataset.cid;
    }
    editor.addEventListener('load', e => e.target.tagName === 'IMG' && e.target.classList.remove('arriving'), true);
    editor.addEventListener('paste', e => {
        const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        insertImages(files);
    });
    $('[data-c=images]', el).addEventListener('change', e => {
        insertImages(e.target.files);
        e.target.value = '';
    });

    // click an image to resize or remove it
    const imgTools = h(`<div class="img-tools" hidden>${[['S', 25], ['M', 50], ['L', 75], ['Full', 100]].map(([l, w]) => `<button data-w="${w}" title="${w}% wide">${l}</button>`).join('')}<span class="sep"></span><button data-w="rm" title="Remove image">${icon('trash')}</button></div>`);
    el.append(imgTools);
    let picked = null;
    const unpick = () => {
        picked?.classList.remove('picked');
        picked = null;
        imgTools.hidden = true;
    };
    const placeTools = () => {
        if (!picked) return;
        const r = picked.getBoundingClientRect(), er = el.getBoundingClientRect(), ed = editor.getBoundingClientRect();
        if (r.bottom < ed.top || r.top > ed.bottom) return unpick();
        imgTools.style.left = `${Math.max(8, r.left - er.left)}px`;
        imgTools.style.top = `${Math.max(ed.top - er.top + 4, r.top - er.top + 8)}px`;
        const w = picked.style.width || '';
        $$('[data-w]', imgTools).forEach(b => b.classList.toggle('on', w === `${b.dataset.w}%`));
    };
    editor.addEventListener('click', e => {
        const img = e.target.closest('img');
        if (img === picked) return;
        unpick();
        if (!img) return;
        picked = img;
        img.classList.add('picked');
        imgTools.hidden = false;
        placeTools();
    });
    editor.addEventListener('scroll', placeTools, { passive: true });
    editor.addEventListener('keydown', e => {
        if (picked && (e.key === 'Backspace' || e.key === 'Delete')) {
            e.preventDefault();
            picked.remove();
            unpick();
            c.dirty = true;
        } else if (picked) unpick();
    });
    imgTools.addEventListener('mousedown', e => e.preventDefault());
    imgTools.addEventListener('click', e => {
        const b = e.target.closest('[data-w]');
        if (!b || !picked) return;
        if (b.dataset.w === 'rm') {
            picked.remove();
            unpick();
        } else {
            picked.style.width = `${b.dataset.w}%`;
            picked.style.height = 'auto';
            requestAnimationFrame(placeTools);
        }
        c.dirty = true;
    });

    // drag & drop files: images dropped on the text go inline, everything else is attached
    let dragDepth = 0;
    el.addEventListener('dragenter', e => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        if (dragDepth++ === 0) el.append(h(`<div class="drop-hint"><span>${icon('clip')} Drop to attach</span><small>Drop images on the text to place them inline</small></div>`));
    });
    el.addEventListener('dragleave', () => {
        if (--dragDepth <= 0) {
            dragDepth = 0;
            $('.drop-hint', el)?.remove();
        }
    });
    el.addEventListener('dragover', e => [...e.dataTransfer.types].includes('Files') && e.preventDefault());
    el.addEventListener('drop', e => {
        dragDepth = 0;
        $('.drop-hint', el)?.remove();
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        const list = [...e.dataTransfer.files];
        if (editor.contains(e.target) && list.every(f => f.type.startsWith('image/'))) {
            const at = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
            insertImages(list, at && editor.contains(at.startContainer) ? at : null);
        } else addFiles(list);
    });

    // formatting
    const exec = (cmd, val) => {
        editor.focus();
        document.execCommand(cmd, false, val);
        c.dirty = true;
    };
    $('.toolbar', el).addEventListener('mousedown', e => e.target.closest('[data-cmd]') && e.preventDefault());
    $('.toolbar', el).addEventListener('click', async e => {
        const b = e.target.closest('[data-cmd]');
        if (!b) return;
        const cmd = b.dataset.cmd;
        if (cmd === 'link') {
            const range = saveSelection();
            const url = await askText({ title: 'Add a link', message: 'Paste the address the selected text should open.', icon: 'link', confirm: 'Add link', input: { type: 'url', value: 'https://', placeholder: 'https://example.com' } });
            restoreSelection(editor, range);
            if (url) exec('createLink', /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);
        } else if (cmd === 'quote') exec('formatBlock', 'blockquote');
        else exec(cmd);
    });
    $('[data-c=size]', el).addEventListener('change', e => {
        if (e.target.value) exec('fontSize', e.target.value);
        e.target.value = '';
    });
    $('[data-c=color]', el).addEventListener('input', e => exec('foreColor', e.target.value));

    // signature swap
    $('[data-c=sig]', el).addEventListener('change', e => {
        const html = signatureHtml(e.target.value);
        let block = $('.pm-signature', editor);
        if (!html) {
            if (block) {
                if (block.previousElementSibling && block.previousElementSibling.tagName === 'BR') block.previousElementSibling.remove();
                block.remove();
            }
            return;
        }
        if (!block) {
            block = h('<div class="pm-signature"></div>');
            const q = $('.pm-quote', editor);
            if (q) q.before(document.createElement('br'), block);
            else editor.append(document.createElement('br'), block);
        }
        block.innerHTML = html;
        c.dirty = true;
    });

    const subjectInput = $('[data-c=subject]', el);
    subjectInput.addEventListener('input', () => {
        c.dirty = true;
        $('.composer-head b', el).textContent = subjectInput.value || title;
    });
    editor.addEventListener('input', () => (c.dirty = true));
    editor.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            e.stopPropagation();
            $('[data-cmd=link]', el).click();
        }
    });
    el.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            send({ archiveAfter: e.shiftKey && !!$('[data-c=send-more]', el) });
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveDraft(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            c.close({ save: true });
        }
        e.stopPropagation();
    });

    function formData() {
        const fd = new FormData();
        fd.append('to', c.fields.to.value());
        fd.append('cc', c.fields.cc.value());
        fd.append('bcc', c.fields.bcc.value());
        fd.append('subject', subjectInput.value);
        const body = editor.cloneNode(true);
        $$('.picked, .arriving', body).forEach(x => x.classList.remove('picked', 'arriving'));
        $$('[class=""]', body).forEach(x => x.removeAttribute('class'));
        for (const img of $$('img[data-cid]', body)) {
            const it = inlineImages.get(img.dataset.cid);
            if (!it) {
                img.remove();
                continue;
            }
            img.src = `cid:${img.dataset.cid}`;
            fd.append('inline', it.file, img.dataset.cid);
            img.removeAttribute('data-cid');
        }
        fd.append('html', body.innerHTML);
        Object.entries(c.meta).forEach(([k, v]) => v != null && fd.append(k, v));
        files.forEach(f => fd.append('attachments', f, f.name));
        return fd;
    }

    async function saveDraft(announce) {
        const status = $('.status', el);
        status.textContent = 'Saving…';
        try {
            const r = await api('api/drafts', { method: 'POST', form: formData() });
            c.meta.draftUid = r.uid || null;
            c.dirty = false;
            status.textContent = 'Draft saved';
            if (announce) toast('Draft saved');
            if (isDrafts()) loadMessages({ quiet: true });
            loadFolders();
            return true;
        } catch (e) {
            status.textContent = '';
            toast(`Couldn’t save draft: ${e.message}`, { error: true });
            return false;
        }
    }
    const autosave = debounce(() => composer === c && c.dirty && !c.sending && saveDraft(false), 20000);
    el.addEventListener('input', autosave);

    c.close = ({ save, discard } = {}) => {
        if (c.closing) return;
        c.closing = true;
        if (composer === c) composer = null;
        $('.composer-backdrop')?.remove();
        const keep = save && c.dirty && !c.sending;
        // shrink into Drafts when it's being saved, back into the compose button otherwise
        const drafts = $(`#folders .folder[data-path="${CSS.escape(specialPath('\\Drafts') || 'Drafts')}"]`);
        const target = discard || mount ? null : keep ? visibleRect(drafts) || visibleRect($('#compose-btn')) : visibleRect($('#compose-btn')) || visibleRect($('#fab'));
        morphTo(el, target).then(() => {
            el.remove();
            if (!keep) freeImages();
            if (keep && !mount) catchIn(drafts);
            if (onClose) onClose();
        });
        // detached nodes are still readable, so the draft can be saved after removal
        if (keep) saveDraft(false).then(ok => {
            freeImages();
            if (ok) toast('Saved to Drafts');
        });
    };
    const freeImages = () => inlineImages.forEach(it => URL.revokeObjectURL(it.url));

    async function send({ archiveAfter = false } = {}) {
        if (c.fields.to.pending()) c.fields.to.commit();
        if (c.fields.cc.pending()) c.fields.cc.commit();
        if (c.fields.bcc.pending()) c.fields.bcc.commit();
        const all = [...c.fields.to.list(), ...c.fields.cc.list(), ...c.fields.bcc.list()];
        if (!all.length) {
            toast('Add at least one recipient', { error: true });
            return c.fields.to.focus();
        }
        if (all.some(p => !validEmail(p.address))) return toast('One of the addresses looks off', { error: true });
        if (!subjectInput.value.trim() && !(await askConfirm({ title: 'Send without a subject?', message: 'A subject helps people find your email later.', icon: 'send', confirm: 'Send anyway', cancel: 'Add one' }))) return subjectInput.focus();
        const lower = (editor.innerText + subjectInput.value).toLowerCase();
        if (/\b(attached|attachment|enclosed)\b/.test(lower.split('wrote:')[0]) && !files.length && !c.meta.forwardUid && !(await askConfirm({ title: 'Forgot the attachment?', message: 'You mention an attachment, but nothing is attached yet.', icon: 'clip', confirm: 'Send anyway', cancel: 'Go back' }))) return;

        const fd = formData();
        c.sending = true;
        el.classList.add('fly-out');
        setTimeout(() => {
            if (c.sending) el.classList.add('hidden');
            el.classList.remove('fly-out');
        }, 520);
        $('.composer-backdrop')?.remove();
        const delay = (state.settings.undoSendSeconds || 0) * 1000;
        let cancelled = false;
        const go = async () => {
            if (cancelled) return;
            const t = toast('Sending…', { duration: 0 });
            try {
                await api('api/send', { method: 'POST', form: fd });
                t.close();
                toast('Message sent', { duration: 3000 });
                if (composer === c) composer = null;
                el.remove();
                freeImages();
                if (onSent) onSent({ archive: archiveAfter });
                if (onClose) onClose();
                loadFolders();
                if (isSentLike()) loadMessages({ quiet: true });
                if (c.meta.answeredUid) {
                    patchLocal([c.meta.answeredUid], x => addFlag(x, '\\Answered'));
                    renderList();
                }
            } catch (e) {
                t.close();
                c.sending = false;
                el.classList.remove('hidden');
                toast(`Not sent: ${e.message}`, { error: true, duration: 7000 });
            }
        };
        if (delay) {
            toast('Sending…', {
                action: 'Undo',
                duration: delay,
                onAction: () => {
                    cancelled = true;
                    c.sending = false;
                    el.classList.remove('hidden');
                    editor.focus();
                }
            });
            setTimeout(go, delay);
        } else go();
    }

    // put template html where you'd expect: replaces an empty body, else goes at the cursor
    function insertHtml(html) {
        const own = editor.cloneNode(true);
        $$('.pm-signature, .pm-quote', own).forEach(x => x.remove());
        if (!own.innerText.trim() && !$('img', own)) {
            const stop = $('.pm-signature, .pm-quote', editor);
            while (editor.firstChild && editor.firstChild !== stop && !(stop && editor.firstChild.nextSibling === stop && editor.firstChild.nodeName === 'BR')) editor.firstChild.remove();
            editor.insertAdjacentHTML('afterbegin', `<div>${html}</div><div><br></div>`);
            const range = document.createRange();
            range.selectNodeContents(editor.firstElementChild);
            range.collapse(false);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
            editor.focus();
        } else {
            editor.focus();
            document.execCommand('insertHTML', false, html);
        }
        c.dirty = true;
    }

    el.addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (!b) {
            if (e.target.closest('.composer-head') && el.classList.contains('minimized')) el.classList.remove('minimized');
            return;
        }
        switch (b.dataset.c) {
            case 'min':
                el.classList.toggle('minimized');
                el.classList.remove('maximized');
                $('.composer-backdrop')?.remove();
                break;
            case 'max':
                el.classList.toggle('maximized');
                el.classList.remove('minimized');
                if (el.classList.contains('maximized')) {
                    const back = h('<div class="composer-backdrop"></div>');
                    back.onclick = () => $('[data-c=max]', el).click();
                    el.before(back);
                } else $('.composer-backdrop')?.remove();
                break;
            case 'close':
                e.stopPropagation();
                c.close({ save: true });
                break;
            case 'discard':
                if (c.meta.draftUid) {
                    api('api/messages/delete', { method: 'POST', body: { folder: specialPath('\\Drafts') || 'Drafts', uids: [c.meta.draftUid] } }).then(() => {
                        loadFolders();
                        if (isDrafts()) loadMessages({ quiet: true });
                    });
                }
                c.dirty = false;
                c.close({ discard: true });
                toast('Draft discarded');
                break;
            case 'show-cc':
                $('[data-field=cc]', el).classList.remove('hidden');
                c.fields.cc.focus();
                break;
            case 'show-bcc':
                $('[data-field=bcc]', el).classList.remove('hidden');
                c.fields.bcc.focus();
                break;
            case 'send':
                send();
                break;
            case 'send-more': {
                e.stopPropagation();
                const r = b.getBoundingClientRect();
                showMenu(r.left, r.top - 60, [{ icon: 'archive', label: 'Send & archive', hint: 'Ctrl Shift Enter', run: () => send({ archiveAfter: true }) }]);
                break;
            }
            case 'templates': {
                e.stopPropagation();
                const r = b.getBoundingClientRect();
                templateMenu(r.left, r.top, { editor, subjectInput, insertHtml, markDirty: () => (c.dirty = true) });
                break;
            }
        }
    });

    if (mode === 'new' && !to.length) c.fields.to.focus();
    else {
        editor.focus();
        const range = document.createRange();
        range.setStart(editor, 0);
        range.collapse(true);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
    }
    return c;
}

const validEmail = a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);

// big photos are scaled down before sending so emails stay light (GIFs keep their animation)
async function fitImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
    let bmp;
    try {
        bmp = await createImageBitmap(file);
    } catch {
        return file;
    }
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
        bmp.close();
        return file;
    }
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * scale);
    cv.height = Math.round(bmp.height * scale);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();
    const type = file.type === 'image/png' && file.size < 3 * 1024 * 1024 ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(r => cv.toBlob(r, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + (type === 'image/png' ? '.png' : '.jpg'), { type });
}

function dataUrlFile(url) {
    const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
    if (!m || m[2].length > 8 * 1024 * 1024) return null;
    try {
        const bin = atob(m[2].replace(/\s/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], 'image.' + m[1].split('/')[1].replace('jpeg', 'jpg'), { type: m[1] });
    } catch {
        return null;
    }
}

/* ---------- templates ---------- */
// the part of the message you wrote: no signature, no quote, no inline images (they can't be stored)
function ownHtml(editor) {
    const own = editor.cloneNode(true);
    $$('.pm-signature, .pm-quote, img[data-cid], .picked', own).forEach(x => (x.classList.contains('picked') && x.tagName !== 'IMG' ? x.classList.remove('picked') : x.remove()));
    return own.innerHTML.replace(/(<div><br><\/div>|<br>)+$/i, '').trim();
}
function templateMenu(x, y, { editor, subjectInput, insertHtml, markDirty }) {
    const list = state.settings.templates || [];
    const items = list.map(t => ({
        icon: 'file',
        label: t.name,
        hint: t.subject,
        run: () => {
            if (t.subject && !subjectInput.value.trim()) {
                subjectInput.value = t.subject;
                subjectInput.dispatchEvent(new Event('input'));
            }
            insertHtml(t.html);
            markDirty();
        }
    }));
    if (items.length) items.push('-');
    items.push({
        icon: 'plus',
        label: 'Save as template',
        run: async () => {
            const html = ownHtml(editor);
            if (!html.replace(/<[^>]+>/g, '').trim()) return toast('Write something first, then save it as a template', { error: true });
            const name = await askText({ title: 'Save as template', message: 'Reuse this message any time from the templates button.', icon: 'file', confirm: 'Save template', input: { value: subjectInput.value.trim().slice(0, 80), placeholder: 'Template name' } });
            editor.focus({ preventScroll: true });
            if (!name) return;
            const templates = [...list, { id: Math.random().toString(36).slice(2, 10), name: name.slice(0, 80), subject: subjectInput.value.trim(), html }];
            if (await saveSettings({ templates })) toast(`Saved “${name}”${$('img[data-cid]', editor) ? ' (pasted images aren’t kept in templates)' : ''}`);
        }
    });
    if (list.length) items.push({ icon: 'settings', label: 'Manage templates', run: () => openSettings('templates') });
    showMenu(x, y - Math.min(52 + items.length * 38, 380), items);
}

function recipientField(box, onChange) {
    let people = [];
    const input = h('<input type="text" autocomplete="off" spellcheck="false">');
    let sugg = null;
    let suggItems = [];
    let suggIdx = 0;

    const render = () => {
        $$('.recip', box).forEach(x => x.remove());
        people.forEach((p, i) => {
            const chip = h(`<span class="recip${validEmail(p.address) ? '' : ' invalid'}" title="${esc(p.address)}">${esc(p.name || p.address)}<button type="button" data-i="${i}">${icon('x')}</button></span>`);
            box.insertBefore(chip, input);
        });
    };
    const add = list => {
        for (const p of list) if (p.address && !people.some(x => x.address.toLowerCase() === p.address.toLowerCase())) people.push(p);
        render();
        onChange();
    };
    const parse = text =>
        text
            .split(/[,;\n]+/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => {
                const mm = s.match(/^(.*?)\s*<([^>]+)>$/);
                return mm ? { name: mm[1].replace(/^"|"$/g, '').trim(), address: mm[2].trim() } : { name: '', address: s };
            });
    const commit = () => {
        if (input.value.trim()) add(parse(input.value));
        input.value = '';
        hideSugg();
    };
    const hideSugg = () => {
        sugg?.remove();
        sugg = null;
    };
    const showSugg = debounce(async () => {
        const q = input.value.trim();
        if (!q) return hideSugg();
        let list = [];
        try {
            list = await api('api/contacts?' + qs({ q }));
        } catch {
            return;
        }
        list = list.filter(p => !people.some(x => x.address === p.address));
        if (!list.length || input.value.trim() !== q) return hideSugg();
        suggItems = list;
        suggIdx = 0;
        hideSugg();
        sugg = h('<div class="suggest"></div>');
        list.forEach((p, i) => {
            const b = h(`<button type="button" class="${i === 0 ? 'on' : ''}">${avatar(p, 'sm')}<span><b>${esc(p.name || p.address)}</b><small>${esc(p.address)}</small></span></button>`);
            b.onmousedown = e => {
                e.preventDefault();
                input.value = '';
                add([p]);
                hideSugg();
            };
            sugg.append(b);
        });
        box.parentElement.append(sugg);
    }, 150);

    box.append(input);
    box.addEventListener('click', e => {
        const b = e.target.closest('button[data-i]');
        if (b) {
            people.splice(Number(b.dataset.i), 1);
            render();
            onChange();
        }
        input.focus();
    });
    input.addEventListener('input', () => {
        if (/[,;]/.test(input.value)) commit();
        else showSugg();
    });
    input.addEventListener('paste', e => {
        const text = e.clipboardData.getData('text');
        if (/[,;\n]/.test(text) || /@/.test(text)) {
            e.preventDefault();
            add(parse(text));
        }
    });
    input.addEventListener('keydown', e => {
        if (sugg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            suggIdx = (suggIdx + (e.key === 'ArrowDown' ? 1 : -1) + suggItems.length) % suggItems.length;
            $$('button', sugg).forEach((b, i) => b.classList.toggle('on', i === suggIdx));
        } else if ((e.key === 'Enter' || e.key === 'Tab') && sugg) {
            e.preventDefault();
            input.value = '';
            add([suggItems[suggIdx]]);
            hideSugg();
        } else if (e.key === 'Enter' || (e.key === 'Tab' && input.value.trim())) {
            if (input.value.trim()) {
                e.preventDefault();
                commit();
            }
        } else if (e.key === 'Backspace' && !input.value && people.length) {
            people.pop();
            render();
            onChange();
        } else if (e.key === 'Escape' && sugg) {
            e.stopPropagation();
            hideSugg();
        }
    });
    input.addEventListener('blur', () => setTimeout(commit, 120));

    return {
        set: list => {
            people = [...list];
            render();
        },
        list: () => people,
        value: () => people.map(p => (p.name ? `"${p.name.replace(/"/g, '')}" <${p.address}>` : p.address)).join(', '),
        pending: () => !!input.value.trim(),
        commit,
        focus: () => input.focus()
    };
}

export { SIG_NONE, cleanQuoted, composer, openComposer, quotedBody, recipientField, signatureHtml, validEmail };
