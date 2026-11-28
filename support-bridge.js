(function(){
  "use strict";
  const SUPPORT_URL="https://alimiranerr-arch.github.io/HakoSupport/";
  function addButton(){
    if(document.getElementById("hakoSupportBridge"))return;
    const b=document.createElement("button");
    b.id="hakoSupportBridge";b.type="button";b.textContent="💬 Hako Destek";
    b.style.cssText="position:fixed;left:18px;bottom:18px;z-index:9999;border:0;border-radius:999px;padding:12px 18px;background:#263e78;color:#fff;font:700 14px system-ui;box-shadow:0 8px 24px #14234735;cursor:pointer;display:none";
    b.addEventListener("click",async()=>{
      const cloud=window.MMCloud,user=cloud&&cloud.user;
      if(!user){alert("Önce Matematik Macerası hesabına giriş yapmalısın.");return;}
      b.disabled=true;b.textContent="Hesap doğrulanıyor…";
      try{
        // The auth event fires before the background profile sync finishes.
        // Wait for it so createSupportHandoff never races userDoc(uid).
        if(cloud.profileReady&&typeof cloud.profileReady.then==="function"){
          const profileReady=await cloud.profileReady;
          if(!profileReady){
            alert("Matematik Macerası profilin henüz hazır değil. Ana sitedeki profil eşitlemesi tamamlandıktan sonra tekrar dene.");
            return;
          }
        }
        const result=await cloud.fn.httpsCallable("createSupportHandoff")({});
        const ticket=result.data&&result.data.ticket;
        if(!ticket)throw new Error("Güvenli destek bağlantısı oluşturulamadı.");
        location.href=SUPPORT_URL+"#handoff="+encodeURIComponent(ticket);
      }catch(e){
        console.error("[HakoSupport:0110] Güvenli destek devri başarısız:",{code:e.code,message:e.message,details:e.details});
        const direct=confirm("Güvenli hesap aktarımı şu anda çalışmıyor (0110). Destek sitesini doğrudan açalım mı? Hesap bilgilerin otomatik aktarılmayacak.");
        if(direct)window.open(SUPPORT_URL,"_blank","noopener");
      }
      finally{b.disabled=false;b.textContent="💬 Hako Destek";}
    });
    document.body.append(b);
  }
  function update(){
    addButton();
    const b=document.getElementById("hakoSupportBridge"),cloud=window.MMCloud;
    if(b)b.style.display=cloud&&cloud.user?"block":"none";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",update,{once:true});else update();
  window.addEventListener("mm-auth-ready",update);
  window.addEventListener("load",update,{once:true});
})();