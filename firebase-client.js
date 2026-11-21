// Firebase web istemci ayarları (API key web uygulaması tanımlayıcısıdır; özel anahtar değildir).
window.firebaseConfig = {
 apiKey: "AIzaSyDCsLQwKIQkpETXyX0bVVLYOWxEy52rLbo",
 authDomain: "hakomatonline261.firebaseapp.com",
 projectId: "hakomatonline261",
 storageBucket: "hakomatonline261.firebasestorage.app",
 messagingSenderId: "213698338676",
 appId: "1:213698338676:web:b876b839b0ccbc99429621"
};
(function(){
 const $=id=>document.getElementById(id), ADMIN='alimiranerr@gmail.com';
 const state={user:null,admin:false,db:null,fn:null}; window.MMCloud=state;
 function msg(id,s){const e=$(id);if(e)e.textContent=s;}
 function call(name,data){if(!state.fn)throw Error('Firebase henüz başlatılmadı.');return state.fn.httpsCallable(name)(data||{});}
 function showAdmin(on){const t=$('tabAdmin'); if(t)t.classList.toggle('hide',!on);}
 function init(){
  if(!window.firebase||!window.firebaseConfig)return;
  try{
   if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
   state.db=firebase.firestore();state.fn=firebase.functions();
   const auth=firebase.auth();
   auth.onAuthStateChanged(async user=>{
    state.user=user;state.admin=false;showAdmin(false);
    if(!user){state.stopPublic?.();state.stopTheme?.();window.dispatchEvent(new CustomEvent('mm-auth-ready',{detail:{user:null,admin:false}}));return;}
    try{const token=await user.getIdTokenResult(true);state.admin=token.claims.admin===true&&user.email===ADMIN&&user.emailVerified;}
    catch(e){}
    showAdmin(state.admin);
    if(user.email===ADMIN&&user.emailVerified&&!state.admin){
      try{await call('claimHakoAdmin');await auth.currentUser.getIdToken(true);alert('Hako admin yetkisi tanımlandı. Sayfayı yenileyin.');}
      catch(e){console.warn('Admin claim:',e.message);}
    }
    if(state.admin)loadAdminSettings();
    recordVisitor(user).catch(()=>{});
    window.dispatchEvent(new CustomEvent('mm-auth-ready',{detail:{user,admin:state.admin}}));
    watchPublicSettings();watchSeasonTheme();
    state.db.collection('users').doc(user.uid).onSnapshot(d=>{if(d.exists&&d.data().banned){$('bannedOverlay')?.classList.remove('hide');$('bannedOverlay')?.setAttribute('aria-hidden','false');auth.signOut().catch(()=>{});}});
   });
   document.querySelectorAll('.gLogin').forEach(b=>b.addEventListener('click',async()=>{
    try{const provider=new firebase.auth.GoogleAuthProvider();await auth.signInWithPopup(provider);}
    catch(e){try{await call('logLoginFailure',{email:$('regGmail')?.value||''});}catch(_){}alert('Giriş yapılamadı: '+e.message);}
   }));
   bindAdmin(); bindConsent();
  }catch(e){console.error('Firebase başlatılamadı',e);}
 }
 async function recordVisitor(user){
  const ua=navigator.userAgent;let device=/Android|iPhone|iPad/i.test(ua)?'Mobil cihaz':/Windows/i.test(ua)?'Windows bilgisayar':/Mac/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux cihaz':'Bilinmeyen cihaz';
  await state.db.collection('users').doc(user.uid).set({email:(user.email||'').toLowerCase()||null,displayName:user.displayName||'Kullanıcı',device, lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
 }
 async function loadAdminSettings(){
  const d=await state.db.doc('settings/site').get();if(d.exists&&$('hakoMaintenanceToggle'))$('hakoMaintenanceToggle').checked=!!d.data().maintenance;
  const t=await state.db.doc('settings/curriculum').get(); if(t.exists){const el=$('adminTermMode');if(el)el.value=t.data().mode||'first';}
 }
 function bindAdmin(){
  $('saveSeasonTheme')?.addEventListener('click',async()=>{try{await call('setSeasonTheme',{theme:$('adminSeasonTheme')?.value||'default'});msg('seasonMsg','Tema tüm kullanıcılara yayınlandı.');}catch(e){msg('seasonMsg',e.message);}});
  $('saveWheelRewards')?.addEventListener('click',async()=>{try{const items=($('adminWheelRewards')?.value||'').split('\n').map(x=>{const a=x.split('|');return {label:(a[0]||'').trim(),coins:Number(a[1])}});await call('setWheelRewards',{items});msg('wheelAdminMsg','Çark ödülleri kaydedildi.');}catch(e){msg('wheelAdminMsg',e.message);}});
  $('admPublishMarketBtn')?.addEventListener('click',async()=>{try{const file=$('admItemGifFile')?.files?.[0];let gifUrl=$('admItemGifUrl')?.value.trim()||'';if(file){if(file.size>10*1024*1024)throw Error('GIF en fazla 10 MB olabilir.');const ref=firebase.storage().ref('market/'+Date.now()+'_'+file.name.replace(/[^\w.-]/g,'_'));await ref.put(file);gifUrl=await ref.getDownloadURL();}const name=$('admItemName')?.value.trim();const type=$('admItemType')?.value;const price=Number($('admItemPrice')?.value||0);await call('publishMarketItem',{name,type,price,gifUrl,emoji:'🎁',description:$('admItemDesc')?.value||''});msg('admMarketMsg','Ürün markette yayınlandı.');}catch(e){msg('admMarketMsg','Yayınlanamadı: '+e.message);}});
  $('publishTitle')?.addEventListener('click',async()=>{try{await call('publishTitle',{name:$('adminTitleName')?.value||'',price:Number($('adminTitlePrice')?.value||0)});msg('titleMsg','Unvan markette yayınlandı.');}catch(e){msg('titleMsg',e.message);}});
  const ban=$('adminProfileBanBtn'); if(ban){ban.classList.remove('hide');ban.addEventListener('click',async()=>{const target=prompt('Banlanacak kullanıcının UID bilgisini gir:');if(!target)return;try{await call('banUser',{uid:target});alert('Kullanıcı kalıcı olarak banlandı.');}catch(e){alert(e.message);}});}

  $('hakoSaveGifSettings')?.addEventListener('click',async()=>{try{await call('setMaintenance',{enabled:!!$('hakoMaintenanceToggle')?.checked});msg('hakoGifAdminMsg','Sunucu bakım ayarı kaydedildi.');}catch(e){msg('hakoGifAdminMsg','Kaydedilemedi: '+e.message);}});
  document.querySelectorAll('[data-admin-term]').forEach(el=>el.addEventListener('change',async()=>{try{await call('setTermMode',{mode:el.value});msg('adminTermMsg','Dönem ayarı kaydedildi.');}catch(e){msg('adminTermMsg',e.message);}}));
 }
 function watchPublicSettings(){
  state.stopPublic?.();state.stopPublic=state.db.doc('settings/site').onSnapshot(s=>{if(!s.exists)return;const d=s.data();const overlay=$('hakoPublicNotice');if(overlay){overlay.classList.toggle('hide',!d.maintenance||state.admin);}});
 }
 function watchSeasonTheme(){state.stopTheme?.();state.stopTheme=state.db.doc('settings/theme').onSnapshot(s=>{if(!s.exists)return;const t=s.data().theme||'default';document.body.dataset.season=t;document.body.classList.remove('season-newyear','season-halloween','season-ramadan','season-sacrifice');if(t!=='default')document.body.classList.add('season-'+t);});}
 function bindConsent(){
  const b=$('reqLocationBtn'); if(!b)return;
  b.addEventListener('click',()=>{if(!state.user){alert('Konum paylaşmak için önce giriş yapmalısın.');return;}if(!confirm('Yaklaşık konumunu admin panelinde görünmesi için paylaşmak istiyor musun? İzin vermezsen siteyi kullanmaya devam edebilirsin.'))return;
   navigator.geolocation?.getCurrentPosition(async pos=>{try{await state.db.collection('users').doc(state.user.uid).set({location:{lat:Number(pos.coords.latitude.toFixed(2)),lng:Number(pos.coords.longitude.toFixed(2)),sharedAt:firebase.firestore.FieldValue.serverTimestamp()}},{merge:true});const x=$('wxNow');if(x)x.textContent='Yaklaşık konum paylaşıldı.';}catch(e){alert('Konum kaydedilemedi: '+e.message);}},e=>alert('Konum alınamadı veya izin verilmedi.'),{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  });
 }
 document.addEventListener('DOMContentLoaded',init);
})();
