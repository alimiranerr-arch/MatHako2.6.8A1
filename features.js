/* Market, üyelik, günlük çark, unvan ve mevsim temaları. Ödemeler gerçek para değil oyun altınıdır. */
(function(w){const $=id=>document.getElementById(id),c=()=>w.MMCloud;let unsub=[],stopShop=null,stopCurriculum=null,stopUser=null,stopTransfers=[];
 const call=(n,d)=>c().fn.httpsCallable(n)(d||{});
 function renderShop(){if(!c()?.db||!c()?.user)return;const shop=$('shop');if(!shop)return;const active=document.querySelector('#mktSeg [aria-selected="true"]')?.dataset.mk||'cards';stopShop?.();stopShop=c().db.collection('market').where('published','==',true).onSnapshot(s=>{shop.innerHTML='';s.forEach(doc=>{const d=doc.data();if(active==='memberships'&&!['membership','miniPass'].includes(d.type))return;if(active==='badges'&&d.type!=='badge')return;if(active==='emojis'&&d.type!=='emoji')return;if(active==='cards'&&!['card','item'].includes(d.type))return;if(active==='titles'&&d.type!=='title')return;if(['themes','avatars'].includes(active)&&d.type!==active.slice(0,-1))return;const card=document.createElement('article');card.className='card';card.innerHTML=`<b>${safe(d.name)}</b><p>${safe(d.description||'')}</p>${d.gifUrl?`<img src="${safe(d.gifUrl)}" alt="" style="max-width:100px;max-height:100px">`:''}<p>🪙 ${Number(d.price)||0}</p><button class="btn">Satın al</button>`;card.querySelector('button').onclick=()=>call('purchaseMarketItem',{itemId:doc.id}).then(()=>alert('Satın alma tamamlandı.')).catch(e=>alert(e.message));shop.appendChild(card)})},e=>{shop.textContent='Market yüklenemedi: '+e.message;console.warn('Market akışı:',e)})}
 function safe(v){return String(v||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
 function loadTasks(){
  const box=$('dailyTasks');
  if(!box||!c()?.user)return;
  call('getDailyTasks').then(r=>{
   box.innerHTML='';
   const tasks=r.data.tasks||[];
   if(!tasks.length){box.textContent='Şu anda yayınlanmış görev yok.';return;}
   tasks.forEach(t=>{
    const li=document.createElement('li');
    const title=document.createElement('b');
    const meta=document.createElement('p');
    const btn=document.createElement('button');
    title.textContent=t.title||'Görev';
    if(t.gifUrl){
     const img=document.createElement('img');
     img.alt='Görev görseli';img.loading='lazy';
     img.style.maxWidth='140px';img.style.maxHeight='100px';
     li.appendChild(img);
     if(String(t.gifUrl).startsWith('adminMedia/')){
      (async()=>{
       try{
        let worker=String(w.MMStorageWorkerUrl||'');while(worker.endsWith('/'))worker=worker.slice(0,-1);
        if(!worker)throw Error('Worker URL yok');
        const response=await fetch(worker+'/v1/task-media-url',{
         method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({path:t.gifUrl})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.url)throw Error(data.error||'Görsel alınamadı');
        img.src=data.url;
       }catch(e){img.alt='Görev görseli yüklenemedi';}
      })();
     }else{img.src=t.gifUrl;}
    }
    meta.textContent='+'+Number(t.reward||0)+' altın · '+(t.mode==='any'?'Herhangi bir mod':t.mode)+' · en az '+t.minQuestions+' soru / '+t.minScore+' puan';
    btn.className='btn';
    btn.textContent=t.claimed?'Ödül alındı':'Ödülü al';
    btn.disabled=!!t.claimed;
    btn.onclick=()=>call('claimDailyTask',{taskId:t.id}).then(()=>{
     btn.textContent='Ödül alındı';btn.disabled=true;
    }).catch(e=>alert(e.message));
    li.append(title,meta,btn);box.appendChild(li);
   });
  }).catch(e=>{box.textContent='Görevler yüklenemedi: '+e.message;});
 }
 function bindTransfers(){
  const select=$('trTo'),btn=$('trBtn');if(!select||!c()?.user)return;stopTransfers.forEach(fn=>fn());stopTransfers=[];
  stopTransfers.push(c().db.collection('users').doc(c().user.uid).collection('friends').onSnapshot(async s=>{
   select.innerHTML='';for(const f of s.docs){const o=document.createElement('option');o.value=f.id;o.textContent=f.data()?.displayName||f.id.slice(0,8);select.appendChild(o);}
   if(!select.options.length){const o=document.createElement('option');o.textContent='Önce arkadaş ekle';o.value='';select.appendChild(o);}
  }));
  const history=$('trList');if(history&&!history.dataset.live){history.dataset.live='1';let sent=[],received=[];const draw=()=>{history.innerHTML='';[...sent,...received].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,20).forEach(x=>{const li=document.createElement('li');li.textContent=(x.from===c().user.uid?'Gönderildi':'Alındı')+' · '+x.amount+' altın · '+(x.note?'Not: '+x.note+' · ':'')+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||'');history.appendChild(li);});if(!history.children.length)history.textContent='Henüz transfer yok.';};stopTransfers.push(c().db.collection('coinTransfers').where('from','==',c().user.uid).orderBy('createdAt','desc').limit(20).onSnapshot(s=>{sent=s.docs.map(d=>d.data());draw();}));stopTransfers.push(c().db.collection('coinTransfers').where('to','==',c().user.uid).orderBy('createdAt','desc').limit(20).onSnapshot(s=>{received=s.docs.map(d=>d.data());draw();}));}
  if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',async()=>{const targetUid=select.value,amount=Number($('trAmt')?.value),out=$('trMsg');try{if(!targetUid)throw Error('Transfer için önce arkadaş eklemelisin.');const r=await call('transferCoins',{targetUid,amount,note:$('trNote')?.value||''});if(out)out.textContent=r.data.amount+' altın gönderildi.';}catch(e){if(out)out.textContent=e.message;}});}
 }
 function bindPublicForms(){
  const feedback=$('fbForm');if(feedback&&!feedback.dataset.bound){feedback.dataset.bound='1';feedback.addEventListener('submit',async e=>{e.preventDefault();const out=$('fbOut'),btn=feedback.querySelector('[type="submit"]');try{btn.disabled=true;await call('submitFeedback',{kind:$('fbTur')?.value||'Öneri',message:$('fbMsg')?.value||'',playerName:$('nm')?.value||c()?.user?.displayName||'',honeypot:feedback.querySelector('[name="bot-field"]')?.value||''});if(out)out.textContent='Geri bildirimin güvenli şekilde alındı. Teşekkürler!';if($('fbCount'))$('fbCount').textContent=String((Number($('fbCount').textContent)||0)+1);feedback.reset();}catch(err){if(out)out.textContent=err.message;}finally{btn.disabled=false;}});}
  const teacher=$('teacherForm');if(teacher&&!teacher.dataset.bound){teacher.dataset.bound='1';teacher.addEventListener('submit',async e=>{e.preventDefault();const out=$('tOut'),btn=teacher.querySelector('[type="submit"]');try{btn.disabled=true;const val=n=>teacher.querySelector('[name="'+n+'"]')?.value||'';await call('submitTeacherRequest',{name:val('ad'),contact:val('iletisim'),email:val('email'),phone:val('telefon'),school:val('okul'),className:val('sinif'),location:val('il_ilce'),request:val('talep'),message:val('mesaj'),honeypot:val('bot-field')});if(out)out.textContent='Başvurun alındı. Teşekkürler!';teacher.reset();}catch(err){if(out)out.textContent=err.message;}finally{btn.disabled=false;}});}
 }
 function bindPdf(){
  const btn=$('statPdfBtn');if(!btn||btn.dataset.bound)return;btn.dataset.bound='1';
  btn.addEventListener('click',async()=>{if(!c()?.user){alert('PDF raporu için giriş yapmalısın.');return;}const report=$('report');if(!report)return;
   try{const snap=await c().db.collection('scores').where('uid','==',c().user.uid).orderBy('createdAt','desc').limit(100).get();
    const rows=snap.docs.map(d=>{const x=d.data();return '<tr><td>'+safe(x.mode)+'</td><td>'+safe(x.topic)+'</td><td>'+(Number(x.score)||0)+'</td><td>'+(Number(x.questions)||0)+'</td><td>'+(x.createdAt?.toDate?.().toLocaleString('tr-TR')||'')+'</td></tr>';}).join('');
    const mistakes=$('includeMistakesPdf')?.checked?(w.MMGame?.getMistakes?.()||[]):[];const mistakeRows=mistakes.map(x=>'<li><b>'+safe(x.q)+'</b><br>Seçimin: '+safe(x.chosen)+' · Doğru cevap: '+safe(x.answer)+'</li>').join('');
    report.innerHTML='<h1>Matematik Macerası · Kişisel Rapor</h1><p>'+safe(c().user.displayName||c().user.email||'Oyuncu')+'</p><table><thead><tr><th>Mod</th><th>Konu</th><th>Puan</th><th>Soru</th><th>Tarih</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">Henüz skor yok.</td></tr>')+'</tbody></table>'+(mistakeRows?'<h2>Son oyundaki hatalar</h2><ul>'+mistakeRows+'</ul>':'');
    report.setAttribute('aria-hidden','false');window.print();report.setAttribute('aria-hidden','true');
   }catch(e){alert('Rapor oluşturulamadı: '+e.message);}
  });
 }
        let worker=String(w.MMStorageWorkerUrl||'');while(worker.endsWith('/'))worker=worker.slice(0,-1);
 function renderLoadout(root,u){
  if(!root)return;
  const inventory=Array.isArray(u.inventory)?u.inventory:[],emojis=Array.isArray(u.equippedEmojis)?u.equippedEmojis.slice(0,5):[],cards=Array.isArray(u.equippedCards)?u.equippedCards.slice(0,5):[];
  while(emojis.length<5)emojis.push('');while(cards.length<5)cards.push('');
  const keyOf=x=>x.itemId||x.id,ownedEmojis=inventory.filter(x=>x.type==='emoji'&&keyOf(x)),ownedCards=inventory.filter(x=>x.type==='card'&&keyOf(x));
  w.MMEquipped={emojis:emojis.map(id=>inventory.find(x=>keyOf(x)===id)).filter(Boolean),cards:cards.map(id=>inventory.find(x=>x.itemId===id)).filter(Boolean)};
  root.replaceChildren();let selected=null;
  const title=document.createElement('p');title.className='note';title.textContent='Envanterindeki öğeyi sürükleyerek veya önce öğeye sonra slota dokunarak yerleştir. Her bölümde 5 slot var.';root.appendChild(title);
  const assign=(type,index,id)=>{const arr=(type==='emoji'?emojis:cards).slice();arr[index]=id||'';const payload={emojis,cards};payload[type==='emoji'?'emojis':'cards']=arr;call('setInventoryLoadout',payload).then(()=>renderLoadout(root,{...u,equippedEmojis:payload.emojis,equippedCards:payload.cards})).catch(e=>alert('Ekipman kaydedilemedi: '+e.message));};
  const addSection=(label,type,items,slots)=>{
   const h=document.createElement('h3');h.className='sub';h.textContent=label;root.appendChild(h);
   const slotGrid=document.createElement('div');slotGrid.className='inv';slotGrid.style.cssText='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px';
   slots.forEach((id,index)=>{const item=items.find(x=>keyOf(x)===id),slot=document.createElement('button');slot.type='button';slot.className='btn';slot.dataset.slotType=type;slot.style.cssText='min-height:66px;white-space:normal;border:2px dashed var(--line,#999);display:flex;flex-direction:column;align-items:center;justify-content:center';slot.textContent=(item?.emoji||(type==='emoji'?'😊':'🃏'))+' '+(item?.name||('Boş '+(index+1)));slot.addEventListener('dragover',e=>e.preventDefault());slot.addEventListener('drop',e=>{e.preventDefault();assign(type,index,e.dataTransfer?.getData('text/plain'));});slot.addEventListener('click',()=>{if(selected){assign(type,index,keyOf(selected));selected=null;}else if(item)assign(type,index,'');});slotGrid.appendChild(slot);});
   root.appendChild(slotGrid);
   const list=document.createElement('div');list.className='inv';list.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px';
   items.forEach(item=>{const chip=document.createElement('button');chip.type='button';chip.className='btn';chip.draggable=true;chip.textContent=(item.emoji||(type==='emoji'?'😊':'🃏'))+' '+(item.name||'Öğe');chip.addEventListener('dragstart',e=>{e.dataTransfer?.setData('text/plain',keyOf(item));});chip.addEventListener('click',()=>{selected=item;list.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===chip)));});list.appendChild(chip);});
   if(!items.length){const empty=document.createElement('span');empty.className='note';empty.textContent=type==='emoji'?'Henüz emoji yok. Marketten emoji edin.':'Henüz kart yok. Marketten kart edin.';list.appendChild(empty);}
   root.appendChild(list);
  };
  addSection('😊 Emoji yuvaları','emoji',ownedEmojis,emojis);addSection('🃏 Kart yuvaları','card',ownedCards,cards);
  const active=$('activeEmojiSelect');if(active){active.replaceChildren();const chosen=ownedEmojis.filter(x=>emojis.includes(keyOf(x)));(chosen.length?chosen:ownedEmojis).forEach(item=>{const o=document.createElement('option');o.value=item.emoji||item.name;o.textContent=(item.emoji||'😊')+' '+item.name;active.appendChild(o)});if(!active.options.length){const o=document.createElement('option');o.value='';o.textContent='Kuşanılmış emoji yok';active.appendChild(o);}}
 }
 function loadUser(){if(!c()?.user||!c()?.db)return;stopUser?.();stopUser=c().db.collection('users').doc(c().user.uid).onSnapshot(d=>{if(!d.exists)return;const u=d.data();document.querySelectorAll('[data-coins]').forEach(x=>x.textContent=Number(u.coins)||0);renderLoadout($('inv'),u);const inv=$('inventory');if(inv){inv.innerHTML='';(u.inventory||[]).forEach(item=>{const row=document.createElement('div');row.className='row';const p=document.createElement('span');p.textContent=`${item.name||'Ürün'} · ${item.type||'eşya'}`;row.appendChild(p);if(item.itemId&&!['membership','miniPass','title'].includes(item.type)){const b=document.createElement('button');b.className='btn';b.textContent='Sat (yarı fiyat)';b.onclick=()=>call('sellInventoryItem',{itemId:item.itemId}).then(r=>alert('Ürün satıldı. +'+r.data.refund+' altın')).catch(e=>alert(e.message));row.appendChild(b)}inv.appendChild(row)})}const membershipActive=Number(u.membershipUntil)>Date.now();const own=$('ownedMemberships');if(own)own.textContent=membershipActive?`Aktif üyelik: ${u.membership}`:'Aktif ücretli üyelik yok.';const pass=$('activePassBadge');if(pass)pass.textContent=membershipActive?u.membership:'Mini Pass';renderMiniPass(u);const p=$('profileView');if(p)p.innerHTML=`<p><b>${safe(u.displayName||c().user.displayName||'Kullanıcı')}</b> ${safe(u.title||'')}</p><p>Okul: ${safe(u.school||'Belirtilmedi')}</p><p>Sınıf: ${safe(u.className||'7. sınıf')}</p><p>Takma ad: ${safe(u.nickname||'Yok')}</p><p>Soyadı: ${safe(u.surname||'Belirtilmedi')}</p>`},e=>{const p=$('profileView');if(p)p.textContent='Profil yüklenemedi: '+e.message;console.warn('Profil akışı:',e)});}
 function bindProfile(){const b=$('profileEditBtn');if(!b||b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',async()=>{const displayName=prompt('Adın:',c().user.displayName||'');if(displayName===null)return;const surname=prompt('Soyadın:');if(surname===null)return;const school=prompt('Okulun:');if(school===null)return;const nickname=prompt('Takma ad (isteğe bağlı):');if(nickname===null)return;const className=prompt('Sınıfın:','7. sınıf');if(className===null)return;try{const clean=String(displayName).trim().slice(0,80);if(!clean)throw Error('Ad boş olamaz.');await c().user.updateProfile({displayName:clean});await c().db.collection('users').doc(c().user.uid).set({displayName:clean,surname:surname.trim().slice(0,80),school:school.trim().slice(0,120),nickname:nickname.trim().slice(0,40),className:className.trim().slice(0,30)},{merge:true});}catch(e){alert('Profil güncellenemedi: '+e.message);}});}
 function watchCurriculum(){stopCurriculum?.();stopCurriculum=c().db.doc('settings/curriculum').onSnapshot(s=>{const mode=s.exists?s.data().mode:'first',topics=[...(w.MatematikMacerasi.fixtures?.topics.firstTerm||[]),...(mode==='second'?(w.MatematikMacerasi.fixtures?.topics.secondTerm||[]):[])],box=$('tp'),badge=$('curriculumBadge');if(badge)badge.textContent=mode==='second'?'1. + 2. Dönem Konuları':'1. Dönem Konuları';if(box){box.innerHTML='';topics.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>{box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true')});box.appendChild(b)})}const toggle=$('toggleSemesterBtn');if(toggle)toggle.textContent=mode==='second'?'📅 1. Dönem Konularına Dön':'📅 2. Dönem Konularına Geç (1. + 2. Dönem Birlikte)';},e=>{const box=$('tp');if(box)box.textContent='Konular yüklenemedi: '+e.message;console.warn('Müfredat akışı:',e)});}

 function renderMiniPass(u){
  const level=Math.max(1,Math.min(30,Number(u.miniPassDay)||1)),active=Number(u.membershipUntil)>Date.now();
  const levelEl=$('miniPassLevel'),free=$('miniPassFreeTiles'),premium=$('miniPassPremiumTiles'),premiumTrack=$('miniPassPremiumTrack'),premiumState=$('miniPassPremiumState'),claim=$('claimMiniPassBtn');
  if(levelEl)levelEl.textContent=level+' / 30';
  if(premiumTrack)premiumTrack.classList.toggle('unlocked',active);
  if(premiumState)premiumState.textContent=active?'Üyeliğin aktif':'Market üyeliğiyle açılır';
  const draw=(root,isPremium)=>{
   if(!root)return;root.replaceChildren();
   for(let i=1;i<=30;i++){
    const tile=document.createElement('div');tile.className='mini-pass-tile'+(!isPremium&&i<level?' done':'');
    const icon=isPremium?(active?['💎','🎟️','👑','🪙','✨'][i%5]:'🔒'):(i%5===0?'🃏':'🪙');
    const amount=isPremium?(active?'Üyelik bonusu':'Kilitli'):(i%5===0?'Kart şansı':'+15 altın');
    tile.innerHTML='<strong>'+icon+'</strong><small>GÜN '+i+'</small><small>'+amount+'</small>';
    root.appendChild(tile);
   }
  };
  draw(free,false);draw(premium,true);
 }
 function bind(){
  document.querySelectorAll('#mktSeg [data-mk]').forEach(btn=>{
   if(btn.dataset.bound)return;btn.dataset.bound='1';
   btn.addEventListener('click',()=>{
    document.querySelectorAll('#mktSeg [data-mk]').forEach(x=>x.setAttribute('aria-selected',String(x===btn)));
    renderShop();
   });
  });
  const claim=$('claimMiniPassBtn');
  if(claim&&!claim.dataset.bound){claim.dataset.bound='1';claim.addEventListener('click',async()=>{
   if(!c()?.user){alert('Mini Pass ödülü için giriş yapmalısın.');return;}
   claim.disabled=true;
   try{const result=await call('claimMiniPass',{});const reward=result.data||{};alert('Günlük ödülün alındı! +'+(Number(reward.coins)||15)+' altın'+(reward.card?' ve temel kart kazandın.':'.'));claim.textContent='✓ Bugünkü ödül alındı';}
   catch(e){alert(e.message||'Günlük ödül alınamadı.');claim.disabled=false;}
  });}
 }
 function admin(){}
 function watchAdminSubmissions(){}
 function init(){bind();bindPdf();bindPublicForms();let started=false;window.addEventListener('mm-auth-ready',e=>{if(!e.detail.user){started=false;stopShop?.();stopUser?.();stopCurriculum?.();stopTransfers.forEach(fn=>fn());stopTransfers=[];if($('trTo'))$('trTo').replaceChildren();if($('trList')){$('trList').replaceChildren();$('trList').dataset.live='';}if($('inventory'))$('inventory').replaceChildren();if($('dailyTasks'))$('dailyTasks').textContent='Görevleri görmek için giriş yap.';if($('profileView'))$('profileView').textContent='Profil bilgileri için giriş yap.';if($('ownedMemberships'))$('ownedMemberships').textContent='';if($('activePassBadge'))$('activePassBadge').textContent='';document.querySelectorAll('[data-coins]').forEach(x=>x.textContent='0');return}if(started)return;started=true;watchCurriculum();renderShop();loadUser();bindProfile();bindTransfers();loadTasks();admin();watchAdminSubmissions()});if(c()?.user){started=true;watchCurriculum();renderShop();loadUser();bindProfile();bindTransfers();loadTasks();admin();watchAdminSubmissions()}}
 document.addEventListener('DOMContentLoaded',init);w.MatematikMacerasi=w.MatematikMacerasi||{};w.MatematikMacerasi.register?.('features',{renderShop});
})(window);
