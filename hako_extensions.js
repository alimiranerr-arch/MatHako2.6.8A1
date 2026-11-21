/* Shared Hako UI extensions used by the current modular app. */
(function(w,d){
 'use strict';
 let toastTimer=null;
 function toast(message,kind='info'){
  let el=d.getElementById('hakoToast');if(!el){el=d.createElement('div');el.id='hakoToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2000000;max-width:min(92vw,520px);padding:12px 16px;border-radius:12px;background:#172033;color:#fff;box-shadow:0 8px 28px #0004;text-align:center';d.body.appendChild(el)}
  el.textContent=String(message||'');el.dataset.kind=kind;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},3200);
 }
 async function copy(value){const text=String(value??'');if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);toast('Panoya kopyalandı.');return true;}const input=d.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';d.body.appendChild(input);input.select();const ok=d.execCommand('copy');input.remove();if(ok)toast('Panoya kopyalandı.');else toast('Kopyalama desteklenmiyor.','error');return ok;}
 function formatCoins(value){const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(n):'0';}
 function safeText(value,max=500){return String(value??'').replace(/[<>]/g,'').slice(0,max);}
 function navigate(id){return w.MatematikMacerasi?.navigate?.(String(id||''))||false;}
 const api={available:true,toast,copy,formatCoins,safeText,navigate,isAdmin:()=>w.MMCloud?.admin===true};
 w.HakoExtensions=api;
 const app=w.MatematikMacerasi=w.MatematikMacerasi||{};app.register=app.register||function(n,v){(app.modules=app.modules||{})[n]=v||{};};app.register('hakoExtensions',api);
})(window,document);
