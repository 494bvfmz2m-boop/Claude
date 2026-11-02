// Chat: talk with people on EderveenGroup, one to one or in a group. Messages arrive live;
// pictures, reactions, replies, editing and deleting your own.
(function () {
    const { $, $$, esc, ic, call, toast, ask, ago, hue, initials, phone } = window.EG;
    const root = $('#chat');
    const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
    const EMOJI = ['😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😅', '😢', '😮', '😡', '👍', '👎', '👏', '🙏', '💪', '🎉', '❤️', '🔥', '✨', '✅', '❌', '👀', '🍕', '☕', '🍻', '🏖️', '🚗', '🏠', '⚽', '🎂', '🌞'];
    let me = '';
    let convs = [];
    let open = null; // { conv, msgs, more, read }
    let replyTo = null;
    let editing = null;
    let stream = null;
    const typing = new Map(); // cid → { name, until }
    const nameOf = (c, p) => (p.email === me ? 'You' : p.name || (p.username ? `@${p.username}` : p.email));
    const others = c => c.members.filter(p => p.email !== me);
    const title = c => c.name || others(c).map(p => p.name || `@${p.username}`).join(', ') || 'Just you';
    const avatar = (p, size = '') => `<span class="ch-av ${size}" style="--h:${hue(p.email)}"><i>${esc(initials(p.name || p.username || p.email))}</i><img alt="" src="/mail/api/avatar?email=${encodeURIComponent(p.email)}" loading="lazy" data-av></span>`;
    const convAvatar = c => {
        const o = others(c);
        if (c.direct || o.length === 1) return avatar(o[0] || c.members[0]);
        return `<span class="ch-group">${o.slice(0, 2).map(p => avatar(p, 'sm')).join('')}</span>`;
    };
    // a picture that isn't there falls back to the initials
    document.addEventListener('error', e => e.target.matches && e.target.matches('img[data-av]') && e.target.remove(), true);
    const when = t => {
        const d = new Date(t);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        if (now - d < 6 * 864e5) return d.toLocaleDateString(undefined, { weekday: 'short' });
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };
    const dayLabel = t => {
        const d = new Date(t);
        const today = new Date();
        const y = new Date(Date.now() - 864e5);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === y.toDateString()) return 'Yesterday';
        return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
    };
    // text with links that work (and nothing else that's HTML)
    const linkify = t => esc(t).replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
    const onlyEmoji = t => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(t) && !/^[\d#*\s]+$/.test(t);

    /* ---------- the list ---------- */
    function layout() {
        root.innerHTML = `<div class="ch${open ? ' in' : ''}">
            <aside class="ch-list">
                <div class="ch-head"><h1>Chat</h1><button class="icon-btn" id="newchat" title="New chat" aria-label="New chat">${ic('pen')}</button></div>
                <label class="ch-search">${ic('search')}<input id="q" placeholder="Search" aria-label="Search chats"></label>
                <div class="ch-convs" id="convs"></div>
            </aside>
            <section class="ch-thread" id="thread"></section>
        </div>`;
        $('#newchat').onclick = newChat;
        $('#q').oninput = drawList;
        drawList();
        drawThread();
    }
    function drawList() {
        const q = ($('#q') && $('#q').value.trim().toLowerCase()) || '';
        const list = convs.filter(c => !q || `${title(c)} ${c.members.map(p => p.username).join(' ')}`.toLowerCase().includes(q));
        $('#convs').innerHTML = list.length
            ? list
                  .map(c => {
                      const t = typing.get(c.id);
                      const last = t && t.until > Date.now() ? `<em>${esc(t.name)} is typing…</em>` : c.last ? `${c.last.by === me ? 'You: ' : !c.direct && c.last.by ? `${esc((c.members.find(p => p.email === c.last.by) || {}).name || '').split(' ')[0]}: ` : ''}${esc(c.last.text)}` : '<em>No messages yet</em>';
                      return `<button class="ch-conv${open && open.conv.id === c.id ? ' on' : ''}${c.unread ? ' unread' : ''}" data-cid="${esc(c.id)}">${convAvatar(c)}<span class="ch-cmain"><span class="ch-ctop"><b>${esc(title(c))}</b><time>${c.last ? esc(when(c.lastAt)) : ''}</time></span><span class="ch-cbot"><span>${last}</span>${c.unread ? `<i class="ch-badge">${c.unread > 99 ? '99+' : c.unread}</i>` : ''}</span></span></button>`;
                  })
                  .join('')
            : `<div class="ch-none">${q ? 'No chats match.' : `${ic('chat')}<p>No chats yet.</p><button class="btn btn-primary" id="start">${ic('pen')}<span>Start a chat</span></button>`}</div>`;
        $('#start') && ($('#start').onclick = newChat);
        const unread = convs.reduce((n, c) => n + c.unread, 0);
        document.title = `${unread ? `(${unread}) ` : ''}Chat · EderveenGroup`;
    }

    /* ---------- a conversation ---------- */
    function drawThread() {
        const el = $('#thread');
        $('.ch').classList.toggle('in', !!open);
        if (!open) {
            el.innerHTML = `<div class="ch-empty">${ic('chat')}<h2>Your chats</h2><p>Pick a chat on the left, or start a new one with anyone on EderveenGroup.</p><button class="btn btn-primary" id="start2">${ic('pen')}<span>New chat</span></button></div>`;
            $('#start2').onclick = newChat;
            return;
        }
        const c = open.conv;
        el.innerHTML = `<header class="ch-thead"><button class="icon-btn ch-back" id="back" aria-label="All chats">${ic('left')}</button>${convAvatar(c)}<div class="ch-tname"><b>${esc(title(c))}</b><small id="tsub">${c.direct ? esc('@' + (others(c)[0] || {}).username) : `${c.members.length} people`}</small></div><span class="spacer"></span>${c.direct ? '' : `<button class="icon-btn" id="tmore" aria-label="Group">${ic('more')}</button>`}</header>
            <div class="ch-msgs" id="msgs"></div>
            <div class="ch-compose">
                <div class="ch-replying" id="replying" hidden></div>
                <div class="ch-row">
                    <button class="icon-btn" id="pic" title="Add a picture" aria-label="Add a picture">${ic('image')}</button>
                    <button class="icon-btn" id="emo" title="Emoji" aria-label="Emoji">😊</button>
                    <textarea id="text" rows="1" placeholder="Type a message" maxlength="4000" aria-label="Message"></textarea>
                    <button class="ch-send" id="send" aria-label="Send">${ic('send')}</button>
                </div>
                <input type="file" id="file" accept="image/*" hidden>
            </div>`;
        $('#back').onclick = () => {
            open = null;
            history.replaceState(null, '', location.pathname);
            drawThread();
            drawList();
        };
        $('#tmore') && ($('#tmore').onclick = e => groupMenu(e.currentTarget));
        const t = $('#text');
        t.addEventListener('input', () => {
            grow(t);
            sendTyping();
        });
        t.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !phone()) {
                e.preventDefault();
                send();
            } else if (e.key === 'Escape' && (replyTo || editing)) cancelReply();
            else if (e.key === 'ArrowUp' && !t.value) {
                // ↑ in an empty box edits your last message, like in Teams
                const last = [...open.msgs].reverse().find(m => m.by === me && !m.deleted && !m.system);
                if (last) (e.preventDefault(), startEdit(last));
            }
        });
        t.addEventListener('paste', e => {
            const f = [...(e.clipboardData.files || [])].find(x => x.type.startsWith('image/'));
            if (f) (e.preventDefault(), sendPicture(f));
        });
        $('#send').onclick = send;
        $('#pic').onclick = () => $('#file').click();
        $('#file').onchange = e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (f) sendPicture(f);
        };
        $('#emo').onclick = e => emojiPop(e.currentTarget, x => {
            t.setRangeText(x, t.selectionStart, t.selectionEnd, 'end');
            t.focus();
            grow(t);
        });
        drawMsgs(true);
        if (!phone()) t.focus();
    }
    const grow = t => {
        t.style.height = 'auto';
        t.style.height = `${Math.min(160, t.scrollHeight)}px`;
    };
    function msgHtml(m, prev, next) {
        const c = open.conv;
        const p = c.members.find(x => x.email === m.by) || { email: m.by, name: '', username: '' };
        if (m.system) return `<div class="ch-sys">${esc(nameOf(c, p))} ${esc(m.text)} · ${esc(when(m.at))}</div>`;
        const mine = m.by === me;
        const near = (a, b) => a && b && !a.system && !b.system && a.by === b.by && Math.abs(a.at - b.at) < 5 * 60e3 && new Date(a.at).toDateString() === new Date(b.at).toDateString();
        const first = !near(prev, m);
        const last = !near(m, next);
        const reacts = m.re ? Object.entries(m.re).map(([e, who]) => `<button class="ch-re${who.includes(me) ? ' on' : ''}" data-react="${e}" title="${esc(who.map(w => nameOf(c, c.members.find(x => x.email === w) || { email: w })).join(', '))}">${e} ${who.length}</button>`).join('') : '';
        const big = !m.deleted && !m.img && onlyEmoji(m.text);
        return `<div class="ch-m${mine ? ' mine' : ''}${first ? ' first' : ''}${last ? ' last' : ''}" data-mid="${esc(m.id)}">
            ${!mine && last && !c.direct ? avatar(p, 'sm') : !mine && !c.direct ? '<span class="ch-av-gap"></span>' : ''}
            <div class="ch-mcol">
                ${first && !mine && !c.direct ? `<span class="ch-who">${esc(nameOf(c, p))}</span>` : ''}
                <div class="ch-bub${m.deleted ? ' gone' : ''}${big ? ' big' : ''}${m.img && !m.text ? ' pic' : ''}">
                    ${m.reply ? `<span class="ch-quote"><b>${esc(nameOf(c, c.members.find(x => x.email === m.reply.by) || { email: m.reply.by }))}</b>${esc(m.reply.text)}</span>` : ''}
                    ${m.deleted ? `${ic('trash')} This message was deleted` : `${m.img ? `<img class="ch-img" alt="Picture" src="${esc(m.img)}" loading="lazy">` : ''}${m.text ? `<span class="ch-text">${linkify(m.text)}</span>` : ''}`}
                    <span class="ch-time" title="${esc(new Date(m.at).toLocaleString())}">${m.edited ? 'Edited · ' : ''}${esc(new Date(m.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</span>
                </div>
                ${reacts ? `<div class="ch-res">${reacts}</div>` : ''}
            </div>
            ${m.deleted ? '' : `<div class="ch-acts">${REACTIONS.slice(0, 3).map(e => `<button data-react="${e}" aria-label="React ${e}">${e}</button>`).join('')}<button data-act="more" aria-label="More">${ic('more')}</button></div>`}
        </div>`;
    }
    function drawMsgs(toEnd) {
        const box = $('#msgs');
        if (!box) return;
        const stick = toEnd || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        const ms = open.msgs;
        let html = open.more ? '<button class="btn btn-ghost ch-older" id="older">Show older messages</button>' : '';
        let day = '';
        ms.forEach((m, i) => {
            const d = new Date(m.at).toDateString();
            if (d !== day) {
                day = d;
                html += `<div class="ch-day"><span>${esc(dayLabel(m.at))}</span></div>`;
            }
            html += msgHtml(m, ms[i - 1], ms[i + 1]);
        });
        if (!ms.length) html += `<div class="ch-start">${convAvatar(open.conv)}<b>${esc(title(open.conv))}</b><p>This is the start of your chat. Say hi!</p></div>`;
        // who has read your last message
        const lastMine = [...ms].reverse().find(m => m.by === me && !m.system);
        if (lastMine && open.conv.direct) {
            const o = others(open.conv)[0];
            if (o && (open.read[o.email] || 0) >= lastMine.at) html += '<div class="ch-seen">Seen</div>';
        }
        const t = typing.get(open.conv.id);
        if (t && t.until > Date.now()) html += `<div class="ch-typing"><span></span><span></span><span></span> ${esc(t.name)} is typing…</div>`;
        const old = box.scrollHeight - box.scrollTop;
        box.innerHTML = html;
        if (stick) box.scrollTop = box.scrollHeight;
        else box.scrollTop = box.scrollHeight - old;
        $('#older') && ($('#older').onclick = loadOlder);
        // pictures arrive after the text: stay at the newest message while they load
        box.onscroll = () => (box.dataset.bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60 ? '1' : '');
        if (stick) box.dataset.bottom = '1';
        $$('img.ch-img', box).forEach(img => !img.complete && img.addEventListener('load', () => box.dataset.bottom && (box.scrollTop = box.scrollHeight), { once: true }));
    }
    async function loadOlder() {
        const r = await call(`/api/chat/${open.conv.id}?before=${open.msgs[0].at}`);
        open.msgs = [...r.msgs, ...open.msgs];
        open.more = r.more;
        const box = $('#msgs');
        const old = box.scrollHeight - box.scrollTop;
        drawMsgs(false);
        box.scrollTop = box.scrollHeight - old;
    }
    async function select(cid) {
        try {
            const r = await call(`/api/chat/${cid}`);
            open = { conv: r.conv, msgs: r.msgs, more: r.more, read: r.read };
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        replyTo = editing = null;
        history.replaceState(null, '', `${location.pathname}#${cid}`);
        drawThread();
        markRead();
    }
    async function markRead() {
        if (!open || document.visibilityState !== 'visible') return;
        const c = convs.find(x => x.id === open.conv.id);
        if (c && !c.unread) return;
        if (c) c.unread = 0;
        drawList();
        call(`/api/chat/${open.conv.id}/read`, { method: 'POST', body: {} }).catch(() => {});
    }

    /* ---------- sending ---------- */
    async function send() {
        const t = $('#text');
        const text = t.value.trim();
        if (!text) return;
        if (editing) {
            const m = editing;
            cancelReply();
            t.value = '';
            grow(t);
            try {
                const r = await call(`/api/chat/${open.conv.id}/m/${m.id}`, { method: 'PATCH', body: { text } });
                Object.assign(m, r);
                drawMsgs();
            } catch (e) {
                toast(e.message, { bad: true });
            }
            return;
        }
        const reply = replyTo && replyTo.id;
        lastTyping = 0; // the next message's typing shows again straight away
        t.value = '';
        grow(t);
        cancelReply();
        await post({ text, reply });
    }
    async function post(body) {
        try {
            const m = await call(`/api/chat/${open.conv.id}`, { method: 'POST', body });
            take(open.conv.id, m);
        } catch (e) {
            toast(e.message, { bad: true });
            if (body.text) $('#text').value = body.text;
        }
    }
    function sendPicture(file) {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * scale);
            cv.height = Math.round(img.height * scale);
            const g = cv.getContext('2d');
            g.fillStyle = '#fff';
            g.fillRect(0, 0, cv.width, cv.height);
            g.drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(img.src);
            const text = $('#text').value.trim();
            $('#text').value = '';
            post({ img: cv.toDataURL('image/jpeg', 0.84), text });
        };
        img.onerror = () => toast('That picture couldn’t be read', { bad: true });
        img.src = URL.createObjectURL(file);
    }
    let lastTyping = 0;
    function sendTyping() {
        if (!open || Date.now() - lastTyping < 3000 || !$('#text').value.trim()) return;
        lastTyping = Date.now();
        call(`/api/chat/${open.conv.id}/typing`, { method: 'POST', body: {} }).catch(() => {});
    }
    function startReply(m) {
        editing = null;
        replyTo = m;
        const c = open.conv;
        const r = $('#replying');
        r.hidden = false;
        r.innerHTML = `${ic('reply')}<div><b>Replying to ${esc(nameOf(c, c.members.find(x => x.email === m.by) || { email: m.by }))}</b><span>${esc(m.text || '📷 Picture')}</span></div><button class="icon-btn" id="noreply" aria-label="Cancel">${ic('x')}</button>`;
        $('#noreply').onclick = cancelReply;
        $('#text').focus();
    }
    function startEdit(m) {
        replyTo = null;
        editing = m;
        const r = $('#replying');
        r.hidden = false;
        r.innerHTML = `${ic('pen')}<div><b>Editing your message</b><span>Enter saves, Esc cancels</span></div><button class="icon-btn" id="noreply" aria-label="Cancel">${ic('x')}</button>`;
        $('#noreply').onclick = () => {
            cancelReply();
            $('#text').value = '';
        };
        const t = $('#text');
        t.value = m.text;
        grow(t);
        t.focus();
    }
    function cancelReply() {
        replyTo = editing = null;
        const r = $('#replying');
        if (r) r.hidden = true;
    }

    /* ---------- clicks in the conversation ---------- */
    root.addEventListener('click', async e => {
        const conv = e.target.closest('.ch-conv');
        if (conv) return select(conv.dataset.cid);
        const img = e.target.closest('.ch-img');
        if (img) return viewer(img.src);
        const row = e.target.closest('.ch-m');
        if (!row || !open) return;
        const m = open.msgs.find(x => x.id === row.dataset.mid);
        if (!m) return;
        const re = e.target.closest('[data-react]');
        if (re) return react(m, re.dataset.react);
        if (e.target.closest('[data-act="more"]')) msgMenu(e.target.closest('[data-act="more"]'), m);
    });
    // right-click on a computer, a long press on a phone: the message's menu
    root.addEventListener('contextmenu', e => {
        const row = e.target.closest('.ch-m');
        if (!row || !open || e.target.closest('a')) return;
        const m = open.msgs.find(x => x.id === row.dataset.mid);
        if (!m || m.deleted) return;
        e.preventDefault();
        msgMenu(row.querySelector('.ch-bub'), m);
    });
    async function react(m, emoji) {
        try {
            const r = await call(`/api/chat/${open.conv.id}/m/${m.id}`, { method: 'PATCH', body: { react: emoji } });
            delete m.re;
            Object.assign(m, r);
            drawMsgs();
        } catch (err) {
            toast(err.message, { bad: true });
        }
    }
    function msgMenu(anchor, m) {
        const items = [
            ['reply', 'Reply', () => startReply(m)],
            ...(m.text ? [['copy', 'Copy text', () => navigator.clipboard.writeText(m.text).then(() => toast('Copied'))]] : []),
            ...(m.by === me && m.text ? [['pen', 'Edit', () => startEdit(m)]] : []),
            ...(m.by === me ? [['trash', 'Delete', async () => {
                if (!(await ask({ title: 'Delete this message?', text: 'It’s removed for everyone in the chat.', ok: 'Delete', danger: true }))) return;
                Object.assign(m, await call(`/api/chat/${open.conv.id}/m/${m.id}`, { method: 'DELETE' }));
                delete m.img;
                delete m.re;
                drawMsgs();
            }, true]] : [])
        ];
        menu(anchor, items, `<div class="ch-reacts">${REACTIONS.map(r => `<button data-r="${r}" aria-label="React ${r}">${r}</button>`).join('')}</div>`, r => react(m, r));
    }
    function menu(anchor, items, top = '', onTop = null) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.innerHTML = top + items.map(([icon, label, , danger], i) => `<button data-i="${i}" class="${danger ? 'danger' : ''}">${ic(icon)}<span>${esc(label)}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(r.bottom + 4, innerHeight - pop.offsetHeight - 8)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
        const off = ev => !pop.contains(ev.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', ev => {
            const t = ev.target.closest('[data-r]');
            if (t && onTop) return (pop.remove(), onTop(t.dataset.r));
            const b = ev.target.closest('[data-i]');
            if (!b) return;
            pop.remove();
            items[+b.dataset.i][2]();
        });
    }
    // a line of text, asked in the page
    function promptText(heading, text, value) {
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'pf-crop-back';
            back.innerHTML = `<div class="pf-crop ch-pick" role="dialog" aria-modal="true"><h2>${esc(heading)}</h2><p class="ad-muted">${esc(text)}</p><input class="input" maxlength="80" value="${esc(value)}"><div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>Save</button></div></div>`;
            document.body.append(back);
            const done = v => (back.remove(), resolve(v));
            $('[data-x]', back).onclick = () => done(null);
            $('[data-ok]', back).onclick = () => done($('input', back).value.trim());
            $('input', back).onkeydown = e => (e.key === 'Enter' ? done($('input', back).value.trim()) : e.key === 'Escape' ? done(null) : 0);
            $('input', back).select();
        });
    }
    function emojiPop(anchor, pick) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop ch-emoji';
        pop.innerHTML = EMOJI.map(x => `<button data-e="${x}">${x}</button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.max(8, r.top - pop.offsetHeight - 6)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left))}px`;
        const off = ev => !pop.contains(ev.target) && ev.target !== anchor && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('mousedown', ev => ev.preventDefault());
        pop.addEventListener('click', ev => ev.target.dataset.e && pick(ev.target.dataset.e));
    }
    function viewer(src) {
        const v = document.createElement('div');
        v.className = 'ch-viewer';
        v.innerHTML = `<img alt="" src="${esc(src)}"><a class="btn" href="${esc(src)}" download>${ic('download')}<span>Download</span></a>`;
        v.onclick = e => !e.target.closest('a') && v.remove();
        addEventListener('keydown', function esc_(e) {
            if (e.key === 'Escape') (v.remove(), removeEventListener('keydown', esc_));
        });
        document.body.append(v);
    }

    /* ---------- new chats and groups ---------- */
    async function peoplePicker({ heading, okLabel, exclude = [], allowName }) {
        const people = (await call('/api/chat/people')).filter(p => !exclude.includes(p.email));
        return new Promise(resolve => {
            const picked = new Set();
            const back = document.createElement('div');
            back.className = 'pf-crop-back';
            back.innerHTML = `<div class="pf-crop ch-pick" role="dialog" aria-modal="true"><h2>${esc(heading)}</h2>
                <input class="input" id="pq" placeholder="Search people" autocomplete="off">
                <div class="ch-plist" id="plist"></div>
                ${allowName ? '<input class="input" id="gname" placeholder="Group name (optional)" maxlength="80" hidden>' : ''}
                <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok disabled>${esc(okLabel)}</button></div></div>`;
            document.body.append(back);
            const draw = () => {
                const q = $('#pq', back).value.trim().toLowerCase();
                const list = people.filter(p => !q || `${p.name} ${p.username}`.toLowerCase().includes(q));
                $('#plist', back).innerHTML = list.length
                    ? list.map(p => `<label class="ch-prow"><input type="checkbox" value="${esc(p.email)}"${picked.has(p.email) ? ' checked' : ''}>${avatar(p)}<span><b>${esc(p.name || '@' + p.username)}</b><small>@${esc(p.username)}</small></span></label>`).join('')
                    : `<p class="ad-muted">${people.length ? 'Nobody matches.' : 'Nobody else is on EderveenGroup yet.'}</p>`;
            };
            draw();
            const done = v => {
                back.remove();
                resolve(v);
            };
            $('#pq', back).oninput = draw;
            $('#plist', back).onchange = e => {
                e.target.checked ? picked.add(e.target.value) : picked.delete(e.target.value);
                $('[data-ok]', back).disabled = !picked.size;
                if ($('#gname', back)) $('#gname', back).hidden = picked.size < 2;
            };
            $('[data-x]', back).onclick = () => done(null);
            $('[data-ok]', back).onclick = () => done({ with: [...picked], name: $('#gname', back) ? $('#gname', back).value.trim() : '' });
            back.addEventListener('click', e => e.target === back && done(null));
            back.addEventListener('keydown', e => e.key === 'Escape' && done(null));
            $('#pq', back).focus();
        });
    }
    async function newChat() {
        const r = await peoplePicker({ heading: 'New chat', okLabel: 'Chat', allowName: true });
        if (!r) return;
        try {
            const c = await call('/api/chat', { method: 'POST', body: r });
            if (!convs.some(x => x.id === c.id)) convs.unshift(c);
            select(c.id);
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    function groupMenu(anchor) {
        const c = open.conv;
        menu(anchor, [
            ['user', 'Add people', async () => {
                const r = await peoplePicker({ heading: 'Add people', okLabel: 'Add', exclude: c.members.map(p => p.email) });
                if (r) await call(`/api/chat/${c.id}`, { method: 'PATCH', body: { add: r.with } }).catch(e => toast(e.message, { bad: true }));
            }],
            ['pen', 'Name the group', async () => {
                const name = await promptText('Group name', 'Everyone in the chat sees it.', c.name || '');
                if (name !== null) await call(`/api/chat/${c.id}`, { method: 'PATCH', body: { name } }).catch(e => toast(e.message, { bad: true }));
            }],
            ['logout', 'Leave the group', async () => {
                if (!(await ask({ title: 'Leave this group?', text: 'You won’t get its messages any more.', ok: 'Leave', danger: true }))) return;
                await call(`/api/chat/${c.id}/leave`, { method: 'POST', body: {} });
                convs = convs.filter(x => x.id !== c.id);
                open = null;
                layout();
            }, true]
        ]);
    }

    /* ---------- live ---------- */
    function take(cid, m) {
        const c = convs.find(x => x.id === cid);
        if (c) {
            c.last = { by: m.by, text: m.system ? `${(c.members.find(p => p.email === m.by) || {}).name || ''} ${m.text}` : m.text || (m.img ? '📷 Picture' : ''), at: m.at };
            c.lastAt = m.at;
            convs.sort((a, b) => b.lastAt - a.lastAt);
        }
        typing.delete(cid);
        if (open && open.conv.id === cid) {
            if (!open.msgs.some(x => x.id === m.id)) open.msgs.push(m);
            drawMsgs(m.by === me);
            if (m.by !== me) {
                if (document.visibilityState === 'visible') markRead();
                else if (c) c.unread++;
            }
        } else if (c && m.by !== me) c.unread++;
        drawList();
    }
    function connect() {
        if (stream) stream.close();
        stream = new EventSource('/api/chat/stream');
        stream.addEventListener('msg', e => {
            const { cid, msg } = JSON.parse(e.data);
            if (!convs.some(c => c.id === cid)) return refresh();
            take(cid, msg);
            if (msg.by !== me && document.visibilityState !== 'visible' && window.Notification && Notification.permission === 'granted') {
                const c = convs.find(x => x.id === cid);
                const p = c && c.members.find(x => x.email === msg.by);
                new Notification(p ? p.name || `@${p.username}` : 'New message', { body: msg.text || '📷 Picture', tag: cid });
            }
        });
        stream.addEventListener('edit', e => {
            const { cid, msg } = JSON.parse(e.data);
            if (!open || open.conv.id !== cid) return;
            const m = open.msgs.find(x => x.id === msg.id);
            if (m) {
                for (const k of ['img', 're', 'reply']) delete m[k];
                Object.assign(m, msg);
                drawMsgs();
            }
        });
        stream.addEventListener('typing', e => {
            const { cid, name } = JSON.parse(e.data);
            typing.set(cid, { name: name.split(' ')[0], until: Date.now() + 4500 });
            drawList();
            if (open && open.conv.id === cid) drawMsgs();
            setTimeout(() => {
                drawList();
                if (open && open.conv.id === cid) drawMsgs();
            }, 4700);
        });
        stream.addEventListener('read', e => {
            const { cid, by, at } = JSON.parse(e.data);
            if (open && open.conv.id === cid && by !== me) {
                open.read[by] = at;
                drawMsgs();
            }
        });
        stream.addEventListener('conv', () => refresh());
        // the connection drops (sleep, network): pick up what was missed
        stream.onerror = () => {
            stream.close();
            setTimeout(() => (connect(), refresh()), 5000);
        };
    }
    async function refresh() {
        convs = await call('/api/chat');
        if (open) {
            const c = convs.find(x => x.id === open.conv.id);
            if (!c) {
                open = null;
                return layout();
            }
            const r = await call(`/api/chat/${open.conv.id}`);
            open.conv = r.conv;
            open.msgs = r.msgs;
            open.more = r.more;
            open.read = r.read;
            const sub = $('#tsub');
            if (sub && !open.conv.direct) sub.textContent = `${open.conv.members.length} people`;
            drawMsgs();
            markRead();
        }
        drawList();
    }
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && markRead());

    Promise.all([call('/api/chat'), call('/api/profile')])
        .then(([list, prof]) => {
            convs = list;
            me = prof.account;
            layout();
            connect();
            const want = location.hash.slice(1);
            if (want && convs.some(c => c.id === want)) select(want);
            else if (!phone() && convs.length && want !== 'list') select(convs[0].id);
            // ask once, kindly, to show new messages while Chat is in the background
            if (window.Notification && Notification.permission === 'default' && !localStorage.getItem('eg-chat-asked')) {
                setTimeout(() => {
                    toast('Want a notice for new messages while Chat is open in the background?', { action: 'Turn on', onAction: () => Notification.requestPermission() });
                    try {
                        localStorage.setItem('eg-chat-asked', '1');
                    } catch {
                        // private mode
                    }
                }, 2500);
            }
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your chats</h1><p>${esc(e.message)}</p></div>`));
})();
