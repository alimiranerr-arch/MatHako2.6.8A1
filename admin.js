/* Hako admin arayüzü ve Storage Network kontrolü. Yetki her istekte Worker tarafından doğrulanır. */
(function(w){
 "use strict";
 const a=w.MatematikMacerasi=w.MatematikMacerasi||{};
 a.register=a.register||function(n,v){(a.modules=a.modules||{})[n]=v||{};};
 a.admin={email:"alimiranerr@gmail.com",authorization:"Firebase custom claim (admin) + doğrulanmış e-posta",get active(){return !!w.MMCloud?.admin;}};
 a.register("admin",a.admin);
 const $=id=>document.getElementById(id);
 function endpoint(){
   const raw=String($("storageWorkerUrl")?.value||"").trim().replace(/\/+$/,"");
   if(!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?$/.test(raw)) throw new Error("Geçerli HTTPS Worker adresini yaz.");
   return raw;
 }
 async function request(path,method="GET"){
   const cloud=w.MMCloud;
   if(!cloud?.admin||!cloud.user) throw new Error("Bu işlem yalnızca doğrulanmış yönetici hesabına açıktır.");
   const token=await cloud.user.getIdToken();
   const response=await fetch(endpoint()+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}});
   const data=await response.json().catch(()=>({}));
   if(!response.ok) throw new Error(data.message||data.error||("HTTP "+response.status));
   return data;
 }
 function status(message,error=false){const el=$("storageNetworkStatus");if(el){el.textContent=message;el.classList.toggle("err",error);}}
 function render(items){
   const list=$("storageNetworkList");if(!list)return;
   list.replaceChildren();
   (items||[]).forEach(item=>{
     const row=document.createElement("div");row.className="storage-shard-row";
     const name=document.createElement("strong");name.textContent=item.repository;
     const count=document.createElement("span");count.textContent=Number(item.images)+" / "+Number(item.limit)+" görsel";
     const remaining=document.createElement("span");remaining.textContent=" · "+Math.max(0,Number(item.limit)-Number(item.images))+" boş yer";
     row.append(name,count,remaining);list.append(row);
   });
   if(!items?.length){const empty=document.createElement("p");empty.textContent="Henüz depo kaydı bulunamadı.";list.append(empty);}
 }
 async function refresh(){
   try{status("Depo kotaları okunuyor…");const data=await request("/v1/admin/storage");render(data.repositories);status("Kota bilgisi güncellendi. En fazla "+data.repositoryLimit+" depo; depo başına "+data.imagesPerRepository+" görsel.");}
   catch(e){status("Kota bilgisi alınamadı: "+e.message,true);}
 }
 async function requestShard(){
   const button=$("storageRequestShardBtn");if(button)button.disabled=true;
   try{
     status("Yeni depo talebi kaydediliyor…");
     const data=await request("/v1/admin/storage/request-shard","POST");
     status("Talep kaydedildi: "+data.requestedName+" · "+data.imageLimit+" görsel. GitHub'da bu adla Private depo oluşturup Worker STORAGE_REPOSITORIES listesine ekle.");
   }catch(e){status("Depo talebi oluşturulamadı: "+e.message,true);}
   finally{if(button)button.disabled=false;}
 }
 document.addEventListener("DOMContentLoaded",()=>{
   $("storageRefreshBtn")?.addEventListener("click",refresh);
   $("storageRequestShardBtn")?.addEventListener("click",requestShard);
 });
})(window);
