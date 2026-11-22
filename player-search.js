/* Oyuncu arama: profil koleksiyonunu doğrudan okumaz; sınırlı alanları callable üzerinden alır. */
(function(w){'use strict';const $=id=>document.getElementById(id);
 async function search(){
  const c=w.MMCloud,q=($('idSearch')?.value||'').trim(),out=$('playerSearchResults');
  if(!out)return;if(!c?.user){out.textContent='Oyuncu aramak için önce giriş yapmalısın.';return;}
  if(q.length<2){out.textContent='En az 2 karakter yaz.';return;}
  out.textContent='Aranıyor…';
  try{
   const r=await c.fn.httpsCallable('searchPlayers')({query:q}),players=r.data.players||[];
   out.innerHTML='';if(!players.length){out.textContent='Oyuncu bulunamadı.';return;}
   players.forEach(u=>{const row=document.createElement('div');row.className='player-result';const title=document.createElement('b');title.textContent=u.displayName||'Oyuncu';const id=document.createElement('small');id.textContent='ID: '+u.playerId;row.append(title,id);out.append(row);});
  }catch(e){out.textContent='Arama başarısız: '+e.message;}
 }
 document.addEventListener('DOMContentLoaded',()=>{$('idSearchBtn')?.addEventListener('click',search);$('idSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')search()});});
})(window);
