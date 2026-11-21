# Matematik Macerası — Güvenlik Denetimi
**Tarih:** 21 Kasım 2026  
**Dal:** `hako/fix-audit-2026-11-21`  
**Durum:** Kod değişiklikleri hazır; canlı Firebase'e dağıtılmadı.

## Yapılan düzeltmeler

- Firestore profil oluşturma/güncelleme işlemlerinde doğrulanmış e-posta şartı ve alan türü/uzunluğu kontrolleri eklendi. Kullanıcı kendi profilinde yalnızca izin verilen alanları değiştirebilir; profil e-postasını doğrudan değiştiremez.
- Sohbet oluşturma kuralları kurucu kimliğini, üye listesini (2–10 kişi), sohbet türünü ve başlığı doğrular. İstemci DM için tek davetliyi, grup için en fazla 9 davetliyi kabul eder; profil kaydı tamamlanmadan sohbet dinleyicileri başlatılmaz.
- Mesaj oluşturma işlemleri aktif sohbet üyeliği, oturum açmış gönderen UID'si ve kullanıcı profilindeki görünen ad ile sınırlandırıldı. Medya türleri istemci ve Storage kuralları arasında eşleştirildi. Kullanıcılar başka bir ad taklit edemez veya mevcut mesajların gönderen kimliğini değiştirerek mesaj güncelleyemez.
- Storage sohbet medyası yüklemelerinde üyelik, dosya yolu, boyut ve MIME türü kontrolleri sıkılaştırıldı; istemci dosya güncellemesi kapatıldı.
- Market koleksiyonu normal kullanıcılara yalnızca yayımlanmış ürünleri gösterir. Rasyonel sayılar sorularının seçenek sırası karıştırıldı; düello skorları artık genel liderlik tablosuna gönderilmiyor. Skor, düello, ödül ve denetim kayıtlarının istemciden doğrudan yazılması kapalıdır.
- Oyuncu arama ve sohbet alıcısı bulma, özel kullanıcı belgelerini istemciye açmak yerine sınırlı alan/UID döndüren callable fonksiyonlara taşındı.
- Başarısız giriş kaydı endpoint'ine IP bazlı 10 dakikada 8 istek sınırı eklendi; endpoint artık e-posta üzerinden profil arayıp kullanıcı adı ifşa etmez.
- Callable kullanıcı işlemlerine doğrulanmış e-posta kontrolü eklendi. Oyuncu arama ve sohbet alıcısı bulma için kullanıcı başına hız sınırı, günlük ödüller için Türkiye yerel günü, skor kayıtları için soru sayısına bağlı makul üst sınır eklendi.

## Açık kalan güvenlik işleri

### Yüksek — skor ve düello sonuçlarının doğrulanması
`submitGameScore` ve `submitDuelResult` hâlâ istemcinin gönderdiği puan/doğru cevap sayılarına güveniyor. Sınır kontrolleri mevcut olsa da sunucu gerçek soruları ve cevapları doğrulamıyor. Bu nedenle hileli skor üretimi tamamen engellenmiş değil. Kalıcı çözüm; sunucunun soru seti üretmesi, cevap anahtarını sunucuda tutması ve cevapları sunucu tarafında puanlamasıdır. Bu iş, oyun motoru/düello aşamasında tamamlanmalıdır.

### Orta — Firebase App Check
Callable endpoint'lerde App Check zorunlu hale getirilmedi. Özellikle herkese açık başarısız giriş kaydı endpoint'inde IP hız sınırı var; App Check etkinleştirilmesi ek koruma sağlar.

### Orta — canlı proje doğrulaması
Emülatör kuralları ve kod kontrolleri başarılıdır; gerçek Firebase projesinde kullanıcı rolleri, mevcut kayıtlar, sohbetler ve Storage dosyalarıyla uçtan uca test yapılmadı.

## Otomatik testler

GitHub Actions üzerinde aşağıdakiler başarılı:
- `npm test` — smoke testleri
- `node --check functions/index.js` — Cloud Functions JavaScript sözdizimi
- Firebase Emulator — Firestore ve Storage kurallarının derlenmesi

## Dağıtım durumu

Bu denetim dalındaki değişiklikler henüz `main` dalına birleştirilmedi ve canlı Firebase'e deploy edilmedi. Deploy öncesi PR gözden geçirilmeli; ardından önce test Firebase projesinde, sonra onayla canlı projede uygulanmalıdır.
