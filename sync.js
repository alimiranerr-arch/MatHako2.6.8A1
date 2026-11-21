/* Senkronizasyon modülü için açık durum bildirimi. Güvenli sunucu kuralları olmadan veri senkronizasyonu başlatılmaz. */
(function(w){ const a=w.MatematikMacerasi=w.MatematikMacerasi||{}; a.register=a.register||function(n,v){(a.modules=a.modules||{})[n]=v||{};}; a.register("sync",{available:false,reason:"Orijinal sync.js ve doğrulanmış Firebase güvenlik kuralları bulunmuyor."}); })(window);
