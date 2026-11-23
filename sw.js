/* Offline app shell for GitHub Pages. Firebase data and authenticated requests are never cached. */
const CACHE_NAME='mathako-shell-2026-11-23-v21';
const APP_ASSETS=[
 './','./index.html','./app.css','./firebase-loader.js','./media-config.js','./support-bridge.js','./manifest.webmanifest',
 './admin-scores.js','./admin-tools.js','./admin.js','./core.js','./duels.js',
 './features.js','./firebase-client.js','./fixtures.js','./game.js',
 './hako_extensions.js','./helpy-notices.js','./player-search.js','./qrcode.js',
 './settings.js','./social.js','./sync.js',
 './bakim-molasi.png','./helpy-onemli-is.webp','./helpy-referans-1.jpg',
 './helpy-referans-2.jpg','./helpy-teknik-onarim.gif',
 './icon.svg','./icon-96.png','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mathako-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(!response.ok)throw Error('Navigation network response not OK');const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));
  return;
 }
 const path=url.pathname;
 const isShell=APP_ASSETS.some(asset=>new URL(asset,self.location.href).pathname===path);
 if(!isShell)return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;})));
});
