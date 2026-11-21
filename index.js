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
exports.setMaintenance=onCall(async req=>{const uid=requireAdmin(req),d=req.data||{},enabled=!!d.maintenance,important=!!d.important,severe=!!d.severe,allowed=['bakim-molasi.png','helpy-onemli-is.webp','helpy-teknik-onarim.gif'],maintenanceImage=allowed.includes(d.maintenanceImage)?d.maintenanceImage:'bakim-molasi.png',importantImage=allowed.includes(d.importantImage)?d.importantImage:'helpy-onemli-is.webp';await db.doc('settings/site').set({maintenance:enabled,important,severe,maintenanceImage,importantImage,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,maintenance:enabled,important,severe};});
exports.setTermMode=onCall(async req=>{const uid=requireAdmin(req),mode=req.data.mode;if(!['first','second'].includes(mode))throw new HttpsError('invalid-argument','Dönem first veya second olmalı.');await db.doc('settings/curriculum').set({mode,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,mode};});
exports.setSeasonTheme=onCall(async req=>{const uid=requireAdmin(req),theme=req.data.theme;if(!['default','newyear','halloween','ramadan','sacrifice'].includes(theme))throw new HttpsError('invalid-argument','Geçersiz tema.');await db.doc('settings/theme').set({theme,updatedAt:Field.serverTimestamp(),updatedBy:uid},{merge:true});return{ok:true,theme};});
exports.banUser=onCall(async req=>{const uid=requireAdmin(req),targetUid=String(req.data.uid||'');if(!targetUid||targetUid===uid)throw new HttpsError('invalid-argument','Geçersiz kullanıcı.');const target=await admin.auth().getUser(targetUid);if(target.email===ADMIN_EMAIL)throw new HttpsError('permission-denied','Hako admin banlanamaz.');await admin.auth().updateUser(targetUid,{disabled:true});await admin.auth().revokeRefreshTokens(targetUid);await db.doc(`users/${targetUid}`).set({banned:true,bannedAt:Field.serverTimestamp(),bannedBy:uid},{merge:true});return{ok:true};});
exports.publishMarketItem=onCall(async req=>{const uid=requireAdmin(req),d=req.data||{},name=String(d.name||'').trim(),type=String(d.type||'item'),price=Number(d.price);if(!name||name.length>80||!Number.isFinite(price)||price<0||price>1000000)throw new HttpsError('invalid-argument','Ürün adı veya fiyat geçersiz.');const ref=await db.collection('market').add({name,type,price,emoji:String(d.emoji||'🎁').slice(0,8),gifUrl:String(d.gifUrl||'').slice(0,1000),description:String(d.description||'').slice(0,300),published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{ok:true,id:ref.id};});
exports.setWheelRewards=onCall(async req=>{const uid=requireAdmin(req),items=req.data.items;if(!Array.isArray(items)||items.length<2||items.length>12)throw new HttpsError('invalid-argument','Çark için 2-12 ödül gerekli.');const clean=items.map(x=>({label:String(x.label||'').slice(0,32),coins:Number(x.coins)}));if(clean.some(x=>!x.label||!Number.isInteger(x.coins)||x.coins<0||x.coins>10000))throw new HttpsError('invalid-argument','Ödül değerleri geçersiz.');await db.doc('settings/wheel').set({items:clean,updatedBy:uid,updatedAt:Field.serverTimestamp()});return{ok:true};});
exports.publishTitle=onCall(async req=>{const uid=requireAdmin(req),name=String(req.data.name||'').trim(),price=Number(req.data.price);if(!name||name.length>32||!Number.isFinite(price)||price<0)throw new HttpsError('invalid-argument','Unvan veya fiyat geçersiz.');const r=await db.collection('market').add({name,type:'title',price,published:true,createdBy:uid,createdAt:Field.serverTimestamp()});return{id:r.id};});
exports.purchaseMarketItem=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const id=String(req.data.itemId||'');if(!id)throw new HttpsError('invalid-argument','Ürün seçilmedi.');const result=await db.runTransaction(async tx=>{const ur=db.doc(`users/${uid}`),ir=db.doc(`market/${id}`);const [u,i]=await Promise.all([tx.get(ur),tx.get(ir)]);if(!i.exists||!i.data().published)throw new HttpsError('not-found','Ürün bulunamadı.');const price=Number(i.data().price)||0,coins=Number(u.data()?.coins)||0;if(coins<price)throw new HttpsError('failed-precondition','Yeterli altının yok.');if(['membership','miniPass'].includes(i.data().type)&&u.data()?.membershipUntil>Date.now())throw new HttpsError('failed-precondition','Aynı anda yalnızca bir aktif üyelik veya MiniPass alabilirsin.');tx.set(ur,{coins:coins-price,inventory:Field.arrayUnion({itemId:id,name:i.data().name,type:i.data().type,ownedAt:Date.now(),paidPrice:price}),...(['membership','miniPass'].includes(i.data().type)?{membership:i.data().name,membershipType:i.data().type,membershipUntil:Date.now()+30*86400000}:{}),...(i.data().type==='title'?{title:i.data().name}:{})},{merge:true});return{coins:coins-price,name:i.data().name};});return result;});
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

exports.sendFriendRequest=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const target=String(req.data?.targetUid||'');
 if(!target||target===uid)throw new HttpsError('invalid-argument','Geçerli bir oyuncu seç.');
 await userDoc(target);
 const ids=[uid,target].sort(),id=ids.join('_'),ref=db.doc('friendRequests/'+id);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(snap.exists&&snap.data().status==='accepted')throw new HttpsError('already-exists','Bu oyuncu zaten arkadaşın.');
  if(snap.exists&&snap.data().status==='pending')throw new HttpsError('already-exists','Bekleyen bir arkadaşlık isteği var.');
  tx.set(ref,{from:uid,to:target,status:'pending',createdAt:Field.serverTimestamp(),updatedAt:Field.serverTimestamp()});
 });
 await db.collection('users').doc(target).collection('notifications').add({type:'friend-request',from:uid,createdAt:Field.serverTimestamp(),read:false});
 return{ok:true};
});
exports.respondFriendRequest=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const id=String(req.data?.requestId||''),accept=req.data?.accept===true;
 if(!id||id.length>140)throw new HttpsError('invalid-argument','İstek kimliği geçersiz.');
 await db.runTransaction(async tx=>{
  const ref=db.doc('friendRequests/'+id),s=await tx.get(ref);if(!s.exists||s.data().to!==uid||s.data().status!=='pending')throw new HttpsError('not-found','Bekleyen arkadaşlık isteği bulunamadı.');
  const from=s.data().from;
  tx.update(ref,{status:accept?'accepted':'declined',respondedAt:Field.serverTimestamp()});
  if(accept){tx.set(db.doc('users/'+uid+'/friends/'+from),{uid:from,createdAt:Field.serverTimestamp()});tx.set(db.doc('users/'+from+'/friends/'+uid),{uid,createdAt:Field.serverTimestamp()});}
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
 const uid=requireUser(req);await userDoc(uid);const target=String(req.data?.targetUid||''),amount=Number(req.data?.amount);
 if(!target||target===uid||!Number.isSafeInteger(amount)||amount<1||amount>100)throw new HttpsError('invalid-argument','Transfer 1-500 altın arasında olmalı.');
 await userDoc(target);
 const day=istanbulDayKey(),sender=db.doc('users/'+uid),receiver=db.doc('users/'+target),limitRef=db.doc('coinTransferLimits/'+uid);
 await db.runTransaction(async tx=>{
  const [s,r,l]=await Promise.all([tx.get(sender),tx.get(receiver),tx.get(limitRef)]);
  if(!s.exists||!r.exists)throw new HttpsError('not-found','Kullanıcı bulunamadı.');
  if(r.data().banned)throw new HttpsError('permission-denied','Bu kullanıcıya transfer yapılamaz.');
  const old=l.exists&&l.data().day===day?Number(l.data().amount)||0:0;
  if(old+amount>100)throw new HttpsError('resource-exhausted','Günlük 1000 altın transfer sınırına ulaştın.');
  const coins=Number(s.data().coins)||0;if(coins<amount)throw new HttpsError('failed-precondition','Yeterli altının yok.');
  tx.update(sender,{coins:coins-amount});tx.update(receiver,{coins:(Number(r.data().coins)||0)+amount});
  tx.set(limitRef,{day,amount:old+amount,updatedAt:Field.serverTimestamp()},{merge:true});
  const log=db.collection('coinTransfers').doc();tx.set(log,{from:uid,to:target,amount,createdAt:Field.serverTimestamp()});
 });
 return{ok:true,amount};
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
 const uid=requireUser(req);await userDoc(uid);await rateLimit(uid,'joinRandomMatch',5);const existing=await db.collection('matchmakingQueue').where('uid','==',uid).where('status','==','waiting').where('expiresAt','>',Date.now()).limit(1).get();if(!existing.empty)return{matched:false,queueId:existing.docs[0].id};const topic=String(req.data?.topic||'Karışık').slice(0,40);
 const waiting=await db.collection('matchmakingQueue').where('status','==','waiting').where('topic','==',topic).where('expiresAt','>',Date.now()).limit(10).get();
 for(const candidate of waiting.docs){
  if(candidate.data().uid===uid)continue;
  const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
  const duelRef=db.doc('duels/'+code);
  const matched=await db.runTransaction(async tx=>{
   const q=await tx.get(candidate.ref);if(!q.exists||q.data().status!=='waiting'||q.data().uid===uid)return false;
   tx.update(candidate.ref,{status:'matched',matchedAt:Field.serverTimestamp(),duelCode:code});
   tx.create(duelRef,{code,hostUid:q.data().uid,players:[q.data().uid,uid],topic,status:'playing',scores:{},createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000,matchType:'random'});
   return true;
  });
  if(matched)return{matched:true,code,topic};
 }
 const ref=await db.collection('matchmakingQueue').add({uid,topic,status:'waiting',createdAt:Field.serverTimestamp(),expiresAt:Date.now()+120000});
 return{matched:false,queueId:ref.id};
});
exports.cancelRandomMatch=onCall(async req=>{
 const uid=requireUser(req);const snap=await db.collection('matchmakingQueue').where('uid','==',uid).where('status','==','waiting').limit(10).get();
 const batch=db.batch();snap.docs.forEach(d=>batch.update(d.ref,{status:'cancelled',cancelledAt:Field.serverTimestamp()}));await batch.commit();return{ok:true};
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
 const uid=requireUser(req);await userDoc(uid);const email=String(req.data?.email||'').trim().toLowerCase();
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>254)throw new HttpsError('invalid-argument','Geçerli bir e-posta adresi gir.');
 if(email===String(req.auth.token.email||'').toLowerCase())throw new HttpsError('invalid-argument','Yeni e-posta mevcut adresinle aynı.');
 const ref=db.doc('emailChangeLimits/'+uid),now=Date.now(),period=30*86400000;
 await db.runTransaction(async tx=>{const s=await tx.get(ref),last=Number(s.data()?.lastRequestedAt)||0;if(last&&now-last<period){const days=Math.ceil((period-(now-last))/86400000);throw new HttpsError('failed-precondition','E-posta değişikliği için '+days+' gün daha beklemelisin.');}tx.set(ref,{lastRequestedAt:now,requestedEmail:email,status:'verification-pending'},{merge:true});});
 return{ok:true,email};
});


exports.createGroupCompetition=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const chatId=String(req.data?.chatId||''),topic=String(req.data?.topic||'Karışık').slice(0,40);
 if(!chatId)throw new HttpsError('invalid-argument','Grup seçilmedi.');
 const chat=await db.doc('chats/'+chatId).get();if(!chat.exists||chat.data().type!=='group'||!chat.data().memberIds?.includes(uid))throw new HttpsError('permission-denied','Bu grup için yarışma oluşturamazsın.');
 const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
 await db.doc('groupCompetitions/'+code).create({code,groupA:chatId,membersA:chat.data().memberIds,groupB:null,membersB:[],topic,status:'waiting',scores:{},createdBy:uid,createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000});
 return{ok:true,code,topic};
});
exports.joinGroupCompetition=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),chatId=String(req.data?.chatId||'');
 if(!code||!chatId)throw new HttpsError('invalid-argument','Yarışma kodu ve grup gerekli.');
 const chat=await db.doc('chats/'+chatId).get();if(!chat.exists||chat.data().type!=='group'||!chat.data().memberIds?.includes(uid))throw new HttpsError('permission-denied','Bu grup için katılım yetkin yok.');
 await db.runTransaction(async tx=>{const ref=db.doc('groupCompetitions/'+code),s=await tx.get(ref);if(!s.exists||s.data().expiresAt<Date.now())throw new HttpsError('not-found','Grup yarışması bulunamadı.');const x=s.data();if(x.status!=='waiting'||x.groupA===chatId)throw new HttpsError('failed-precondition','Yarışma dolu veya aynı grup seçildi.');tx.update(ref,{groupB:chatId,membersB:chat.data().memberIds,status:'playing',joinedAt:Field.serverTimestamp()});});
 return{ok:true,code};
});
exports.submitGroupCompetitionResult=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().slice(0,6),score=Number(req.data?.score),correct=Number(req.data?.correct);
 if(!code||!Number.isInteger(score)||score<0||!Number.isInteger(correct)||correct<0||correct>500||score>correct*20)throw new HttpsError('invalid-argument','Grup sonucu geçersiz.');
 let totals={a:0,b:0,complete:false};
 await db.runTransaction(async tx=>{const ref=db.doc('groupCompetitions/'+code),s=await tx.get(ref);if(!s.exists||s.data().status!=='playing')throw new HttpsError('not-found','Aktif grup yarışması bulunamadı.');const x=s.data(),side=x.membersA?.includes(uid)?'a':x.membersB?.includes(uid)?'b':null;if(!side)throw new HttpsError('permission-denied','Bu yarışmada yer almıyorsun.');if(x.scores?.[uid])throw new HttpsError('already-exists','Sonucun zaten kaydedildi.');const scores={...(x.scores||{}),[uid]:{score,correct,side,at:Date.now()}};totals={a:0,b:0,complete:true};for(const v of Object.values(scores)){totals[v.side]+=v.score;}const complete=Object.keys(scores).length>=((x.membersA||[]).length+(x.membersB||[]).length);tx.update(ref,{scores,totals,status:complete?'completed':'playing',completedAt:complete?Field.serverTimestamp():null,updatedAt:Field.serverTimestamp()});});
 return{ok:true,totals};
});


async function publicSubmissionLimit(req,action){
 const ip=String(req.rawRequest?.ip||'unknown'),key=crypto.createHash('sha256').update(action+':'+ip).digest('hex').slice(0,40),ref=db.doc('publicRateLimits/'+key),now=Date.now();
 await db.runTransaction(async tx=>{const s=await tx.get(ref),old=s.exists?s.data():{},active=old.windowStart&&now-old.windowStart<10*60*1000,count=active?Number(old.count)||0:0;if(count>=5)throw new HttpsError('resource-exhausted','Çok fazla form gönderildi. Daha sonra tekrar dene.');tx.set(ref,{windowStart:active?old.windowStart:now,count:count+1,updatedAt:Field.serverTimestamp()});});
}
exports.submitFeedback=onCall(async req=>{
 const d=req.data||{};if(String(d.honeypot||''))return{ok:true};
 await publicSubmissionLimit(req,'feedback');
 const kind=String(d.kind||'Öneri'),message=String(d.message||'').trim();
 if(!['Öneri','Hata','Ad Değişikliği','Teşekkür'].includes(kind)||!message||message.length>500)throw new HttpsError('invalid-argument','Geri bildirim türü veya mesajı geçersiz.');
 await db.collection('feedback').add({kind,message,uid:req.auth?.uid||null,playerName:String(d.playerName||'').slice(0,40),createdAt:Field.serverTimestamp(),status:'new'});
 return{ok:true};
});
exports.submitTeacherRequest=onCall(async req=>{
 const d=req.data||{};if(String(d.honeypot||''))return{ok:true};
 await publicSubmissionLimit(req,'teacher');
 const name=String(d.name||'').trim(),contact=String(d.contact||'E-posta'),email=String(d.email||'').trim().slice(0,100),phone=String(d.phone||'').trim().slice(0,20),school=String(d.school||'').trim(),className=String(d.className||'').trim(),location=String(d.location||'').trim(),request=String(d.request||'Diğer'),message=String(d.message||'').trim();
 if(!name||name.length>60||!school||school.length>80||!['E-posta','Telefon'].includes(contact)||(contact==='E-posta'&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))||(contact==='Telefon'&&!/^[+0-9 ()-]{7,20}$/.test(phone))||message.length>600)throw new HttpsError('invalid-argument','Öğretmen başvuru bilgileri geçersiz.');
 await db.collection('teacherRequests').add({name,contact,email:contact==='E-posta'?email:'',phone:contact==='Telefon'?phone:'',school,className,location,request,message,createdAt:Field.serverTimestamp(),status:'new'});
 return{ok:true};
});

exports.protectAdminProfile=onDocumentCreated('users/{uid}',async e=>{const uid=e.params.uid,u=await admin.auth().getUser(uid).catch(()=>null);if(u&&u.email===ADMIN_EMAIL&&u.emailVerified)await admin.auth().setCustomUserClaims(uid,{...(u.customClaims||{}),admin:true});});

// Skorlar yalnızca callable üzerinden yazılır; oyuncu kendi puanını değiştiremez.
exports.submitGameScore=onCall(async req=>{
 const uid=requireUser(req);await userDoc(uid);const d=req.data||{},score=Number(d.score),questions=Number(d.questions),mode=String(d.mode||'classic'),topic=String(d.topic||'Karışık');
 if(!Number.isInteger(score)||score<0||!Number.isInteger(questions)||questions<1||questions>10000||score>questions*20||!['classic','endless','retry','balance'].includes(mode)||(mode==='retry'&&questions>10))throw new HttpsError('invalid-argument','Skor, soru sayısı veya oyun modu geçersiz.');
 const ur=db.doc(`users/${uid}`),u=await ur.get(),name=String(u.data()?.displayName||req.auth.token.name||'Oyuncu').slice(0,32),publicScore=d.public===true;
 const ref=await db.collection('scores').add({uid,playerName:name,score,mode,topic:topic.slice(0,40),public:publicScore,questions,createdAt:Field.serverTimestamp()});
 return {ok:true,id:ref.id};
});


// Asenkron, kodla katılınan düellolar: her iki oyuncu da skorunu ayrı gönderir.
exports.createDuel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');const topic=String(req.data?.topic||'Karışık').slice(0,40);const ref=db.collection('duels').doc(code);await ref.create({code,hostUid:uid,players:[uid],topic,status:'waiting',scores:{},createdAt:Field.serverTimestamp(),expiresAt:Date.now()+86400000});return{code,topic};});
exports.joinDuel=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(!code)throw new HttpsError('invalid-argument','Düello kodu gerekli.');let topic='Karışık';await db.runTransaction(async tx=>{const r=db.doc(`duels/${code}`),d=await tx.get(r);if(!d.exists||d.data().expiresAt<Date.now())throw new HttpsError('not-found','Düello bulunamadı veya süresi doldu.');const x=d.data();if(x.hostUid===uid)throw new HttpsError('failed-precondition','Kendi düellona katılamazsın.');if(x.status!=='waiting')throw new HttpsError('failed-precondition','Bu düello dolu veya tamamlanmış.');topic=x.topic||'Karışık';tx.update(r,{players:[x.hostUid,uid],status:'playing',joinedAt:Field.serverTimestamp()});});return{ok:true,code,topic};});
exports.submitDuelResult=onCall(async req=>{const uid=requireUser(req);await userDoc(uid);const code=String(req.data?.code||'').toUpperCase().slice(0,6),score=Number(req.data?.score),correct=Number(req.data?.correct);if(!code||!Number.isInteger(score)||score<0||!Number.isInteger(correct)||correct<0||correct>10||score>correct*20)throw new HttpsError('invalid-argument','Düello sonucu geçersiz.');let completed=false;await db.runTransaction(async tx=>{const r=db.doc(`duels/${code}`),d=await tx.get(r);if(!d.exists||!d.data().players?.includes(uid)||d.data().status!=='playing')throw new HttpsError('permission-denied','Bu düelloya katılma yetkin yok.');if(d.data().scores?.[uid])throw new HttpsError('already-exists','Sonucun zaten kaydedildi.');const scores={...(d.data().scores||{}),[uid]:{score,correct,at:Date.now()}};completed=Object.keys(scores).length===2;tx.update(r,{scores,status:completed?'completed':'playing',completedAt:completed?Field.serverTimestamp():null});});return{ok:true,completed};});
