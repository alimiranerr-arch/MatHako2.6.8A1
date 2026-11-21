const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');
function randomJoinCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>chars[crypto.randomInt(0,chars.length)]).join('');}
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
exports.setFeatureFlags=onCall(async req=>{
 const uid=requireAdmin(req),d=req.data||{},keys=['adminBox','wheel','tasks','market','online'],flags={};
 for(const key of keys){if(typeof d[key]!=='boolean')throw new HttpsError('invalid-argument','Özellik ayarları boolean olmalı.');flags[key]=d[key];}
 await db.doc('settings/features').set({flags,updatedAt:Field.serverTimestamp()},{merge:true});
 return{ok:true,flags};
});
exports.setMaintenance=onCall(async req=>{const uid=requireAdmin(req),d=req.data||{},enabled=!!d.maintenance,important=!!d.important,severe=!!d.severe,allowed=['bakim-molasi.png','helpy-onemli-is.webp','helpy-teknik-onarim.gif'],maintenanceImage=allowed.includes(d.maintenanceImage)?d.maintenanceImage:'bakim-molasi.png',importantImage=allowed.includes(d.importantImage)?d.importantImage:'helpy-onemli-is.webp';await db.doc('settings/site').set({maintenance:enabled,important,severe,maintenanceImage,importantImage,updatedAt:Field.serverTimestamp()},{merge:true});return{ok:true,maintenance:enabled,important,severe};});
exports.setTermMode=onCall(async req=>{const uid=requireAdmin(req),mode=req.data.mode;if(!['first','second'].includes(mode))throw new HttpsError('invalid-argument','Dönem first veya second olmalı.');await db.doc('settings/curriculum').set({mode,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,mode};});
exports.setEconomySettings=onCall(async req=>{
 const uid=requireAdmin(req),d=req.data||{};
 const dailyTransferLimit=Number(d.dailyTransferLimit),singleTransferLimit=Number(d.singleTransferLimit),coinsPerScore=Number(d.coinsPerScore),maxGameReward=Number(d.maxGameReward);
 if(!Number.isSafeInteger(dailyTransferLimit)||dailyTransferLimit<1||dailyTransferLimit>1000000||!Number.isSafeInteger(singleTransferLimit)||singleTransferLimit<1||singleTransferLimit>50000||singleTransferLimit>dailyTransferLimit||!Number.isSafeInteger(coinsPerScore)||coinsPerScore<0||coinsPerScore>100||!Number.isSafeInteger(maxGameReward)||maxGameReward<0||maxGameReward>1000000)throw new HttpsError('invalid-argument','Ekonomi ayarları geçersiz. Günlük limit 1-1.000.000, tek transfer 1-50.000, skor oranı 0-100 ve oyun ödül üst sınırı 0-1.000.000 olmalı.');
 await db.doc('settings/economy').set({dailyTransferLimit,singleTransferLimit,coinsPerScore,maxGameReward,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});
 return{ok:true,dailyTransferLimit,singleTransferLimit,coinsPerScore,maxGameReward};
});
exports.setSeasonTheme=onCall(async req=>{const uid=requireAdmin(req),theme=req.data.theme;if(!['default','newyear','halloween','ramadan','sacrifice'].includes(theme))throw new HttpsError('invalid-argument','Geçersiz tema.');await db.doc('settings/theme').set({theme,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,theme};});
exports.banUser=onCall(async req=>{const uid=requireAdmin(req),targetUid=String(req.data.uid||'');if(!targetUid||targetUid===uid)throw new HttpsError('invalid-argument','Geçersiz kullanıcı.');const target=await admin.auth().getUser(targetUid);if(target.email===ADMIN_EMAIL)throw new HttpsError('permission-denied','Hako admin banlanamaz.');await admin.auth().updateUser(targetUid,{disabled:true});await admin.auth().revokeRefreshTokens(targetUid);await db.doc(`users/${targetUid}`).set({banned:true,bannedAt:Field.serverTimestamp(),bannedBy:uid},{merge:true});return{ok:true};});
exports.publishMarketItem=onCall(async req=>{const uid=requireAdmin(req),d=req.data||{},name=String(d.name||'').trim(),type=String(d.type||'item'),price=Number(d.price),gifUrl=String(d.gifUrl||'').trim().slice(0,1000);if(!name||name.length>80||!['badge','emoji','card','membership','miniPass','theme','avatar','title','item'].includes(type)||!Number.isSafeInteger(price)||price<0||price>1000000||(gifUrl&&!/^https:\/\//i.test(gifUrl)))throw new HttpsError('invalid-argument','Ürün adı, türü veya fiyatı geçersiz.');const ref=await db.collection('market').add({name,type,price,emoji:String(d.emoji||'🎁').slice(0,8),gifUrl,description:String(d.description||'').slice(0,300),published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{ok:true,id:ref.id};});
exports.setWheelRewards=onCall(async req=>{const uid=requireAdmin(req),items=req.data.items;if(!Array.isArray(items)||items.length<2||items.length>12)throw new HttpsError('invalid-argument','Çark için 2-12 ödül gerekli.');const clean=items.map(x=>({label:String(x.label||'').slice(0,32),coins:Number(x.coins)}));if(clean.some(x=>!x.label||!Number.isInteger(x.coins)||x.coins<0||x.coins>10000))throw new HttpsError('invalid-argument','Ödül değerleri geçersiz.');await db.doc('settings/wheel').set({items:clean,updatedBy:uid,updatedAt:Field.serverTimestamp()});return{ok:true};});
exports.publishTitle=onCall(async req=>{const uid=requireAdmin(req),name=String(req.data.name||'').trim(),price=Number(req.data.price);if(!name||name.length>32||!Number.isSafeInteger(price)||price<0||price>1000000)throw new HttpsError('invalid-argument','Unvan veya fiyat geçersiz.');const r=await db.collection('market').add({name,type:'title',price,published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{id:r.id};});
exports.publishAndGrantMarketItem=onCall(async req=>{
 const adminUid=requireAdmin(req),d=req.data||{},name=String(d.name||'').trim(),type=String(d.type||'item'),price=Number(d.price),target=String(d.targetUid||adminUid),gifUrl=String(d.gifUrl||'').trim().slice(0,1000),description=String(d.description||'').slice(0,300);
 if(!name||name.length>80||!['badge','emoji','card','membership','miniPass','theme','avatar','title','item'].includes(type)||!Number.isSafeInteger(price)||price<0||price>1000000||!target||target.length>128|| (gifUrl&&!/^https:\/\//i.test(gifUrl)))throw new HttpsError('invalid-argument','Ürün veya hedef kullanıcı bilgisi geçersiz.');
 await userDoc(target);const userRef=db.doc('users/'+target),itemRef=db.collection('market').doc(),item={name,type,price,emoji:String(d.emoji||'🎁').slice(0,8),gifUrl,description,published:true,createdBy:adminUid,createdAt:Field.serverTimestamp()};
 await db.runTransaction(async tx=>{const u=await tx.get(userRef);if(!u.exists)throw new HttpsError('not-found','Hedef kullanıcı bulunamadı.');if(['membership','miniPass'].includes(type)&&Number(u.data().membershipUntil)>Date.now())throw new HttpsError('failed-precondition','Hedef kullanıcının zaten aktif üyeliği var.');const inv=Array.isArray(u.data().inventory)?u.data().inventory:[];tx.create(itemRef,item);tx.update(userRef,{inventory:[...inv,{itemId:itemRef.id,name,type,ownedAt:Date.now(),paidPrice:price,grantedBy:adminUid}],...(['membership','miniPass'].includes(type)?{membership:name,membershipType:type,membershipUntil:Date.now()+30*86400000}:{}),...(type==='title'?{title:name}:{})});});
 await db.collection('auditLogs').add({action:'publish-and-grant-market-item',adminUid,targetUid:target,itemId:itemRef.id,createdAt:Field.serverTimestamp()});
 return{ok:true,itemId:itemRef.id,targetUid:target};
});
exports.adminGrantInventoryItem=onCall(async req=>{
 const adminUid=requireAdmin(req),target=String(req.data?.targetUid||adminUid),itemId=String(req.data?.itemId||'');
 if(!itemId||itemId.length>140)throw new HttpsError('invalid-argument','Ürün kimliği geçersiz.');
 await userDoc(target);const userRef=db.doc('users/'+target),itemRef=db.doc('market/'+itemId);
 await db.runTransaction(async tx=>{const [u,i]=await Promise.all([tx.get(userRef),tx.get(itemRef)]);if(!u.exists||!i.exists||i.data().published!==true)throw new HttpsError('not-found','Kullanıcı veya yayınlanmış ürün bulunamadı.');const inv=Array.isArray(u.data().inventory)?u.data().inventory:[];if(inv.some(x=>x.itemId===itemId))throw new HttpsError('already-exists','Bu ürün kullanıcının envanterinde zaten var.');const x=i.data();tx.update(userRef,{inventory:[...inv,{itemId,name:String(x.name||'Ürün').slice(0,60),type:String(x.type||'item'),ownedAt:Date.now(),paidPrice:Number(x.price)||0,grantedBy:adminUid}]});});
 await db.collection('auditLogs').add({action:'admin-grant-inventory',adminUid,targetUid:target,itemId,createdAt:Field.serverTimestamp()});
 return{ok:true,targetUid:target,itemId};
});
exports.purchaseMarketItem=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const id=String(req.data.itemId||'');if(!id)throw new HttpsError('invalid-argument','Ürün seçilmedi.');const result=await db.runTransaction(async tx=>{const ur=db.doc(`users/${uid}`),ir=db.doc(`market/${id}`);const [u,i]=await Promise.all([tx.get(ur),tx.get(ir)]);if(!i.exists||!i.data().published)throw new HttpsError('not-found','Ürün bulunamadı.');const price=Number(i.data().price)||0,coins=Number(u.data()?.coins)||0;if(coins<price)throw new HttpsError('failed-precondition','Yeterli altının yok.');if(['membership','miniPass'].includes(i.data().type)&&u.data()?.membershipUntil>Date.now())throw new HttpsError('failed-precondition','Aynı anda yalnızca bir aktif üyelik veya MiniPass alabilirsin.');tx.set(ur,{coins:coins-price,inventory:Field.arrayUnion({itemId:id,name:i.data().name,type:i.data().type,ownedAt:Date.now(),paidPrice:price}),...(['membership','miniPass'].includes(i.data().type)?{membership:i.data().name,membershipType:i.data().type,membershipUntil:Date.now()+30*86400000}:{}),...(i.data().type==='title'?{title:i.data().name}:{})},{merge:true});return{coins:coins-price,name:i.data().name};});return result;});
exports.spinDailyWheel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const ref=db.doc(`wheelClaims/${uid}`);const cfg=await db.doc('settings/wheel').get();const rewards=cfg.exists&&Array.isArray(cfg.data().items)?cfg.data().items:[{label:'10 Altın',coins:10},{label:'25 Altın',coins:25},{label:'50 Altın',coins:50},{label:'5 Altın',coins:5},{label:'100 Altın',coins:100}];const r=rewards[crypto.randomInt(0,rewards.length)];await db.runTransaction(async tx=>{const [claim,user]=await Promise.all([tx.get(ref),tx.get(db.doc(`users/${uid}`))]);const today=istanbulDayKey();if(claim.exists&&claim.data().day===today)throw new HttpsError('failed-precondition','Bugünkü çark hakkını kullandın.');tx.set(ref,{day:today,at:Field.serverTimestamp(),reward:r});tx.set(db.doc(`users/${uid}`),{coins:(Number(user.data()?.coins)||0)+r.coins},{merge:true});});return r;});
exports.claimMiniPass=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const ref=db.doc(`miniPassClaims/${uid}`),u=db.doc(`users/${uid}`),today=istanbulDayKey();let reward;await db.runTransaction(async tx=>{const [c,us]=await Promise.all([tx.get(ref),tx.get(u)]);if(c.exists&&c.data().day===today)throw new HttpsError('failed-precondition','Günlük Mini Pass ödülünü zaten aldın.');const card=crypto.randomInt(0,100)<22;reward={coins:15,card:card?{id:'basic-'+today,name:'Temel Oyun Kartı',type:'card'}:null};const inv=Array.isArray(us.data()?.inventory)?us.data().inventory:[];tx.set(ref,{day:today,at:Field.serverTimestamp(),reward});tx.set(u,{coins:(Number(us.data()?.coins)||0)+reward.coins,...(card?{inventory:[...inv,{...reward.card,ownedAt:Date.now()}]}:{})},{merge:true});});return reward;});
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

exports.sendFriendRequest=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'sendFriendRequest',20);const target=String(req.data?.targetUid||'');
 if(!target||target===uid)throw new HttpsError('invalid-argument','Geçerli bir oyuncu seç.');
 await userDoc(target);
 const ids=[uid,target].sort(),id=ids.join('_'),ref=db.doc('friendRequests/'+id);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(snap.exists&&snap.data().status==='accepted')throw new HttpsError('already-exists','Bu oyuncu zaten arkadaşın.');
  if(snap.exists&&snap.data().status==='pending')throw new HttpsError('already-exists','Bekleyen bir arkadaşlık isteği var.');
  tx.set(ref,{from:uid,to:target,status:'pending',createdAt:Field.serverTimestamp(),updatedAt:Field.serverTimestamp()});
 });
 const sender=await db.doc('users/'+uid).get();await db.collection('users').doc(target).collection('notifications').add({type:'friend-request',from:uid,fromName:String(sender.data()?.displayName||req.auth.token.name||'Oyuncu').slice(0,80),createdAt:Field.serverTimestamp(),read:false});
 return{ok:true};
});
exports.respondFriendRequest=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const id=String(req.data?.requestId||''),accept=req.data?.accept===true;
 if(!id||id.length>140)throw new HttpsError('invalid-argument','İstek kimliği geçersiz.');
 await db.runTransaction(async tx=>{
  const ref=db.doc('friendRequests/'+id),s=await tx.get(ref);if(!s.exists||s.data().to!==uid||s.data().status!=='pending')throw new HttpsError('not-found','Bekleyen arkadaşlık isteği bulunamadı.');
  const from=s.data().from,[sender,recipient]=await Promise.all([tx.get(db.doc('users/'+from)),tx.get(db.doc('users/'+uid))]);
  tx.update(ref,{status:accept?'accepted':'declined',respondedAt:Field.serverTimestamp()});
  if(accept){tx.set(db.doc('users/'+uid+'/friends/'+from),{uid:from,displayName:String(sender.data()?.displayName||'Oyuncu').slice(0,80),createdAt:Field.serverTimestamp()});tx.set(db.doc('users/'+from+'/friends/'+uid),{uid,displayName:String(recipient.data()?.displayName||'Oyuncu').slice(0,80),createdAt:Field.serverTimestamp()});}
 });
 return{ok:true,accepted:accept};
});
exports.removeFriend=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const target=String(req.data?.targetUid||'');if(!target||target===uid)throw new HttpsError('invalid-argument','Oyuncu geçersiz.');
 const a=db.doc('users/'+uid+'/friends/'+target),b=db.doc('users/'+target+'/friends/'+uid);
 await db.runTransaction(async tx=>{tx.delete(a);tx.delete(b);});
 return{ok:true};
});
exports.transferCoins=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'transferCoins',5);const target=String(req.data?.targetUid||''),amount=Number(req.data?.amount),note=String(req.data?.note||'').trim().slice(0,40);
 const economySnap=await db.doc('settings/economy').get(),economy=economySnap.exists?economySnap.data():{},singleLimit=Number.isSafeInteger(economy.singleTransferLimit)?economy.singleTransferLimit:500,dailyLimit=Number.isSafeInteger(economy.dailyTransferLimit)?economy.dailyTransferLimit:1000;
 if(!target||target===uid||!Number.isSafeInteger(amount)||amount<1||amount>singleLimit)throw new HttpsError('invalid-argument','Tek seferlik transfer limiti: '+singleLimit+' altın.');
 await userDoc(target);
 const day=istanbulDayKey(),sender=db.doc('users/'+uid),receiver=db.doc('users/'+target),limitRef=db.doc('coinTransferLimits/'+uid);
 await db.runTransaction(async tx=>{
  const [s,r,l]=await Promise.all([tx.get(sender),tx.get(receiver),tx.get(limitRef)]);
  if(!s.exists||!r.exists)throw new HttpsError('not-found','Kullanıcı bulunamadı.');
  if(r.data().banned)throw new HttpsError('permission-denied','Bu kullanıcıya transfer yapılamaz.');
  const old=l.exists&&l.data().day===day?Number(l.data().amount)||0:0;
  if(old+amount>dailyLimit)throw new HttpsError('resource-exhausted','Günlük '+dailyLimit+' altın transfer sınırına ulaştın.');
  const coins=Number(s.data().coins)||0;if(coins<amount)throw new HttpsError('failed-precondition','Yeterli altının yok.');
  tx.update(sender,{coins:coins-amount});tx.update(receiver,{coins:(Number(r.data().coins)||0)+amount});
  tx.set(limitRef,{day,amount:old+amount,updatedAt:Field.serverTimestamp()},{merge:true});
  const log=db.collection('coinTransfers').doc();tx.set(log,{from:uid,to:target,amount,note,createdAt:Field.serverTimestamp()});
 });
 return{ok:true,amount};
});
exports.createGiftCode=onCall(async req=>{
 const uid=requireAdmin(req);
 for(let attempt=0;attempt<12;attempt++){
  const code=String(crypto.randomInt(0,10000)).padStart(4,'0'),ref=db.doc('giftCodes/'+code);
  try{await ref.create({active:true,rewardCoins:25,rewardItem:{name:'Temel Oyun Kartı',type:'card'},createdBy:uid,createdAt:Field.serverTimestamp()});return{ok:true,code};}
  catch(e){if(e.code==='already-exists'||e.code===6)continue;throw e;}
 }
 throw new HttpsError('resource-exhausted','Şu anda yeni hediye kodu oluşturulamadı.');
});
exports.redeemGiftCode=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'redeemGiftCode',5);
 const code=String(req.data?.code||'').replace(/\D/g,'').slice(0,4);
 if(!/^\d{4}$/.test(code))throw new HttpsError('invalid-argument','4 haneli kodu gir.');
 const giftRef=db.doc('giftCodes/'+code),userRef=db.doc('users/'+uid);let reward;
 await db.runTransaction(async tx=>{
  const [gift,user]=await Promise.all([tx.get(giftRef),tx.get(userRef)]);
  if(!gift.exists||gift.data().active!==true)throw new HttpsError('not-found','Hediye kodu geçersiz veya kullanılmış.');
  const g=gift.data(),inventory=Array.isArray(user.data()?.inventory)?user.data().inventory:[];
  if(inventory.some(x=>x.itemId==='gift-'+code))throw new HttpsError('already-exists','Bu kodu zaten kullandın.');
  reward={coins:Number(g.rewardCoins)||0,item:g.rewardItem||{name:'Hediye Kartı',type:'card'}};
  tx.update(giftRef,{active:false,claimedBy:uid,claimedAt:Field.serverTimestamp()});
  tx.update(userRef,{coins:(Number(user.data()?.coins)||0)+reward.coins,inventory:[...inventory,{itemId:'gift-'+code,name:String(reward.item.name||'Hediye Kartı').slice(0,60),type:String(reward.item.type||'card'),ownedAt:Date.now(),paidPrice:0}]});
 });
 return{ok:true,...reward};
});
exports.publishDailyTask=onCall(async req=>{
 const uid=requireAdmin(req),d=req.data||{},title=String(d.title||'').trim(),mode=String(d.mode||'classic'),minScore=Number(d.minScore||0),minQuestions=Number(d.minQuestions||1),reward=Number(d.reward||0),gifUrl=String(d.gifUrl||'').slice(0,1000);
 if(!title||title.length>80||!['classic','endless','retry','balance','any'].includes(mode)||!Number.isInteger(minScore)||minScore<0||minScore>10000||!Number.isInteger(minQuestions)||minQuestions<1||minQuestions>500||!Number.isInteger(reward)||reward<0||reward>10000)throw new HttpsError('invalid-argument','Görev bilgileri geçersiz.');
 const ref=await db.collection('dailyTasks').add({title,mode,minScore,minQuestions,reward,gifUrl,active:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{ok:true,id:ref.id};
});
exports.claimDailyTask=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const id=String(req.data?.taskId||'');if(!id)throw new HttpsError('invalid-argument','Görev seçilmedi.');
 const taskRef=db.doc('dailyTasks/'+id),userRef=db.doc('users/'+uid),claimRef=db.doc('dailyTaskClaims/'+uid+'_'+id+'_'+istanbulDayKey());
 await db.runTransaction(async tx=>{
  const [t,u,claim]=await Promise.all([tx.get(taskRef),tx.get(userRef),tx.get(claimRef)]);
  if(!t.exists||!t.data().active)throw new HttpsError('not-found','Görev artık etkin değil.');
  if(claim.exists)throw new HttpsError('already-exists','Bu görevin bugünkü ödülünü zaten aldın.');
  const d=t.data(),parts=istanbulDayKey().split('-').map(Number),start=admin.firestore.Timestamp.fromMillis(Date.UTC(parts[0],parts[1]-1,parts[2])-3*60*60*1000);
  let q=db.collection('scores').where('uid','==',uid).where('createdAt','>=',start);
  if(d.mode!=='any')q=q.where('mode','==',d.mode);
  const scores=await tx.get(q);const done=scores.docs.some(x=>Number(x.data().score)>=d.minScore&&Number(x.data().questions)>=d.minQuestions);
  if(!done)throw new HttpsError('failed-precondition','Görev henüz tamamlanmadı.');
  tx.create(claimRef,{uid,taskId:id,day:istanbulDayKey(),claimedAt:Field.serverTimestamp(),reward:d.reward});
  tx.update(userRef,{coins:(Number(u.data().coins)||0)+d.reward});
 });
 return{ok:true};
});
exports.getDailyTasks=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);
 const snap=await db.collection('dailyTasks').where('active','==',true).limit(30).get(),day=istanbulDayKey();
 const claims=await db.collection('dailyTaskClaims').where('uid','==',uid).where('day','==',day).get();
 const claimed=new Set(claims.docs.map(x=>x.data().taskId));
 return{tasks:snap.docs.map(x=>({id:x.id,...x.data(),claimed:claimed.has(x.id)}))};
});
exports.joinRandomMatch=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'joinRandomMatch',5);const difficulty=String(req.data?.difficulty||'medium');if(!['easy','medium','hard','impossible'].includes(difficulty))throw new HttpsError('invalid-argument','Zorluk seviyesi geçersiz.');const existing=await db.collection('matchmakingQueue').where('uid','==',uid).where('status','==','waiting').where('expiresAt','>',Date.now()).limit(1).get();if(!existing.empty)return{matched:false,queueId:existing.docs[0].id};const topic=String(req.data?.topic||'Karışık').slice(0,40);
 const waiting=await db.collection('matchmakingQueue').where('status','==','waiting').where('topic','==',topic).where('difficulty','==',difficulty).where('expiresAt','>',Date.now()).limit(10).get();
 for(const candidate of waiting.docs){
  if(candidate.data().uid===uid)continue;
  const code=randomJoinCode();
  const duelRef=db.doc('duels/'+code);
  const matched=await db.runTransaction(async tx=>{
   const q=await tx.get(candidate.ref);if(!q.exists||q.data().status!=='waiting'||q.data().uid===uid)return false;
   tx.update(candidate.ref,{status:'matched',matchedAt:Field.serverTimestamp(),duelCode:code});
   tx.create(duelRef,{code,hostUid:q.data().uid,players:[q.data().uid,uid],topic,difficulty,status:'playing',scores:{},createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000,matchType:'random'});
   return true;
  });
  if(matched)return{matched:true,code,topic};
 }
 const ref=await db.collection('matchmakingQueue').add({uid,topic,difficulty,status:'waiting',createdAt:Field.serverTimestamp(),expiresAt:Date.now()+120000});
 return{matched:false,queueId:ref.id};
});
exports.cancelRandomMatch=onCall(async req=>{
 const uid=requireUser(req);const snap=await db.collection('matchmakingQueue').where('uid','==',uid).where('status','==','waiting').limit(10).get();
 const batch=db.batch();snap.docs.forEach(d=>batch.update(d.ref,{status:'cancelled',cancelledAt:Field.serverTimestamp()}));await batch.commit();return{ok:true};
});


exports.setInventoryLoadout=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'setInventoryLoadout',30);
 const emojis=Array.isArray(req.data?.emojis)?req.data.emojis:[],cards=Array.isArray(req.data?.cards)?req.data.cards:[];
 if(emojis.length!==5||cards.length!==5||[...emojis,...cards].some(x=>typeof x!=='string'||x.length>128)||new Set(emojis.filter(Boolean)).size!==emojis.filter(Boolean).length||new Set(cards.filter(Boolean)).size!==cards.filter(Boolean).length)throw new HttpsError('invalid-argument','Emoji ve kart alanları beşer benzersiz slottan oluşmalı.');
 const ref=db.doc('users/'+uid);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('failed-precondition','Kullanıcı profili bulunamadı.');
  const inventory=Array.isArray(snap.data().inventory)?snap.data().inventory:[];
  const owns=(id,type)=>!id||inventory.some(x=>x.itemId===id&&x.type===type);
  if(!emojis.every(id=>owns(id,'emoji'))||!cards.every(id=>owns(id,'card')))throw new HttpsError('permission-denied','Yalnızca envanterindeki emoji ve kartları kuşanabilirsin.');
  tx.update(ref,{equippedEmojis:emojis,equippedCards:cards});
 });
 return{ok:true,emojis,cards};
});
exports.sellInventoryItem=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const itemId=String(req.data?.itemId||'');if(!itemId)throw new HttpsError('invalid-argument','Satılacak ürün seçilmedi.');
 const ref=db.doc('users/'+uid);
 const result=await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);const inv=Array.isArray(snap.data()?.inventory)?snap.data().inventory:[];
  const index=inv.findIndex(x=>x.itemId===itemId);
  if(index<0)throw new HttpsError('not-found','Ürün envanterinde bulunamadı.');
  const item=inv[index];if(['membership','miniPass','title'].includes(item.type))throw new HttpsError('failed-precondition','Bu ürün satılamaz.');
  const paid=Number(item.paidPrice);if(!Number.isFinite(paid)||paid<0)throw new HttpsError('failed-precondition','Bu eski ürünün satış bedeli kayıtlı değil.');
  const refund=Math.floor(paid/2),next=inv.slice();next.splice(index,1);
  tx.update(ref,{inventory:next,coins:(Number(snap.data().coins)||0)+refund});
  return{ok:true,refund,name:item.name};
 });
 return result;
});
exports.requestEmailChange=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'requestEmailChange',5);const email=String(req.data?.email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new HttpsError('invalid-argument','Geçerli bir e-posta adresi gir.');
 if(email===String(req.auth.token.email||'').toLowerCase())throw new HttpsError('invalid-argument','Yeni e-posta mevcut adresinle aynı.');
 try{const existing=await admin.auth().getUserByEmail(email);if(existing.uid!==uid)throw new HttpsError('already-exists','Bu e-posta başka bir hesapta kullanılıyor.');}catch(e){if(e.code!=='auth/user-not-found'&&!(e instanceof HttpsError))throw e;}
 const ref=db.doc('emailChangeLimits/'+uid),now=Date.now(),period=30*86400000;
 await db.runTransaction(async tx=>{const s=await tx.get(ref),last=Number(s.data()?.lastChangedAt)||0;if(last&&now-last<period){const days=Math.ceil((period-(now-last))/86400000);throw new HttpsError('failed-precondition','E-posta değişikliği için '+days+' gün daha beklemelisin.');}tx.set(ref,{requestedAt:now,requestedEmail:email,status:'verification-pending'},{merge:true});});
 return{ok:true,email};
});
exports.completeEmailChange=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const email=String(req.auth.token.email||'').trim().toLowerCase(),authUser=await admin.auth().getUser(uid);
 if(!authUser.emailVerified||String(authUser.email||'').toLowerCase()!==email)throw new HttpsError('permission-denied','Yeni e-posta adresi doğrulanmamış.');
 const ref=db.doc('emailChangeLimits/'+uid),profile=db.doc('users/'+uid),now=Date.now(),period=30*86400000;let changed=false;
 await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||s.data().status!=='verification-pending'||String(s.data().requestedEmail||'').toLowerCase()!==email)return;const last=Number(s.data().lastChangedAt)||0;if(last&&now-last<period)throw new HttpsError('failed-precondition','E-posta değişikliği için 30 gün beklemelisin.');tx.set(ref,{lastChangedAt:now,status:'completed',completedAt:Field.serverTimestamp()},{merge:true});tx.set(profile,{email},{merge:true});changed=true;});
 return{ok:true,changed};
});


exports.createGroupCompetition=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'createGroupCompetition',5);const chatId=String(req.data?.chatId||''),topic=String(req.data?.topic||'Karışık').slice(0,40);
 if(!chatId)throw new HttpsError('invalid-argument','Grup seçilmedi.');
 const chat=await db.doc('chats/'+chatId).get();if(!chat.exists||chat.data().type!=='group'||!chat.data().memberIds?.includes(uid))throw new HttpsError('permission-denied','Bu grup için yarışma oluşturamazsın.');
 const code=randomJoinCode();
 await db.doc('groupCompetitions/'+code).create({code,groupA:chatId,membersA:chat.data().memberIds,groupB:null,membersB:[],topic,status:'waiting',scores:{},createdBy:uid,createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000});
 return{ok:true,code,topic};
});
exports.joinGroupCompetition=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'joinGroupCompetition',5);const code=String(req.data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),chatId=String(req.data?.chatId||'');
 if(!code||!chatId)throw new HttpsError('invalid-argument','Yarışma kodu ve grup gerekli.');
 const chat=await db.doc('chats/'+chatId).get();if(!chat.exists||chat.data().type!=='group'||!chat.data().memberIds?.includes(uid))throw new HttpsError('permission-denied','Bu grup için katılım yetkin yok.');
 await db.runTransaction(async tx=>{const ref=db.doc('groupCompetitions/'+code),s=await tx.get(ref);if(!s.exists||s.data().expiresAt<Date.now())throw new HttpsError('not-found','Grup yarışması bulunamadı.');const x=s.data();if(x.status!=='waiting'||x.groupA===chatId)throw new HttpsError('failed-precondition','Yarışma dolu veya aynı grup seçildi.');tx.update(ref,{groupB:chatId,membersB:chat.data().memberIds,status:'playing',joinedAt:Field.serverTimestamp()});});
 return{ok:true,code};
});
exports.submitGroupCompetitionResult=onCall(async()=>{throw new HttpsError('failed-precondition','Grup skorları yalnızca doğrulanmış oyun oturumundan gönderilebilir.');});

exports.reportChatMessage=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const chatId=String(req.data?.chatId||''),messageId=String(req.data?.messageId||''),reason=String(req.data?.reason||'Uygunsuz içerik').trim().slice(0,160);
 if(!chatId||!messageId)throw new HttpsError('invalid-argument','Bildirilecek mesaj seçilmedi.');
 const chat=await db.doc('chats/'+chatId).get();if(!chat.exists||!chat.data().memberIds?.includes(uid))throw new HttpsError('permission-denied','Bu sohbet için bildirim gönderemezsin.');
 const message=await db.doc('chats/'+chatId+'/messages/'+messageId).get();if(!message.exists||message.data().senderId===uid)throw new HttpsError('failed-precondition','Bu mesaj bildirilemez.');
 const duplicate=await db.collection('messageReports').where('messageId','==',messageId).where('reportedBy','==',uid).limit(1).get();if(!duplicate.empty)throw new HttpsError('already-exists','Bu mesajı zaten bildirdin.');
 await db.collection('messageReports').add({chatId,messageId,reportedBy:uid,reason,senderId:message.data().senderId,senderName:String(message.data().senderName||'Kullanıcı').slice(0,80),messageText:String(message.data().text||'').slice(0,500),createdAt:Field.serverTimestamp(),status:'new'});
 return{ok:true};
});

exports.resolveMessageReport=onCall(async req=>{
 const uid=requireAdmin(req),id=String(req.data?.reportId||'').trim();
 if(!id||id.length>140)throw new HttpsError('invalid-argument','Bildirim kimliği geçersiz.');
 const ref=db.doc('messageReports/'+id),snap=await ref.get();if(!snap.exists)throw new HttpsError('not-found','Bildirim bulunamadı.');
 await ref.update({status:'resolved',resolvedBy:uid,resolvedAt:Field.serverTimestamp()});
 const reporter=snap.data().reportedBy;if(reporter)await db.doc('users/'+reporter+'/notifications/report_'+id).set({type:'report-resolved',message:'Mesaj bildirimin yönetici tarafından incelendi.',createdAt:Field.serverTimestamp(),read:false});
 return{ok:true};
});
exports.submitFeedback=onCall(async req=>{
 const d=req.data||{};if(String(d.honeypot||''))return{ok:true};
 await publicSubmissionLimit(req,'feedback');
 const kind=String(d.kind||'Öneri'),message=String(d.message||'').trim();
 if(!['Öneri','Hata','Ad Değişikliği','Teşekkür'].includes(kind)||!message||message.length>500)throw new HttpsError('invalid-argument','Geri bildirim türü veya mesajı geçersiz.');
 await db.collection('feedback').add({kind,message,uid:req.auth?.uid||null,playerName:String(d.playerName||'').slice(0,40),createdAt:Field.serverTimestamp(),status:'new'});
 return{ok:true};
});
exports.replyFeedback=onCall(async req=>{
 const adminUid=requireAdmin(req),id=String(req.data?.feedbackId||''),reply=String(req.data?.reply||'').trim().slice(0,1000);
 if(!id||!reply)throw new HttpsError('invalid-argument','Geri bildirim ve yanıt gerekli.');
 const ref=db.doc('feedback/'+id),snap=await ref.get();if(!snap.exists)throw new HttpsError('not-found','Geri bildirim bulunamadı.');
 await ref.update({adminReply:reply,repliedBy:adminUid,repliedAt:Field.serverTimestamp(),status:'replied'});
 const target=snap.data().uid;if(target)await db.doc('users/'+target+'/notifications/feedback_'+id).set({type:'feedback-reply',message:reply,fromName:'Hako Yönetimi',createdAt:Field.serverTimestamp(),read:false});
 await db.collection('auditLogs').add({action:'reply-feedback',adminUid,feedbackId:id,createdAt:Field.serverTimestamp()});
 return{ok:true};
});
exports.submitTeacherRequest=onCall(async req=>{
 const d=req.data||{};if(String(d.honeypot||''))return{ok:true};
 await publicSubmissionLimit(req,'teacher');
 const name=String(d.name||'').trim(),contact=String(d.contact||'E-posta'),email=String(d.email||'').trim().slice(0,100),phone=String(d.phone||'').trim().slice(0,20),school=String(d.school||'').trim(),className=String(d.className||'').trim(),location=String(d.location||'').trim(),request=String(d.request||'Diğer'),message=String(d.message||'').trim();
 if(!name||name.length>60||!school||school.length>80||!['E-posta','Telefon'].includes(contact)||(contact==='E-posta'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(contact==='Telefon'&&!/^[+0-9 ()-]{7,20}$/.test(phone))||message.length>600)throw new HttpsError('invalid-argument','Öğretmen başvuru bilgileri geçersiz.');
 await db.collection('teacherRequests').add({name,contact,email:contact==='E-posta'?email:'',phone:contact==='Telefon'?phone:'',school,className,location,request,message,createdAt:Field.serverTimestamp(),status:'new'});
 return{ok:true};
});

exports.protectAdminProfile=onDocumentCreated('users/{uid}',async e=>{const uid=e.params.uid,u=await admin.auth().getUser(uid).catch(()=>null);if(u&&u.email===ADMIN_EMAIL&&u.emailVerified)await admin.auth().setCustomUserClaims(uid,{...(u.customClaims||{}),admin:true});});


const GAME_TOPICS=['Tam Sayılar','Rasyonel Sayılar','Cebirsel İfadeler','Eşitlik ve Denklem','Oran ve Orantı','Yüzdeler','Doğrular ve Açılar','Çokgenler','Çember ve Daire','Veri Analizi'];
function gameRand(a,b){return crypto.randomInt(a,b+1);}
function gamePick(a){return a[gameRand(0,a.length-1)];}
function makeServerQuestion(topic,difficulty='normal'){
 const level=({easy:0,medium:1,hard:2,impossible:3})[difficulty]??1;
 let a,b,x,ans,q;
 if(topic==='Karışık')topic=gamePick(GAME_TOPICS);
 switch(topic){
  case 'Tam Sayılar':a=gameRand(-30-15*level,30+15*level);b=gameRand(-20-10*level,20+10*level);{const op=gamePick(['+','−','×']);ans=op==='+'?a+b:op==='−'?a-b:a*b;q=a+' '+op+' ('+b+') işleminin sonucu kaçtır?';}break;
  case 'Rasyonel Sayılar':{const d=gamePick([2,3,4,5,6,8,10]);a=gameRand(1,d-1);b=gameRand(1,d-1);const num=a+b,gcd=(x,y)=>y?gcd(y,x%y):x,g=gcd(num,d);ans=num/g===d/g? '1':(d/g===1?String(num/g):(num/g)+'/'+(d/g));q=a+'/'+d+' + '+b+'/'+d+' işleminin sonucu kaçtır?';break;}
  case 'Cebirsel İfadeler':a=gameRand(2,9+3*level);b=gameRand(1,12+5*level);x=gameRand(1,8+4*level);q='x = '+x+' ise '+a+'x + '+b+' ifadesinin değeri kaçtır?';ans=a*x+b;break;
  case 'Eşitlik ve Denklem':a=gameRand(2,8+3*level);x=gameRand(1,12+5*level);b=gameRand(-10-5*level,15+5*level);q=a+'x '+(b<0?'− '+Math.abs(b):'+ '+b)+' = '+(a*x+b)+' denkleminde x kaçtır?';ans=x;break;
  case 'Oran ve Orantı':a=gameRand(2,8+3*level);b=gameRand(2,9+3*level);x=gameRand(2,6+2*level);q=a+' kalem '+(b*a)+' TL ise '+(a*x)+' kalem kaç TL\\'dir?';ans=b*a*x;break;
  case 'Yüzdeler':a=gamePick([10,20,25,30,40,50,60,75]);b=gamePick([40,60,80,100,120,160,200,240]);if(crypto.randomInt(0,2)===0){q=b+' TL\\'lik ürünün %'+a+' indirimli fiyatı kaç TL\\'dir?';ans=b-b*a/100;}else{q=b+' sayısının %'+a+'\\'i kaçtır?';ans=b*a/100;}break;
  case 'Doğrular ve Açılar':a=gameRand(25,155);if(crypto.randomInt(0,2)===0){q='Bir doğru açı üzerinde komşu açılardan biri '+a+'° ise diğeri kaç derecedir?';ans=180-a;}else{q='Tümler iki açıdan biri '+(a%90)+'° ise diğeri kaç derecedir?';ans=90-(a%90);}break;
  case 'Çokgenler':a=gameRand(3,8);q='Düzgün olmayan bir çokgenin '+a+' kenarı varsa iç açılar toplamı kaç derecedir?';ans=(a-2)*180;break;
  case 'Çember ve Daire':a=gameRand(2,12+6*level);if(crypto.randomInt(0,2)===0){q='Yarıçapı '+a+' cm olan çemberin çevresi kaç cm\\'dir? (π = 3 alınız)';ans=6*a;}else{q='Çapı '+(2*a)+' cm olan çemberin çevresi kaç cm\\'dir? (π = 3 alınız)';ans=6*a;}break;
  case 'Veri Analizi':{const v=[gameRand(2,9+5*level),gameRand(2,9+5*level),gameRand(2,9+5*level),gameRand(2,9+5*level),gameRand(2,9+5*level)].sort((m,n)=>m-n);if(crypto.randomInt(0,2)===0){q=v.join(', ')+' veri grubunun ortancası (medyanı) kaçtır?';ans=v[2];}else{q=v.join(', ')+' veri grubunun açıklığı kaçtır?';ans=v[4]-v[0];}break;}
  default:throw new HttpsError('invalid-argument','Geçersiz matematik konusu.');
 }
 const correct=String(ans);let candidates,fractionParts=null;if(correct.includes('/')){const p=correct.split('/').map(Number);fractionParts=p;candidates=[correct,p[0]+'/'+(p[1]*2),(p[0]+1)+'/'+p[1],(p[0]-1)+'/'+p[1]];}else candidates=[correct,String(Number(ans)+gamePick([1,2,3,5,-1,-2])),String(Number(ans)-gamePick([1,2,3,4])),String(Number(ans)*2)];const opts=[...new Set(candidates)];let filler=1;
 while(opts.length<4){const candidate=fractionParts?(fractionParts[0]+filler)+'/'+fractionParts[1]:String(Number(ans)+gameRand(2,12)+filler);if(!opts.includes(candidate))opts.push(candidate);filler++;}
 for(let i=opts.length-1;i>0;i--){const j=gameRand(0,i);[opts[i],opts[j]]=[opts[j],opts[i]];}
 return{q,options:opts.slice(0,4),answer:correct};
}
exports.startMistakeReview=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'startMistakeReview',5);
 const sourceId=String(req.data?.sessionId||'');if(!sourceId)throw new HttpsError('invalid-argument','Önceki oyun oturumu gerekli.');
 const source=await db.doc('gameSessions/'+sourceId).get();
 if(!source.exists||source.data().uid!==uid||source.data().status!=='submitted')throw new HttpsError('permission-denied','Hata tekrarı için geçerli oyun kaydı bulunamadı.');
 const d=source.data(),questions=d.questions.filter((q,i)=>d.answers?.[i]&&!d.answers[i].correct).slice(0,10);
 if(!questions.length)throw new HttpsError('failed-precondition','Son oyunda tekrar edilecek hata yok.');
 const id=crypto.randomBytes(16).toString('hex'),now=Date.now();
 await db.doc('gameSessions/'+id).create({uid,mode:'retry',topic:d.topic,difficulty:d.difficulty||'normal',questions,competitionType:null,competitionCode:null,status:'active',answers:[],nextIndex:0,score:0,correct:0,streak:0,lives:5,questionStartedAt:now,questionDeadlineAt:null,sourceSessionId:sourceId,createdAt:Field.serverTimestamp(),expiresAt:now+2*60*60*1000});
 return{sessionId:id,questions:questions.map(x=>({q:x.q,opts:x.options}))};
});
exports.startGameSession=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'startGameSession',10);const d=req.data||{},mode=String(d.mode||'classic');
 let topic=String(d.topic||'Karışık').slice(0,40);
 if(!['classic','endless','retry','balance'].includes(mode))throw new HttpsError('invalid-argument','Oyun modu geçersiz.');
 if(mode==='balance')topic='Eşitlik ve Denklem';
 if(topic!=='Karışık'&&!GAME_TOPICS.includes(topic))throw new HttpsError('invalid-argument','Matematik konusu geçersiz.');
 let difficulty=String(d.difficulty||'medium');if(!['easy','medium','hard','impossible'].includes(difficulty))throw new HttpsError('invalid-argument','Zorluk seviyesi geçersiz.');const competitionType=String(d.competitionType||''),competitionCode=String(d.competitionCode||'').toUpperCase().slice(0,6);
 if(competitionType==='duel'){const duel=await db.doc('duels/'+competitionCode).get();if(!duel.exists||duel.data().status!=='playing'||!duel.data().players?.includes(uid)||duel.data().scores?.[uid])throw new HttpsError('permission-denied','Aktif düello oturumu bulunamadı.');difficulty=duel.data().difficulty||'medium';}
 else if(competitionType==='group'){const comp=await db.doc('groupCompetitions/'+competitionCode).get();if(!comp.exists||comp.data().status!=='playing'||(!(comp.data().membersA||[]).includes(uid)&&!(comp.data().membersB||[]).includes(uid))||comp.data().scores?.[uid])throw new HttpsError('permission-denied','Aktif grup yarışması bulunamadı.');}
 else if(competitionType)throw new HttpsError('invalid-argument','Yarışma türü geçersiz.');
 const count=mode==='retry'?10:500,questions=Array.from({length:count},()=>makeServerQuestion(topic,difficulty)),id=crypto.randomBytes(16).toString('hex');
 const startedAt=Date.now();await db.doc('gameSessions/'+id).create({uid,mode,topic,questions,difficulty,competitionType:competitionType||null,competitionCode:competitionCode||null,status:'active',answers:[],nextIndex:0,score:0,correct:0,streak:0,lives:5,questionStartedAt:startedAt,questionDeadlineAt:mode==='endless'?startedAt+10000:null,createdAt:Field.serverTimestamp(),expiresAt:startedAt+2*60*60*1000});
 return{sessionId:id,questions:questions.map(x=>({q:x.q,opts:x.options}))};
});
exports.submitGameSession=onCall(async()=>{throw new HttpsError('failed-precondition','Bu eski puan uç noktası kapalı.');});
exports.submitGameAnswer=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'submitGameAnswer',600);const id=String(req.data?.sessionId||''),index=Number(req.data?.index),selected=req.data?.answer===null?null:String(req.data?.answer);
 if(!id||!Number.isInteger(index)||index<0)throw new HttpsError('invalid-argument','Cevap bilgisi geçersiz.');
 const ref=db.doc('gameSessions/'+id);let result;
 await db.runTransaction(async tx=>{
  const s=await tx.get(ref);if(!s.exists||s.data().uid!==uid||s.data().status!=='active'||s.data().expiresAt<Date.now())throw new HttpsError('failed-precondition','Oyun oturumu geçersiz veya süresi dolmuş.');
  const d=s.data();if(index!==d.nextIndex||index>=d.questions.length||d.lives<=0)throw new HttpsError('failed-precondition','Bu soru zaten yanıtlandı veya sıra geçersiz.');
  const q=d.questions[index];if(!q||!Array.isArray(q.options)||typeof q.answer!=='string')throw new HttpsError('data-loss','Oyun sorusu sunucu kaydında geçersiz.');
  const now=Date.now(),deadline=Number(d.questionDeadlineAt)||0,timeoutSignal=d.mode==='endless'&&deadline>0&&now>=deadline,lateAnswer=d.mode==='endless'&&deadline>0&&now>deadline+1500;if(selected===null&&d.mode!=='endless')throw new HttpsError('invalid-argument','Bu modda süre aşımı gönderilemez.');if(selected===null&&!timeoutSignal)throw new HttpsError('failed-precondition','Süre henüz dolmadı.');if(selected!==null&&!q.options.includes(selected))throw new HttpsError('invalid-argument','Cevap seçenekler arasında değil.');
  const effective=lateAnswer?null:selected,correct=effective===q.answer,streak=correct?d.streak+1:0,score=correct?d.score+10+Math.min(streak-1,5)*2:d.score,lives=correct?d.lives:d.lives-1;
  const entry={selected:effective,correct,answer:q.answer,at:now};
  tx.update(ref,{answers:Field.arrayUnion(entry),nextIndex:index+1,score,correct:d.correct+(correct?1:0),streak,lives,questionStartedAt:now,questionDeadlineAt:d.mode==='endless'?now+10850:null});
  result={correct,answer:q.answer,score,correctCount:d.correct+(correct?1:0),streak,lives,nextIndex:index+1};
 });
 return result;
});
exports.finishGameSession=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'finishGameSession',10);const id=String(req.data?.sessionId||'');if(!id)throw new HttpsError('invalid-argument','Oyun oturumu gerekli.');
 const sessionRef=db.doc('gameSessions/'+id);let result;
 await db.runTransaction(async tx=>{
  const s=await tx.get(sessionRef);if(!s.exists||s.data().uid!==uid||s.data().status!=='active'||s.data().expiresAt<Date.now())throw new HttpsError('failed-precondition','Oyun oturumu geçersiz veya süresi dolmuş.');
  const d=s.data(),finished=d.lives<=0||d.nextIndex>=d.questions.length||(d.mode==='retry'&&d.nextIndex>=10);
  if(!finished)throw new HttpsError('failed-precondition','Oyun henüz tamamlanmadı.');
  const userRef=db.doc('users/'+uid),economyRef=db.doc('settings/economy');
  const [userSnap,economySnap]=await Promise.all([tx.get(userRef),tx.get(economyRef)]);
  if(!userSnap.exists)throw new HttpsError('failed-precondition','Kullanıcı profili bulunamadı.');
  const economy=economySnap.exists?economySnap.data():{},coinsPerScore=Number.isSafeInteger(economy.coinsPerScore)?economy.coinsPerScore:5,maxGameReward=Number.isSafeInteger(economy.maxGameReward)?economy.maxGameReward:50000;
  const coinsEarned=Math.min(Math.max(0,Math.floor(Number(d.score)||0)*coinsPerScore),maxGameReward);
  result={score:d.score,correct:d.correct,questions:d.nextIndex,mode:d.mode,topic:d.topic,difficulty:d.difficulty||'medium',coinsEarned};
  if(d.competitionType==='duel'){
   const ref=db.doc('duels/'+d.competitionCode),duel=await tx.get(ref);if(!duel.exists||duel.data().status!=='playing'||!duel.data().players?.includes(uid)||duel.data().scores?.[uid])throw new HttpsError('failed-precondition','Düello artık aktif değil.');
   const scores={...(duel.data().scores||{}),[uid]:{score:d.score,correct:d.correct,questions:d.nextIndex,difficulty:d.difficulty||'medium',at:Date.now()}},complete=Object.keys(scores).length===2;
   tx.update(ref,{scores,status:complete?'completed':'playing',completedAt:complete?Field.serverTimestamp():null});result.competition='duel';result.completed=complete;
  }else if(d.competitionType==='group'){
   const ref=db.doc('groupCompetitions/'+d.competitionCode),comp=await tx.get(ref);if(!comp.exists||comp.data().status!=='playing'||comp.data().scores?.[uid])throw new HttpsError('failed-precondition','Grup yarışması artık aktif değil.');
   const x=comp.data(),side=(x.membersA||[]).includes(uid)?'a':(x.membersB||[]).includes(uid)?'b':null;if(!side)throw new HttpsError('permission-denied','Bu grup yarışmasında değilsin.');
   const scores={...(x.scores||{}),[uid]:{score:d.score,correct:d.correct,side,difficulty:d.difficulty||'medium',at:Date.now()}},totals={a:0,b:0};for(const v of Object.values(scores))totals[v.side]+=v.score;
   const complete=Object.keys(scores).length>=(x.membersA||[]).length+(x.membersB||[]).length;
   tx.update(ref,{scores,totals,status:complete?'completed':'playing',completedAt:complete?Field.serverTimestamp():null});result.competition='group';result.completed=complete;result.totals=totals;
  }else{
   const name=String(userSnap.data()?.displayName||req.auth.token.name||'Oyuncu').slice(0,32);
   tx.create(db.collection('scores').doc(),{uid,playerName:name,score:d.score,mode:d.mode,topic:d.topic,difficulty:d.difficulty||'medium',public:req.data?.public===true,questions:d.nextIndex,coinsEarned,createdAt:Field.serverTimestamp()});
  }
  tx.update(userRef,{coins:(Number(userSnap.data().coins)||0)+coinsEarned});
  tx.update(sessionRef,{status:'submitted',submittedAt:Field.serverTimestamp()});
 });
 return{ok:true,...result};
});

// Oturum puanları yalnızca sunucuda doğrulanır.
exports.submitGameScore=onCall(async()=>{throw new HttpsError('failed-precondition','Doğrudan skor gönderimi kapalı. Sunucu oturumu kullan.');});


// Asenkron, kodla katılınan düellolar: her iki oyuncu da skorunu ayrı gönderir.
exports.createDuel=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'createDuel',5);const topic=String(req.data?.topic||'Karışık').slice(0,40),targetUid=String(req.data?.targetUid||''),difficulty=String(req.data?.difficulty||'medium');
 if(topic!=='Karışık'&&!GAME_TOPICS.includes(topic))throw new HttpsError('invalid-argument','Düello konusu geçersiz.');if(!['easy','medium','hard','impossible'].includes(difficulty))throw new HttpsError('invalid-argument','Düello zorluğu geçersiz.');
 if(targetUid){if(targetUid===uid)throw new HttpsError('invalid-argument','Kendine düello gönderemezsin.');await userDoc(targetUid);const friend=await db.doc('users/'+uid+'/friends/'+targetUid).get();if(!friend.exists)throw new HttpsError('permission-denied','Yalnızca arkadaşlarına doğrudan düello gönderebilirsin.');}
 const code=randomJoinCode(),ref=db.collection('duels').doc(code);
 await ref.create({code,hostUid:uid,invitedUid:targetUid||null,players:[uid],topic,difficulty,status:'waiting',scores:{},createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000});
 if(targetUid){const sender=await db.doc('users/'+uid).get();await db.doc('users/'+targetUid+'/notifications/'+('duel_'+code)).set({type:'duel-invite',from:uid,fromName:String(sender.data()?.displayName||'Oyuncu').slice(0,80),code,topic,createdAt:Field.serverTimestamp(),read:false});}
 return{code,topic};
});
exports.joinDuel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(!code)throw new HttpsError('invalid-argument','Düello kodu gerekli.');let topic='Karışık';await db.runTransaction(async tx=>{const r=db.doc(`duels/${code}`),d=await tx.get(r);if(!d.exists||d.data().expiresAt<Date.now())throw new HttpsError('not-found','Düello bulunamadı veya süresi doldu.');const x=d.data();if(x.hostUid===uid)throw new HttpsError('failed-precondition','Kendi düellona katılamazsın.');if(x.invitedUid&&x.invitedUid!==uid)throw new HttpsError('permission-denied','Bu düello başka bir oyuncuya gönderilmiş.');if(x.status!=='waiting')throw new HttpsError('failed-precondition','Bu düello dolu veya tamamlanmış.');topic=x.topic||'Karışık';tx.update(r,{players:[x.hostUid,uid],status:'playing',joinedAt:Field.serverTimestamp()});});return{ok:true,code,topic};});
exports.submitDuelResult=onCall(async()=>{throw new HttpsError('failed-precondition','Düello skorları yalnızca doğrulanmış oyun oturumundan gönderilebilir.');});
