/* Hako Storage Network endpoint and shared media error handling. */
window.MMStorageWorkerUrl = "https://hako-media-server.alimiranerr.workers.dev";
window.MMStorageFail = function (message, code) {
  const errorCode = String(code || "0148");
  const clean = String(message || "Görsel sunucusu işlemi başarısız oldu.")
    .replace(/\s*\(Hata kodu: \d+\)$/, "");
  window.MMError?.show?.(clean, errorCode);
  return new Error(clean + " (Hata kodu: " + errorCode + ")");
};
window.MMStorageFetch = async function (url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const networkFailure = error instanceof TypeError ||
      /failed to fetch|networkerror|load failed|fetch failed/i.test(String(error?.message || error));
    if (networkFailure) {
      throw window.MMStorageFail("Görsel sunucusuna ulaşılamadı. Bağlantı veya sunucu erişimi (CORS) kontrol edilmeli.", "0150");
    }
    throw window.MMStorageFail(error?.message || "Görsel sunucusu isteği başarısız oldu.", "0148");
  }
};