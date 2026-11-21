# Firebase App Check kurulumu (son dış bağımlılık)

İstemci tarafında App Check SDK'sı yüklendi ve isteğe bağlı reCAPTCHA v3 başlatma kodu eklendi. Ancak **App Check henüz etkin/enforced değildir**; Firebase projesine ait site key olmadan güvenli biçimde etkinleştirilemez.

## Gerekli Firebase Console adımları

1. Firebase Console'da `hakomatonline261` projesini aç.
2. **App Check** bölümüne gir ve web uygulamasını kaydet.
3. reCAPTCHA v3 sağlayıcısını seç; GitHub Pages alan adını (ör. `alimiranerr-arch.github.io`) izin verilen alan adlarına ekle.
4. Üretilen site key'i al.
5. `firebase-client.js` içindeki `firebaseConfig.appCheckSiteKey` alanına site key'i yaz.
6. Önce App Check metriklerini izleyerek gerçek kullanıcı trafiğinin token aldığını doğrula.
7. Ardından Firebase Console'da Cloud Firestore, Cloud Storage ve Cloud Functions için App Check enforcement'ı ayrı ayrı aç.
8. Enforcement sonrası giriş, market, sohbet, dosya yükleme, oyun oturumu ve yönetici callable işlemlerini doğrula.

## Önemli

- Site key gizli anahtar değildir; buna karşılık App Check debug token'ı veya servis hesabı anahtarı depoya kesinlikle eklenmemelidir.
- Enforcement, geçerli token alamayan eski istemcilerin isteklerini reddedebilir. Önce metrikleri kontrol et.
- Bu adımlar Firebase Console erişimi gerektirir; depo kodundan tek başına tamamlanamaz.
- Bu işlem için henüz canlı Firebase ayarlarına müdahale edilmedi ve hiçbir deploy yapılmadı.
