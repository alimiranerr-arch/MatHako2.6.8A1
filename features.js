/* Market, üyelik, günlük çark, unvan ve mevsim temaları. Ödemeler gerçek para değil oyun altınıdır. */
(function(w){const $=id=>document.getElementById(id),c=()=>w.MMCloud;let unsub=[],stopShop=null,stopCurriculum=null,stopUser=null,stopTransfers=[];
 const call=(n,d)=>c().fn.httpsCallable(n)(d||{});
 function renderShop(){
  const shop=$('shop');if(!shop)return;
  if(!c()?.db){shop.textContent='Market bağlantısı hazırlanıyor…';return;}
  if(!c()?.user){shop.textContent='Market ürünlerini görmek ve satın almak için Gmail ile giriş yap.';return;}
  stopShop?.();
  shop.textContent='Market ürünleri yükleniyor…';
  stopShop=c().db.collection('market').where('published','==',true).onSnapshot(snapshot=>{
   shop.replaceChildren();
   if(snapshot.empty){shop.textContent='Şu anda markette yayınlanmış ürün yok.';return;}
   const docs=snapshot.docs.slice().sort((a,b)=>{
    const x=a.data(),y=b.data();
    return String(x.type||'').localeCompare(String(y.type||''),'tr')||String(x.name||'').localeCompare(String(y.name||''),'tr');
   });
   docs.forEach(doc=>{
    const item=doc.data();
    const card=document.createElement('article');card.className='card';
    const title=document.createElement('b');title.textContent=item.name||'Market ürünü';
    const desc=document.createElement('p');desc.textContent=item.description||'';
    card.append(title,desc);
    if(item.gifUrl){const img=document.createElement('img');img.src=item.gifUrl;img.alt=item.name||'Ürün görseli';img.loading='lazy';img.style.cssText='display:block;max-width:100%;max-height:130px;object-fit:contain;margin:8px auto';card.appendChild(img);}
    const price=document.createElement('p');price.textContent='🪙 '+(Number(item.price)||0)+' altın';card.appendChild(price);
    const buy=document.createElement('button');buy.type='button';buy.className='btn';buy.textContent='Satın al';buy.disabled=!c()?.user?.emailVerified;
    if(buy.disabled)buy.title='Satın almak için doğrulanmış Gmail hesabı gerekir';
    buy.addEventListener('click',async()=>{
     if(!c()?.user?.emailVerified){w.MMError?.show?.('Satın almak için Gmail hesabını doğrula.',124);return;}
     buy.disabled=true;
     try{await call('purchaseMarketItem',{itemId:doc.id});alert('Satın alma tamamlandı.');}
     catch(e){w.MMError?.show?.(e.message||'Satın alma tamamlanamadı.',130);}
     finally{buy.disabled=false;}
    });
    card.appendChild(buy);shop.appendChild(card);
   });
  },e=>{
   shop.textContent='Market yüklenemedi: '+(e.message||'Bağlantı hatası')+' (Hata kodu: 0130)';
   w.MMError?.show?.('Market yüklenemedi: '+(e.message||'Bağlantı hatası'),'0130');
   console.warn('Market akışı [0130]:',e);
  });
 }
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
    }).catch(e=>{w.MMError?.show?.(e.message||'Ödül alınamadı.',124);});
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

 let stopPlayerMarket=null,stopPlayerMarketListings=null;
 function bindPlayerMarket(){
  const select=$('playerMarketItem'),btn=$('playerMarketListBtn'),out=$('playerMarketMsg'),box=$('playerMarketListings');
  if(!c()?.user||!c()?.db)return;
  stopPlayerMarket?.();stopPlayerMarketListings?.();
  const drawOwned=()=>{
   if(!select)return;
   const inv=Array.isArray(window.MMCloud?.userData?.inventory)?window.MMCloud.userData.inventory:[];
   const options=inv.filter(x=>['card','title','membership','miniPass'].includes(x.type)&&!x.listed&&x.itemId);
   select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=options.length?'Ürün seç':'Satılabilir kart/unvan/üyelik yok';select.appendChild(empty);
   options.forEach(x=>{const o=document.createElement('option');o.value=x.itemId;o.textContent=(x.emoji||'🎁')+' '+x.name+' · '+x.type;select.appendChild(o);});
  };
  const userRef=c().db.collection('users').doc(c().user.uid);
  const stopOwned=userRef.onSnapshot(s=>{if(s.exists){window.MMCloud.userData=s.data();drawOwned();}},e=>{if(out)out.textContent='Envanter okunamadı: '+e.message;});
  stopPlayerMarket=()=>{stopOwned();stopPlayerMarket=null;};
  if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',async()=>{
   const itemId=select?.value,price=Number($('playerMarketPrice')?.value);if(!itemId||!Number.isSafeInteger(price)||price<1||price>1000000){if(out)out.textContent='Ürün seç ve 1-1.000.000 arası tam sayı fiyat gir.';return;}
   btn.disabled=true;try{await call('createPlayerMarketListing',{itemId,price});if(out)out.textContent='İlanın Oyuncu Pazarı’na eklendi.';if($('playerMarketPrice'))$('playerMarketPrice').value='';}
   catch(e){if(out)out.textContent=e.message||'İlan oluşturulamadı.';}finally{btn.disabled=false;}
  });}
  if(box) stopPlayerMarketListings=c().db.collection('playerMarketListings').where('active','==',true).onSnapshot(s=>{
   box.replaceChildren();if(s.empty){box.textContent='Şu anda oyuncu ilanı yok.';return;}
   s.docs.forEach(d=>{const x=d.data(),card=document.createElement('article');card.className='card';
    const title=document.createElement('b');title.textContent=(x.emoji||'🎁')+' '+(x.name||'Oyuncu ürünü');
    const seller=document.createElement('p');seller.textContent='Satıcı: '+(x.sellerName||'Oyuncu');
    const price=document.createElement('p');price.textContent='🪙 '+Number(x.price||0)+' altın';
    card.append(title,seller,price);
    if(x.gifUrl){const img=document.createElement('img');img.src=x.gifUrl;img.alt=x.name||'Ürün';img.loading='lazy';img.style.maxWidth='120px';card.appendChild(img);}
    if(x.sellerUid===c()?.user?.uid){const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='İlanı kaldır';cancel.onclick=()=>call('cancelPlayerMarketListing',{listingId:d.id}).catch(e=>{if(out)out.textContent=e.message;});card.appendChild(cancel);}
    else{const buy=document.createElement('button');buy.className='btn';buy.textContent='Altınla satın al';buy.onclick=async()=>{buy.disabled=true;try{await call('buyPlayerMarketListing',{listingId:d.id});if(out)out.textContent='Satın alma tamamlandı: '+x.name;}catch(e){if(out)out.textContent=e.message;}finally{buy.disabled=false;}};card.appendChild(buy);}
    box.appendChild(card);
   });
  },e=>{box.textContent='Oyuncu Pazarı yüklenemedi: '+e.message;});
 }
 function loadUser(){if(!c()?.user||!c()?.db)return;stopUser?.();stopUser=c().db.collection('users').doc(c().user.uid).onSnapshot(d=>{if(!d.exists)return;const u=d.data();window.MMCloud.userData=u;const pmSelect=$('playerMarketItem');if(pmSelect){const eligible=(u.inventory||[]).filter(x=>['card','title','membership','miniPass'].includes(x.type)&&!x.listed&&x.itemId);pmSelect.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=eligible.length?'Ürün seç':'Satılabilir kart/unvan/üyelik yok';pmSelect.appendChild(empty);eligible.forEach(x=>{const o=document.createElement('option');o.value=x.itemId;o.textContent=(x.emoji||'🎁')+' '+x.name+' · '+x.type;pmSelect.appendChild(o);});}document.querySelectorAll('[data-coins]').forEach(x=>x.textContent=Number(u.coins)||0);renderLoadout($('inv'),u);const inv=$('inventory');if(inv){inv.innerHTML='';(u.inventory||[]).forEach(item=>{const row=document.createElement('div');row.className='row';const p=document.createElement('span');p.textContent=`${item.name||'Ürün'} · ${item.type||'eşya'}`;row.appendChild(p);if(item.itemId&&!['membership','miniPass','title'].includes(item.type)){const b=document.createElement('button');b.className='btn';b.textContent='Sat (yarı fiyat)';b.onclick=()=>call('sellInventoryItem',{itemId:item.itemId}).then(r=>alert('Ürün satıldı. +'+r.data.refund+' altın')).catch(e=>alert(e.message));row.appendChild(b)}inv.appendChild(row)})}const membershipActive=Number(u.membershipUntil)>Date.now();const own=$('ownedMemberships');if(own)own.textContent=membershipActive?`Aktif üyelik: ${u.membership}`:'Aktif ücretli üyelik yok.';const pass=$('activePassBadge');if(pass)pass.textContent=membershipActive?u.membership:'Mini Pass';renderMiniPass(u);const quickName=$('quickMenuName'),quickEmail=$('quickMenuEmail'),quickAvatar=$('quickMenuAvatar');if(quickName)quickName.textContent=u.displayName||c().user.displayName||'Kullanıcı';if(quickEmail)quickEmail.textContent=c().user.email||'Hesap';if(quickAvatar)quickAvatar.textContent=u.avatar||'🙂';const p=$('profileView');if(p)p.innerHTML=`<p><b>${safe(u.displayName||c().user.displayName||'Kullanıcı')}</b> ${safe(u.title||'')}</p><p>Okul: ${safe(u.school||'Belirtilmedi')}</p><p>Sınıf: ${safe(u.className||'7. sınıf')}</p><p>Takma ad: ${safe(u.nickname||'Yok')}</p><p>Soyadı: ${safe(u.surname||'Belirtilmedi')}</p>`},e=>{const p=$('profileView');if(p)p.textContent='Profil yüklenemedi: '+e.message+' (Hata kodu: 0132)';w.MMError?.show?.('Profil yüklenemedi: '+e.message,'0132');console.warn('Profil akışı:',e)});}
 function bindProfile(){
  const b=$('profileEditBtn');if(!b||b.dataset.bound)return;b.dataset.bound='1';
  b.addEventListener('click',async()=>{
   const displayName=prompt('Adın:',c().user.displayName||'');if(displayName===null)return;
   const surname=prompt('Soyadın:');if(surname===null)return;
   const school=prompt('Okulun:');if(school===null)return;
   const nickname=prompt('Takma ad:');if(nickname===null)return;
   const className=prompt('Sınıfın:','7. sınıf');if(className===null)return;
   try{
    const clean={displayName:String(displayName).trim().slice(0,80),surname:String(surname).trim().slice(0,80),school:String(school).trim().slice(0,120),nickname:String(nickname).trim().slice(0,40),className:String(className).trim().slice(0,30)};
    const requiredFields=[['Ad',clean.displayName],['Soyad',clean.surname],['Okul',clean.school],['Takma ad',clean.nickname],['Sınıf',clean.className]];
    const emptyField=requiredFields.find(field=>!field[1]);
    if(emptyField)throw Error(emptyField[0]+' boş bırakılamaz.');
    const previous=window.MMCloud?.userData||{};
    const fields=[['Ad',previous.displayName||c().user.displayName||'',clean.displayName],['Soyad',previous.surname||'',clean.surname],['Okul',previous.school||'',clean.school],['Takma ad',previous.nickname||'',clean.nickname],['Sınıf',previous.className||'',clean.className]];
    const changedFields=fields.filter(x=>String(x[1]).trim()!==String(x[2]).trim()).map(x=>x[0]);
    await c().user.updateProfile({displayName:clean.displayName});
    await c().db.collection('users').doc(c().user.uid).set(clean,{merge:true});
    window.MMCloud.userData={...previous,...clean};
    if(changedFields.length&&c().user.emailVerified){
     try{
      const token=await c().user.getIdToken();
      const response=await fetch('https://hako-profile-mailer.alimiranerr.workers.dev/profile-change-notice',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({changedFields})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw Error(result.error||'Bildirim servisi yanıt vermedi.');
      alert('Profilin güncellendi. Değişiklik bildirimi doğrulanmış e-posta adresine gönderildi.');
     }catch(mailError){console.warn('Profil e-posta bildirimi gönderilemedi:',mailError);alert('Profilin kaydedildi ancak e-posta bildirimi gönderilemedi. Daha sonra tekrar deneyebiliriz.');}
    }else{alert('Profilin başarıyla güncellendi.'+(c().user.emailVerified?'':' E-posta adresin doğrulanmadığı için bildirim gönderilmedi.'));}
   }catch(e){const message='Profil güncellenemedi: '+e.message+' (Hata kodu: 0134)';alert(message);w.MMError?.show?.(message,'0134');console.warn('Profil güncelleme hatası [0134]:',e);}
  });
}
 function watchCurriculum(){stopCurriculum?.();stopCurriculum=c().db.doc('settings/curriculum').onSnapshot(s=>{const mode=s.exists?s.data().mode:'first',topics=[...(w.MatematikMacerasi.fixtures?.topics.firstTerm||[]),...(mode==='second'?(w.MatematikMacerasi.fixtures?.topics.secondTerm||[]):[])],box=$('tp'),badge=$('curriculumBadge');if(badge)badge.textContent=mode==='second'?'1. + 2. Dönem Konuları':'1. Dönem Konuları';if(box){box.innerHTML='';topics.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>{box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true')});box.appendChild(b)})}const toggle=$('toggleSemesterBtn');if(toggle)toggle.textContent=mode==='second'?'📅 1. Dönem Konularına Dön':'📅 2. Dönem Konularına Geç (1. + 2. Dönem Birlikte)';},e=>{const box=$('tp');if(box)box.textContent='Konular yüklenemedi: '+e.message+' (Hata kodu: 0126)';w.MMError?.show?.('Konular yüklenemedi: '+e.message,'0126');console.warn('Müfredat akışı:',e)});}

 function applyMiniPassAccess(user){
  const box=$('miniPassBox'),claim=$('claimMiniPassBtn'),title=$('miniPassLockTitle'),copy=$('miniPassLockText');
  if(!box)return;
  const verified=!!(user&&user.emailVerified);
  box.classList.toggle('mini-pass-locked',!verified);
  $('miniPassLock')?.setAttribute('aria-hidden',String(verified));
  if(claim)claim.disabled=!verified;
  if(title)title.textContent=verified?'':'Günlük Mini Pass kilitli';
  if(copy)copy.textContent=user&&!user.emailVerified?'Gmail adresini doğrulamalısın. Gelen doğrulama e-postasındaki bağlantıya tıkla, sonra sayfayı yenile.':'Günlük ödül yolunu açmak için Gmail ile giriş yap.';
 }
 function renderMiniPass(u){
  const level=Math.max(1,Math.min(30,Number(u.miniPassDay)||1)),active=Number(u.membershipUntil)>Date.now();
  const levelEl=$('miniPassLevel'),free=$('miniPassFreeTiles'),premium=$('miniPassPremiumTiles'),premiumTrack=$('miniPassPremiumTrack'),premiumState=$('miniPassPremiumState'),claim=$('claimMiniPassBtn');
  if(levelEl)levelEl.textContent=level+' / 30';
  if(premiumTrack)premiumTrack.classList.toggle('unlocked',active);
  if(premiumState)premiumState.textContent=active?'Üyeliğin aktif':'Market üyeliğiyle açılır';
  const draw=(root,isPremium)=>{
   if(!root)return;root.replaceChildren();
   for(let i=1;i<=30;i++){
    const tile=document.createElement('div');tile.className='mini-pass-tile'+(!isPremium&&i<level?' done':'')+(!isPremium&&i===level?' current':'');
    if(isPremium&&!active){tile.classList.add('empty');tile.setAttribute('aria-label','Üyelik satın alındığında açılır');root.appendChild(tile);continue;}
    const icon=isPremium?['💎','🎟️','🪙','✨'][i%4]:(i%5===0?'🃏':'🪙');
    const amount=isPremium?'':(i%5===0?'Kart şansı':'+15 altın');
    tile.innerHTML=isPremium?'<span class="premium-empty-mark">🔒</span>':'<strong>'+icon+'</strong><small>GÜN '+i+'</small><small>'+amount+'</small>';
    root.appendChild(tile);
   }
  };
  draw(free,false);draw(premium,true);
 }
 function bind(){
  renderShop();
  const claim=$('claimMiniPassBtn');
  if(claim&&!claim.dataset.bound){claim.dataset.bound='1';claim.addEventListener('click',async()=>{
   if(!c()?.user?.emailVerified){w.MMError?.show?.('Günlük Mini Pass için doğrulanmış Gmail hesabıyla giriş yapmalısın.',124);return;}
   claim.disabled=true;
   try{const result=await call('claimMiniPass',{});const reward=result.data||{};alert('Günlük ödülün alındı! +'+(Number(reward.coins)||15)+' altın'+(reward.card?' ve temel kart kazandın.':'.'));claim.textContent='✓ Bugünkü ödül alındı';}
   catch(e){w.MMError?.show?.(e.message||'Günlük ödül alınamadı.',124);claim.disabled=false;}
  });}
 }
 function admin(){}
 function watchAdminSubmissions(){}
 function init(){bind();bindPdf();bindPublicForms();let started=false;window.addEventListener('mm-auth-ready',e=>{if(!e.detail.user){applyMiniPassAccess(null);started=false;stopShop?.();stopPlayerMarket?.();stopPlayerMarketListings?.();stopUser?.();stopCurriculum?.();stopTransfers.forEach(fn=>fn());stopTransfers=[];if($('trTo'))$('trTo').replaceChildren();if($('trList')){$('trList').replaceChildren();$('trList').dataset.live='';}if($('inventory'))$('inventory').replaceChildren();if($('dailyTasks'))$('dailyTasks').textContent='Görevleri görmek için giriş yap.';if($('profileView'))$('profileView').textContent='Profil bilgileri için giriş yap.';if($('ownedMemberships'))$('ownedMemberships').textContent='';if($('activePassBadge'))$('activePassBadge').textContent='';document.querySelectorAll('[data-coins]').forEach(x=>x.textContent='0');return}applyMiniPassAccess(e.detail.user);if(started)return;started=true;watchCurriculum();Promise.resolve(c()?.profileReady).finally(()=>renderShop());loadUser();bindPlayerMarket();bindProfile();bindTransfers();loadTasks();admin();watchAdminSubmissions()});if(c()?.user){applyMiniPassAccess(c().user);started=true;watchCurriculum();Promise.resolve(c()?.profileReady).finally(()=>renderShop());loadUser();bindPlayerMarket();bindProfile();bindTransfers();loadTasks();admin();watchAdminSubmissions()}else{applyMiniPassAccess(null)}}
 document.addEventListener('DOMContentLoaded',init);w.MatematikMacerasi=w.MatematikMacerasi||{};w.MatematikMacerasi.register?.('features',{renderShop});
})(window);
