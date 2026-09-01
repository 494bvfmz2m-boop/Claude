const S={csrf:'',email:'',folder:'INBOX',page:1,total:0,perPage:20,openUid:null,allMessages:[],renameTarget:null,identity:{name:'',signature:'',avatar:''}};

async function api(action,qs=''){
  const res=await fetch('api.php?action='+action+(qs?'&'+qs:''),{credentials:'same-origin',headers:{'X-CSRF-Token':S.csrf}});
  const j=await res.json().catch(()=>({ok:false,error:'Server error'}));
  if(!j.ok)throw new Error(j.error||'Unknown error');
  return j.data;
}
async function apiPost(action,params={}){
  const fd=new FormData();
  for(const[k,v]of Object.entries(params))fd.append(k,v);
  const res=await fetch('api.php?action='+action,{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':S.csrf},body:fd});
  const j=await res.json().catch(()=>({ok:false,error:'Server error'}));
  if(!j.ok)throw new Error(j.error||'Unknown error');
  return j.data;
}

let toastT;
function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className=type;
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.add('hidden'),3200);
}

function showSendProgress(){
  const el=document.getElementById('send-progress');el.classList.add('show');
  const bar=document.getElementById('sp-bar');bar.style.width='0%';
  let w=0;const iv=setInterval(()=>{w=Math.min(w+Math.random()*18,88);bar.style.width=w+'%';},220);
  return{done(){clearInterval(iv);bar.style.width='100%';setTimeout(()=>{el.classList.remove('show');bar.style.width='0%';},700);}};
}

// ── INIT ──────────────────────────────────────────────────────────────────
(async()=>{
  try{
    const d=await api('csrf');S.csrf=d.token;
    const me=await api('me');onLoggedIn(me.email);
  }catch{}
})();

document.getElementById('login-btn').addEventListener('click',doLogin);
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const errEl=document.getElementById('login-error');
  errEl.textContent='';
  if(!email&&!pass){errEl.textContent='Please enter your email and password.';return;}
  if(!email){errEl.textContent='Please enter your email address.';return;}
  if(!pass){errEl.textContent='Please enter your password.';return;}
  const btn=document.getElementById('login-btn');
  btn.disabled=true;
  document.getElementById('login-label').textContent='Signing in...';
  document.getElementById('login-spinner').style.display='block';
  try{
    const fd=new FormData();fd.append('email',email);fd.append('pass',pass);
    const res=await fetch('api.php?action=login',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':S.csrf},body:fd});
    const j=await res.json();
    if(!j.ok){
      let msg=j.error||'Something went wrong.';
      if(msg.includes('Invalid email or password'))msg='Incorrect password. Please try again.';
      else if(msg.includes('domain is not allowed'))msg='This email domain is not authorized.';
      else if(msg.includes('connect'))msg='Could not reach the mail server. Try again shortly.';
      else if(msg.includes('Too many'))msg='Too many attempts. Wait a minute and try again.';
      throw new Error(msg);
    }
    S.csrf=j.data.csrf;onLoggedIn(j.data.email);
  }catch(e){
    errEl.textContent=e.message;
    const passField=document.getElementById('login-pass');
    passField.style.borderColor='var(--danger)';
    passField.style.boxShadow='0 0 0 3px rgba(224,92,92,.15)';
    setTimeout(()=>{passField.style.borderColor='';passField.style.boxShadow='';},2500);
  }finally{
    btn.disabled=false;
    document.getElementById('login-label').textContent='Sign in to mailbox';
    document.getElementById('login-spinner').style.display='none';
  }
}

function onLoggedIn(email){
  S.email=email;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').classList.add('active');
  document.getElementById('user-email-label').textContent=email;
  refreshAllAvatars();
  loadFolders();
  loadMessages();
  loadIdentity();
}

// ── AVATAR ────────────────────────────────────────────────────────────────
function renderAvatarInto(el,letter){
  if(S.identity.avatar)el.innerHTML='<img src="'+S.identity.avatar+'" alt=""/>';
  else el.textContent=letter;
}
function refreshAllAvatars(){
  const letter=(S.email[0]||'?').toUpperCase();
  renderAvatarInto(document.getElementById('user-avatar'),letter);
  renderAvatarInto(document.getElementById('identity-avatar-lg'),letter);
  renderAvatarInto(document.getElementById('preview-avatar'),letter);
}

function resizeImageToDataUrl(file,size){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read that file.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Could not read that image.'));
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        canvas.width=size;canvas.height=size;
        const ctx=canvas.getContext('2d');
        const scale=Math.max(size/img.width,size/img.height);
        const w=img.width*scale,h=img.height*scale;
        ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
        resolve(canvas.toDataURL('image/jpeg',0.85));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('avatar-upload-btn').addEventListener('click',()=>document.getElementById('avatar-file-input').click());

document.getElementById('avatar-file-input').addEventListener('change',async e=>{
  const file=e.target.files[0];
  e.target.value='';
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('Please choose a PNG, JPG, or WEBP image.','error');return;}
  if(file.size>5*1024*1024){toast('Image is too large (max 5MB).','error');return;}
  try{
    const dataUrl=await resizeImageToDataUrl(file,256);
    await apiPost('save_avatar',{avatar:dataUrl});
    S.identity.avatar=dataUrl;
    refreshAllAvatars();
    document.getElementById('avatar-remove-btn').style.display='';
    toast('Profile picture updated');
  }catch(err){toast(err.message||'Could not update photo.','error');}
});

document.getElementById('avatar-remove-btn').addEventListener('click',async()=>{
  try{
    await apiPost('remove_avatar');
    S.identity.avatar='';
    refreshAllAvatars();
    document.getElementById('avatar-remove-btn').style.display='none';
    toast('Profile picture removed');
  }catch(err){toast(err.message,'error');}
});

document.getElementById('logout-btn').addEventListener('click',async()=>{try{await apiPost('logout');}catch{}location.reload();});

// ── IDENTITY ──────────────────────────────────────────────────────────────
async function loadIdentity(){
  try{
    const d=await api('get_identity');
    S.identity=d;
    document.getElementById('identity-name').value=d.name||'';
    document.getElementById('identity-signature').value=d.signature||'';
    document.getElementById('avatar-remove-btn').style.display=d.avatar?'':'none';
    refreshAllAvatars();
    updateIdentityPreview();
  }catch{}
}

function updateIdentityPreview(){
  const name=document.getElementById('identity-name').value.trim();
  const sig=document.getElementById('identity-signature').value.trim();
  const fromStr=name?name+' <'+S.email+'>':S.email;
  document.getElementById('preview-from-text').textContent=fromStr;
  const sigEl=document.getElementById('preview-sig');
  if(sig){sigEl.textContent=sig;sigEl.style.display='';}
  else{sigEl.style.display='none';}
}

document.getElementById('identity-name').addEventListener('input',updateIdentityPreview);
document.getElementById('identity-signature').addEventListener('input',updateIdentityPreview);

document.getElementById('save-identity-btn').addEventListener('click',async()=>{
  const name=document.getElementById('identity-name').value.trim();
  const signature=document.getElementById('identity-signature').value.trim();
  try{
    await apiPost('save_identity',{name,signature});
    S.identity={name,signature};
    const msg=document.getElementById('identity-saved-msg');
    msg.textContent='Saved!';msg.style.opacity='1';
    setTimeout(()=>msg.style.opacity='0',2500);
  }catch(e){toast(e.message,'error');}
});

// Identity nav
document.getElementById('identity-nav-btn').addEventListener('click',()=>{
  document.getElementById('message-view').style.display='none';
  document.getElementById('identity-view').style.display='block';
  document.querySelectorAll('.sidebar-nav-item').forEach(el=>el.classList.toggle('active',el.id==='identity-nav-btn'));
  document.querySelectorAll('.folder-item').forEach(el=>el.classList.remove('active'));
});

function showMailView(){
  document.getElementById('message-view').style.display='';
  document.getElementById('identity-view').style.display='none';
  document.getElementById('identity-nav-btn').classList.remove('active');
}

// ── FOLDERS ───────────────────────────────────────────────────────────────
const FICONS={
  'INBOX':'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.76 4H7.24a2 2 0 00-1.74 1.1z"/>',
  'INBOX.Sent':'<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  'Sent':'<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  'INBOX.Drafts':'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  'Drafts':'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  'INBOX.Trash':'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
  'Trash':'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
  'INBOX.spam':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'INBOX.Junk':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'Spam':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'Junk':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
};
const SYS=['INBOX','Sent','Drafts','Trash','Spam','Junk','INBOX.Sent','INBOX.Drafts','INBOX.Trash','INBOX.spam','INBOX.Junk','INBOX.Archive'];
const FORD=['INBOX','INBOX.Sent','Sent','INBOX.Drafts','Drafts','INBOX.Archive','INBOX.Trash','Trash','INBOX.spam','INBOX.Junk','Spam','Junk'];

async function loadFolders(){
  const list=document.getElementById('folder-list');
  try{
    const folders=await api('folders');
    list.innerHTML='';
    const sorted=[...folders].sort((a,b)=>{const ai=FORD.indexOf(a),bi=FORD.indexOf(b);if(ai===-1&&bi===-1)return a.localeCompare(b);if(ai===-1)return 1;if(bi===-1)return -1;return ai-bi;});
    for(const f of sorted){
      const icon=FICONS[f]||'<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>';
      const isSys=SYS.includes(f);
      const label=f.startsWith('INBOX.')?f.replace('INBOX.',''):f;
      const div=document.createElement('div');
      div.className='folder-item'+(f===S.folder?' active':'');
      div.dataset.folder=f;
      div.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'+icon+'</svg>'
        +'<span class="folder-name">'+esc(label)+'</span>'
        +'<span class="folder-actions">'
        +(!isSys?'<button class="folder-action-btn rename-btn" data-folder="'+esc(f)+'" title="Rename">&#9998;</button>':'')
        +'</span>';
      div.addEventListener('click',e=>{if(e.target.closest('.folder-action-btn'))return;showMailView();selectFolder(f);});
      list.appendChild(div);
    }
    list.querySelectorAll('.rename-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();openRenameModal(btn.dataset.folder);});
    });
  }catch(e){list.innerHTML='<div class="loading-row" style="color:var(--danger)">'+esc(e.message)+'</div>';}
}

function selectFolder(folder){
  S.folder=folder;S.page=1;S.openUid=null;
  document.querySelectorAll('.folder-item').forEach(el=>el.classList.toggle('active',el.dataset.folder===folder));
  const label=folder.startsWith('INBOX.')?folder.replace('INBOX.',''):folder;
  document.getElementById('pane-folder-title').textContent=label;
  document.getElementById('empty-state').style.display='';
  document.getElementById('msg-view-inner').style.display='none';
  document.getElementById('search-box').value='';
  loadMessages();
}

document.getElementById('new-folder-btn').addEventListener('click',async()=>{
  const name=document.getElementById('new-folder-input').value.trim();
  if(!name)return;
  try{await apiPost('create_folder',{name});document.getElementById('new-folder-input').value='';toast('Folder created');loadFolders();}
  catch(e){toast(e.message,'error');}
});
document.getElementById('new-folder-input').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('new-folder-btn').click();});

function openRenameModal(name){
  S.renameTarget=name;
  document.getElementById('rename-input').value=name;
  document.getElementById('rename-modal').classList.add('open');
  setTimeout(()=>{document.getElementById('rename-input').focus();document.getElementById('rename-input').select();},50);
}
document.getElementById('rename-cancel').addEventListener('click',()=>document.getElementById('rename-modal').classList.remove('open'));
document.getElementById('rename-input').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('rename-confirm').click();if(e.key==='Escape')document.getElementById('rename-cancel').click();});
document.getElementById('rename-confirm').addEventListener('click',async()=>{
  const newName=document.getElementById('rename-input').value.trim();
  if(!newName||newName===S.renameTarget){document.getElementById('rename-modal').classList.remove('open');return;}
  try{
    await apiPost('rename_folder',{old_name:S.renameTarget,new_name:newName});
    document.getElementById('rename-modal').classList.remove('open');
    toast('Folder renamed');
    if(S.folder===S.renameTarget)S.folder=newName;
    loadFolders();
  }catch(e){toast(e.message,'error');}
});

// ── MESSAGES ──────────────────────────────────────────────────────────────
async function loadMessages(){
  const list=document.getElementById('message-list');
  list.innerHTML='<div class="loading-row"><div class="spinner"></div> Loading...</div>';
  document.getElementById('pagination').innerHTML='';
  try{
    const data=await api('messages','folder='+encodeURIComponent(S.folder)+'&page='+S.page);
    S.total=data.total;S.allMessages=data.messages;
    document.getElementById('pane-msg-count').textContent=data.total||'';
    renderMessages(data.messages);renderPagination();
  }catch(e){list.innerHTML='<div class="loading-row" style="color:var(--danger)">'+esc(e.message)+'</div>';}
}

function renderMessages(msgs){
  const list=document.getElementById('message-list');
  if(!msgs.length){list.innerHTML='<div class="loading-row" style="opacity:.4;font-size:.8rem">No messages</div>';return;}
  list.innerHTML='';
  for(const m of msgs){
    const div=document.createElement('div');
    div.className='message-row'+(!m.seen?' unread':'')+(m.uid===S.openUid?' active':'');
    div.dataset.uid=m.uid;
    div.innerHTML=(!m.seen?'<div class="unread-dot"></div>':'')
      +'<div class="msg-top"><span class="msg-from">'+esc(shortFrom(m.from))+'</span><span class="msg-date">'+fmtDate(m.date)+'</span></div>'
      +'<div class="msg-subject">'+esc(m.subject)+(m.flagged?' *':'')+'</div>';
    div.addEventListener('click',()=>openMessage(m.uid));
    list.appendChild(div);
  }
}

function renderPagination(){
  const pages=Math.ceil(S.total/S.perPage);if(pages<=1)return;
  const pg=document.getElementById('pagination');pg.innerHTML='';
  if(S.page>1){const b=mkBtn('Prev','btn-ghost btn-sm',()=>{S.page--;loadMessages();});pg.appendChild(b);}
  const info=document.createElement('span');info.style.cssText='color:var(--muted);font-size:.75rem';info.textContent=S.page+'/'+pages;pg.appendChild(info);
  if(S.page<pages){const b=mkBtn('Next','btn-ghost btn-sm',()=>{S.page++;loadMessages();});pg.appendChild(b);}
}
function mkBtn(t,c,fn){const b=document.createElement('button');b.className='btn '+c;b.textContent=t;b.onclick=fn;return b;}

document.getElementById('search-box').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q){renderMessages(S.allMessages);return;}
  renderMessages(S.allMessages.filter(m=>m.subject.toLowerCase().includes(q)||m.from.toLowerCase().includes(q)));
});

async function openMessage(uid){
  S.openUid=uid;
  document.querySelectorAll('.message-row').forEach(el=>el.classList.toggle('active',parseInt(el.dataset.uid)===uid));
  document.getElementById('empty-state').style.display='none';
  document.getElementById('msg-view-inner').style.display='flex';
  const content=document.getElementById('message-content');
  content.innerHTML='<div class="loading-row"><div class="spinner"></div> Loading...</div>';
  try{
    const msg=await api('message','uid='+uid+'&folder='+encodeURIComponent(S.folder));
    content.innerHTML='<div class="msg-subject-line">'+esc(msg.subject)+'</div>'
      +'<div class="msg-meta">'
      +'<div class="msg-meta-row"><span class="msg-meta-label">From</span><span class="msg-meta-value">'+esc(msg.from)+'</span></div>'
      +'<div class="msg-meta-row"><span class="msg-meta-label">To</span><span class="msg-meta-value">'+esc(msg.to)+'</span></div>'
      +(msg.cc?'<div class="msg-meta-row"><span class="msg-meta-label">Cc</span><span class="msg-meta-value">'+esc(msg.cc)+'</span></div>':'')
      +'<div class="msg-meta-row"><span class="msg-meta-label">Date</span><span class="msg-meta-value">'+esc(msg.date)+'</span></div>'
      +'</div>'
      +'<hr class="divider"/>'
      +'<div class="msg-body">'+sanitize(msg.body)+'</div>';
    const m=S.allMessages.find(x=>x.uid===uid);
    if(m)m.seen=true;
    document.querySelectorAll('.message-row[data-uid="'+uid+'"]').forEach(el=>{el.classList.remove('unread');el.querySelector('.unread-dot')?.remove();});
    document.getElementById('delete-btn').onclick=()=>deleteMsg(uid);
    document.getElementById('flag-btn').onclick=()=>flagMsg(uid,'flagged');
    document.getElementById('mark-read-btn').onclick=()=>flagMsg(uid,'seen');
    document.getElementById('reply-btn').onclick=()=>openReply(msg);
  }catch(e){
    content.innerHTML='<div class="loading-row" style="color:var(--danger);flex-direction:column;gap:8px"><span>Failed to load message</span><small style="color:var(--muted)">'+esc(e.message)+'</small></div>';
  }
}

async function deleteMsg(uid){
  if(!confirm('Delete this message?'))return;
  try{
    await apiPost('delete',{uid,folder:S.folder});
    toast('Message deleted');S.openUid=null;
    document.getElementById('empty-state').style.display='';
    document.getElementById('msg-view-inner').style.display='none';
    loadMessages();
  }catch(e){toast(e.message,'error');}
}

async function flagMsg(uid,flag){
  try{await apiPost('flag',{uid,flag,folder:S.folder});toast('Updated');loadMessages();}
  catch(e){toast(e.message,'error');}
}

// ── COMPOSE ───────────────────────────────────────────────────────────────
document.getElementById('compose-btn').addEventListener('click',()=>openCompose());
document.getElementById('compose-close').addEventListener('click',closeCompose);
document.getElementById('compose-discard').addEventListener('click',closeCompose);
document.getElementById('compose-modal').addEventListener('click',e=>{if(e.target===document.getElementById('compose-modal'))closeCompose();});

function openCompose(d={}){
  document.getElementById('compose-to').value=d.to||'';
  document.getElementById('compose-cc').value=d.cc||'';
  document.getElementById('compose-subject').value=d.subject||'';
  // Add signature if not a reply with existing body
  let body=d.body||'';
  if(!d.body&&S.identity.signature){
    body='\n\n-- \n'+S.identity.signature;
  }
  document.getElementById('compose-body').value=body;
  document.getElementById('compose-title').textContent=d.title||'New message';
  document.getElementById('compose-error').textContent='';
  document.getElementById('compose-modal').classList.add('open');
  const bodyEl=document.getElementById('compose-body');
  setTimeout(()=>{
    document.getElementById(d.to?'compose-subject':'compose-to').focus();
    // Place cursor at top of body
    bodyEl.setSelectionRange(0,0);
    bodyEl.scrollTop=0;
  },60);
}
function closeCompose(){document.getElementById('compose-modal').classList.remove('open');}

function openReply(msg){
  const from=msg.from.match(/<(.+)>/)?msg.from.match(/<(.+)>/)[1]:msg.from;
  const plain=msg.body.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
  let body='\n\n';
  if(S.identity.signature)body+='\n-- \n'+S.identity.signature+'\n';
  body+='\n--- Original message ---\nFrom: '+msg.from+'\nDate: '+msg.date+'\n\n'+plain;
  openCompose({title:'Reply',to:from,subject:msg.subject.startsWith('Re:')?msg.subject:'Re: '+msg.subject,body});
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeCompose();document.getElementById('rename-modal').classList.remove('open');}
});

document.getElementById('send-btn').addEventListener('click',async()=>{
  const to=document.getElementById('compose-to').value.trim();
  const cc=document.getElementById('compose-cc').value.trim();
  const subject=document.getElementById('compose-subject').value.trim();
  const body=document.getElementById('compose-body').value.trim();
  const errEl=document.getElementById('compose-error');
  errEl.textContent='';
  if(!to||!subject||!body){errEl.textContent='To, subject, and body are required.';return;}
  document.getElementById('send-btn').disabled=true;
  document.getElementById('send-label').textContent='Sending...';
  closeCompose();
  const prog=showSendProgress();
  try{
    await apiPost('send',{to,cc,subject,body});
    prog.done();toast('Message sent!');
  }catch(e){
    prog.done();
    openCompose({to,cc,subject,body,title:'New message'});
    document.getElementById('compose-error').textContent=e.message;
  }finally{
    document.getElementById('send-btn').disabled=false;
    document.getElementById('send-label').textContent='Send';
  }
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function sanitize(html){
  const d=document.createElement('div');d.innerHTML=html;
  d.querySelectorAll('script,iframe,object,embed,form,meta,base').forEach(el=>el.remove());
  d.querySelectorAll('*').forEach(el=>{
    for(const a of[...el.attributes]){
      if(a.name.startsWith('on')||(a.name==='href'&&a.value.toLowerCase().startsWith('javascript'))||(a.name==='src'&&a.value.toLowerCase().startsWith('javascript')))el.removeAttribute(a.name);
    }
    if(el.hasAttribute('style')&&/expression|javascript|url\s*\(/i.test(el.getAttribute('style')))el.removeAttribute('style');
  });
  return d.innerHTML;
}

function shortFrom(from){const m=from.match(/^"?([^"<]+)"?\s*</);return m?m[1].trim():from.split('@')[0]||from;}

function fmtDate(s){
  try{
    const d=new Date(s),now=new Date(),diff=now-d;
    if(diff<86400000&&d.getDate()===now.getDate())return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(diff<7*86400000)return d.toLocaleDateString([],{weekday:'short'});
    if(d.getFullYear()===now.getFullYear())return d.toLocaleDateString([],{month:'short',day:'numeric'});
    return d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
  }catch{return s;}
}
