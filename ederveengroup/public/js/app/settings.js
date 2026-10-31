// EderveenGroup client: settings
import { remove } from './actions.js';
import { logout, refreshMe } from './chrome.js';
import { cropPhoto } from './cropper.js';
import { askConfirm, askText, restoreSelection, saveSelection } from './dialogs.js';
import { renderList } from './list.js';
import { saveSettings } from './look.js';
import { SHORTCUTS } from './palette.js';
import { state } from './state.js';
import { $, $$, api, avatar, debounce, esc, fmtDate, glide, h, resetPhotos, toast } from './util.js';

const SIG_TEMPLATES = {
    Minimal: name => `<div>— ${esc(name)}</div>`,
    Professional: (name, email) =>
        `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333"><tr><td style="padding-right:14px;border-right:3px solid ${state.settings.accent}"><b style="font-size:15px;color:${state.settings.accent}">${esc(name)}</b><br><span style="color:#777">Your title · EderveenGroup</span></td><td style="padding-left:14px;line-height:1.6"><a href="mailto:${esc(email)}" style="color:${state.settings.accent};text-decoration:none">${esc(email)}</a><br><span style="color:#777">+1 (555) 000-0000</span></td></tr></table>`,
    Executive: (name, email) =>
        `<div style="font-family:Georgia,'Times New Roman',serif"><div style="font-size:18px;color:${state.settings.accent}">${esc(name)}</div><div style="font-family:Arial,sans-serif;font-size:11px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase;margin-top:2px">EderveenGroup</div><div style="font-family:Arial,sans-serif;font-size:12px;margin-top:8px"><a href="mailto:${esc(email)}" style="color:#8a8a8a;text-decoration:none">${esc(email)}</a></div></div>`
};

// "3 min ago", "2 h ago", then a date
function ago(t) {
    const d = Date.now() - t;
    if (d < 90e3) return 'just now';
    if (d < 3600e3) return `${Math.round(d / 60e3)} min ago`;
    if (d < 864e5) return `${Math.round(d / 3600e3)} h ago`;
    return fmtDate(new Date(t).toISOString());
}
const DEVICE_ICON = { phone: 'phone', tablet: 'tablet', desktop: 'laptop' };
const deviceRow = (d, i) => `<div class="dev${d.current ? ' current' : ''}" data-ref="${esc(d.ref)}" style="animation-delay:${i * 45}ms">
    <div class="dev-ic">${icon(DEVICE_ICON[d.device.kind] || 'laptop')}</div>
    <div class="lbl"><b>${esc(d.device.label)}${d.current ? ' <span class="badge">This device</span>' : ''}</b>
        <small>${d.current ? 'Active now' : `Active ${esc(ago(d.lastSeen))}`}${d.ip ? ` · ${esc(d.ip)}` : ''} · Signed in ${esc(fmtDate(new Date(d.created).toISOString()))}${d.remember ? '' : ' · Until the browser closes'}</small></div>
    ${d.current ? '' : `<button class="btn" data-revoke>Sign out</button>`}</div>`;
const ACT_TEXT = {
    password: 'Signed in',
    'trusted-device': 'Signed in on a trusted device',
    '2fa': 'Signed in with a 2FA code',
    'recovery-code': 'Signed in with a recovery code'
};
const FAIL_TEXT = { 'wrong-password': 'Wrong password', 'wrong-code': 'Wrong 2FA code', locked: 'Blocked: too many attempts' };
const activityRow = (a, i) => `<li class="${a.ok ? 'ok' : 'bad'}" style="animation-delay:${Math.min(i, 12) * 30}ms">
    <span class="act-dot">${icon(a.ok ? 'check' : 'x')}</span>
    <div class="lbl"><b>${esc(a.ok ? ACT_TEXT[a.method] || 'Signed in' : FAIL_TEXT[a.reason] || 'Failed sign-in')}</b>
        <small>${esc(a.device ? a.device.label : 'Unknown device')}${a.ip ? ` · ${esc(a.ip)}` : ''}</small></div>
    <time title="${esc(fmtDate(new Date(a.t).toISOString(), true))}">${esc(ago(a.t))}</time></li>`;

function openSettings(tab = 'general') {
    const s = state.settings;
    const back = h(`<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="modal-head"><h2>Settings</h2><button class="icon-btn" data-close aria-label="Close settings">${icon('x')}</button></div>
        <div class="settings">
            <nav>
                <button data-tab="profile">${icon('user')} Profile</button>
                <button data-tab="general">${icon('settings')} General</button>
                <button data-tab="look">${icon('palette')} Appearance</button>
                <button data-tab="sigs">${icon('signature')} Signatures</button>
                <button data-tab="templates">${icon('file')} Templates</button>
                <button data-tab="keys">${icon('keyboard')} Shortcuts</button>
                <button data-tab="security">${icon('lock')} Security</button>
                <button data-tab="devices">${icon('laptop')} Devices</button>
                <button data-tab="account">${icon('user')} Account</button>
            </nav>
            <section></section>
        </div></div></div>`);
    document.body.append(back);
    let section = $('section', back);
    const close = () => {
        back.remove();
        document.removeEventListener('keydown', onEsc, true);
    };
    const onEsc = e => {
        if (e.key === 'Escape' && !$('.dlg-back')) {
            e.stopPropagation();
            close();
        }
    };
    document.addEventListener('keydown', onEsc, true);
    back.addEventListener('click', e => (e.target === back || e.target.closest('[data-close]')) && close());

    const tabs = {
        general() {
            section.innerHTML = `<h3>General</h3><p class="hint">How your inbox behaves.</p>
                <div class="row"><div class="lbl"><b>Conversation view</b><small>Group replies into one conversation, with your sent replies in line</small></div><label class="switch"><input type="checkbox" data-s="conversations" ${s.conversations !== false ? 'checked' : ''}><span></span></label></div>
                <div class="row"><div class="lbl"><b>Reading pane</b><small>Show messages next to the list, or open them full size</small></div>
                    <div class="seg" data-seg="readingPane">${[['right', 'Right'], ['off', 'Off']].map(([v, l]) => `<button data-v="${v}" class="${s.readingPane === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
                <div class="row"><div class="lbl"><b>After archiving or deleting</b><small>What the reader shows next</small></div>
                    <div class="seg" data-seg="afterAction">${[['next', 'Next message'], ['list', 'Back to list']].map(([v, l]) => `<button data-v="${v}" class="${s.afterAction === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
                <div class="row"><div class="lbl"><b>Undo send</b><small>Grace period before mail actually leaves</small></div>
                    <div class="seg" data-seg="undoSendSeconds">${[0, 5, 10, 20].map(n => `<button data-v="${n}" class="${s.undoSendSeconds === n ? 'on' : ''}">${n ? n + 's' : 'Off'}</button>`).join('')}</div></div>
                <div class="row"><div class="lbl"><b>Load remote images</b><small>Off blocks tracking pixels until you allow them</small></div><label class="switch"><input type="checkbox" data-s="loadRemoteImages" ${s.loadRemoteImages ? 'checked' : ''}><span></span></label></div>
                <div class="row"><div class="lbl"><b>Sender photos</b><small>Show Gravatars and company logos. Fetched by your server, so senders never see your IP.</small></div><label class="switch"><input type="checkbox" data-s="senderPhotos" ${s.senderPhotos !== false ? 'checked' : ''}><span></span></label></div>
                <div class="row"><div class="lbl"><b>Save a copy to Sent</b><small>Turn off if Purelymail already saves outgoing mail for you</small></div><label class="switch"><input type="checkbox" data-s="saveSentCopy" ${s.saveSentCopy ? 'checked' : ''}><span></span></label></div>
                <div class="row"><div class="lbl"><b>Desktop notifications</b><small>Get pinged when new mail lands</small></div><button class="btn" data-notify>${'Notification' in window && Notification.permission === 'granted' ? icon('check') + ' Enabled' : icon('bell') + ' Enable'}</button></div>`;
            $$('input[type=checkbox][data-s]', section).forEach(i =>
                i.addEventListener('change', async () => {
                    await saveSettings({ [i.dataset.s]: i.checked });
                    if (i.dataset.s === 'conversations') renderList();
                    if (i.dataset.s === 'senderPhotos') {
                        resetPhotos();
                        renderList();
                    }
                })
            );
            $('[data-notify]', section).onclick = async e => {
                if (!('Notification' in window)) return toast('Notifications aren’t supported here', { error: true });
                const p = await Notification.requestPermission();
                e.target.closest('button').innerHTML = p === 'granted' ? icon('check') + ' Enabled' : icon('bell') + ' Blocked';
            };
        },
        look() {
            const accents = ['#4c8dff', '#22c3ee', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#e5484d', '#94a3b8'];
            section.innerHTML = `<h3>Appearance</h3><p class="hint">Make it yours.</p>
                <div class="row"><div class="lbl"><b>Theme</b></div><div class="seg" data-seg="theme">${['dark', 'light', 'system'].map(t => `<button data-v="${t}" class="${s.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
                <div class="row"><div class="lbl"><b>Accent color</b></div><div class="swatches">${accents.map(a => `<button class="swatch${s.accent === a ? ' on' : ''}" data-accent="${a}" style="background:${a}" aria-label="${a}"></button>`).join('')}<label class="swatch swatch-custom${accents.includes(s.accent) ? '' : ' on'}" title="Custom"><input type="color" value="${esc(s.accent)}"></label></div></div>
                <div class="row"><div class="lbl"><b>Density</b><small>Compact hides previews</small></div><div class="seg" data-seg="density">${['comfortable', 'compact'].map(t => `<button data-v="${t}" class="${s.density === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>`;
            section.addEventListener('click', e => {
                const sw = e.target.closest('[data-accent]');
                if (sw) {
                    $$('.swatch', section).forEach(x => x.classList.toggle('on', x === sw));
                    saveSettings({ accent: sw.dataset.accent });
                }
            });
            $('.swatch-custom input', section).addEventListener('input', debounce(e => {
                $$('.swatch', section).forEach(x => x.classList.toggle('on', x.classList.contains('swatch-custom')));
                saveSettings({ accent: e.target.value });
            }, 120));
        },
        sigs() {
            let sigs = s.signatures.map(x => ({ ...x }));
            let defaultSig = s.defaultSignature;
            let replySig = s.replySignature;
            const draw = () => {
                section.innerHTML = `<h3>Signatures</h3><p class="hint">Create as many as you like and pick defaults. They’re added automatically and you can switch them while composing.</p>
                    <div class="sig-templates"><button class="btn" data-new="">${icon('plus')} Blank</button>${Object.keys(SIG_TEMPLATES).map(k => `<button class="btn" data-new="${k}">${icon('sparkle')} ${k}</button>`).join('')}</div>
                    <div class="sig-list">${sigs.length ? '' : `<div class="empty" style="height:auto;padding:30px;border:1px dashed var(--border-strong);border-radius:14px"><div><div class="big">${icon('signature')}</div><h3>No signatures yet</h3><p>Start from a template above.</p></div></div>`}</div>
                    ${sigs.length ? `<div class="sig-pickers">
                        <label class="field"><span>For new emails</span><select class="select" data-pick="default"><option value="">None</option>${sigs.map(x => `<option value="${esc(x.id)}" ${x.id === defaultSig ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
                        <label class="field"><span>For replies &amp; forwards</span><select class="select" data-pick="reply"><option value="">Same as new</option>${sigs.map(x => `<option value="${esc(x.id)}" ${x.id === replySig ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>` : ''}
                    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" data-save>${icon('check')} Save signatures</button></div>`;
                const list = $('.sig-list', section);
                sigs.forEach((sig, i) => {
                    const card = h(`<div class="sig-card"><div class="sig-card-head"><input value="${esc(sig.name)}" aria-label="Signature name">
                        <button class="icon-btn" data-del title="Delete">${icon('trash')}</button></div>
                        <div class="toolbar"><button class="icon-btn" data-cmd="bold">${icon('bold')}</button><button class="icon-btn" data-cmd="italic">${icon('italic')}</button><button class="icon-btn" data-cmd="underline">${icon('underline')}</button>
                        <label class="icon-btn" title="Text color" style="cursor:pointer">${icon('palette')}<input type="color" style="position:absolute;opacity:0;width:0;height:0"></label>
                        <button class="icon-btn" data-cmd="link">${icon('link')}</button><button class="icon-btn" data-cmd="image" title="Image from URL">${icon('image')}</button><span class="sep"></span><button class="icon-btn" data-cmd="html" title="Edit HTML">${icon('code')}</button></div>
                        <div class="sig-editor" contenteditable="true">${sig.html}</div></div>`);
                    const ed = $('.sig-editor', card);
                    $('input', card).addEventListener('input', e => (sig.name = e.target.value));
                    ed.addEventListener('input', () => (sig.html = ed.innerHTML));
                    $('[data-del]', card).onclick = () => {
                        sigs.splice(i, 1);
                        if (defaultSig === sig.id) defaultSig = null;
                        if (replySig === sig.id) replySig = null;
                        draw();
                    };
                    $('.toolbar', card).addEventListener('mousedown', e => e.target.closest('[data-cmd]') && e.preventDefault());
                    $('input[type=color]', card).addEventListener('input', e => {
                        ed.focus();
                        document.execCommand('foreColor', false, e.target.value);
                        sig.html = ed.innerHTML;
                    });
                    $('.toolbar', card).addEventListener('click', async e => {
                        const b = e.target.closest('[data-cmd]');
                        if (!b) return;
                        const cmd = b.dataset.cmd;
                        if (cmd === 'html') {
                            if (ed.dataset.raw) {
                                ed.innerHTML = ed.textContent;
                                delete ed.dataset.raw;
                                ed.style.fontFamily = '';
                            } else {
                                ed.textContent = ed.innerHTML;
                                ed.dataset.raw = '1';
                                ed.style.fontFamily = 'ui-monospace,monospace';
                                ed.style.whiteSpace = 'pre-wrap';
                                return;
                            }
                            ed.style.whiteSpace = '';
                        } else {
                            ed.focus();
                            if (cmd === 'link') {
                                const range = saveSelection();
                                const url = await askText({ title: 'Add a link', icon: 'link', confirm: 'Add link', input: { type: 'url', value: 'https://', placeholder: 'https://example.com' } });
                                restoreSelection(ed, range);
                                if (url) document.execCommand('createLink', false, /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);
                            } else if (cmd === 'image') {
                                const range = saveSelection();
                                const url = await askText({ title: 'Add an image', message: 'Paste a link to an image (https://…), like your company logo.', icon: 'image', confirm: 'Add image', input: { type: 'url', placeholder: 'https://example.com/logo.png' } });
                                restoreSelection(ed, range);
                                if (url && /^https:\/\//i.test(url)) document.execCommand('insertHTML', false, `<img src="${esc(url)}" alt="" style="max-width:240px;height:auto">`);
                                else if (url) toast('Image links need to start with https://', { error: true });
                            } else document.execCommand(cmd);
                        }
                        sig.html = ed.innerHTML;
                    });
                    list.append(card);
                });
                section.querySelector('[data-pick=default]')?.addEventListener('change', e => (defaultSig = e.target.value || null));
                section.querySelector('[data-pick=reply]')?.addEventListener('change', e => (replySig = e.target.value || null));
                $$('[data-new]', section).forEach(b => (b.onclick = () => {
                    const name = s.displayName || state.me.email.split('@')[0];
                    const t = b.dataset.new;
                    const sig = { id: Math.random().toString(36).slice(2, 10), name: t || `Signature ${sigs.length + 1}`, html: t ? SIG_TEMPLATES[t](name, state.me.email) : '<div><br></div>' };
                    sigs.push(sig);
                    if (!defaultSig) defaultSig = sig.id;
                    draw();
                    $$('.sig-editor', section).pop().focus();
                }));
                $('[data-save]', section).onclick = async () => {
                    $$('.sig-editor[data-raw]', section).forEach(ed => ed.closest('.sig-card').querySelector('[data-cmd=html]').click());
                    await saveSettings({ signatures: sigs, defaultSignature: defaultSig, replySignature: replySig });
                    toast('Signatures saved ✨');
                    sigs = state.settings.signatures.map(x => ({ ...x }));
                    draw();
                };
            };
            draw();
        },
        profile() {
            const draw = () => {
                section.innerHTML = `<h3>Profile</h3><p class="hint">How you appear across EderveenGroup.</p>
                    <div class="profile-card">
                        <label class="profile-photo" title="Change photo">${avatar({ address: state.me.email, name: s.displayName }, 'xl')}
                            <span class="profile-photo-edit">${icon('image')}</span><input type="file" accept="image/*" hidden data-photo-input></label>
                        <div class="profile-meta">
                            <b>${esc(s.displayName || state.me.email.split('@')[0])}</b><small>${esc(state.me.email)}</small>
                            <div class="profile-actions">
                                <button class="btn btn-primary" data-photo-pick>${icon('image')} ${state.me.photo ? 'Change photo' : 'Upload photo'}</button>
                                ${state.me.photo ? `<button class="btn" data-photo-remove>Remove</button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="row"><div class="lbl"><b>Display name</b><small>Shown to people you email</small></div><input class="input" data-s="displayName" value="${esc(s.displayName)}" placeholder="Your name"></div>
                    <p class="hint" style="margin-top:14px">Your photo shows everywhere in EderveenGroup, including for colleagues who use it. Email has no universal profile picture, so people on Gmail or Outlook see it if you also add it at <a href="https://gravatar.com" target="_blank" rel="noopener">gravatar.com</a>.</p>`;
                const input = $('[data-photo-input]', section);
                $('[data-photo-pick]', section).onclick = () => input.click();
                input.onchange = () => input.files[0] && cropPhoto(input.files[0], draw);
                const card = $('.profile-photo', section);
                card.addEventListener('dragover', e => {
                    e.preventDefault();
                    card.classList.add('drag');
                });
                card.addEventListener('dragleave', () => card.classList.remove('drag'));
                card.addEventListener('drop', e => {
                    e.preventDefault();
                    card.classList.remove('drag');
                    const f = e.dataTransfer.files[0];
                    if (f) cropPhoto(f, draw);
                });
                const rm = $('[data-photo-remove]', section);
                if (rm)
                    rm.onclick = async () => {
                        try {
                            state.me.photo = (await api('api/profile/photo', { method: 'DELETE' })).photo;
                            resetPhotos(state.me.email);
                            refreshMe();
                            renderList();
                            draw();
                            toast('Photo removed');
                        } catch (err) {
                            toast(err.message, { error: true });
                        }
                    };
                $('[data-s=displayName]', section).addEventListener('change', async e => {
                    await saveSettings({ displayName: e.target.value.trim() });
                    refreshMe();
                    draw();
                });
            };
            draw();
        },
        templates() {
            let list = (s.templates || []).map(x => ({ ...x }));
            const draw = () => {
                section.innerHTML = `<h3>Templates</h3><p class="hint">Canned replies and messages you send often. Insert one from the ${icon('file')} button while composing, or save what you’re writing as a new one.</p>
                    <div class="tpl-list">${list.length ? '' : `<div class="empty" style="height:auto;padding:30px;border:1px dashed var(--border-strong);border-radius:14px"><div><div class="big">${icon('file')}</div><h3>No templates yet</h3><p>Make one here, or from the composer.</p></div></div>`}</div>
                    <div style="display:flex;gap:10px;justify-content:space-between;margin-top:16px"><button class="btn" data-new>${icon('plus')} New template</button><button class="btn btn-primary" data-save>${icon('check')} Save templates</button></div>`;
                const box = $('.tpl-list', section);
                list.forEach((t, i) => {
                    const card = h(`<div class="sig-card tpl-card" style="animation-delay:${i * 40}ms"><div class="sig-card-head"><input value="${esc(t.name)}" aria-label="Template name" placeholder="Name">
                        <button class="icon-btn" data-del title="Delete">${icon('trash')}</button></div>
                        <input class="input tpl-subject" value="${esc(t.subject)}" placeholder="Subject (optional, used when the subject is empty)" aria-label="Subject">
                        <div class="sig-editor" contenteditable="true" data-placeholder="Write the template…">${t.html}</div></div>`);
                    const [name, subject] = $$('input', card);
                    name.addEventListener('input', () => (t.name = name.value));
                    subject.addEventListener('input', () => (t.subject = subject.value));
                    const ed = $('.sig-editor', card);
                    ed.addEventListener('input', () => (t.html = ed.innerHTML));
                    $('[data-del]', card).onclick = () => {
                        list.splice(i, 1);
                        draw();
                    };
                    box.append(card);
                });
                $('[data-new]', section).onclick = () => {
                    list.push({ id: Math.random().toString(36).slice(2, 10), name: 'New template', subject: '', html: '' });
                    draw();
                    const cards = $$('.tpl-card', section);
                    const last = cards[cards.length - 1];
                    last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    $('input', last).select();
                };
                $('[data-save]', section).onclick = async () => {
                    if (await saveSettings({ templates: list })) {
                        list = state.settings.templates.map(x => ({ ...x }));
                        toast('Templates saved');
                    }
                };
            };
            draw();
        },
        async security() {
            const here = section;
            here.innerHTML = `<h3>Security</h3><p class="hint">Two-step verification asks for a code from your phone after your password, so a leaked password alone can’t get in.</p><div class="spinner"></div>`;
            let st;
            try {
                st = await api('api/2fa');
            } catch (e) {
                return toast(e.message, { error: true });
            }
            if (section !== here) return;
            const codesBlock = codes => `<p class="hint" style="margin:0">Save these recovery codes somewhere safe. Each one works once if you lose your phone. They won’t be shown again.</p>
                <div class="tf-codes">${codes.map((c, i) => `<code style="animation-delay:${i * 30}ms">${esc(c)}</code>`).join('')}</div>
                <div class="tf-actions"><button class="btn" data-copy-codes>${icon('copy')} Copy</button><button class="btn" data-dl-codes>${icon('download')} Download .txt</button><button class="btn btn-primary" data-done>I’ve saved them</button></div>`;
            const wireCodes = codes => {
                const text = `EderveenGroup recovery codes for ${state.me.email}\n\n${codes.join('\n')}\n`;
                $('[data-copy-codes]', here).onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(text);
                        toast('Recovery codes copied');
                    } catch {
                        toast('Couldn’t copy. Select them instead.', { error: true });
                    }
                };
                $('[data-dl-codes]', here).onclick = () => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
                    a.download = 'ederveengroup-recovery-codes.txt';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                };
                $('[data-done]', here).onclick = () => tabs.security();
            };
            const confirmRow = (label, cls = 'btn-primary') => `<div class="tf-confirm"><input class="input" inputmode="numeric" placeholder="123456" maxlength="9" autocomplete="one-time-code" data-code><button class="btn ${cls}" data-confirm>${label}</button></div>`;

            const status = `<div class="tf-status ${st.enabled ? 'on' : ''}"><div class="shield">${icon(st.enabled ? 'check' : 'lock')}</div>
                <div class="meta"><b>Two-step verification is ${st.enabled ? 'on' : 'off'}</b><small>${st.enabled ? `Since ${esc(fmtDate(new Date(st.since).toISOString(), true))} · ${st.recoveryLeft} recovery code${st.recoveryLeft === 1 ? '' : 's'} left` : 'Add an authenticator app such as Google Authenticator, 1Password or Authy.'}</small></div>
                ${st.enabled ? '' : `<button class="btn btn-primary" data-setup>${icon('lock')} Turn on</button>`}</div>`;
            here.innerHTML = `<h3>Security</h3><p class="hint">Two-step verification asks for a code from your phone after your password, so a leaked password alone can’t get in.</p>${status}<div data-area></div>
                <p class="hint" style="margin-top:18px">Turned on 2FA in Purelymail too? Mail apps can’t ask for Purelymail’s code, so sign in here with a <b>Purelymail app password</b>.</p>`;
            const area = $('[data-area]', here);

            if (!st.enabled) {
                $('[data-setup]', here).onclick = async e => {
                    e.target.closest('button').disabled = true;
                    let setup;
                    try {
                        setup = await api('api/2fa/setup', { method: 'POST' });
                    } catch (err) {
                        e.target.closest('button').disabled = false;
                        return toast(err.message, { error: true });
                    }
                    area.innerHTML = `<div class="tf-setup"><div class="tf-qr">${setup.qr}</div><div>
                        <ol class="tf-steps"><li>Open your authenticator app and add an account.</li><li>Scan the QR code, or enter this key:</li></ol>
                        <div class="tf-secret"><span>${esc(setup.secret)}</span><button class="icon-btn" data-copy-secret title="Copy key">${icon('copy')}</button></div>
                        <ol class="tf-steps" start="3"><li>Enter the 6-digit code it shows.</li></ol>${confirmRow('Verify &amp; turn on')}</div></div>`;
                    $('[data-copy-secret]', area).onclick = () => navigator.clipboard.writeText(setup.secret.replace(/\s/g, '')).then(() => toast('Key copied'), () => {});
                    const input = $('[data-code]', area);
                    input.focus();
                    const go = async () => {
                        try {
                            const r = await api('api/2fa/enable', { method: 'POST', body: { code: input.value.replace(/\s/g, '') } });
                            toast('Two-step verification is on');
                            here.querySelector('.tf-status').outerHTML = `<div class="tf-status on"><div class="shield">${icon('check')}</div><div class="meta"><b>Two-step verification is on</b><small>You’ll be asked for a code when you sign in on a new device.</small></div></div>`;
                            area.innerHTML = codesBlock(r.recovery);
                            wireCodes(r.recovery);
                        } catch (err) {
                            toast(err.message, { error: true });
                            input.select();
                        }
                    };
                    $('[data-confirm]', area).onclick = go;
                    input.addEventListener('keydown', ev => ev.key === 'Enter' && go());
                };
                return;
            }

            area.innerHTML = `<div class="row"><div class="lbl"><b>New recovery codes</b><small>Replaces your old ones. Confirm with a code from your app.</small></div><button class="btn" data-regen>Generate</button></div>
                <div class="row"><div class="lbl"><b>Turn off two-step verification</b><small>Confirm with a code from your app or a recovery code.</small></div><button class="btn btn-danger" data-off>Turn off</button></div>`;
            const ask = (btn, label, cls, run) => {
                const row = btn.closest('.row');
                btn.outerHTML = confirmRow(label, cls);
                const input = $('[data-code]', row);
                input.focus();
                const go = () => run(input.value.trim()).catch(err => {
                    toast(err.message, { error: true });
                    input.select();
                });
                $('[data-confirm]', row).onclick = go;
                input.addEventListener('keydown', ev => ev.key === 'Enter' && go());
            };
            $('[data-regen]', area).onclick = e =>
                ask(e.target.closest('button'), 'Confirm', 'btn-primary', async code => {
                    const r = await api('api/2fa/recovery', { method: 'POST', body: { code } });
                    area.innerHTML = codesBlock(r.recovery);
                    wireCodes(r.recovery);
                });
            $('[data-off]', area).onclick = e =>
                ask(e.target.closest('button'), 'Turn off', 'btn-danger', async code => {
                    await api('api/2fa/disable', { method: 'POST', body: { code } });
                    toast('Two-step verification is off');
                    tabs.security();
                });
        },
        async devices() {
            const here = section;
            here.innerHTML = `<h3>Devices &amp; activity</h3><p class="hint">Everywhere you’re signed in to EderveenGroup. Don’t recognise one? Sign it out, then change your Purelymail password.</p><div class="spinner"></div>`;
            let list, activity;
            try {
                [list, activity] = await Promise.all([api('api/sessions'), api('api/activity')]);
            } catch (e) {
                return toast(e.message, { error: true });
            }
            if (section !== here) return;
            const others = list.filter(d => !d.current).length;
            const failures = activity.filter(a => !a.ok && Date.now() - a.t < 7 * 864e5).length;
            here.innerHTML = `<h3>Devices &amp; activity</h3><p class="hint">Everywhere you’re signed in to EderveenGroup. Don’t recognise one? Sign it out, then change your Purelymail password.</p>
                ${failures ? `<div class="sec-alert">${icon('alert')}<div><b>${failures} failed sign-in${failures === 1 ? '' : 's'} this week</b><small>Someone typed a wrong password or code. If that wasn’t you, your account is still safe, but consider turning on two-step verification.</small></div></div>` : ''}
                <div class="dev-list">${list.map((d, i) => deviceRow(d, i)).join('')}</div>
                ${others ? `<div class="row"><div class="lbl"><b>Sign out all other devices</b><small>Keeps you signed in here only</small></div><button class="btn btn-danger" data-others>${icon('logout')} Sign out ${others} other${others === 1 ? '' : 's'}</button></div>` : ''}
                <h4 class="sub-h">Recent sign-ins</h4>
                <ol class="act-list">${activity.length ? activity.slice(0, 12).map((a, i) => activityRow(a, i)).join('') : '<li class="empty">Nothing yet</li>'}</ol>
                ${activity.length > 12 ? `<button class="btn btn-ghost" data-more-act>Show all ${activity.length}</button>` : ''}`;
            $$('[data-revoke]', here).forEach(b =>
                b.addEventListener('click', async () => {
                    const row = b.closest('.dev');
                    const d = list.find(x => x.ref === row.dataset.ref);
                    if (!(await askConfirm({ title: `Sign out ${d.device.label}?`, message: 'That device will be sent back to the sign-in page right away.', icon: 'logout', confirm: 'Sign out', danger: true }))) return;
                    try {
                        await api(`api/sessions/${encodeURIComponent(d.ref)}`, { method: 'DELETE' });
                    } catch (e) {
                        return toast(e.message, { error: true });
                    }
                    row.style.height = row.offsetHeight + 'px';
                    row.classList.add('gone');
                    setTimeout(() => section === here && tabs.devices(), 380);
                    toast(`${d.device.label} signed out`);
                })
            );
            const others$ = $('[data-others]', here);
            if (others$)
                others$.onclick = async () => {
                    if (!(await askConfirm({ title: 'Sign out everywhere else?', message: `${others} other device${others === 1 ? '' : 's'} will be signed out. You stay signed in here.`, icon: 'lock', confirm: 'Sign them out', danger: true }))) return;
                    try {
                        const r = await api('api/sessions/others', { method: 'POST' });
                        $$('.dev:not(.current)', here).forEach((row, n) => {
                            row.style.height = row.offsetHeight + 'px';
                            row.style.transitionDelay = `${n * 40}ms`;
                            row.classList.add('gone');
                        });
                        toast(`Signed out ${r.signedOut} device${r.signedOut === 1 ? '' : 's'}`);
                        setTimeout(() => section === here && tabs.devices(), 420 + others * 40);
                    } catch (e) {
                        toast(e.message, { error: true });
                    }
                };
            const more = $('[data-more-act]', here);
            if (more)
                more.onclick = () => {
                    $('.act-list', here).innerHTML = activity.map((a, i) => activityRow(a, Math.max(0, i - 12))).join('');
                    more.remove();
                };
        },
        keys() {
            section.innerHTML = `<h3>Keyboard shortcuts</h3><p class="hint">Fly through your inbox.</p><div class="shortcuts">${SHORTCUTS.map(([k, d]) => `<div><span>${d}</span><span>${k.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ')}</span></div>`).join('')}</div>`;
        },
        account() {
            section.innerHTML = `<h3>Account</h3><p class="hint">Connected to Purelymail over IMAP (993) and SMTP (465), both SSL/TLS.</p>
                <div class="row"><div class="lbl"><b>Signed in as</b><small>${esc(state.me.email)}</small></div>${avatar({ address: state.me.email, name: s.displayName })}</div>
                <div class="row"><div class="lbl"><b>Session</b><small>Stays signed in until ${esc(fmtDate(state.me.sessionExpires, true))}</small></div>${icon('lock')}</div>
                <div class="row"><div class="lbl"><b>Devices</b><small>See where you’re signed in and recent sign-ins</small></div><button class="btn" data-goto="devices">${icon('laptop')} Manage</button></div>
                <div class="row"><div class="lbl"><b>Sign out</b><small>Clears the session cookie on this device</small></div><button class="btn btn-danger" data-logout>${icon('logout')} Sign out</button></div>
                <div class="row"><div class="lbl"><b>Sign out everywhere</b><small>Ends every session on every device right away. Use it if a device is lost.</small></div><button class="btn btn-danger" data-logout-all>${icon('lock')} Sign out everywhere</button></div>`;
            $('[data-goto]', section).onclick = () => show('devices');
            $('[data-logout]', section).onclick = logout;
            $('[data-logout-all]', section).onclick = async () => {
                if (!(await askConfirm({ title: 'Sign out everywhere?', message: 'Every device signed in to your account will be signed out right away, including this one.', icon: 'lock', confirm: 'Sign out everywhere', danger: true }))) return;
                try {
                    await api('api/logout/everywhere', { method: 'POST' });
                } finally {
                    location.replace('login');
                }
            };
        }
    };

    $('nav', back).addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (b) show(b.dataset.tab);
    });
    function show(name) {
        $$('nav button', back).forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        glide($('nav', back), $(`nav [data-tab="${name}"]`, back));
        // fresh element per tab so listeners from the previous tab don't pile up
        const fresh = section.cloneNode(false);
        section.replaceWith(fresh);
        section = fresh;
        section.addEventListener('click', e => {
            const b = e.target.closest('.seg button');
            if (!b) return;
            const seg = b.parentElement;
            $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
            const key = seg.dataset.seg;
            saveSettings({ [key]: key === 'undoSendSeconds' ? Number(b.dataset.v) : b.dataset.v });
        });
        tabs[name]();
    }
    show(tab);
}

export { SIG_TEMPLATES, openSettings };
