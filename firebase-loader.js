/* Firebase SDK yüklemesini HTML ayrıştırıcısından ayırır; yerel arayüz kodu beklemez. */
(function(w,d){
 'use strict';
 const urls=[
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check-compat.js'
 ];
 w.MMFBReady=new Promise(resolve=>{
  let index=0,finished=false;
  const fail=message=>{if(finished)return;finished=true;resolve({error:message});};
  const next=()=>{
   if(finished)return;
   if(index>=urls.length){finished=true;resolve({ok:true});return;}
   const url=urls[index++],script=d.createElement('script');
   let settled=false;
   const timer=setTimeout(()=>{if(settled)return;settled=true;script.remove();fail('CDN yanıt süresi aşıldı.');},8000);
   script.async=true;
   script.src=url;
   script.onload=()=>{if(settled)return;settled=true;clearTimeout(timer);next();};
   script.onerror=()=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();fail('Firebase CDN dosyası indirilemedi.');};
   d.head.appendChild(script);
  };
  next();
 });
})(window,document);
