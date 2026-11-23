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
  assert.ok(fs.readFileSync(path.join(root,'core.js'),'utf8').includes('MMError'));
  assert.ok(fs.readFileSync(path.join(root,'core.js'),'utf8').includes('profileQuickMenu'));
  assert.ok(fs.readFileSync(path.join(root,'features.js'),'utf8').includes("' current'"));
});

test('Firebase yapılandırma JSON dosyaları geçerli', () => {
  for (const f of ['firebase.json','firestore.indexes.json','functions/package.json','manifest.webmanifest','package.json'])
    JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
});

test('Ana HTML içindeki yerel script dosyaları mevcut ve ID değerleri benzersiz', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]).filter(s=>!/^https?:\/\//i.test(s));
  for(const src of scripts) assert.ok(fs.existsSync(path.resolve(root,src.split('?')[0])), 'Eksik script: '+src);
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
  const duels=fs.readFileSync(path.join(root,'duels.js'),'utf8');
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
  assert.ok(social.includes("'image/png'") && social.includes("'image/webp'"));
  assert.ok(features.includes('membershipActive'));
  const authClient=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  assert.ok(authClient.includes("call('syncUserProfile',{device})"));
  assert.ok(authClient.includes('state.profileReady=recordVisitor(user)'));
  assert.ok(fs.readFileSync(path.join(root,'functions/index.js'),'utf8').includes('exports.syncUserProfile=onCall'));
  assert.ok(fs.readFileSync(path.join(root,'settings.js'),'utf8').includes('seasonEffect'));
  assert.ok(fs.readFileSync(path.join(root,'settings.js'),'utf8').includes('settings/theme'));
  assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('teacherFormLock'));
  assert.ok(fs.readFileSync(path.join(root,'firebase-client.js'),'utf8').includes('Hata kodu: 0122'));
  assert.ok(rules.includes('function socialActive()'));
  assert.ok(rules.includes('function validProfile'));
  assert.ok(rules.includes('data.displayName.size()<=80'));
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  assert.ok(game.includes('opts:[`${a+b}/${d}`,`${a+b}/${d*2}`,`${a*b}/${d}`,`${a+b+1}/${d}`].sort'));
  assert.ok(game.includes('Sonuç genel liderliğe eklenmedi'));
});

test('Emoji ve kart ekipman sistemi güvenli ve arayüze bağlı', () => {
  const backend=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
  const features=fs.readFileSync(path.join(root,'features.js'),'utf8');
  const social=fs.readFileSync(path.join(root,'social.js'),'utf8');
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  assert.ok(backend.includes('exports.setInventoryLoadout=onCall'));
  assert.ok(backend.includes("owns(id,'emoji')") && backend.includes("owns(id,'card')"));
  assert.ok(backend.includes('emojis.length!==5||cards.length!==5'));
  assert.ok(features.includes("while(emojis.length<5)emojis.push('');while(cards.length<5)cards.push('')"));
  assert.ok(features.includes("addEventListener('drop'") && features.includes("addEventListener('click'"));
  assert.ok(social.includes("const emoji=w.MMEquipped?.emojis?.[0]?.emoji||''"));
  assert.ok(game.includes('w.MMEquipped?.cards') && game.includes('w.MMEquipped?.emojis'));
  assert.ok(rules.includes("'emoji'") && rules.includes('request.resource.data.emoji.size()<=8'));
});

test('Ortak başlangıç ve sekme gezinmesi etkin', () => {
  const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(core.includes("d.addEventListener('click', onDocumentClick, true)"));
  assert.ok(core.includes("closest?.('[data-go]')"));
  assert.ok(core.includes('app.navigate = navigate'));
  assert.ok(core.includes('w.MMCloud?.admin'));
  assert.ok(html.includes('#bannedOverlay {'));
  assert.ok(html.includes('#bannedOverlay.hide {'));
  assert.ok(html.indexOf('#bannedOverlay {') < html.indexOf('#bannedOverlay.hide {'));
});

test('Ana menü sekmeleri birbirinden bağımsız panelleri açıyor ve koyu temada okunuyor', () => {
  const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'app.css'),'utf8');
  const panels=[...html.matchAll(/data-home-panel="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(panels,['play','inventory','rewards','stats']);
  assert.ok(core.includes("#s0 > [data-home-panel]"));
  assert.ok(core.includes('panel.hidden = !active'));
  assert.ok(core.includes("closest?.('#homeTabs [data-home-tab]')"));
  assert.ok(css.includes('body.theme-night .home-tabs'));
  assert.ok(css.includes('body[data-mm-mode="dark"] .home-tabs'));
});

test('Görev, envanter ve oyuncu pazarı hata kodları ayrılmış; görevler Firestore üzerinden okunuyor', () => {
  const features=fs.readFileSync(path.join(root,'features.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(features.includes("collection('dailyTasks').where('active','==',true)"));
  assert.ok(features.includes("collection('dailyTaskClaims').where('uid','==',c().user.uid)"));
  assert.ok(features.includes("'0142'"));
  assert.ok(features.includes("'0138'"));
  assert.ok(features.includes("'0140'"));
  assert.ok(features.includes("'0136'"));
  assert.ok(!html.includes('Admin tarafından yayınlanan GIF görevleri'));
});

test('Gmail hesabı değiştirilebilir ve boş giriş kartı gösterilmez', () => {
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('id="switchAccountBtn"'));
  assert.ok(client.includes("auth.signOut()"));
  assert.ok(client.includes("accountCard?.classList.add('hide')"));
  assert.ok(client.includes("accountCard?.classList.remove('hide')"));
});

test('Çevrimiçi oyuncu durumu güvenli presence kayıtlarıyla izleniyor', () => {
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const duels=fs.readFileSync(path.join(root,'duels.js'),'utf8');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  assert.ok(client.includes("collection('onlinePresence')"));
  assert.ok(client.includes('setInterval(update,30000)'));
  assert.ok(duels.includes("collection('onlinePresence').where('lastSeen'"));
  assert.ok(duels.includes("$('onlineNames')"));
  assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('id="onlineNames"'));
  assert.ok(rules.includes('match /onlinePresence/{uid}'));
});

test('Firebase SDK dosyaları arayüzü bloke etmeden sırayla yükleniyor', () => {
  const loader=fs.readFileSync(path.join(root,'firebase-loader.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.ok(loader.includes('w.MMFBReady'));
  assert.ok(loader.includes('script.async=true'));
  assert.ok(loader.includes('script.onerror'));
  assert.ok(loader.includes('setTimeout'));
  assert.ok(html.includes('./firebase-loader.js'));
  assert.ok(!html.includes('https://www.gstatic.com/firebasejs/10.14.1/'));
  assert.ok(client.includes('Promise.race([window.MMFBReady,timeout])'));
  assert.ok(client.includes('Firebase SDK eksik modülle yüklendi:'));
  assert.ok(sw.includes("'./firebase-loader.js'"));
});

test('Firebase başlangıcı hata ve gecikme durumlarında uygulamayı kilitlemiyor', () => {
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(client.includes("if(!window.firebase||!window.firebaseConfig||!window.firebaseConfig.apiKey)"));
  assert.ok(client.includes("state.authReady=true"));
  assert.ok(client.includes("new Promise(resolve=>setTimeout(()=>resolve(false),20000))"));
  assert.ok(client.includes("auth.onAuthStateChanged(async user=>"));
  assert.ok(client.includes("Oturum kontrol edilemedi: "));
  assert.ok(html.includes('id="firebaseStatus"'));
});

test('Firebase istemcisi DOMContentLoaded beklemeden güvenli biçimde başlıyor', () => {
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(!client.includes("document.addEventListener('DOMContentLoaded',init)"),
    'Firebase istemcisi DOMContentLoaded olayına bağlı kalmamalı.');
  assert.ok(client.trimEnd().endsWith('init();\n})();'),
    'Firebase istemcisi dosya sonunda init() çağırmalı.');
  const clientScript=html.indexOf('./firebase-client.js');
  const bodyEnd=html.lastIndexOf('</body>');
  assert.ok(clientScript>=0 && bodyEnd>clientScript,
    'Firebase istemcisi, uygulama HTML içeriğinden sonra body sonunda yüklenmeli.');
});

test('Skor gizliliği tercihi kullanıcıya özel buluta kaydediliyor ve çevrimdışı korunuyor', () => {
  const settings=fs.readFileSync(path.join(root,'settings.js'),'utf8');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  assert.ok(settings.includes("doc('privacy').onSnapshot"));
  assert.ok(settings.includes('hideFromPublicLb:value'));
  assert.ok(settings.includes("addEventListener('change',savePrivacy)"));
  assert.ok(rules.includes("doc=='privacy'&&validPrivacy(request.resource.data)"));
  assert.ok(game.includes("public:!$('hideFromPublicLb')?.checked"));
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
  const duels=fs.readFileSync(path.join(root,'duels.js'),'utf8');
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
  assert.ok(/apiKey:\s*"[^"]{20,}"/.test(client),'Firebase Web API key yapılandırması eksik.');
  assert.ok(settings.includes("httpsCallable('redeemGiftCode')"));
  assert.ok(social.includes('ensureNotificationPanel'));
  assert.ok(social.includes('Hata kodu: 0114'));
  assert.ok(social.includes('Hata kodu: 0116'));
  assert.ok(social.includes('Hata kodu: 0117'));
  assert.ok(duels.includes('Hata kodu: 0146'));
  assert.ok(duels.includes('Hata kodu: 0120'));
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

test('2.7.0 sürümü, Mini Pass Gmail kilidi, ödül hata kodu ve profil açılır menüsü', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
  const features=fs.readFileSync(path.join(root,'features.js'),'utf8');
  const social=fs.readFileSync(path.join(root,'social.js'),'utf8');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.version,'2.7.0');
  assert.ok(html.includes('Sürüm 2.7.0') && html.includes('sürüm: 2.7.0'));
  assert.ok(core.includes("app.version = '2.7.0'"));
  assert.ok(html.includes('id="miniPassLock"') && html.includes('class="mini-pass mini-pass-locked"'));
  assert.ok(features.includes('user.emailVerified') && features.includes("Günlük ödül alınamadı.',124"));
  assert.ok(features.includes("Ödül alınamadı.',124"));
  assert.ok(core.includes("profileQuickMenu") && core.includes("aria-hidden"));
  assert.ok(!social.includes("(Hata kodu: 0114)'+' (Hata kodu: 0114)"));
});

test('2.7.0 market, admin görünür kullanıcı aralığı, GIF ve hata kodları', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'app.css'),'utf8');
  const client=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8');
  const features=fs.readFileSync(path.join(root,'features.js'),'utf8');
  const duels=fs.readFileSync(path.join(root,'duels.js'),'utf8');
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const backend=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
  const mirror=fs.readFileSync(path.join(root,'index.js'),'utf8');
  assert.ok(html.includes('data-mk="special"'));
  assert.ok(html.includes('id="gameDifficultyCards"'));
  assert.ok(html.includes('id="admOnlineMin"') && html.includes('id="admOnlineMax"'));
  assert.ok(html.includes('id="admMiniPassGif"') && html.includes('id="miniPassAdminGif"'));
  assert.ok(css.includes('#s7:not(.hide) #saveSettings.savebar{position:fixed'));
  assert.ok(game.includes('#gameDifficultyCards'));
  assert.ok(client.includes("setOnlineDisplayRange") && client.includes("setMiniPassGif"));
  assert.ok(features.includes('Hata kodu: 0126') && features.includes('Hata kodu: 0130') && features.includes('Hata kodu: 0132'));
  assert.ok(client.includes("'0128'"));
  assert.ok(duels.includes('Hata kodu: 0134') && duels.includes('Hata kodu: 0146'));
  assert.ok(backend.includes('exports.setOnlineDisplayRange') && backend.includes('exports.setMiniPassGif'));
  assert.equal(backend,mirror,'Root ve Functions backend kaynakları eşleşmeli.');
});
