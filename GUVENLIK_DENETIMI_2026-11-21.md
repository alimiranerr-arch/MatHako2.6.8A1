# Matematik Macerası — Güvenlik ve Özellik Denetimi

**Tarih:** 21 Kasım 2026  
**Dal:** `hako/fix-audit-2026-11-21`  
**PR:** #1 — açık/taslak  
**Canlı dağıtım:** Yapılmadı  
**Test durumu:** Kullanıcı “test et” diyene kadar yeni test çalıştırılmıyor.

## Güvenlik düzeltmeleri

- Firestore profil oluşturma/güncelleme doğrulanmış e-posta, alan izin listesi, tür ve uzunluk kontrolleriyle sınırlandırıldı.
- Kullanıcılar kendi coin, inventory, membership, ban, role, score ve admin alanlarını değiştiremez.
- Profildeki avatar yolu yalnızca kullanıcının kendi `avatars/{uid}/...` klasörünü işaret edebilir.
- Görünüm tercihleri `users/{uid}/preferences/appearance` altında yalnızca sahibi tarafından okunur/yazılır ve alanları doğrulanır.
- Sohbet oluşturma 2–10 üyeyle, DM/grup türüyle ve kurucu UID ile sınırlıdır.
- Mesaj gönderen kimliği ve görünen adı kimlik doğrulanmış kullanıcı profiliyle eşleştirilir. Medya türü, dosya yolu ve boyutu Storage kurallarıyla sınırlandırılır.
- Arkadaşlık, bildirim, transfer, hediye kodu, skor, düello, görev ve denetim kayıtları istemciden doğrudan yazılamaz.
- Kullanıcı profili bulunmayan veya banlı kullanıcılar callable oyun/ödül işlemlerini kullanamaz.
- Oyuncu arama ve sohbet alıcısı bulma özel profil belgelerini açmadan sınırlı alan döndürür.
- Kullanıcı başına callable hız sınırları eklendi.
- E-posta değişikliği talebi yalnızca doğrulanmış oturumdan açılır; yeni adres Firebase doğrulama bağlantısıyla doğrulanır. 30 günlük süre yalnızca değişiklik başarıyla tamamlanınca başlar ve sunucuda denetlenir.
- Düello ve hediye kodlarında kriptografik rastgele üretim kullanılır.
- Hediye kodu tek kullanımlıdır; transaction içinde aynı kodun iki kullanıcı tarafından tüketilmesi engellenir.
- Başarısız giriş kayıtları parola/OTP saklamaz.
- Public settings yalnızca site/theme/curriculum/features belgeleri için anonim okunabilir; çark ayarları admin ile sınırlıdır.

## Oyun güvenliği

- Soru setleri Cloud Functions tarafında üretilir ve cevap anahtarı istemciye gönderilmez.
- Her cevap tek bir oturum indeksine bağlanır; seçenek dışı cevap reddedilir.
- Puan, doğru sayısı, seri ve can sunucu tarafından hesaplanır.
- Sonsuz modda soru son tarihi sunucu oturumunda tutulur; geç cevap doğru sayılmaz.
- Yanlış cevap tekrarı, önceki sunucu oturumundan seçilen yanlış sorularla yeni bir oturum oluşturur.
- Düello puanları genel liderlik tablosuna yazılmaz; katılımcı sonuçları ayrı tutulur.
- Bu kontroller hileyi önemli ölçüde zorlaştırır; yine de canlı ortamda yarışma/istismar testleri yapılmadan mutlak hile koruması iddia edilmez.

## Kalan dış bağımlılıklar

### Firebase Web API yapılandırması
`firebase-client.js` içindeki `apiKey` bilerek boştur. Önceki doğrulanmamış anahtar kullanılmıyor. Firebase Console > Project settings > Your apps içinden doğru web uygulaması yapılandırması girilmelidir.

### Firebase App Check
App Check uyumlu SDK ve isteğe bağlı reCAPTCHA v3 başlatma kodu eklendi. Site key boş olduğu için App Check etkin/enforced değildir. Kurulum için `APP_CHECK_KURULUMU_TR.md` dosyasını izleyin. Metrikler doğrulanmadan enforcement açılmamalıdır.

### Canlı Firebase
Cloud Functions, Firestore rules/indexes ve Storage rules canlı projeye dağıtılmadı. Deploy maliyet/faturalandırma doğurabilir; kullanıcı onayı olmadan yapılmayacak.

## Test ve yayın disiplini

- Bu turda yeni test çalıştırılmadı; kullanıcının açık talimatı bekleniyor.
- GitHub Actions otomatik push/PR tetiklerinden çıkarıldı ve manuel çalıştırmaya alındı.
- Önceki commit SHA'larında başarılı olmuş CI çalışmaları bu son kodun test edildiği anlamına gelmez.
- `main` dalı değişmedi. PR birleştirilmedi. Canlıya dağıtım yapılmadı.
