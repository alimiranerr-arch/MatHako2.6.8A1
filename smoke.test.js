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

test('Güvenlik kuralları sohbet üyeliğini ve mesaj sahipliğini doğruluyor', () => {
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  const storage=fs.readFileSync(path.join(root,'storage.rules'),'utf8');
  assert.match(rules,/request\.auth\.uid in get\(/);
  assert.match(rules,/request\.resource\.data\.senderId==resource\.data\.senderId/);
  assert.match(storage,/request\.auth\.token\.email_verified==true/);
});

console.log('\n' + passed + ' test başarılı.');
