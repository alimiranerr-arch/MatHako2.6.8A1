# Hako Storage Network — ana site entegrasyon planı

## Karar
- Yönetim: yalnızca ana site yönetici panelinden talep oluşturma.
- Kota: depo başına en fazla 1.000 görsel, dosya başına 5 MiB.
- Worker yapılandırmasına en fazla 10 Private depo eklenebilir.
- İlk shard: `alimiranerr-arch/USERDATA_MATS-TE`.
- Worker kodu ve yönetici paneli aynı PR dalında hazırlanıyor:
  https://github.com/alimiranerr-arch/USERDATA_MATS-TE/pull/1

## Yönetici paneli
- Admin panelinde Worker URL alanı, depo kota görüntüleme ve yeni Private depo talebi butonu bulunur.
- İstekler yalnızca doğrulanmış Firebase yöneticisinin `admin: true` custom claim'i ve `alimiranerr@gmail.com` e-posta eşleşmesi ile kabul edilir.
- Yeni depo talebi mevcut Private depoda JSON kayıt oluşturur.
- GitHub token yalnızca USERDATA_MATS-TE Contents read/write kapsamındadır. Hesap genelinde depo oluşturma yetkisi verilmez.
- Bu nedenle yönetici paneli talep kaydeder; depo sahibi GitHub'da talep edilen ismi Private repo olarak oluşturur ve Worker `STORAGE_REPOSITORIES` değişkenine ekler. Bu adım otomatik repo oluşturma değildir.

## Kota ve güvenlik
- Worker yükleme öncesi her shard'ın Git tree sayımını yapar; depo başına 1.000 görsel sınırını uygular.
- Aynı shard üzerinde eşzamanlı yüklemeler GitHub Contents API lock dosyasıyla sıraya alınır.
- En fazla 8 shard taranır; bu sayı Cloudflare Free harici alt-istek bütçesi için sabitlenmiştir.
- Depo dolu veya kilitliyse yükleme reddedilir. Ücretli plana geçiş/otomatik faturalandırma yoktur.
- Firebase ID token, imza, issuer, audience, e-posta doğrulaması kontrol edilir. Admin endpoint ayrıca admin claim ve e-posta ister.
- GitHub token yalnızca Worker secret'tır; tarayıcı koduna girmez.

## Henüz taşınmayacaklar
- Avatar/profil akışı henüz Worker API'sine bağlanmadı.
- Sohbet medya erişiminde üyelik bazlı okuma, silme, moderasyon ve kota kontrolleri tamamlanmadı; sohbet ekleri mevcut akışta kalır.
- Market görselleri için admin-only yükleme entegrasyonu tamamlanmadı.
- HakoSupport ayrı Firebase projesi kurulup allowlist'e eklenmeden HakoSupport upload etkinleştirilmez.

## Kurulum öncesi gereklilikler
1. Cloudflare Workers Free Worker kurulmalı; ücretli plan açılmamalı.
2. `GITHUB_TOKEN` yalnızca USERDATA_MATS-TE için Contents read/write olmalı.
3. `MEDIA_SIGNING_SECRET`, `FIREBASE_PROJECT_IDS`, `ADMIN_EMAIL`, `ALLOWED_ORIGINS` güvenli şekilde ayarlanmalı.
4. Ana site admin claim'inin gerçekten `admin: true` olduğu doğrulanmalı.
5. Testler kullanıcı açıkça "test et" dediğinde yapılmalı.

**Durum:** PR dalında hazırlandı; test, deploy, merge veya main değişikliği yapılmadı.


## Son PR entegrasyonu
- `media-config.js` üzerinden ortak Worker adresi yapılandırılır.
- Profil avatarı yükleme artık `POST /v1/upload` kullanır; Firestore profilinde Worker yolunu tutar, görüntülemede kısa ömürlü URL yeniler.
- Sohbet ekleri `POST /v1/chat-upload` kullanır. Worker her yükleme ve URL yenilemede Firestore chat belgesinden üyeliği doğrular.
- Sohbet dosyası başına 15 MiB; kullanıcı/sohbet başına ağ genelinde 100 dosya ve 100 MiB kota.
- Mevcut Firebase Storage ekleri geçiş süresince eski URL üzerinden görüntülenebilir.
- Worker URL boşken yeni avatar/sohbet yüklemesi hata mesajı verir; Firebase Storage'a sessiz fallback yapılmaz.
- Sohbet dosyalarını silme/moderasyon henüz yoktur; bu nedenle silme arayüzü eklenmeden kota dolan dosyalar otomatik temizlenmez.
