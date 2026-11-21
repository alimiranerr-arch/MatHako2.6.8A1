/* Hako settings, profile avatar, accessibility and preference controls. */
(function(w,d){
 'use strict';
 const $=id=>d.getElementById(id),KEY='mm_user_settings_v1';
 const defaults={bw:false,mode:'auto',theme:0,bgOn:false,bg:0,custom:false,c1:'#fff7e0',c2:'#dbeafe',effect:'none',sound:false,vibration:false};
 const themes=[['Gün Işığı','#fff7e0','#dbeafe'],['Okyanus','#dff6ff','#c7d2fe'],['Lavanta','#f5e8ff','#fce7f3'],['Orman','#e7f8e9','#d1fae5'],['Gün Batımı','#ffedd5','#fbcfe8']];
 const bgs=[['Krem','#fff7e0','#ffffff'],['Buz','#e0f2fe','#eef2ff'],['Pembe','#fce7f3','#fff1f2'],['Mint','#d1fae5','#ecfccb']];
 const pairs=[['Mavi','#2563eb','#93c5fd'],['Mor','#7c3aed','#c4b5fd'],['Yeşil','#059669','#a7f3d0'],['Turuncu','#ea580c','#fed7aa']];
 let state={...defaults};let installPrompt=null,stopProfile=null;
 function read(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(_){return {...defaults}}}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('Ayarlar kaydedilemedi:',e)}}
 function effectiveMode(){if(state.mode!=='auto')return state.mode;const h=new Date().getHours();return h>=7&&h<19?'light':'dark'}
 function apply(){
  const mode=effectiveMode(),pair=state.custom?[state.c1,state.c2]:state.bgOn?bgs[state.bg]:themes[state.theme].slice(1);
  d.body.classList.toggle('mm-bw',!!state.bw);d.body.dataset.mmMode=mode;d.body.dataset.mmEffect=state.effect;
  d.body.style.setProperty('--mm-bg-a',pair[0]);d.body.style.setProperty('--mm-bg-b',pair[1]);
  d.body.style.backgroundImage='linear-gradient(135deg,var(--mm-bg-a),var(--mm-bg-b))';
  d.body.style.backgroundAttachment='fixed';
  const sw=$('swatch');if(sw)sw.style.background='linear-gradient(90deg,'+state.c1+','+state.c2+')';
  let fx=$('mmWeatherFx');if(!fx){fx=d.createElement('div');fx.id='mmWeatherFx';fx.setAttribute('aria-hidden','true');fx.style.cssText='position:fixed;right:14px;top:72px;z-index:2;pointer-events:none;font-size:26px;opacity:.55';d.body.appendChild(fx)}
  fx.textContent=state.effect==='sunny'?'☀️':state.effect==='rain'?'🌧️':state.effect==='snow'?'❄️':'';
 }
 function selected(container,attr,value){container?.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===value)));}
 function choices(id,items,onPick){const box=$(id);if(!box)return;box.replaceChildren();items.forEach((item,i)=>{const b=d.createElement('button');b.type='button';b.className='btn';b.textContent=item[0];b.style.background='linear-gradient(120deg,'+item[1]+','+item[2]+')';b.style.color='#172033';b.setAttribute('aria-pressed',String(i===state[id==='themeList'?'theme':'bg']));b.addEventListener('click',()=>onPick(i));box.appendChild(b)})}
 function syncControls(){
  if($('bwOn'))$('bwOn').checked=!!state.bw;
  if($('bgOn'))$('bgOn').checked=!!state.bgOn;
  if($('customOn'))$('customOn').checked=!!state.custom;
  if($('c1'))$('c1').value=state.c1;if($('c2'))$('c2').value=state.c2;
  if($('fxSel'))$('fxSel').value=state.effect;
  if($('sndOn'))$('sndOn').checked=!!state.sound;if($('vibOn'))$('vibOn').checked=!!state.vibration;
  d.querySelectorAll('[data-md]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.md===state.mode)));
  d.querySelectorAll('[data-st]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.st===((w.MMCloud?.profile?.status)||'online'))));
 }
 function collect(){state.bw=!!$('bwOn')?.checked;state.bgOn=!!$('bgOn')?.checked;state.custom=!!$('customOn')?.checked;state.c1=$('c1')?.value||state.c1;state.c2=$('c2')?.value||state.c2;state.effect=$('fxSel')?.value||'none';state.sound=!!$('sndOn')?.checked;state.vibration=!!$('vibOn')?.checked}
 function status(value){const c=w.MMCloud;if(!c?.user||!c?.db){alert('Durumunu değiştirmek için giriş yapmalısın.');return}c.db.collection('users').doc(c.user.uid).set({status:value,statusUpdatedAt:w.firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(e=>alert('Durum kaydedilemedi: '+e.message))}
 function avatarView(emoji,path){const el=$('meAv');if(el){el.replaceChildren();if(path&&w.firebase?.storage){w.firebase.storage().ref(path).getDownloadURL().then(url=>{const img=d.createElement('img');img.src=url;img.alt='Profil resmi';img.style.cssText='width:30px;height:30px;object-fit:cover;border-radius:50%';el.replaceChildren(img)}).catch(()=>{el.textContent=emoji||'🙂'})}else el.textContent=emoji||'🙂'}const preview=$('avatarPreviewBox');if(preview)preview.textContent=emoji||'🙂'}
 async function saveAvatar(user){
  const emoji=$('presetAvatarSelect')?.value||'🦊',file=$('customAvatarFile')?.files?.[0];
  if(!file)return{avatar:emoji,avatarPath:''};
  if(file.size>2*1024*1024)throw Error('Profil resmi en fazla 2 MB olabilir.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Profil resmi PNG, JPEG veya WebP olmalı.');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path='avatars/'+user.uid+'/avatar-'+Date.now()+'.'+ext;
  await w.firebase.storage().ref(path).put(file,{contentType:file.type});
  return{avatar:'🖼️',avatarPath:path};
 }
 function watchProfile(){
  const c=w.MMCloud;if(!c?.user||!c?.db)return;stopProfile?.();
  stopProfile=c.db.collection('users').doc(c.user.uid).onSnapshot(s=>{if(!s.exists)return;const u=s.data();c.profile=u;avatarView(u.avatar||'🙂',u.avatarPath||'');const name=$('meName');if(name)name.textContent=u.nickname||u.displayName||'Oyuncu';},e=>console.warn('Profil görünümü:',e));
 }
 function bind(){
  state=read();choices('themeList',themes,i=>{state.theme=i;state.bgOn=false;state.custom=false;choices('themeList',themes,()=>{});persist();apply()});
  choices('bgPick',bgs,i=>{state.bg=i;state.bgOn=true;state.custom=false;persist();apply()});
  choices('pairList',pairs,i=>{state.c1=pairs[i][1];state.c2=pairs[i][2];state.custom=true;state.bgOn=false;syncControls();persist();apply()});
  syncControls();apply();
  $('bwOn')?.addEventListener('change',()=>{collect();persist();apply()});
  $('bgOn')?.addEventListener('change',()=>{collect();persist();apply()});
  $('customOn')?.addEventListener('change',()=>{collect();persist();apply()});
  ['c1','c2','fxSel','sndOn','vibOn'].forEach(id=>$(id)?.addEventListener('change',()=>{collect();persist();apply()}));
  d.querySelectorAll('[data-md]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.md;syncControls();persist();apply()}));
  d.querySelectorAll('[data-st]').forEach(b=>b.addEventListener('click',()=>{d.querySelectorAll('[data-st]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));status(b.dataset.st)}));
  $('saveSettings')?.addEventListener('click',()=>{collect();persist();apply();const b=$('saveSettings');if(b){const old=b.textContent;b.textContent='✓ Kaydedildi';setTimeout(()=>b.textContent=old,1200)}});
  $('resetBtn')?.addEventListener('click',()=>{if(!confirm('Bu cihazdaki görünüm ve ses ayarları sıfırlansın mı?'))return;state={...defaults};persist();syncControls();apply()});
  $('meChip')?.addEventListener('click',()=>w.MatematikMacerasi?.navigate('s6'));
  $('coinBox')?.addEventListener('click',()=>w.MatematikMacerasi?.navigate('s5'));
  $('presetAvatarSelect')?.addEventListener('change',()=>avatarView($('presetAvatarSelect').value,''));
  $('customAvatarFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type)){alert('PNG, JPEG veya WebP; en fazla 2 MB kullan.');e.target.value='';return}const url=URL.createObjectURL(f),img=d.createElement('img');img.src=url;img.alt='Avatar önizlemesi';img.style.cssText='max-width:90px;max-height:90px;border-radius:50%';$('avatarPreviewBox')?.replaceChildren(img)});
  $('pdfBtn')?.addEventListener('click',()=>{$('statPdfBtn')?.click()});
  $('fbKind')?.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{ $('fbKind').querySelectorAll('[data-k]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));if($('fbTur'))$('fbTur').value=b.dataset.k}));
  $('fbMsg')?.addEventListener('input',()=>{if($('fbChars'))$('fbChars').textContent=($('fbMsg').value.length)+'/500'});
  $('teacherContactPref')?.addEventListener('change',()=>{const email=$('teacherContactPref').value==='E-posta';$('teacherEmailLabel')?.classList.toggle('hide',!email);$('teacherPhoneLabel')?.classList.toggle('hide',email);if($('teacherEmailInput'))$('teacherEmailInput').required=email;if($('teacherPhoneInput'))$('teacherPhoneInput').required=!email});
  $('testFx')?.addEventListener('click',()=>{if(state.sound){try{const Ctx=w.AudioContext||w.webkitAudioContext;if(Ctx){const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=660;gain.gain.value=.06;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.16);osc.onended=()=>ctx.close()}}catch(e){console.warn(e)}}if(state.vibration&&navigator.vibrate)navigator.vibrate(120)});
  $('bellBtn')?.addEventListener('click',()=>{const panel=$('notifPanel');if(panel){panel.classList.toggle('hide');panel.setAttribute('aria-hidden',String(panel.classList.contains('hide')))}});
  w.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn')?.classList.remove('hide')});
  $('installBtn')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn')?.classList.add('hide')});
  w.addEventListener('appinstalled',()=>{$('installBtn')?.classList.add('hide')});
  w.addEventListener('mm-auth-ready',e=>{if(e.detail?.user){watchProfile()}else{stopProfile?.();stopProfile=null}});
  if(w.MMCloud?.user)watchProfile();
 }
 w.MMSettings={saveAvatar,apply};
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window,document);
