/* Hako administrator moderation and operations views. */
(function(w,d){
 'use strict';
 const $=id=>d.getElementById(id);let stops=[];
 const cloud=()=>w.MMCloud;
 function clear(){stops.forEach(fn=>{try{fn()}catch(_){}});stops=[]}
 function listen(query,handler,error){const stop=query.onSnapshot(handler,e=>{if(error)error(e)});stops.push(stop);return stop}
 function addText(parent,tag,value){const el=d.createElement(tag);el.textContent=String(value||'');parent.appendChild(el);return el}
 function renderChats(type){
  const box=$(type==='group'?'adminGroupsFeed':'adminDmsFeed');if(!box||!cloud()?.db)return;
  listen(cloud().db.collection('chats').where('type','==',type).orderBy('createdAt','desc').limit(50),s=>{
   box.replaceChildren();if(s.empty){addText(box,'p',type==='group'?'Henüz grup yok.':'Henüz özel sohbet yok.');return}
   s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',x.title||(type==='group'?'Grup':'Özel sohbet'));addText(card,'p','Üye sayısı: '+(x.memberIds||[]).length);addText(card,'small','Oluşturulma: '+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||''));box.appendChild(card)});
  },e=>{box.textContent='Sohbet listesi yüklenemedi: '+e.message});
 }
 function renderMessages(){
  const box=$('adminMessageFeed');if(!box||!cloud()?.db)return;
  listen(cloud().db.collectionGroup('messages').orderBy('createdAt','desc').limit(60),s=>{
   box.replaceChildren();if(s.empty){addText(box,'p','Henüz mesaj yok.');return}
   s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',x.senderName||x.senderId||'Kullanıcı');addText(card,'p',x.text||'[Medya eki]');addText(card,'small',x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');box.appendChild(card)});
  },e=>{box.textContent='Mesaj akışı yüklenemedi: '+e.message});
 }
 function renderReports(){
  const box=$('adminReportsFeed');if(!box||!cloud()?.db)return;
  listen(cloud().db.collection('messageReports').orderBy('createdAt','desc').limit(100),s=>{
   box.replaceChildren();if(s.empty){addText(box,'p','Henüz mesaj bildirimi yok.');return}
   s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',(x.senderName||'Kullanıcı')+' · '+(x.status==='resolved'?'Çözüldü':'İncelenmeyi bekliyor'));addText(card,'p','Neden: '+(x.reason||'Belirtilmedi'));addText(card,'p','Mesaj: '+(x.messageText||'[Medya eki]'));addText(card,'small',x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');
    if(x.status!=='resolved'){const resolve=d.createElement('button');resolve.type='button';resolve.className='btn';resolve.textContent='Bildirimi kapat';resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await cloud().fn.httpsCallable('resolveMessageReport')({reportId:doc.id});}catch(e){alert(e.message);resolve.disabled=false}});card.appendChild(resolve);
     if(x.senderId){const ban=d.createElement('button');ban.type='button';ban.className='btn';ban.textContent='Göndereni banla';ban.addEventListener('click',async()=>{if(!confirm('Bu kullanıcı kalıcı olarak banlansın mı?'))return;ban.disabled=true;try{await cloud().fn.httpsCallable('banUser')({uid:x.senderId});}catch(e){alert(e.message);ban.disabled=false}});card.appendChild(ban)}
    }box.appendChild(card);
   });
  },e=>{box.textContent='Mesaj bildirimleri yüklenemedi: '+e.message});
 }
 function renderUsers(){
  const box=$('adminVisitorsList');if(!box||!cloud()?.db)return;
  listen(cloud().db.collection('users').limit(100),s=>{
   box.replaceChildren();s.forEach(doc=>{const x=doc.data(),row=d.createElement('article');row.className='row';addText(row,'span',(x.displayName||x.email||doc.id)+' · '+(x.device||'Cihaz bilinmiyor')+' · '+(x.location&&Number.isFinite(Number(x.location.lat))&&Number.isFinite(Number(x.location.lng))?'Konum: '+Number(x.location.lat).toFixed(2)+', '+Number(x.location.lng).toFixed(2):'Konum yok'));if(x.email!=='alimiranerr@gmail.com'){const b=d.createElement('button');b.className='btn';b.textContent='Banla';b.addEventListener('click',async()=>{if(!confirm('Bu kullanıcı kalıcı olarak banlansın mı?'))return;b.disabled=true;try{await cloud().fn.httpsCallable('banUser')({uid:doc.id});}catch(e){alert(e.message);b.disabled=false}});row.appendChild(b)}box.appendChild(row)});
  },e=>{box.textContent='Kullanıcılar yüklenemedi: '+e.message});
 }
 function renderSubmissions(){
  const fb=$('adminFeedbackList'),teachers=$('adminTeacherRequestsList');
  if(fb)listen(cloud().db.collection('feedback').orderBy('createdAt','desc').limit(60),s=>{fb.replaceChildren();if(s.empty)addText(fb,'p','Henüz geri bildirim yok.');s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',(x.kind||'Geri bildirim')+' · '+(x.playerName||'Oyuncu'));addText(card,'p',x.message||'');addText(card,'small',x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');if(x.adminReply)addText(card,'p','Yönetici yanıtı: '+x.adminReply);const reply=d.createElement('textarea');reply.rows=2;reply.maxLength=1000;reply.placeholder='Kullanıcıya yanıt yaz…';reply.value=x.adminReply||'';card.appendChild(reply);const send=d.createElement('button');send.type='button';send.className='btn';send.textContent=x.adminReply?'Yanıtı güncelle':'Yanıt gönder';send.addEventListener('click',async()=>{send.disabled=true;try{await cloud().fn.httpsCallable('replyFeedback')({feedbackId:doc.id,reply:reply.value});}catch(e){alert(e.message);send.disabled=false}});card.appendChild(send);fb.appendChild(card)})},e=>{fb.textContent='Geri bildirimler yüklenemedi: '+e.message});
  if(teachers)listen(cloud().db.collection('teacherRequests').orderBy('createdAt','desc').limit(60),s=>{teachers.replaceChildren();if(s.empty)addText(teachers,'p','Henüz öğretmen başvurusu yok.');s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',x.name||'Öğretmen başvurusu');addText(card,'p',(x.school||'')+' · '+(x.className||''));addText(card,'p',(x.email||x.phone||'')+' · '+(x.request||''));addText(card,'p',x.message||'');addText(card,'small',x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');teachers.appendChild(card)})},e=>{teachers.textContent='Başvurular yüklenemedi: '+e.message});
 }
 function renderLoginFailures(){
  const box=$('aattempts');if(!box||!cloud()?.db)return;
  listen(cloud().db.collection('loginFailures').orderBy('createdAt','desc').limit(30),s=>{box.replaceChildren();if(s.empty)addText(box,'p','Kayıtlı başarısız giriş yok.');s.forEach(doc=>{const x=doc.data();addText(box,'li',(x.email||'Bilinmeyen')+' · '+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||''))})},e=>{box.textContent='Giriş kayıtları yüklenemedi: '+e.message});
 }
 function showTab(which){
  const map={groups:'adminGroupsFeed',dms:'adminDmsFeed',messages:'adminMessageFeed',reports:'adminReportsFeed'};
  Object.entries(map).forEach(([key,id])=>$(id)?.classList.toggle('hide',key!==which));
  d.querySelectorAll('[data-achat]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.achat===which)));
 }
 function start(){
  if(!cloud()?.admin||!cloud()?.db)return;clear();
  renderChats('group');renderChats('dm');renderMessages();renderReports();renderUsers();renderSubmissions();renderLoginFailures();
  d.querySelectorAll('[data-achat]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.addEventListener('click',()=>showTab(b.dataset.achat))}});
  showTab('groups');
 }
 w.addEventListener('mm-auth-ready',e=>{if(e.detail?.admin)start();else{clear();['adminGroupsFeed','adminDmsFeed','adminMessageFeed','adminReportsFeed','adminVisitorsList','adminFeedbackList','adminTeacherRequestsList','aattempts'].forEach(id=>{if($(id))$(id).replaceChildren()})}});
 d.addEventListener('DOMContentLoaded',()=>{if(cloud()?.admin)start()});
})(window,document);
