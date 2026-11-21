/* Hako administrator moderation views: groups, DMs and reports. */
(function(w,d){
 'use strict';
 const $=id=>d.getElementById(id);let stops=[];
 const cloud=()=>w.MMCloud;
 function clear(){stops.forEach(fn=>{try{fn()}catch(_){}});stops=[]}
 function addText(parent,tag,value){const el=d.createElement(tag);el.textContent=String(value||'');parent.appendChild(el);return el}
 function renderChats(type){
  const box=$(type==='group'?'adminGroupsFeed':'adminDmsFeed');if(!box||!cloud()?.db)return;
  const stop=cloud().db.collection('chats').where('type','==',type).orderBy('createdAt','desc').limit(50).onSnapshot(s=>{
   box.replaceChildren();if(s.empty){addText(box,'p',type==='group'?'Henüz grup yok.':'Henüz özel sohbet yok.');return}
   s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',x.title|| (type==='group'?'Grup':'Özel sohbet'));addText(card,'p','Üye sayısı: '+(x.memberIds||[]).length);addText(card,'small','Oluşturulma: '+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||''));box.appendChild(card)});
  },e=>{box.textContent='Sohbet listesi yüklenemedi: '+e.message});
  stops.push(stop);
 }
 function renderReports(){
  const box=$('adminReportsFeed');if(!box||!cloud()?.db)return;
  const stop=cloud().db.collection('messageReports').orderBy('createdAt','desc').limit(100).onSnapshot(s=>{
   box.replaceChildren();if(s.empty){addText(box,'p','Henüz mesaj bildirimi yok.');return}
   s.forEach(doc=>{const x=doc.data(),card=d.createElement('article');card.className='card';addText(card,'b',(x.senderName||'Kullanıcı')+' · '+(x.status==='resolved'?'Çözüldü':'İncelenmeyi bekliyor'));addText(card,'p','Neden: '+(x.reason||'Belirtilmedi'));addText(card,'p','Mesaj: '+(x.messageText||'[Medya eki]'));addText(card,'small',x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');
    if(x.status!=='resolved'){const resolve=d.createElement('button');resolve.type='button';resolve.className='btn';resolve.textContent='Bildirimi kapat';resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await cloud().fn.httpsCallable('resolveMessageReport')({reportId:doc.id});}catch(e){alert(e.message);resolve.disabled=false}});card.appendChild(resolve);
     if(x.senderId){const ban=d.createElement('button');ban.type='button';ban.className='btn';ban.textContent='Göndereni banla';ban.addEventListener('click',async()=>{if(!confirm('Bu kullanıcı kalıcı olarak banlansın mı?'))return;ban.disabled=true;try{await cloud().fn.httpsCallable('banUser')({uid:x.senderId});}catch(e){alert(e.message);ban.disabled=false}});card.appendChild(ban)}
    }
    box.appendChild(card);
   });
  },e=>{box.textContent='Mesaj bildirimleri yüklenemedi: '+e.message});
  stops.push(stop);
 }
 function showTab(which){
  const map={groups:'adminGroupsFeed',dms:'adminDmsFeed',reports:'adminReportsFeed'};
  Object.entries(map).forEach(([key,id])=>$(id)?.classList.toggle('hide',key!==which));
  d.querySelectorAll('[data-achat]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.achat===which)));
 }
 function start(){
  if(!cloud()?.admin||!cloud()?.db)return;clear();
  renderChats('group');renderChats('dm');renderReports();
  d.querySelectorAll('[data-achat]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.addEventListener('click',()=>showTab(b.dataset.achat))}});
  showTab('groups');
 }
 w.addEventListener('mm-auth-ready',e=>{if(e.detail?.admin)start();else{clear();['adminGroupsFeed','adminDmsFeed','adminReportsFeed'].forEach(id=>{if($(id))$(id).textContent='Admin yetkisi gerekli.'})}});
 d.addEventListener('DOMContentLoaded',()=>{if(cloud()?.admin)start()});
})(window,document);
