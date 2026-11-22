/* Firebase sosyal katmanı: DM/grup sohbeti, metin ve medya gönderimi. */
(function(w){
 const $=id=>document.getElementById(id), cloud=()=>w.MMCloud;
 let activeChat=null, stopMessages=null, stopChatList=null, stopNotifications=null, stopGroupCompetition=null, stopGroupA=null, stopGroupB=null, stopFriends=null, stopRequests=null, groupActiveCode='', groupTopic='Karışık', recorder=null, chunks=[], notified=new Set();
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function db(){return cloud()?.db} function uid(){return cloud()?.user?.uid} async function currentSenderName(){const p=await db().collection('users').doc(uid()).get();return String(p.data()?.displayName||cloud().user.displayName||cloud().user.email||'Kullanıcı').slice(0,80)}
 function note(s){const e=$('msgs'); if(e)e.insertAdjacentHTML('beforeend',`<p class="note">${esc(s)}</p>`)}
 async function resolveChatMediaUrl(data,chatId){
  if(data.mediaPath&&String(data.mediaPath).startsWith('chatMedia/')&&String(data.mediaPath).split('/').length===4){
   let worker=String(w.MMStorageWorkerUrl||'');while(worker.endsWith('/'))worker=worker.slice(0,-1);if(!worker)throw Error('Sohbet medya sunucusu henüz yapılandırılmadı.');
   const token=await cloud().user.getIdToken(),response=await fetch(worker+'/v1/chat-media-url',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({chatId,path:data.mediaPath,mediaType:data.mediaType})});
   const result=await response.json().catch(()=>({}));if(!response.ok||!result.url)throw Error(result.error||'Sohbet eki açılamadı.');return result.url;
  }
  return data.mediaUrl||'';
 }
 function renderMessage(d,id){
  const e=$('msgs');if(!e)return;const chatId=activeChat;
  const article=document.createElement('article');article.className='card';article.style.cssText='margin:6px 0;padding:9px';
  article.innerHTML='<b>'+esc(d.senderName||'Kullanıcı')+'</b><div>'+esc(d.text||'')+' '+(d.emoji?'<span aria-label="Kuşanılmış emoji">'+esc(d.emoji)+'</span>':'')+'</div><div class="chat-media-slot"></div><small class="note">'+(d.createdAt?.toDate?d.createdAt.toDate().toLocaleString('tr-TR'):'')+'</small>';
  e.appendChild(article);
  if(d.mediaPath||d.mediaUrl){
   resolveChatMediaUrl(d,chatId).then(url=>{
    if(!url||!article.isConnected)return;const slot=article.querySelector('.chat-media-slot'),type=String(d.mediaType||'');
    if(type.startsWith('audio/')){const el=document.createElement('audio');el.controls=true;el.src=url;slot.appendChild(el);}
    else if(type.startsWith('video/')){const el=document.createElement('video');el.controls=true;el.playsInline=true;el.src=url;el.style.maxWidth='220px';slot.appendChild(el);}
    else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';const img=document.createElement('img');img.src=url;img.alt='Sohbet eki';img.loading='lazy';img.style.cssText='max-width:180px;max-height:180px;border-radius:12px';link.appendChild(img);slot.appendChild(link);}
   }).catch(err=>{const slot=article.querySelector('.chat-media-slot');if(slot)slot.textContent='Sohbet eki erişilemiyor: '+err.message;});
  }
  if(d.senderId!==uid()&&id){const report=document.createElement('button');report.className='btn';report.textContent='🚩 Bildir';report.onclick=async()=>{const reason=prompt('Bildirim nedeni (en fazla 160 karakter):','Uygunsuz içerik');if(reason===null)return;try{await cloud().fn.httpsCallable('reportChatMessage')({chatId,messageId:id,reason});report.textContent='Bildirildi';report.disabled=true;}catch(err){alert(err.message);}};article.appendChild(report);}
  e.scrollTop=e.scrollHeight;
 }
 function watchGroupCompetition(code){
  stopGroupCompetition?.();if(!code||!db())return;
  stopGroupCompetition=db().collection('groupCompetitions').doc(code).onSnapshot(s=>{
   if(!s.exists)return;const x=s.data(),tools=$('chatTools');if(!tools)return;
   let start=tools.querySelector('#startGroupCompetition');
   if(x.status==='playing'&&!start){start=document.createElement('button');start.id='startGroupCompetition';start.className='btn';start.textContent='▶️ Grup yarışmasını başlat';start.onclick=()=>w.MMGame?.startGroupCompetition(groupTopic);tools.appendChild(start);}
   if(x.status==='playing'&&start)start.disabled=false;
   if(x.status!=='playing'&&start)start.disabled=true;
   const status=tools.querySelector('#groupCompetitionStatus');if(status)status.textContent=x.status==='playing'?'Rakip grup katıldı.': 'Rakip grup bekleniyor. Kod: '+code;
  });
 }
 function setupGroupCompetition(id){
  const tools=$('chatTools');if(!tools)return;
  db().collection('chats').doc(id).get().then(s=>{
   if(!s.exists||s.data().type!=='group')return;
   const box=document.createElement('div');box.className='card';box.id='groupCompetitionControls';
   const create=document.createElement('button');create.className='btn';create.textContent='⚔️ Grup yarışması oluştur';
   const input=document.createElement('input');input.placeholder='Rakip grubun yarışma kodu';input.maxLength=6;
   const join=document.createElement('button');join.className='btn';join.textContent='Koda katıl';
   const status=document.createElement('p');status.id='groupCompetitionStatus';status.className='note';
   create.onclick=async()=>{try{const r=await cloud().fn.httpsCallable('createGroupCompetition')({chatId:id,topic:'Karışık'});groupActiveCode=r.data.code;groupTopic=r.data.topic;status.textContent='Yarışma kodun: '+groupActiveCode+' · Rakip gruba gönder.';watchGroupCompetition(groupActiveCode);}catch(e){status.textContent=e.message;}};
   join.onclick=async()=>{try{const r=await cloud().fn.httpsCallable('joinGroupCompetition')({chatId:id,code:input.value});groupActiveCode=r.data.code;status.textContent='Katıldın. Rakip grubun diğer üyeleri bekleniyor.';watchGroupCompetition(groupActiveCode);}catch(e){status.textContent=e.message;}};
   box.append(create,input,join,status);tools.appendChild(box);const follow=(field,setter)=>db().collection('groupCompetitions').where(field,'==',id).onSnapshot(s=>{const active=s.docs.map(d=>({id:d.id,...d.data()})).find(x=>x.status==='playing');if(active){groupActiveCode=active.code;groupTopic=active.topic||'Karışık';watchGroupCompetition(active.code);}});stopGroupA?.();stopGroupB?.();stopGroupA=follow('groupA');stopGroupB=follow('groupB');
  }).catch(e=>note('Grup yarışması yüklenemedi: '+e.message));
 }
 function listenMessages(id){if(stopMessages)stopMessages();const el=$('msgs');if(el)el.innerHTML='';stopMessages=db().collection('chats').doc(id).collection('messages').orderBy('createdAt').limit(100).onSnapshot(s=>{if(el)el.innerHTML='';s.forEach(x=>renderMessage(x.data(),x.id))},e=>note('Mesajlar yüklenemedi: '+e.message));}
 function openChat(id,title){activeChat=id;stopGroupCompetition?.();$('chatTools')?.querySelector('#groupCompetitionControls')?.remove();$('chatTools')?.querySelector('#startGroupCompetition')?.remove();$('chatRoom')?.classList.remove('hide');$('chatTitle').textContent=title||'Sohbet';listenMessages(id);setupGroupCompetition(id)}
 async function createChat(group){const raw=prompt(group?'Grup üyelerinin e-posta adreslerini virgülle yaz (kendin otomatik eklenirsin):':'Sohbet edeceğin kişinin e-posta adresi:');if(!raw)return;const emails=[...new Set(raw.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))];if(!group&&emails.length!==1)throw Error('Özel sohbet için yalnızca bir e-posta adresi gir.');if(group&&emails.length>9)throw Error('Bir gruba en fazla 9 kişi davet edebilirsin.');const result=await cloud().fn.httpsCallable('findChatMembers')({emails:emails.slice(0,9)});const ids=[uid(),...(result.data.uids||[])].filter((v,i,a)=>a.indexOf(v)===i);if(ids.length<2)throw Error('Belirtilen kullanıcı bulunamadı veya kayıtlı değil.');const ref=await db().collection('chats').add({memberIds:ids,type:group?'group':'dm',title:group?'Yeni grup':'Özel sohbet',createdBy:uid(),createdAt:firebase.firestore.FieldValue.serverTimestamp()});openChat(ref.id,group?'Yeni grup':'Özel sohbet');}
 function ensureNotificationPanel(){
  let panel=$('notifPanel');if(panel)return panel;
  panel=document.createElement('aside');panel.id='notifPanel';panel.className='card hide';panel.setAttribute('aria-label','Bildirimler');panel.setAttribute('aria-hidden','true');
  panel.style.cssText='position:fixed;top:68px;right:14px;z-index:1000001;width:min(360px,calc(100vw - 28px));max-height:70vh;overflow:auto;box-shadow:0 12px 40px #0004';
  const heading=document.createElement('b');heading.textContent='🔔 Bildirimler';panel.appendChild(heading);document.body.appendChild(panel);return panel;
 }
 async function markNotificationsRead(){
  if(!db()||!uid())return;
  try{const s=await db().collection('users').doc(uid()).collection('notifications').where('read','==',false).limit(50).get(),batch=db().batch();s.docs.forEach(d=>batch.update(d.ref,{read:true}));await batch.commit();}catch(e){console.warn('Bildirim okundu işaretlenemedi:',e);}
 }
 function watchNotifications(){
  if(!db()||!uid())return;stopNotifications?.();
  const panel=ensureNotificationPanel();
  stopNotifications=db().collection('users').doc(uid()).collection('notifications').orderBy('createdAt','desc').limit(30).onSnapshot(s=>{
   panel.replaceChildren();const heading=document.createElement('b');heading.textContent='🔔 Bildirimler';panel.appendChild(heading);
   const unread=s.docs.filter(d=>!d.data().read).length,badge=$('bellBadge');if(badge){badge.textContent=String(unread);badge.classList.toggle('hide',unread===0);}
   if(s.empty){const empty=document.createElement('p');empty.textContent='Yeni bildirim yok.';panel.appendChild(empty);return;}
   s.forEach(d=>{const x=d.data(),row=document.createElement('button');row.type='button';row.className='btn';row.style.cssText='display:block;width:100%;text-align:left;margin-top:7px;white-space:normal';row.textContent=(x.type==='friend-request'?'👥 '+(x.fromName||'Yeni arkadaşlık isteği')+' sana arkadaşlık isteği gönderdi':x.type==='duel-invite'?'⚔️ Düello daveti · '+(x.code||''):x.type==='feedback-reply'?'✉️ Hako yanıtı: '+(x.message||''):x.type==='report-resolved'?'✅ '+(x.message||'Bildirimin incelendi.'):'🔔 Bildirim')+' · '+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');row.addEventListener('click',()=>{w.MatematikMacerasi?.navigate('s6');if(x.code&&$('joinCode'))$('joinCode').value=x.code;panel.classList.add('hide');panel.setAttribute('aria-hidden','true');});panel.appendChild(row);
    if(!x.read&&$('notifOn')?.checked&&'Notification'in window&&Notification.permission==='granted'&&!notified.has(d.id)){notified.add(d.id);new Notification('Matematik Macerası',{body:x.type==='friend-request'?(x.fromName||'Yeni arkadaşlık isteği')+' sana arkadaşlık isteği gönderdi.':'Yeni bildirimin var.'});}
   });
  },e=>{panel.textContent='Bildirimler yüklenemedi: '+e.message;});
 }
 function bindNotifications(){
  ensureNotificationPanel();
  let b=$('bellBtn');if(!b){const tabs=$('tabs');if(tabs&&!$('mmNotifButton')){b=document.createElement('button');b.type='button';b.id='mmNotifButton';b.className='btn';b.textContent='🔔';b.setAttribute('aria-label','Bildirimleri aç');tabs.appendChild(b);}}
  b=b||$('mmNotifButton');if(b&&!b.dataset.notifBound){b.dataset.notifBound='1';b.addEventListener('click',async()=>{const panel=ensureNotificationPanel(),open=panel.classList.contains('hide');panel.classList.toggle('hide');panel.setAttribute('aria-hidden',String(!open));if(open)await markNotificationsRead();});}
  const pref=$('notifOn');if(pref&&!pref.dataset.bound){pref.dataset.bound='1';pref.checked=localStorage.getItem('mm_notifications')==='1';pref.addEventListener('change',async()=>{localStorage.setItem('mm_notifications',pref.checked?'1':'0');if(pref.checked&&'Notification'in window&&Notification.permission==='default')await Notification.requestPermission();});}
 }
 function bindFriends(){
  const input=$('addFriend'),add=$('addFriendBtn'),list=$('friends'),requests=$('reqs');
  if(add&&!add.dataset.bound){add.dataset.bound='1';add.addEventListener('click',async()=>{
   const q=(input?.value||'').trim();if(q.length<2){alert('En az 2 karakterlik oyuncu adı veya UID gir.');return;}
   add.disabled=true;try{const r=await cloud().fn.httpsCallable('searchPlayers')({query:q});const players=(r.data.players||[]).filter(x=>x.uid!==uid());
    if(!players.length)throw Error('Oyuncu bulunamadı.');
    const chosen=players.length===1?players[0]:players.find(x=>x.displayName.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
    if(!chosen)throw Error('Birden fazla oyuncu bulundu. Daha uzun bir ad yaz.');
    await cloud().fn.httpsCallable('sendFriendRequest')({targetUid:chosen.uid});input.value='';alert(chosen.displayName+' kişisine arkadaşlık isteği gönderildi.');
   }catch(e){alert(e.message)}finally{add.disabled=false;}
  });}
  if(list){stopFriends?.();list.dataset.live='1';stopFriends=db().collection('users').doc(uid()).collection('friends').onSnapshot(async s=>{
   list.innerHTML='';const ids=s.docs.map(x=>x.id);if(!ids.length){list.textContent='Henüz arkadaşın yok.';return;}
   for(const friend of s.docs){const id=friend.id;const row=document.createElement('li');row.textContent=(friend.data()?.displayName||id.slice(0,8))+' ';const b=document.createElement('button');b.className='btn';b.textContent='Çıkar';b.onclick=async()=>{if(confirm('Arkadaşlıktan çıkarılsın mı?'))try{await cloud().fn.httpsCallable('removeFriend')({targetUid:id})}catch(e){alert(e.message)}};row.appendChild(b);list.appendChild(row);}
  },e=>{list.textContent='Arkadaşlar yüklenemedi: '+e.message;});}
  if(requests){stopRequests?.();requests.dataset.live='1';stopRequests=db().collection('friendRequests').where('to','==',uid()).where('status','==','pending').onSnapshot(s=>{
   requests.innerHTML='';s.forEach(d=>{const row=document.createElement('div');row.className='card';row.textContent='Arkadaşlık isteği · '+(d.data().fromName||d.data().from.slice(0,8))+' ';const yes=document.createElement('button');yes.className='btn';yes.textContent='Kabul et';yes.onclick=()=>cloud().fn.httpsCallable('respondFriendRequest')({requestId:d.id,accept:true}).catch(e=>alert(e.message));const no=document.createElement('button');no.className='btn';no.textContent='Reddet';no.onclick=()=>cloud().fn.httpsCallable('respondFriendRequest')({requestId:d.id,accept:false}).catch(e=>alert(e.message));row.append(yes,no);requests.appendChild(row);});
  },e=>{requests.textContent='İstekler yüklenemedi: '+e.message;});}
 }
 function watchChats(){if(stopChatList)stopChatList();stopChatList=db().collection('chats').where('memberIds','array-contains',uid()).onSnapshot(s=>{const el=$('chatList');if(!el)return;el.innerHTML='';s.forEach(d=>{const b=document.createElement('button');b.className='btn';b.textContent=(d.data().title||'Sohbet')+' · '+(d.data().type==='group'?'Grup':'Özel');b.addEventListener('click',()=>openChat(d.id,d.data().title));el.appendChild(b)})});}
 async function send(){if(!activeChat||!uid())return;const input=$('chatIn'),text=(input?.value||'').trim();if(!text)return;const emoji=w.MMEquipped?.emojis?.[0]?.emoji||'';await db().collection('chats').doc(activeChat).collection('messages').add({senderId:uid(),senderName:await currentSenderName(),text,emoji,createdAt:firebase.firestore.FieldValue.serverTimestamp(),type:'text'});input.value='';}
 async function upload(file){
  if(!file||!activeChat)return;
  if(file.size>15*1024*1024)throw Error('Dosya en fazla 15 MB olabilir.');
  if(!['image/png','image/jpeg','image/gif','image/webp','audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/mp4','video/mp4','video/webm','video/ogg'].includes(file.type))throw Error('Bu dosya türü desteklenmiyor.');
  let worker=String(w.MMStorageWorkerUrl||'');while(worker.endsWith('/'))worker=worker.slice(0,-1);if(!worker)throw Error('Sohbet medya sunucusu henüz yapılandırılmadı.');
  const chatId=activeChat,token=await cloud().user.getIdToken();
  const response=await fetch(worker+'/v1/chat-upload?chatId='+encodeURIComponent(chatId),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':file.type},body:file});
  const result=await response.json().catch(()=>({}));if(!response.ok||!result.path)throw Error(result.message||result.error||'Dosya yüklenemedi.');
  await db().collection('chats').doc(chatId).collection('messages').add({senderId:uid(),senderName:await currentSenderName(),text:'',mediaPath:result.path,mediaType:file.type,createdAt:firebase.firestore.FieldValue.serverTimestamp(),type:'media'});
 }
 async function startVoice(){if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Bu tarayıcı ses kaydını desteklemiyor.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(stream);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());try{await upload(new File(chunks,`ses-${Date.now()}.webm`,{type:chunks[0]?.type||'audio/webm'}))}catch(e){alert(e.message)}};recorder.start();alert('Ses kaydı başladı. Bitirmek için tekrar ses kaydı düğmesine bas.');}
 function bind(){ bindNotifications();watchNotifications();bindFriends(); $('chatInfo')?.addEventListener('click',async()=>{if(!activeChat)return;try{const s=await db().collection('chats').doc(activeChat).get();if(!s.exists)throw Error('Sohbet bulunamadı.');const x=s.data();alert((x.type==='group'?'Grup sohbeti':'Özel sohbet')+'\n'+(x.title||'Sohbet')+'\nÜye sayısı: '+(x.memberIds||[]).length+'\nSohbet kimliği: '+activeChat);}catch(e){alert(e.message)}}); $('newDm')?.addEventListener('click',()=>createChat(false).catch(e=>alert(e.message)));$('newGroup')?.addEventListener('click',()=>createChat(true).catch(e=>alert(e.message)));$('chatSend')?.addEventListener('click',()=>send().catch(e=>alert(e.message)));$('chatIn')?.addEventListener('keydown',e=>{if(e.key==='Enter')send().catch(x=>alert(x.message))});$('chatFile')?.addEventListener('change',e=>upload(e.target.files[0]).catch(x=>alert(x.message)));$('chatBack')?.addEventListener('click',()=>{$('chatRoom')?.classList.add('hide');activeChat=null;if(stopMessages)stopMessages()});$('chatEmoji')?.addEventListener('click',async()=>{const v=prompt('Mesaja eklenecek emoji veya GIF bağlantısı:',$('activeEmojiSelect')?.value||'😎');if(!v)return;if(/^https:\/\//i.test(v)){await db().collection('chats').doc(activeChat).collection('messages').add({senderId:uid(),senderName:await currentSenderName(),text:'',mediaUrl:v,mediaType:'image/gif',createdAt:firebase.firestore.FieldValue.serverTimestamp(),type:'media'});}else $('chatIn').value+=v});const tools=$('chatTools');if(tools&&!tools.dataset.voice){tools.dataset.voice='1';const b=document.createElement('button');b.className='btn';b.textContent='🎙️ Ses kaydet / bitir';b.onclick=()=>{if(recorder?.state==='recording')recorder.stop();else startVoice().catch(e=>alert(e.message))};tools.appendChild(b)} }
 document.addEventListener('DOMContentLoaded',()=>{let bound=false;window.addEventListener('mm-auth-ready',e=>{if(!e.detail.user){if(stopChatList)stopChatList();if(stopMessages)stopMessages();stopNotifications?.();stopNotifications=null;if($('notifPanel')){$('notifPanel').replaceChildren();$('notifPanel').classList.add('hide');$('notifPanel').setAttribute('aria-hidden','true');}if($('bellBadge')){$('bellBadge').textContent='0';$('bellBadge').classList.add('hide');}if($('friends'))$('friends').replaceChildren();if($('reqs'))$('reqs').replaceChildren();stopFriends?.();stopFriends=null;stopRequests?.();stopRequests=null;stopGroupCompetition?.();stopGroupCompetition=null;stopGroupA?.();stopGroupA=null;stopGroupB?.();stopGroupB=null;groupActiveCode='';activeChat=null;if($('chatList'))$('chatList').replaceChildren();if($('msgs'))$('msgs').replaceChildren();if($('chatTitle'))$('chatTitle').textContent='';if($('chatRoom'))$('chatRoom').classList.add('hide');return}if(!bound){bind();bound=true}watchChats();bindFriends();watchNotifications()});if(uid()&&db()){bind();bound=true;watchChats();bindFriends();watchNotifications()}});
 w.MMGroupDuel={hasActive:()=>!!groupActiveCode,getCode:()=>groupActiveCode,submit:async(score,correct)=>{if(!groupActiveCode)return;const r=await cloud().fn.httpsCallable('submitGroupCompetitionResult')({code:groupActiveCode,score,correct});const out=$('duelResult');if(out)out.textContent='Grup yarışması skorun kaydedildi. Takım toplamları: '+r.data.totals.a+' / '+r.data.totals.b;groupActiveCode='';stopGroupCompetition?.();stopGroupCompetition=null;$('startGroupCompetition')?.remove();}};
 w.MatematikMacerasi=w.MatematikMacerasi||{};w.MatematikMacerasi.register?.('social',{get activeChat(){return activeChat},openChat});
})(window);
