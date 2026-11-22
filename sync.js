/* Cloud sync for non-sensitive user appearance preferences. */
(function(w){
 'use strict';
 const keys=['bw','mode','theme','bgOn','bg','custom','c1','c2','effect','sound','vibration'];
 function cloud(){return w.MMCloud}
 function clean(value){const out={};keys.forEach(k=>{if(value&&Object.prototype.hasOwnProperty.call(value,k))out[k]=value[k]});return out}
 async function loadAppearance(){
  const c=cloud();if(!c?.user||!c?.db)return null;
  const snap=await c.db.collection('users').doc(c.user.uid).collection('preferences').doc('appearance').get();
  return snap.exists?clean(snap.data()):null;
 }
 function watchAppearance(onChange){const c=cloud();if(!c?.user||!c?.db)return()=>{};return c.db.collection('users').doc(c.user.uid).collection('preferences').doc('appearance').onSnapshot(s=>onChange(s.exists?clean(s.data()):null),e=>console.warn('Görünüm ayarları dinlenemedi:',e));}
 async function saveAppearance(value){
  const c=cloud();if(!c?.user||!c?.db)throw new Error('Görünüm ayarlarını eşitlemek için giriş yapmalısın.');
  const data=clean(value);
  await c.db.collection('users').doc(c.user.uid).collection('preferences').doc('appearance').set({...data,updatedAt:w.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  return{ok:true};
 }
 w.MMCloudSync={loadAppearance,saveAppearance,watchAppearance,available:true};
 const app=w.MatematikMacerasi=w.MatematikMacerasi||{};app.register=app.register||function(n,v){(app.modules=app.modules||{})[n]=v||{};};app.register('sync',w.MMCloudSync);
})(window);
