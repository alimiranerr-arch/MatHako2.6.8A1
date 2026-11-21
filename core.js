/* Güvenli ortak başlangıç katmanı. Orijinal core.js kaynak kodu mevcut değildi. */
(function(w){
  const app = w.MatematikMacerasi = w.MatematikMacerasi || {};
  app.version = "2.6.7-recovery";
  app.modules = app.modules || {};
  app.register = function(name, api){ app.modules[name] = api || {}; };
  app.ready = true;
})(window);
