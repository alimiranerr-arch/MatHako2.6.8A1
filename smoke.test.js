'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = __dirname;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }

test('Tüm JavaScript dosyaları sözdizimi kontrolünden geçiyor', () => {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
      const p=path.join(dir,e.name);
      if(e.isDirectory() && e.name!=='node_modules') walk(p);
      else if(e.isFile() && p.endsWith('.js')) files.push(p);
    }
  }
  walk(root);
  for (const file of files) execFileSync(process.execPath, ['--check', file], {stdio:'pipe'});
  assert.ok(files.length >= 10);
});

test('Firebase yapılandırma JSON dosyaları geçerli', () => {
  for (const f of ['firebase.json','firestore.indexes.json','functions/package.json','manifest.webmanifest','package.json'])
    JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
});

test('Ana HTML içindeki yerel script dosyaları mevcut ve ID değerleri benzersiz', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]).filter(s=>!/^https?:\/\//i.test(s));
  for(const src of scripts) assert.ok(fs.existsSync(path.resolve(root,src)), 'Eksik script: '+src);
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'HTML içinde yinelenen id var');
});

test('Cloud Functions yapılandırması mevcut kaynak diziniyle eşleşiyor', () => {
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8'));
  assert.equal(cfg.functions[0].source,'functions');
  assert.ok(fs.existsSync(path.join(root,'functions/index.js')));
  assert.ok(fs.existsSync(path.join(root,'functions/package.json')));
});

test('Güvenlik ve sohbet işlevleri için ek kontroller mevcut', () => {
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  const storage=fs.readFileSync(path.join(root,'storage.rules'),'utf8');
  const functions=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
  const social=fs.readFileSync(path.join(root,'social.js'),'utf8');
  const features=fs.readFileSync(path.join(root,'features.js'),'utf8');
  assert.ok(rules.includes('request.auth.uid in get('));
  assert.ok(rules.includes('request.resource.data.senderId==request.auth.uid'));
  assert.ok(rules.includes('senderName==get('));
  assert.ok(rules.includes("resource.data.published==true"));
  assert.ok(storage.includes('request.auth.token.email_verified==true'));
  assert.ok(storage.includes('fileName.matches'));
  assert.ok(functions.includes('exports.searchPlayers=onCall'));
  assert.ok(functions.includes('exports.findChatMembers=onCall'));
  assert.ok(functions.includes("if(!d.exists)throw new HttpsError('failed-precondition','Kullanıcı profili henüz hazır değil."));
  assert.ok(functions.includes('function rateLimit'));
  assert.ok(functions.includes("timeZone:'Europe/Istanbul'"));
  assert.ok(functions.includes('resource-exhausted'));
  assert.ok(functions.includes('exports.startGameSession=onCall'));
  assert.ok(functions.includes('exports.submitGameAnswer=onCall'));
  assert.ok(functions.includes('exports.finishGameSession=onCall'));
  assert.ok(functions.includes('answers:Field.arrayUnion(entry)'));
  assert.ok(functions.includes("await rateLimit(uid,'submitGameAnswer',600)"));
  assert.ok(functions.includes('Doğrudan skor gönderimi kapalı'));
  assert.ok(functions.includes('Grup skorları yalnızca doğrulanmış oyun oturumundan gönderilebilir'));
  assert.ok(functions.includes('Düello skorları yalnızca doğrulanmış oyun oturumundan gönderilebilir'));
  assert.ok(social.includes('emails.length>9'));
  assert.ok(social.includes('currentSenderName'));
  assert.ok(social.includes('image\\/(png|jpeg|gif|webp)'));
  assert.ok(features.includes('membershipActive'));
  const authClient=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  assert.ok(authClient.includes('recordVisitor(user).then(()=>true)'));
  assert.ok(rules.includes('function validProfile'));
  assert.ok(rules.includes('data.displayName.size()<=80'));
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  assert.ok(game.includes('opts:[`${a+b}/${d}`,`${a+b}/${d*2}`,`${a*b}/${d}`,`${a+b+1}/${d}`].sort'));
  assert.ok(game.includes('genel liderlik tablosuna eklenmedi'));
});

test('Ortak başlangıç ve sekme gezinmesi etkin', () => {
  const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(core.includes("d.addEventListener('click', onDocumentClick)"));
  assert.ok(core.includes("closest?.('[data-go]')"));
  assert.ok(core.includes('app.navigate = navigate'));
  assert.ok(core.includes('w.MMCloud?.admin'));
  assert.ok(html.includes('#bannedOverlay {'));
  assert.ok(html.includes('#bannedOverlay.hide {'));
  assert.ok(html.indexOf('#bannedOverlay {') < html.indexOf('#bannedOverlay.hide {'));
});

test('Firebase başlangıcı hata ve gecikme durumlarında uygulamayı kilitlemiyor', () => {
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(client.includes("if(!window.firebase||!window.firebaseConfig)"));
  assert.ok(client.includes("state.authReady=true"));
  assert.ok(client.includes("new Promise(resolve=>setTimeout(()=>resolve(false),7000))"));
  assert.ok(client.includes("auth.onAuthStateChanged(async user=>"));
  assert.ok(client.includes("Oturum kontrol edilemedi: "));
  assert.ok(html.includes('id="firebaseStatus"'));
});

test('PWA ikon yolları depodaki gerçek dosyalarla eşleşiyor', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.ok(html.includes('href="icon.svg"'));
  assert.ok(html.includes('href="icon-192.png"'));
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  for(const icon of manifest.icons) {
    const asset=icon.src.replace('./','');
    assert.ok(fs.existsSync(path.join(root,asset)),'Eksik PWA ikonu: '+asset);
  }
});

test('Yeni güvenli oyun, hesap, hediye ve yönetim akışları kaynakta bağlı', () => {
  const backend=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
  const mirror=fs.readFileSync(path.join(root,'index.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const settings=fs.readFileSync(path.join(root,'settings.js'),'utf8');
  const social=fs.readFileSync(path.join(root,'social.js'),'utf8');
  const admin=fs.readFileSync(path.join(root,'admin-tools.js'),'utf8');
  const sync=fs.readFileSync(path.join(root,'sync.js'),'utf8');
  const extensions=fs.readFileSync(path.join(root,'hako_extensions.js'),'utf8');
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  const storage=fs.readFileSync(path.join(root,'storage.rules'),'utf8');
  assert.equal(backend,mirror,'Root ve Functions backend kaynakları eşleşmeli.');
  for(const name of ['completeEmailChange','startMistakeReview','publishAndGrantMarketItem','createGiftCode','redeemGiftCode','setFeatureFlags','resolveMessageReport','randomJoinCode']) {
    assert.ok(backend.includes(name),'Eksik backend iş akışı: '+name);
  }
  assert.ok(backend.includes('questionDeadlineAt'));
  assert.ok(backend.includes('crypto.randomInt'));
  assert.ok(html.includes('./settings.js'));
  assert.ok(html.includes('./admin-tools.js'));
  assert.ok(settings.includes("navigator.serviceWorker.register('./sw.js')"));
  assert.ok(sync.includes('loadAppearance')&&sync.includes('saveAppearance'));
  assert.ok(extensions.includes('available:true'));
  assert.ok(client.includes('apiKey: ""'),'Doğrulanmamış Firebase API key depoda tutulmamalı.');
  assert.ok(settings.includes("httpsCallable('redeemGiftCode')"));
  assert.ok(social.includes('ensureNotificationPanel'));
  assert.ok(social.includes('displayName') && social.includes('friend.data()'));
  assert.ok(admin.includes('resolveMessageReport'));
  assert.ok(rules.includes('match /giftCodes/{code}'));
  assert.ok(rules.includes('avatarPath'));
  assert.ok(storage.includes('match /avatars/{uid}/{fileName}'));
});

test('Offline uygulama kabuğu yalnızca depoda bulunan statik dosyaları önbelleğe alıyor', () => {
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.ok(sw.includes("request.method!=='GET'"));
  assert.ok(sw.includes("url.origin!==self.location.origin"));
  assert.ok(sw.includes("request.mode==='navigate'"));
  const assets=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(x=>x!==''&&x!=='index.html');
  for(const asset of assets) assert.ok(fs.existsSync(path.join(root,asset)),'Service worker var olmayan dosyayı önbelleğe alıyor: '+asset);
});

console.log('\n' + passed + ' test başarılı.');
