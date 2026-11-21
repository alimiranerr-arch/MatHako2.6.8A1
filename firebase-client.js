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
 function status(text,isError=false){const el=$('firebaseStatus');if(el){el.textContent=text;el.classList.toggle('err',!!isError);el.classList.toggle('ok',!isError);}}
 function ready(user,error){state.authReady=true;window.dispatchEvent(new CustomEvent('mm-auth-ready',{detail:{user:user||null,admin:!!state.admin,error:error||null}}));}
 function call(name,data){if(!state.fn)throw Error('Firebase henüz başlatılmadı.');return state.fn.httpsCallable(name)(data||{});}
 function showAdmin(on){const t=$('tabAdmin'); if(t)t.classList.toggle('hide',!on);}
 function init(){
  if(!window.firebase||!window.firebaseConfig){
   const e=new Error('Firebase SDK yüklenemedi. İnternet bağlantısını ve Firebase CDN erişimini kontrol edin.');
   console.error('Firebase başlatılamadı:',e);status(e.message,true);ready(null,e);return;
  }
  try{
   if(!firebase.apps.length)firebase.initializeApp(window.firebaseConfig);
   state.db=firebase.firestore();state.fn=firebase.functions();
   const auth=firebase.auth();
   auth.onAuthStateChanged(async user=>{
    state.user=user;state.admin=false;showAdmin(false);
    if(!user){
     state.stopPublic?.();state.stopTheme?.();status('Firebase bağlantısı hazır. Gmail ile giriş yapabilirsin.');
     ready(null);return;
    }
    status('Hesap doğrulanıyor…');
    try{
     const token=await Promise.race([
      user.getIdTokenResult().then(value=>({value})),
      new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),5000))
     ]);
     if(token.value)state.admin=token.value.claims.admin===true&&user.email===ADMIN&&user.emailVerified;
     else console.warn('Firebase kimlik doğrulama yanıtı gecikti; yönetici özellikleri geçici olarak kapalı.');
    }catch(e){console.warn('Kimlik bilgileri alınamadı:',e);}
    showAdmin(state.admin);
    try{const emailChange=await call('completeEmailChange');if(emailChange.data?.changed)status('E-posta değişikliğin doğrulandı ve profilin güncellendi.');}catch(e){if(e.code!=='functions/not-found')console.warn('E-posta değişikliği tamamlanamadı:',e.message);}
    if(user.email===ADMIN&&user.emailVerified&&!state.admin){
     call('claimHakoAdmin').then(()=>auth.currentUser?.getIdToken(true)).then(()=>{
      if(auth.currentUser?.uid!==user.uid)return;
      return auth.currentUser.getIdTokenResult().then(token=>{
       state.admin=token.claims.admin===true&&user.email===ADMIN&&user.emailVerified;
       showAdmin(state.admin);if(state.admin)loadAdminSettings().catch(e=>console.warn('Admin ayarları:',e));
       ready(user);
      });
     }).catch(e=>console.warn('Admin claim:',e.message));
    }
    status('Profil bilgileri eşitleniyor…');
    let profileSaved=false;
    try{
     profileSaved=await Promise.race([
      recordVisitor(user).then(()=>true),
      new Promise(resolve=>setTimeout(()=>resolve(false),7000))
     ]);
    }catch(e){console.warn('Profil kaydı tamamlanamadı:',e);status('Oturum açıldı ancak profil kaydedilemedi: '+e.message,true);}
    if(!profileSaved)status('Oturum açıldı; profil eşitlemesi gecikiyor. İnternet bağlantısını kontrol et.',true);
    try{const p=await state.db.collection('users').doc(user.uid).get();if(!p.data()?.surname||!p.data()?.school){const form=$('accountRegisterForm');form?.classList.remove('hide');if($('regGmail'))$('regGmail').value=user.email||'';if($('regFirstName'))$('regFirstName').value=(user.displayName||'').split(' ')[0]||'';}}catch(e){console.warn('Profil formu hazırlanamadı:',e);}
    else status('Hesap hazır. İyi eğlenceler!');
    if(state.admin)loadAdminSettings().catch(e=>console.warn('Admin ayarları:',e));
    ready(user);
    watchPublicSettings();watchSeasonTheme();
    state.db.collection('users').doc(user.uid).onSnapshot(d=>{
     if(d.exists&&d.data().banned){$('bannedOverlay')?.classList.remove('hide');$('bannedOverlay')?.setAttribute('aria-hidden','false');auth.signOut().catch(()=>{});}
    },e=>console.warn('Ban durumu okunamadı:',e));
   },error=>{
    state.user=null;state.admin=false;showAdmin(false);
    const e=error||new Error('Firebase oturum durumu alınamadı.');
    console.error('Firebase oturum hatası:',e);status('Oturum kontrol edilemedi: '+e.message,true);ready(null,e);
   });
   document.querySelectorAll('.gLogin').forEach(b=>b.addEventListener('click',async()=>{
    b.disabled=true;
    try{const provider=new firebase.auth.GoogleAuthProvider();await auth.signInWithPopup(provider);}
    catch(e){try{await call('logLoginFailure',{email:$('regGmail')?.value||''});}catch(_){}alert('Giriş yapılamadı: '+e.message);}
    finally{b.disabled=false;}
   }));
   bindAdmin(); bindConsent(); bindEmailChange(auth); bindRegistrationForm(auth);
  }catch(e){
   console.error('Firebase başlatılamadı',e);status('Firebase başlatılamadı: '+e.message,true);ready(null,e);
  }
 }
 async function recordVisitor(user){
  const ua=navigator.userAgent;let device=/Android|iPhone|iPad/i.test(ua)?'Mobil cihaz':/Windows/i.test(ua)?'Windows bilgisayar':/Mac/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux cihaz':'Bilinmeyen cihaz';
  if(!user.email)throw Error('Google hesabından e-posta bilgisi alınamadı.');
  await state.db.collection('users').doc(user.uid).set({email:user.email.toLowerCase(),displayName:String(user.displayName||'Kullanıcı').slice(0,80),device,lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
 }
 async function loadAdminSettings(){
  const d=await state.db.doc('settings/site').get();if(d.exists){const x=d.data();if($('hakoMaintenanceToggle'))$('hakoMaintenanceToggle').checked=!!x.maintenance;if($('hakoImportantToggle'))$('hakoImportantToggle').checked=!!x.important;if($('hakoSevereToggle'))$('hakoSevereToggle').checked=!!x.severe;if($('hakoMaintenanceImage'))$('hakoMaintenanceImage').value=x.maintenanceImage||'bakim-molasi.png';if($('hakoImportantImage'))$('hakoImportantImage').value=x.importantImage||'helpy-onemli-is.webp';}
  const t=await state.db.doc('settings/curriculum').get(); if(t.exists){const el=$('adminTermMode');if(el)el.value=t.data().mode||'first';}
 }
 function bindAdmin(){
  $('saveSeasonTheme')?.addEventListener('click',async()=>{try{await call('setSeasonTheme',{theme:$('adminSeasonTheme')?.value||'default'});msg('seasonMsg','Tema tüm kullanıcılara yayınlandı.');}catch(e){msg('seasonMsg',e.message);}});
  $('saveWheelRewards')?.addEventListener('click',async()=>{try{const items=($('adminWheelRewards')?.value||'').split('\n').map(x=>{const a=x.split('|');return {label:(a[0]||'').trim(),coins:Number(a[1])}});await call('setWheelRewards',{items});msg('wheelAdminMsg','Çark ödülleri kaydedildi.');}catch(e){msg('wheelAdminMsg',e.message);}});
  $('admPublishMarketBtn')?.addEventListener('click',async()=>{try{const file=$('admItemGifFile')?.files?.[0];let gifUrl=$('admItemGifUrl')?.value.trim()||'';if(file){if(file.size>10*1024*1024)throw Error('GIF en fazla 10 MB olabilir.');const ref=firebase.storage().ref('market/'+Date.now()+'_'+file.name.replace(/[^\w.-]/g,'_'));await ref.put(file);gifUrl=await ref.getDownloadURL();}const name=$('admItemName')?.value.trim();const type=$('admItemType')?.value;const price=Number($('admItemPrice')?.value||0);await call('publishMarketItem',{name,type,price,gifUrl,emoji:'🎁',description:$('admItemDesc')?.value||''});msg('admMarketMsg','Ürün markette yayınlandı.');}catch(e){msg('admMarketMsg','Yayınlanamadı: '+e.message);}});
  $('publishTitle')?.addEventListener('click',async()=>{try{await call('publishTitle',{name:$('adminTitleName')?.value||'',price:Number($('adminTitlePrice')?.value||0)});msg('titleMsg','Unvan markette yayınlandı.');}catch(e){msg('titleMsg',e.message);}});
  const ban=$('adminProfileBanBtn'); if(ban){ban.classList.remove('hide');ban.addEventListener('click',async()=>{const target=prompt('Banlanacak kullanıcının UID bilgisini gir:');if(!target)return;try{await call('banUser',{uid:target});alert('Kullanıcı kalıcı olarak banlandı.');}catch(e){alert(e.message);}});}

  $('hakoSaveGifSettings')?.addEventListener('click',async()=>{try{await call('setMaintenance',{maintenance:!!$('hakoMaintenanceToggle')?.checked,important:!!$('hakoImportantToggle')?.checked,severe:!!$('hakoSevereToggle')?.checked,maintenanceImage:$('hakoMaintenanceImage')?.value||'bakim-molasi.png',importantImage:$('hakoImportantImage')?.value||'helpy-onemli-is.webp'});msg('hakoGifAdminMsg','Sunucu bakım ayarı kaydedildi.');}catch(e){msg('hakoGifAdminMsg','Kaydedilemedi: '+e.message);}});
  document.querySelectorAll('[data-admin-term]').forEach(el=>el.addEventListener('change',async()=>{try{await call('setTermMode',{mode:el.value});msg('adminTermMsg','Dönem ayarı kaydedildi.');}catch(e){msg('adminTermMsg',e.message);}}));
 }
 function watchPublicSettings(){
  state.stopPublic?.();state.stopPublic=state.db.doc('settings/site').onSnapshot(s=>{if(!s.exists)return;const d=s.data(),overlay=$('hakoPublicNotice');if(overlay){const active=!!(d.severe||d.maintenance||d.important);overlay.hidden=!active||state.admin;overlay.classList.toggle('hide',!active||state.admin);if($('hakoNoticeTitle'))$('hakoNoticeTitle').textContent=d.severe?'Büyük Teknik Sorun':d.maintenance?'Bakım Molası':'Önemli Teknik Çalışma';if($('hakoNoticeText'))$('hakoNoticeText').textContent=d.severe?'Sistemimizde önemli bir teknik sorun tespit edildi. Ekibimiz sorunu gidermek için çalışıyor.':d.maintenance?'Sistem üzerinde bakım çalışması yapılıyor. Lütfen daha sonra tekrar deneyin.':'Önemli bir işlem yürütülüyor. Kısa süreli kesintiler yaşanabilir.';if($('hakoNoticeImage'))$('hakoNoticeImage').src=d.severe?'helpy-teknik-onarim.gif':d.maintenance?(d.maintenanceImage||'bakim-molasi.png'):(d.importantImage||'helpy-onemli-is.webp');if($('hakoNoticeClose'))$('hakoNoticeClose').hidden=!!(d.severe||d.maintenance);document.body.classList.toggle('hako-notice-open',active&&!state.admin);}window.dispatchEvent(new CustomEvent('mm-public-settings',{detail:d}));},e=>console.warn('Genel site ayarları okunamadı:',e));
 }
 function watchSeasonTheme(){state.stopTheme?.();state.stopTheme=state.db.doc('settings/theme').onSnapshot(s=>{if(!s.exists)return;const t=s.data().theme||'default';document.body.dataset.season=t;document.body.classList.remove('season-newyear','season-halloween','season-ramadan','season-sacrifice');if(t!=='default')document.body.classList.add('season-'+t);},e=>console.warn('Sezon teması okunamadı:',e));}
 function bindRegistrationForm(auth){
  const verify=$('sendGmailVerifyBtn'),complete=$('completeGmailRegBtn');
  if(verify&&!verify.dataset.bound){verify.dataset.bound='1';verify.addEventListener('click',async()=>{
   const out=$('regVerifyMsg');try{if(!auth.currentUser)throw Error('Önce Gmail ile giriş yap.');if(auth.currentUser.emailVerified){if(out)out.textContent='E-posta adresin zaten doğrulanmış.';return;}await auth.currentUser.sendEmailVerification();if(out)out.textContent='Doğrulama bağlantısı e-posta adresine gönderildi.';}catch(e){if(out)out.textContent=e.message;}
  });}
  if(complete&&!complete.dataset.bound){complete.dataset.bound='1';complete.addEventListener('click',async()=>{
   const out=$('regErrorMsg');try{
    if(!auth.currentUser)throw Error('Önce Gmail ile giriş yap.');
    const displayName=String($('regFirstName')?.value||'').trim().slice(0,20),surname=String($('regLastName')?.value||'').trim().slice(0,80),nickname=String($('regNick')?.value||'').trim().slice(0,40),school=String($('regSchool')?.value||'').trim().slice(0,120);
    if(!displayName||!surname||!nickname||!school)throw Error('Ad, soyad, lakap ve okul alanlarını doldur.');
    await auth.currentUser.updateProfile({displayName});
    const avatarData=await window.MMSettings?.saveAvatar(auth.currentUser)||{avatar:$('presetAvatarSelect')?.value||'🦊',avatarPath:''};
    await state.db.collection('users').doc(auth.currentUser.uid).set({email:auth.currentUser.email.toLowerCase(),displayName,surname,nickname,school,className:'7. sınıf',...avatarData},{merge:true});
    const form=$('accountRegisterForm');form?.classList.add('hide');if(out)out.textContent='Profilin kaydedildi. Maceraya hoş geldin!';
   }catch(e){if(out)out.textContent=e.message;}
  });}
 }
 function bindEmailChange(auth){
  const b=$('requestEmailChangeBtn');if(!b||b.dataset.bound)return;b.dataset.bound='1';
  b.addEventListener('click',async()=>{
   const out=$('emailChangeMsg'),email=String($('newAccountEmail')?.value||'').trim().toLowerCase();
   try{
    if(!auth.currentUser)throw Error('Önce Gmail ile giriş yapmalısın.');
    if(!email)throw Error('Yeni e-posta adresini yaz.');
    await call('requestEmailChange',{email});
    if(typeof auth.currentUser.verifyBeforeUpdateEmail!=='function')throw Error('Bu Firebase Auth sürümü doğrulama bağlantısıyla e-posta değiştirmeyi desteklemiyor. SDK güncellemesi gerekiyor.');
    await auth.currentUser.verifyBeforeUpdateEmail(email);
    if(out)out.textContent='Doğrulama bağlantısı gönderildi. Bağlantıyı açarak değişikliği tamamla. Güvenlik nedeniyle yeni talep için 30 gün beklenir.';
   }catch(e){if(out)out.textContent=e.message;}
  });
 }
 function bindConsent(){
  const b=$('reqLocationBtn'); if(!b)return;
  b.addEventListener('click',()=>{if(!state.user){alert('Konum paylaşmak için önce giriş yapmalısın.');return;}if(!confirm('Yaklaşık konumunu admin panelinde görünmesi için paylaşmak istiyor musun? İzin vermezsen siteyi kullanmaya devam edebilirsin.'))return;
   navigator.geolocation?.getCurrentPosition(async pos=>{try{await state.db.collection('users').doc(state.user.uid).set({location:{lat:Number(pos.coords.latitude.toFixed(2)),lng:Number(pos.coords.longitude.toFixed(2)),sharedAt:firebase.firestore.FieldValue.serverTimestamp()}},{merge:true});const x=$('wxNow');if(x)x.textContent='Yaklaşık konum paylaşıldı.';}catch(e){alert('Konum kaydedilemedi: '+e.message);}},e=>alert('Konum alınamadı veya izin verilmedi.'),{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  });
 }
 document.addEventListener('DOMContentLoaded',init);
})();
