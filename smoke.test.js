'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }

class FakeElement {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  appendChild(el) { this.children.push(el); return el; }
  replaceChildren(...els) { this.children = els; }
}

test('Tüm JavaScript dosyaları sözdizimi kontrolünden geçiyor', () => {
  const files = [];
  function walk(dir) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory() && e.name!=='node_modules') walk(p); else if(e.isFile() && p.endsWith('.js')) files.push(p); } }
  walk(root);
  for (const file of files) execFileSync(process.execPath, ['--check', file], {stdio:'pipe'});
  assert.ok(files.length >= 10);
});

test('Firebase yapılandırma JSON dosyaları geçerli', () => {
  for (const f of ['firebase.json','firestore.indexes.json','functions/package.json','manifest.webmanifest']) JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
});

test('Ana HTML içindeki yerel script dosyaları mevcut ve ID değerleri benzersiz', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]).filter(s=>!/^https?:\/\//i.test(s));
  for(const src of scripts) assert.ok(fs.existsSync(path.join(root,src)), 'Eksik script: '+src);
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'HTML içinde yinelenen id var');
});

test('QR üreticisi 21x21 QR SVG üretir ve hatalı uzunluğu reddeder', () => {
  const target=new FakeElement('div');
  const document={createElementNS:(_ns,tag)=>new FakeElement(tag),getElementById:()=>target};
  const window={};
  vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/qrcode.js'),'utf8'),{window,document});
  new window.QRCode(target,{text:'MM:ABC123',width:180});
  assert.equal(target.children.length,1);
  const svg=target.children[0];
  assert.equal(svg.attrs.viewBox,'0 0 29 29');
  assert.equal(svg.children.length,2);
  assert.ok(svg.children[1].attrs.d.length>200,'QR modülleri boş');
  assert.throws(()=>new window.QRCode(target,{text:'BU METIN COK UZUN BIR QR KODU'}),/1-25 karakter/);
});

test('Düello QR, kamera tarama, konu seçimi ve 10 soruluk oyun bağları mevcut', () => {
  const duel=fs.readFileSync(path.join(root,'js/duels.js'),'utf8');
  const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
  const backend=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  assert.match(duel,/new w\.QRCode/);
  assert.match(duel,/BarcodeDetector/);
  assert.match(duel,/duelTopic/);
  assert.match(game,/mode='retry'/);
  assert.match(backend,/exports\.createDuel/);
  assert.match(backend,/exports\.joinDuel/);
  assert.match(backend,/exports\.submitDuelResult/);
  assert.match(rules,/match \/duels\/\{id\}/);
});

console.log(`\n${passed} test başarılı.`);
