/* Hako Storage Network public endpoint and shared media error handler. */
window.MMStorageWorkerUrl = "https://hako-media-server.alimiranerr.workers.dev";
window.MMStorageFail = function (message) {
  const clean = String(message || "Görsel sunucusu işlemi başarısız oldu.")
    .replace(/\s*\(Hata kodu: 0148\)$/, "");
  window.MMError?.show?.(clean, "0148");
  return new Error(clean + " (Hata kodu: 0148)");
};
