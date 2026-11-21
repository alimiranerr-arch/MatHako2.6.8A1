const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');
admin.initializeApp();
const db=admin.firestore(), Field=admin.firestore.FieldValue;
const ADMIN_EMAIL='alimiranerr@gmail.com';
function requireUser(req){if(!req.auth)throw new HttpsError('unauthenticated','Önce giriş yapmalısın.');if(req.auth.token.email_verified!==true)throw new HttpsError('permission-denied','Önce e-posta adresini doğrulamalısın.');return req.auth.uid;}
function requireAdmin(req){const uid=requireUser(req);if(req.auth.token.admin!==true||req.auth.token.email!==ADMIN_EMAIL||req.auth.token.email_verified!==true)throw new HttpsError('permission-denied','Bu işlem yalnızca doğrulanmış Hako admin hesabına açıktır.');return uid;}
async function userDoc(uid){const d=await db.doc(`users/${uid}`).get();if(!d.exists)throw new HttpsError('failed-precondition','Kullanıcı profili henüz hazır değil. Sayfayı yenileyip tekrar dene.');if(d.data().banned)throw new HttpsError('permission-denied','Hesabın yönetici tarafından kalıcı olarak yasaklandı.');}
async function rateLimit(uid,action,max,windowMs=10*60*1000){
 const key=crypto.createHash('sha256').update(action+':'+uid).digest('hex').slice(0,40);
 const ref=db.doc('apiRateLimits/'+key),now=Date.now();
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),old=snap.exists?snap.data():{};
  const active=old.windowStart&&now-old.windowStart<windowMs,count=active?(Number(old.count)||0):0;
  if(count>=max)throw new HttpsError('resource-exhausted','Çok sık istek gönderildi. Biraz sonra tekrar dene.');
  tx.set(ref,{windowStart:active?old.windowStart:now,count:count+1,updatedAt:Field.serverTimestamp()});
 });
}
function istanbulDayKey(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return values.year+'-'+values.month+'-'+values.day;
}
exports.claimHakoAdmin=onCall(async req=>{if(!req.auth||req.auth.token.email!==ADMIN_EMAIL||req.auth.token.email_verified!==true)throw new HttpsError('permission-denied','Admin e-postası doğrulanmış olmalı.');const u=await admin.auth().getUser(req.auth.uid);await admin.auth().setCustomUserClaims(u.uid,{...(u.customClaims||{}),admin:true});await db.collection('auditLogs').add({action:'admin-claim-granted',uid:u.uid,email:ADMIN_EMAIL,at:Field.serverTimestamp()});return{ok:true};});
exports.setMaintenance=onCall(async req=>{const uid=requireAdmin(req);const enabled=!!req.data.enabled;await db.doc('settings/site').set({maintenance:enabled,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,maintenance:enabled};});
exports.setTermMode=onCall(async req=>{const uid=requireAdmin(req),mode=req.data.mode;if(!['first','second'].includes(mode))throw new HttpsError('invalid-argument','Dönem first veya second olmalı.');await db.doc('settings/curriculum').set({mode,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,mode};});
exports.setSeasonTheme=onCall(async req=>{const uid=requireAdmin(req),theme=req.data.theme;if(!['default','newyear','halloween','ramadan','sacrifice'].includes(theme))throw new HttpsError('invalid-argument','Geçersiz tema.');await db.doc('settings/theme').set({theme,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,theme};});
exports.banUser=onCall(async req=>{const uid=requireAdmin(req),targetUid=String(req.data.uid||'');if(!targetUid||targetUid===uid)throw new HttpsError('invalid-argument','Geçersiz kullanıcı.');const target=await admin.auth().getUser(targetUid);if(target.email===ADMIN_EMAIL)throw new HttpsError('permission-denied','Hako admin banlanamaz.');await admin.auth().updateUser(targetUid,{disabled:true});await admin.auth().revokeRefreshTokens(targetUid);await db.doc(`users/${targetUid}`).set({banned:true,bannedAt:Field.serverTimestamp(),bannedBy:uid},{merge:true});return{ok:true};});
exports.publishMarketItem=onCall(async req=>{const uid=requireAdmin(req),d=req.data||{},name=String(d.name||'').trim(),type=String(d.type||'item'),price=Number(d.price);if(!name||name.length>80||!Number.isFinite(price)||price<0||price>1000000)throw new HttpsError('invalid-argument','Ürün adı veya fiyat geçersiz.');const ref=await db.collection('market').add({name,type,price,emoji:String(d.emoji||'🎁').slice(0,8),gifUrl:String(d.gifUrl||'').slice(0,1000),description:String(d.description||'').slice(0,300),published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{ok:true,id:ref.id};});
exports.setWheelRewards=onCall(async req=>{const uid=requireAdmin(req),items=req.data.items;if(!Array.isArray(items)||items.length<2||items.length>12)throw new HttpsError('invalid-argument','Çark için 2-12 ödül gerekli.');const clean=items.map(x=>({label:String(x.label||'').slice(0,32),coins:Number(x.coins)}));if(clean.some(x=>!x.label||!Number.isInteger(x.coins)||x.coins<0||x.coins>10000))throw new HttpsError('invalid-argument','Ödül değerleri geçersiz.');await db.doc('settings/wheel').set({items:clean,updatedBy:uid,updatedAt:Field.serverTimestamp()});return{ok:true};});
exports.publishTitle=onCall(async req=>{const uid=requireAdmin(req),name=String(req.data.name||'').trim(),price=Number(req.data.price);if(!name||name.length>32||!Number.isFinite(price)||price<0)throw new HttpsError('invalid-argument','Unvan veya fiyat geçersiz.');const r=await db.collection('market').add({name,type:'title',price,published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{id:r.id};});
exports.purchaseMarketItem=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const id=String(req.data.itemId||'');if(!id)throw new HttpsError('invalid-argument','Ürün seçilmedi.');const result=await db.runTransaction(async tx=>{const ur=db.doc(`users/${uid}`),ir=db.doc(`market/${id}`);const [u,i]=await Promise.all([tx.get(ur),tx.get(ir)]);if(!i.exists||!i.data().published)throw new HttpsError('not-found','Ürün bulunamadı.');const price=Number(i.data().price)||0,coins=Number(u.data()?.coins)||0;if(coins<price)throw new HttpsError('failed-precondition','Yeterli altının yok.');if(['membership','miniPass'].includes(i.data().type)&&u.data()?.membershipUntil>Date.now())throw new HttpsError('failed-precondition','Aynı anda yalnızca bir aktif üyelik veya MiniPass alabilirsin.');tx.set(ur,{coins:coins-price,inventory:Field.arrayUnion({itemId:id,name:i.data().name,type:i.data().type,ownedAt:Date.now()}),...(['membership','miniPass'].includes(i.data().type)?{membership:i.data().name,membershipType:i.data().type,membershipUntil:Date.now()+30*86400000}:{}),...(i.data().type==='title'?{title:i.data().name}:{})},{merge:true});return{coins:coins-price,name:i.data().name};});return result;});
exports.spinDailyWheel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const ref=db.doc(`wheelClaims/${uid}`);const cfg=await db.doc('settings/wheel').get();const rewards=cfg.exists&&Array.isArray(cfg.data().items)?cfg.data().items:[{label:'10 Altın',coins:10},{label:'25 Altın',coins:25},{label:'50 Altın',coins:50},{label:'5 Altın',coins:5},{label:'100 Altın',coins:100}];const r=rewards[Math.floor(Math.random()*rewards.length)];await db.runTransaction(async tx=>{const [claim,user]=await Promise.all([tx.get(ref),tx.get(db.doc(`users/${uid}`))]);const today=istanbulDayKey();if(claim.exists&&claim.data().day===today)throw new HttpsError('failed-precondition','Bugünkü çark hakkını kullandın.');tx.set(ref,{day:today,at:Field.serverTimestamp(),reward:r});tx.set(db.doc(`users/${uid}`),{coins:(Number(user.data()?.coins)||0)+r.coins},{merge:true});});return r;});
exports.claimMiniPass=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const ref=db.doc(`miniPassClaims/${uid}`),u=db.doc(`users/${uid}`),today=istanbulDayKey();let reward;await db.runTransaction(async tx=>{const [c,us]=await Promise.all([tx.get(ref),tx.get(u)]);if(c.exists&&c.data().day===today)throw new HttpsError('failed-precondition','Günlük Mini Pass ödülünü zaten aldın.');const card=Math.random()<0.22;reward={coins:15,card:card?{id:'basic-'+today,name:'Temel Oyun Kartı',type:'card'}:null};const inv=Array.isArray(us.data()?.inventory)?us.data().inventory:[];tx.set(ref,{day:today,at:Field.serverTimestamp(),reward});tx.set(u,{coins:(Number(us.data()?.coins)||0)+reward.coins,...(card?{inventory:[...inv,{...reward.card,ownedAt:Date.now()}]}:{})},{merge:true});});return reward;});
exports.logLoginFailure=onCall(async req=>{
 const email=String(req.data?.email||'').trim().toLowerCase().slice(0,254);
 const ip=String(req.rawRequest?.ip||'unknown');
 const key=crypto.createHash('sha256').update(ip).digest('hex').slice(0,40);
 const rateRef=db.doc('loginFailureRateLimits/'+key);
 const now=Date.now(),windowMs=10*60*1000;
 await db.runTransaction(async tx=>{
  const snap=await tx.get(rateRef),old=snap.exists?snap.data():{};
  const count=old.windowStart&&now-old.windowStart<windowMs?Number(old.count)||0:0;
  if(count>=8)throw new HttpsError('resource-exhausted','Çok fazla deneme yapıldı. Biraz sonra tekrar dene.');
  tx.set(rateRef,{windowStart:count?old.windowStart:now,count:count+1,updatedAt:Field.serverTimestamp()});
 });
 await db.collection('loginFailures').add({email:email||'Bilinmeyen',displayName:'Bilinmeyen kullanıcı',createdAt:Field.serverTimestamp(),source:'client-auth-error'});
 return{ok:true};
});
exports.searchPlayers=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'searchPlayers',30);
 const q=String(req.data?.query||'').trim().slice(0,40);
 if(q.length<2)throw new HttpsError('invalid-argument','En az 2 karakter yaz.');
 let docs=[];
 const exact=await db.doc('users/'+q).get();
 if(exact.exists&&!exact.data().banned)docs=[exact];
 else {
  const snap=await db.collection('users').orderBy('displayName').startAt(q).endAt(q+'\uf8ff').limit(10).get();
  docs=snap.docs.filter(d=>!d.data().banned);
 }
 return {players:docs.map(d=>({uid:d.id,displayName:String(d.data().displayName||d.data().nickname||'Oyuncu').slice(0,40),playerId:String(d.data().playerId||d.id).slice(0,64)}))};
});
exports.findChatMembers=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'findChatMembers',10);
 const emails=Array.isArray(req.data?.emails)?[...new Set(req.data.emails.map(x=>String(x||'').trim().toLowerCase()).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))].slice(0,10):[];
 if(!emails.length)throw new HttpsError('invalid-argument','Geçerli e-posta adresi gir.');
 const snap=await db.collection('users').where('email','in',emails).limit(10).get();
 return {uids:snap.docs.filter(d=>!d.data().banned).map(d=>d.id)};
});
exports.protectAdminProfile=onDocumentCreated('users/{uid}',async e=>{const uid=e.params.uid,u=await admin.auth().getUser(uid).catch(()=>null);if(u&&u.email===ADMIN_EMAIL&&u.emailVerified)await admin.auth().setCustomUserClaims(uid,{...(u.customClaims||{}),admin:true});});

// Skorlar yalnızca callable üzerinden yazılır; oyuncu kendi puanını değiştiremez.
exports.submitGameScore=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const d=req.data||{},score=Number(d.score),questions=Number(d.questions),mode=String(d.mode||'classic'),topic=String(d.topic||'Karışık');
 if(!Number.isInteger(score)||score<0||!Number.isInteger(questions)||questions<1||questions>500||score>questions*20||!['classic','endless','retry','balance'].includes(mode)||(mode==='retry'&&questions>10))throw new HttpsError('invalid-argument','Skor, soru sayısı veya oyun modu geçersiz.');
 const ur=db.doc(`users/${uid}`),u=await ur.get(),name=String(u.data()?.displayName||req.auth.token.name||'Oyuncu').slice(0,32),publicScore=d.public===true;
 const ref=await db.collection('scores').add({uid,playerName:name,score,mode,topic:topic.slice(0,40),public:publicScore,questions,createdAt:Field.serverTimestamp()});
 return {ok:true,id:ref.id};
});


// Asenkron, kodla katılınan düellolar: her iki oyuncu da skorunu ayrı gönderir.
exports.createDuel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');const topic=String(req.data?.topic||'Karışık').slice(0,40);const ref=db.collection('duels').doc(code);await ref.create({code,hostUid:uid,players:[uid],topic,status:'waiting',scores:{},createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000});return{code,topic};});
exports.joinDuel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(!code)throw new HttpsError('invalid-argument','Düello kodu gerekli.');let topic='Karışık';await db.runTransaction(async tx=>{const r=db.doc(`duels/${code}`),d=await tx.get(r);if(!d.exists||d.data().expiresAt<Date.now())throw new HttpsError('not-found','Düello bulunamadı veya süresi doldu.');const x=d.data();if(x.hostUid===uid)throw new HttpsError('failed-precondition','Kendi düellona katılamazsın.');if(x.status!=='waiting')throw new HttpsError('failed-precondition','Bu düello dolu veya tamamlanmış.');topic=x.topic||'Karışık';tx.update(r,{players:[x.hostUid,uid],status:'playing',joinedAt:Field.serverTimestamp()});});return{ok:true,code,topic};});
exports.submitDuelResult=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().slice(0,6),score=Number(req.data?.score),correct=Number(req.data?.correct);if(!code||!Number.isInteger(score)||score<0||!Number.isInteger(correct)||correct<0||correct>10||score>correct*20)throw new HttpsError('invalid-argument','Düello sonucu geçersiz.');let completed=false;await db.runTransaction(async tx=>{const r=db.doc(`duels/${code}`),d=await tx.get(r);if(!d.exists||!d.data().players?.includes(uid)||d.data().status!=='playing')throw new HttpsError('permission-denied','Bu düelloya katılma yetkin yok.');if(d.data().scores?.[uid])throw new HttpsError('already-exists','Sonucun zaten kaydedildi.');const scores={...(d.data().scores||{}),[uid]:{score,correct,at:Date.now()}};completed=Object.keys(scores).length===2;tx.update(r,{scores,status:completed?'completed':'playing',completedAt:completed?Field.serverTimestamp():null});});return{ok:true,completed};});
