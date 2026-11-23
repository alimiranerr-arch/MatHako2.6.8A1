// Firebase web istemci ayarları (API key web uygulaması tanımlayıcısıdır; özel anahtar değildir).
window.firebaseConfig = {
 apiKey: "AIzaSyDCsLQwKIQkpETXyX0bVVLYOWxEy52rLbo",
 authDomain: "hakomatonline261.firebaseapp.com",
 projectId: "hakomatonline261",
 storageBucket: "hakomatonline261.firebasestorage.app",
 messagingSenderId: "213698338676",
 appId: "1:213698338676:web:b876b839b0ccbc99429621",
 appCheckSiteKey: "" // Firebase Console > App Check > Web uygulaması site key
};
(function(){
 const $=id=>document.getElementById(id), ADMIN='alimiranerr@gmail.com';
 const state={user:null,admin:false,db:null,fn:null,firebaseLoaderSettled:false,profileReady:Promise.resolve(false),presenceTimer:0}; window.MMCloud=state;
 function msg(id,s){const e=$(id);if(e)e.textContent=s;}
 function status(text,isError=false){const el=$('firebaseStatus');if(el){el.textContent=text;el.classList.toggle('err',!!isError);el.classList.toggle('ok',!isError);}}
 function ready(user,error){state.authReady=true;window.dispatchEvent(new CustomEvent('mm-auth-ready',{detail:{user:user||null,admin:!!state.admin,error:error||null}}));}
 function call(name,data){if(!state.fn)throw Error('Firebase henüz başlatılmadı.');return state.fn.httpsCallable(name)(data||{});}
 const DEFAULT_FLAGS={adminBox:true,wheel:true,tasks:true,market:true,online:true};
 function showAdmin(on){const t=$('tabAdmin');if(t)t.classList.toggle('hide',!on);const section=$('s3');if(section)section.classList.toggle('hide',!on);$('adminLocked')?.classList.add('hide');$('adminOpen')?.classList.toggle('hide',!on);$('unlockNameBtn')?.classList.toggle('hide',!on);const box=$('adminLogin');if(box)box.classList.toggle('hide',!on||state.featureFlags?.adminBox===false);if(!on&&window.MatematikMacerasi?.activeSection==='s3')window.MatematikMacerasi.navigate('s0');}
 function applyFeatureFlags(flags){
  state.featureFlags={...DEFAULT_FLAGS,...(flags||{})};
  const f=state.featureFlags;
  if($('admToggleAdminBox'))$('admToggleAdminBox').checked=f.adminBox;if($('admToggleWheel'))$('admToggleWheel').checked=f.wheel;if($('admToggleTasks'))$('admToggleTasks').checked=f.tasks;if($('admToggleMarket'))$('admToggleMarket').checked=f.market;if($('admToggleOnline'))$('admToggleOnline').checked=f.online;
  const map=[['wheel','tabRewards','s4'],['tasks','tabTasks','s8'],['market','tabMarket','s5'],['online','tabSocial','s6'],['online','tabCompete','s9']];
  map.forEach(([key,tabId,sectionId])=>{const disabled=!f[key];$(tabId)?.classList.toggle('hide',disabled);$(sectionId)?.classList.toggle('hide',disabled);});
  showAdmin(state.admin);
  const current=window.MatematikMacerasi?.activeSection;
  if(current&&['s4','s5','s6','s8','s9'].includes(current)&&$(current)?.classList.contains('hide'))window.MatematikMacerasi?.navigate('s0');
  window.dispatchEvent(new CustomEvent('mm-feature-flags',{detail:state.featureFlags}));
 }
 function watchFeatureFlags(){
  state.stopFeatures?.();state.stopFeatures=state.db.doc('settings/features').onSnapshot(s=>applyFeatureFlags(s.exists?s.data().flags:DEFAULT_FLAGS),e=>{console.warn('Özellik ayarları okunamadı:',e);applyFeatureFlags(DEFAULT_FLAGS);});
 }
 async function saveFeatureFlags(){
  const flags={adminBox:!!$('admToggleAdminBox')?.checked,wheel:!!$('admToggleWheel')?.checked,tasks:!!$('admToggleTasks')?.checked,market:!!$('admToggleMarket')?.checked,online:!!$('admToggleOnline')?.checked};
  try{await call('setFeatureFlags',flags);msg('adminFeatureFlagsMsg','Özellik ayarları sunucuya kaydedildi.');}catch(e){msg('adminFeatureFlagsMsg','Kaydedilemedi: '+e.message);}
 }
 function init(){
  if(window.MMFBReady&&!state.firebaseLoaderSettled){
   if(state.firebaseInitPending)return;
   state.firebaseInitPending=true;
   status('Firebase bağlantısı hazırlanıyor…');
   const timeout=new Promise(resolve=>setTimeout(()=>resolve({error:'Firebase SDK yüklemesi 20 saniyede tamamlanmadı.'}),20000));
   Promise.race([window.MMFBReady,timeout]).then(result=>{
    state.firebaseInitPending=false;
    state.firebaseLoaderSettled=true;
    if(result?.error){const e=new Error('Firebase SDK yüklenemedi: '+result.error);console.error('Firebase SDK yüklenemedi:',e);status(e.message,true);ready(null,e);return;}
    const missing=['auth','firestore','functions'].filter(name=>typeof window.firebase?.[name]!=='function');
    if(missing.length){const e=new Error('Firebase SDK eksik modülle yüklendi: '+missing.join(', '));console.error('Firebase SDK eksik:',e);status(e.message,true);ready(null,e);return;}
    init();
   }).catch(error=>{state.firebaseInitPending=false;state.firebaseLoaderSettled=true;const e=error instanceof Error?error:new Error(String(error));console.error('Firebase yükleyici hatası:',e);status('Firebase yükleyici hatası: '+e.message,true);ready(null,e);});
   return;
  }
  if(!window.firebase||!window.firebaseConfig||!window.firebaseConfig.apiKey){
   const e=new Error(!window.firebase?'Firebase SDK yüklenemedi. İnternet bağlantısını ve Firebase CDN erişimini kontrol edin.':'Firebase Web API anahtarı henüz yapılandırılmamış. Firebase Console > Project settings > Your apps bölümündeki gerçek apiKey değerini girin.');
   console.error('Firebase başlatılamadı:',e);status(e.message,true);ready(null,e);return;
  }
  try{
   if(!firebase.apps.length)firebase.initializeApp(window.firebaseConfig);
   if(window.firebaseConfig.appCheckSiteKey&&firebase.appCheck){try{firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(window.firebaseConfig.appCheckSiteKey),true);state.appCheckEnabled=true;}catch(e){state.appCheckEnabled=false;console.warn('App Check başlatılamadı:',e);}}
   else{state.appCheckEnabled=false;console.warn('App Check için Firebase Console site key ayarı bekleniyor.');}
   state.db=firebase.firestore();state.fn=firebase.functions();watchPublicSettings();watchSeasonTheme();watchFeatureFlags();
   const auth=firebase.auth();
   auth.onAuthStateChanged(async user=>{
    state.user=user;state.admin=false;showAdmin(false);
    const authBox=$('gmailAuthBox'),accountCard=$('accountCard'),registerForm=$('accountRegisterForm');
    if(user){
     // Giriş tamamlanınca boş bir kart bırakma; eksik profil varsa kayıt formunu göstereceğiz.
     authBox?.classList.remove('hide');
     accountCard?.classList.add('hide');
     registerForm?.classList.add('hide');
     document.querySelectorAll('.gLogin').forEach(button=>button.classList.add('hide'));
     document.querySelectorAll('.lockover').forEach(overlay=>overlay.classList.add('hide'));
    }else{
     if(state.presenceTimer){clearInterval(state.presenceTimer);state.presenceTimer=0;}
     accountCard?.classList.remove('hide');
     authBox?.classList.remove('hide');
     registerForm?.classList.add('hide');
     document.querySelectorAll('.gLogin').forEach(button=>button.classList.remove('hide'));
     $('profileCard')?.classList.add('hide');
     const menu=$('profileQuickMenu');menu?.classList.remove('show');menu?.setAttribute('aria-hidden','true');
     status('Firebase bağlantısı hazır. Gmail ile giriş yapabilirsin.');
     ready(null);return;
    }
    $('profileCard')?.classList.remove('hide');
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
    // Oturumu hemen aç; profil eşitlemesi arka planda çalışsın.
    status('Hesap hazır. Profil bilgileri arka planda eşitleniyor…');
    state.profileReady=recordVisitor(user).then(()=>{
     startPresence(user);
     status('Profil eşitlemesi tamamlandı. Hesap hazır.');
     return true;
    }).catch(e=>{
     console.error('[Profil eşitleme 0108] Profil kaydı başarısız:',{code:e.code,message:e.message});
     status('Profil kaydı tamamlanamadı: '+(e.message||'Bilinmeyen hata')+' (Hata kodu: 0108; Firebase: '+(e.code||'unknown')+')',true);
     return false;
    });
    ready(user);
    call('completeEmailChange').then(r=>{
     if(r.data?.changed)status('E-posta değişikliğin doğrulandı ve profilin güncellendi.');
    }).catch(e=>{if(e.code!=='functions/not-found')console.warn('E-posta değişikliği tamamlanamadı:',e.message);});
    if(user.email===ADMIN&&user.emailVerified&&!state.admin){
     call('claimHakoAdmin').then(()=>auth.currentUser?.getIdToken(true)).then(()=>{
      if(auth.currentUser?.uid!==user.uid)return;
      return auth.currentUser.getIdTokenResult().then(token=>{
       state.admin=token.claims.admin===true&&user.email===ADMIN&&user.emailVerified;
       showAdmin(state.admin);if(state.admin)loadAdminSettings().catch(e=>console.warn('Admin ayarları:',e));
      });
     }).catch(e=>console.warn('Admin claim:',e.message));
    }
    state.db.collection('users').doc(user.uid).get().then(p=>{
     const incomplete=!p.exists||!p.data()?.surname||!p.data()?.school||!p.data()?.nickname||!p.data()?.className;
     if(incomplete){
      accountCard?.classList.remove('hide');authBox?.classList.remove('hide');
      registerForm?.classList.remove('hide');
      if($('regGmail'))$('regGmail').value=user.email||'';
      if($('regFirstName'))$('regFirstName').value=(user.displayName||'').split(' ')[0]||'';
     }else{
      registerForm?.classList.add('hide');accountCard?.classList.add('hide');
     }
    }).catch(e=>{
     console.warn('Profil formu hazırlanamadı:',e);
     accountCard?.classList.remove('hide');authBox?.classList.remove('hide');
     status('Profil bilgileri okunamadı: '+e.message,true);
    });
    if(state.admin)loadAdminSettings().catch(e=>console.warn('Admin ayarları:',e));
    state.db.collection('users').doc(user.uid).onSnapshot(d=>{
     if(d.exists&&d.data().banned){$('bannedOverlay')?.classList.remove('hide');$('bannedOverlay')?.setAttribute('aria-hidden','false');auth.signOut().catch(()=>{});}
    },e=>console.warn('Ban durumu okunamadı:',e));
   },error=>{
    state.user=null;state.admin=false;showAdmin(false);
    const e=error||new Error('Firebase oturum durumu alınamadı.');
    console.error('Firebase oturum hatası:',e);status('Oturum kontrol edilemedi: '+e.message,true);ready(null,e);
   });
   document.querySelectorAll('.gLogin').forEach(b=>b.addEventListener('click',async()=>{
    if(state.user){return;}
    b.disabled=true;
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    try{
     await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
     await auth.signInWithPopup(provider);
    }catch(e){
     if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/cancelled-popup-request'].includes(e.code)){
      try{await auth.signInWithRedirect(provider);return;}
      catch(redirectError){e=redirectError;}
     }
     call('logLoginFailure',{email:$('regGmail')?.value||''}).catch(()=>{});
     status('Google girişi açılamadı: '+(e.code||'')+' · '+(e.message||'Bilinmeyen hata'),true);
     window.MMError?.show?.('Giriş yapılamadı: '+(e.code||'')+' · '+e.message,'0128');
    }finally{b.disabled=false;}
   }));
   const switchAccount=$('switchAccountBtn');
   if(switchAccount&&!switchAccount.dataset.bound){switchAccount.dataset.bound='1';switchAccount.addEventListener('click',async()=>{
    switchAccount.disabled=true;
    try{await auth.signOut();status('Oturum kapatıldı. Yeni Gmail hesabıyla giriş yapabilirsin.');}
    catch(e){window.MMError?.show?.('Hesap değiştirilemedi: '+e.message,'0128');}
    finally{switchAccount.disabled=false;}
   });}
   bindAdmin(); bindConsent(); bindEmailChange(auth); bindRegistrationForm(auth);
  }catch(e){
   console.error('Firebase başlatılamadı',e);status('Firebase başlatılamadı: '+e.message,true);ready(null,e);
  }
 }
 function startPresence(user){
  if(state.presenceTimer){clearInterval(state.presenceTimer);state.presenceTimer=0;}
  if(!user?.uid||!state.db)return;
  const ref=state.db.collection('onlinePresence').doc(user.uid);
  const update=()=>ref.set({
   uid:user.uid,
   displayName:String(user.displayName||user.email?.split('@')[0]||'Oyuncu').slice(0,80),
   lastSeen:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true}).catch(e=>console.warn('Çevrimiçi durumu güncellenemedi:',e));
  update();
  state.presenceTimer=setInterval(update,30000);
 }
 async function recordVisitor(user){
  const ua=navigator.userAgent;let device=/Android|iPhone|iPad/i.test(ua)?'Mobil cihaz':/Windows/i.test(ua)?'Windows bilgisayar':/Mac/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux cihaz':'Bilinmeyen cihaz';
  if(!user?.uid||!user.email)throw Error('Google hesabından doğrulanmış e-posta bilgisi alınamadı.');
  const ref=state.db.collection('users').doc(user.uid),snap=await ref.get();
  if(snap.exists&&snap.data()?.banned)throw Error('Hesabın yönetici tarafından kalıcı olarak yasaklandı.');
  const profile={displayName:String(user.displayName||user.email.split('@')[0]||'Kullanıcı').slice(0,80),device,lastSeen:firebase.firestore.FieldValue.serverTimestamp()};
  if(!snap.exists){
   profile.email=user.email;
   await ref.set(profile);
   return;
  }
  if(snap.data()?.email===user.email){
   await ref.set(profile,{merge:true});
   return;
  }
  // Eski profil şemasında e-posta alanını yalnızca güvenli sunucu fonksiyonu tamamlayabilir.
  await call('syncUserProfile',{device});
 }
 async function loadAdminSettings(){
  const d=await state.db.doc('settings/site').get();if(d.exists){const x=d.data();if($('hakoMaintenanceToggle'))$('hakoMaintenanceToggle').checked=!!x.maintenance;if($('hakoImportantToggle'))$('hakoImportantToggle').checked=!!x.important;if($('hakoSevereToggle'))$('hakoSevereToggle').checked=!!x.severe;if($('hakoMaintenanceImage'))$('hakoMaintenanceImage').value=x.maintenanceImage||'bakim-molasi.png';if($('hakoImportantImage'))$('hakoImportantImage').value=x.importantImage||'helpy-onemli-is.webp';}
  const t=await state.db.doc('settings/curriculum').get(); if(t.exists){const el=$('adminTermMode');if(el)el.value=t.data().mode||'first';}
  const economy=await state.db.doc('settings/economy').get(),eco=economy.exists?economy.data():{};if($('admDailyTransferLimit'))$('admDailyTransferLimit').value=eco.dailyTransferLimit??1000;if($('admSingleTransferLimit'))$('admSingleTransferLimit').value=eco.singleTransferLimit??500;if($('admCoinsPerScore'))$('admCoinsPerScore').value=eco.coinsPerScore??5;if($('admMaxGameReward'))$('admMaxGameReward').value=eco.maxGameReward??50000;
  const site=await state.db.doc('settings/site').get(),siteData=site.exists?site.data():{};if($('admOnlineMin'))$('admOnlineMin').value=siteData.onlineDisplayMin??'';if($('admOnlineMax'))$('admOnlineMax').value=siteData.onlineDisplayMax??'';if($('admMiniPassGif'))$('admMiniPassGif').value=siteData.miniPassGifUrl||'';
  const f=await state.db.doc('settings/features').get(),flags=f.exists?f.data().flags:DEFAULT_FLAGS;if(flags){if($('admToggleAdminBox'))$('admToggleAdminBox').checked=flags.adminBox!==false;if($('admToggleWheel'))$('admToggleWheel').checked=flags.wheel!==false;if($('admToggleTasks'))$('admToggleTasks').checked=flags.tasks!==false;if($('admToggleMarket'))$('admToggleMarket').checked=flags.market!==false;if($('admToggleOnline'))$('admToggleOnline').checked=flags.online!==false;}
 }
 function bindAdmin(){
  ['admToggleAdminBox','admToggleWheel','admToggleTasks','admToggleMarket','admToggleOnline'].forEach(id=>$(id)?.addEventListener('change',saveFeatureFlags));
  $('saveOnlineRange')?.addEventListener('click',async()=>{const min=$('admOnlineMin')?.value,max=$('admOnlineMax')?.value;try{if((min==='' )!==(max===''))throw Error('İki kutuyu da doldur veya ikisini de boş bırak.');await call('setOnlineDisplayRange',{min:min===''?null:Number(min),max:max===''?null:Number(max)});msg('onlineRangeMsg',min===''?'Gerçek çevrimiçi kullanıcı sayısı gösterilecek.':'Görünen sayı aralığı kaydedildi.');}catch(e){msg('onlineRangeMsg','Kaydedilemedi: '+e.message);}});
  $('saveMiniPassGif')?.addEventListener('click',async()=>{try{const url=String($('admMiniPassGif')?.value||'').trim();await call('setMiniPassGif',{url});msg('miniPassGifMsg',url?'Mini Pass GIF kaydedildi.':'GIF kaldırıldı; simge boş kalacak.');}catch(e){msg('miniPassGifMsg','Kaydedilemedi: '+e.message);}});
  $('saveEconomySettings')?.addEventListener('click',async()=>{const b=$('saveEconomySettings');b.disabled=true;try{const r=await call('setEconomySettings',{dailyTransferLimit:Number($('admDailyTransferLimit')?.value),singleTransferLimit:Number($('admSingleTransferLimit')?.value),coinsPerScore:Number($('admCoinsPerScore')?.value),maxGameReward:Number($('admMaxGameReward')?.value)});msg('economySettingsMsg','Ekonomi ayarları kaydedildi. Oyun ödülü: skor × '+r.data.coinsPerScore+' altın.');}catch(e){msg('economySettingsMsg','Kaydedilemedi: '+e.message);}finally{b.disabled=false;}});
  $('unlockNameBtn')?.addEventListener('click',async()=>{if(!state.admin||!state.user)return;const current=String(state.user.displayName||'Hako'),name=String(prompt('Yeni görünen adını yaz:',current)||'').trim().slice(0,80);if(!name||name===current)return;try{await state.user.updateProfile({displayName:name});await state.db.collection('users').doc(state.user.uid).set({displayName:name},{merge:true});msg('nmMsg','Yönetici profil adı güncellendi.');}catch(e){msg('nmMsg','Ad değiştirilemedi: '+e.message);}});
  $('openAdmin')?.addEventListener('click',()=>{if(state.admin)window.MatematikMacerasi?.navigate('s3');});
  $('ghostKey')?.addEventListener('click',()=>{if(state.admin)window.MatematikMacerasi?.navigate('s3');});
  $('arefresh')?.addEventListener('click',()=>{if(state.admin)window.location.reload();});
  $('adminCreateGiftCodeBtn')?.addEventListener('click',async()=>{const b=$('adminCreateGiftCodeBtn'),out=$('adminGiftCodeMsg');b.disabled=true;try{const r=await call('createGiftCode');if(out)out.textContent='Yeni kod: '+r.data.code+' · 25 altın + Temel Oyun Kartı';}catch(e){if(out)out.textContent='Kod oluşturulamadı: '+e.message;}finally{b.disabled=false;}});
  $('saveSeasonTheme')?.addEventListener('click',async()=>{try{await call('setSeasonTheme',{theme:$('adminSeasonTheme')?.value||'default'});msg('seasonMsg','Tema tüm kullanıcılara yayınlandı.');}catch(e){msg('seasonMsg',e.message);}});
  $('saveWheelRewards')?.addEventListener('click',async()=>{try{const items=($('adminWheelRewards')?.value||'').split('\n').map(x=>{const a=x.split('|');return {label:(a[0]||'').trim(),coins:Number(a[1])}});await call('setWheelRewards',{items});msg('wheelAdminMsg','Çark ödülleri kaydedildi.');}catch(e){msg('wheelAdminMsg',e.message);}});
  $('admAddToInvSellBtn')?.addEventListener('click',async()=>{const target=prompt('Hedef oyuncunun UID bilgisini gir. Boş bırakırsan ürün kendi envanterine eklenir:','');if(target===null)return;const b=$('admAddToInvSellBtn');b.disabled=true;try{const file=$('admItemGifFile')?.files?.[0];let gifUrl=$('admItemGifUrl')?.value.trim()||'';if(file){if(file.size>10*1024*1024)throw Error('Görsel en fazla 10 MB olabilir.');if(!['image/gif','image/png','image/jpeg','image/webp'].includes(file.type))throw Error('GIF, PNG, JPEG veya WebP kullan.');const path='market/'+Date.now()+'_'+file.name.replace(/[^\w.-]/g,'_'),ref=firebase.storage().ref(path);await ref.put(file);gifUrl=await ref.getDownloadURL();}const name=$('admItemName')?.value.trim(),type=$('admItemType')?.value,price=Number($('admItemPrice')?.value||0);const published=await call('publishAndGrantMarketItem',{name,type,price,gifUrl,emoji:'🎁',description:$('admItemDesc')?.value||'',targetUid:target.trim()||state.user.uid});msg('admMarketMsg','Ürün yayınlandı ve hedef kullanıcının envanterine eklendi. Ürün kimliği: '+published.data.itemId);}catch(e){msg('admMarketMsg','İşlem tamamlanamadı: '+e.message);}finally{b.disabled=false;}});
  $('admPublishMarketBtn')?.addEventListener('click',async()=>{try{const file=$('admItemGifFile')?.files?.[0];let gifUrl=$('admItemGifUrl')?.value.trim()||'';if(file){if(file.size>10*1024*1024)throw Error('GIF en fazla 10 MB olabilir.');const ref=firebase.storage().ref('market/'+Date.now()+'_'+file.name.replace(/[^\w.-]/g,'_'));await ref.put(file);gifUrl=await ref.getDownloadURL();}const name=$('admItemName')?.value.trim();const type=$('admItemType')?.value;const price=Number($('admItemPrice')?.value||0);await call('publishMarketItem',{name,type,price,gifUrl,emoji:'🎁',description:$('admItemDesc')?.value||''});msg('admMarketMsg','Ürün markette yayınlandı.');}catch(e){msg('admMarketMsg','Yayınlanamadı: '+e.message);}});
  $('publishTitle')?.addEventListener('click',async()=>{try{await call('publishTitle',{name:$('adminTitleName')?.value||'',price:Number($('adminTitlePrice')?.value||0)});msg('titleMsg','Unvan markette yayınlandı.');}catch(e){msg('titleMsg',e.message);}});
  const ban=$('adminProfileBanBtn'); if(ban){ban.classList.remove('hide');ban.addEventListener('click',async()=>{const target=prompt('Banlanacak kullanıcının UID bilgisini gir:');if(!target)return;try{await call('banUser',{uid:target});alert('Kullanıcı kalıcı olarak banlandı.');}catch(e){alert(e.message);}});}

  $('hakoSaveGifSettings')?.addEventListener('click',async()=>{try{await call('setMaintenance',{maintenance:!!$('hakoMaintenanceToggle')?.checked,important:!!$('hakoImportantToggle')?.checked,severe:!!$('hakoSevereToggle')?.checked,maintenanceImage:$('hakoMaintenanceImage')?.value||'bakim-molasi.png',importantImage:$('hakoImportantImage')?.value||'helpy-onemli-is.webp'});msg('hakoGifAdminMsg','Sunucu bakım ayarı kaydedildi.');}catch(e){msg('hakoGifAdminMsg','Kaydedilemedi: '+e.message);}});
  document.querySelectorAll('[data-admin-term]').forEach(el=>el.addEventListener('change',async()=>{try{await call('setTermMode',{mode:el.value});msg('adminTermMsg','Dönem ayarı kaydedildi.');}catch(e){msg('adminTermMsg',e.message);}}));
  $('toggleSemesterBtn')?.addEventListener('click',async()=>{if(!state.admin)return;const select=$('adminTermMode'),mode=select?.value==='second'?'first':'second';try{await call('setTermMode',{mode});if(select)select.value=mode;msg('adminTermMsg',mode==='second'?'1. ve 2. dönem konuları açıldı.':'Yalnızca 1. dönem konuları açıldı.');}catch(e){msg('adminTermMsg',e.message);}});
 }
 function watchPublicSettings(){
  state.stopPublic?.();state.stopPublic=state.db.doc('settings/site').onSnapshot(s=>{if(!s.exists)return;const d=s.data(),overlay=$('hakoPublicNotice');
   const min=Number(d.onlineDisplayMin),max=Number(d.onlineDisplayMax),rangeValid=Number.isInteger(min)&&Number.isInteger(max)&&min>0&&max>=min;
   if(rangeValid){const shown=min+Math.floor(Math.random()*(max-min+1));document.querySelectorAll('#onlineCount').forEach(el=>{el.textContent=String(shown);el.dataset.adminOverride='true';});}else document.querySelectorAll('#onlineCount').forEach(el=>{el.dataset.adminOverride='false';});
   const passGif=$('miniPassAdminGif');if(passGif){const url=typeof d.miniPassGifUrl==='string'?d.miniPassGifUrl:'';passGif.src=url;passGif.classList.toggle('hide',!url);}if(overlay){const active=!!(d.severe||d.maintenance||d.important);overlay.hidden=!active||state.admin;overlay.classList.toggle('hide',!active||state.admin);if($('hakoNoticeTitle'))$('hakoNoticeTitle').textContent=d.severe?'Büyük Teknik Sorun':d.maintenance?'Bakım Molası':'Önemli Teknik Çalışma';if($('hakoNoticeText'))$('hakoNoticeText').textContent=d.severe?'Sistemimizde önemli bir teknik sorun tespit edildi. Ekibimiz sorunu gidermek için çalışıyor.':d.maintenance?'Sistem üzerinde bakım çalışması yapılıyor. Lütfen daha sonra tekrar deneyin.':'Önemli bir işlem yürütülüyor. Kısa süreli kesintiler yaşanabilir.';if($('hakoNoticeImage'))$('hakoNoticeImage').src=d.severe?'helpy-teknik-onarim.gif':d.maintenance?(d.maintenanceImage||'bakim-molasi.png'):(d.importantImage||'helpy-onemli-is.webp');if($('hakoNoticeClose'))$('hakoNoticeClose').hidden=!!(d.severe||d.maintenance);document.body.classList.toggle('hako-notice-open',active&&!state.admin);}window.dispatchEvent(new CustomEvent('mm-public-settings',{detail:d}));},e=>console.warn('Genel site ayarları okunamadı:',e));
 }
 function watchSeasonTheme(){state.stopTheme?.();state.stopTheme=state.db.doc('settings/theme').onSnapshot(s=>{if(!s.exists)return;const t=s.data().theme||'default';document.body.dataset.season=t;document.body.classList.remove('season-newyear','season-halloween','season-ramadan','season-sacrifice');if(t!=='default')document.body.classList.add('season-'+t);},e=>console.warn('Sezon teması okunamadı:',e));}
 function bindRegistrationForm(auth){
  const verify=$('sendGmailVerifyBtn'),complete=$('completeGmailRegBtn');
  if(verify&&!verify.dataset.bound){verify.dataset.bound='1';verify.addEventListener('click',async()=>{
   const out=$('regVerifyMsg');try{if(!auth.currentUser)throw Error('Önce Gmail ile giriş yap.');if(auth.currentUser.emailVerified){if(out)out.textContent='E-posta adresin zaten doğrulanmış.';return;}await auth.currentUser.sendEmailVerification();if(out)out.textContent='Doğrulama bağlantısı e-posta adresine gönderildi.';}catch(e){if(out)out.textContent=(e.code==='auth/user-not-found'||e.code==='functions/not-found'?'Girilen e-posta adresi bulunamadı. (Hata kodu: 0122)':e.message);}
  });}
  if(complete&&!complete.dataset.bound){complete.dataset.bound='1';complete.addEventListener('click',async()=>{
   const out=$('regErrorMsg');try{
    if(!auth.currentUser)throw Error('Önce Gmail ile giriş yap.');
    const displayName=String($('regFirstName')?.value||'').trim().slice(0,20),surname=String($('regLastName')?.value||'').trim().slice(0,80),nickname=String($('regNick')?.value||'').trim().slice(0,40),school=String($('regSchool')?.value||'').trim().slice(0,120),className=String($('regClassName')?.value||'').trim().slice(0,30);
    if(!displayName||!surname||!nickname||!school||!className)throw Error('Ad, soyad, takma ad, okul adı ve sınıf alanlarını doldur.');
    await auth.currentUser.updateProfile({displayName});
    const avatarData=await window.MMSettings?.saveAvatar(auth.currentUser)||{avatar:$('presetAvatarSelect')?.value||'🦊',avatarPath:''};
    await state.db.collection('users').doc(auth.currentUser.uid).set({email:auth.currentUser.email,displayName,surname,nickname,school,className,...avatarData},{merge:true});
    const form=$('accountRegisterForm');form?.classList.add('hide');$('accountCard')?.classList.add('hide');if(out)out.textContent='Profilin kaydedildi. Maceraya hoş geldin!';
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
  const b=$('reqLocationBtn');if(!b)return;
  b.addEventListener('click',()=>{if(!state.user){alert('Konum ve hava durumu için önce giriş yapmalısın.');return;}if(!confirm('Yaklaşık konumunu admin panelinde paylaşmayı ve hava durumu bilgisini almak için Open-Meteo servisine göndermeyi kabul ediyor musun? İzin vermezsen siteyi kullanmaya devam edebilirsin.'))return;
   if(!navigator.geolocation){msg('wxNow','Bu tarayıcı konum özelliğini desteklemiyor.');return;}
   b.disabled=true;msg('wxNow','Konum alınıyor…');
   navigator.geolocation.getCurrentPosition(async pos=>{try{
    const lat=pos.coords.latitude,lng=pos.coords.longitude;
    await state.db.collection('users').doc(state.user.uid).set({location:{lat:Number(lat.toFixed(2)),lng:Number(lng.toFixed(2)),sharedAt:firebase.firestore.FieldValue.serverTimestamp()}},{merge:true});
    msg('wxNow','Yaklaşık konum kaydedildi; hava durumu alınıyor…');
    const url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lng)+'&current=temperature_2m,weather_code&timezone=auto';
    const response=await fetch(url);if(!response.ok)throw Error('Hava durumu servisi yanıt vermedi.');
    const weather=await response.json(),current=weather.current||{},code=Number(current.weather_code);
    const effect=code===0||code<=3?'sunny':[71,73,75,77,85,86].includes(code)?'snow':[45,48,51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)?'rain':'none';
    const labels={sunny:'Açık / az bulutlu',rain:'Yağışlı',snow:'Karlı',none:'Bulutlu / sisli'};
    if($('fxSel')){$('fxSel').value=effect;$('fxSel').dispatchEvent(new Event('change',{bubbles:true}));}
    msg('wxNow',(current.temperature_2m??'—')+'°C · '+labels[effect]+' · Konum yaklaşık olarak kaydedildi.');
   }catch(e){msg('wxNow','Konum kaydedildi; hava durumu alınamadı: '+e.message);}finally{b.disabled=false;}
   },e=>{msg('wxNow','Konum alınamadı veya izin verilmedi.');b.disabled=false;},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  });
 }
 // Bu dosya index.html'de uygulama HTML'inden sonra yüklenir. DOMContentLoaded beklemek,
 // sonraki klasik scriptlerden biri takılırsa Firebase ve arayüz başlangıcını kilitleyebilir.
 init();
})();
