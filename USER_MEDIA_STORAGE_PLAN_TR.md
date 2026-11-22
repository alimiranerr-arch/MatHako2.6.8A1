# Ücretsiz kullanıcı görseli deposu — geçiş notu

## Karar
Kullanıcı görselleri için ayrı ve Private olan `alimiranerr-arch/USERDATA_MATS-TE` deposu hazırlanmıştır. Depoya doğrudan tarayıcıdan erişilmeyecek. Arada Cloudflare Workers Free üzerinde çalışan bir API bulunacaktır.

Worker kaynak kodu ve kurulum talimatları:
https://github.com/alimiranerr-arch/USERDATA_MATS-TE/pull/1

## Güvenlik
- GitHub fine-grained token yalnızca Worker secret olarak tutulur; web uygulamasına, Firebase'e veya bu depoya yazılmaz.
- Yükleme Firebase ID token doğrulaması ve doğrulanmış e-posta ister.
- İlk sürüm yalnızca JPEG, PNG, GIF ve WebP kabul eder; dosya başına 5 MiB sınırı vardır.
- Dosyalar kullanıcı UID'si altında saklanır; 10 dakikalık imzalı okuma bağlantısı döndürülür.
- Depo Private kalır; GitHub Pages etkinleştirilmez.
- Ücretsiz plan kotaları aşılırsa yükleme durdurulmalı; ücretli plana otomatik geçilmemelidir.

## Şu anki entegrasyon durumu
- Worker henüz deploy edilmedi ve uygulamalara bağlanmadı.
- HakoSupport için ayrı Firebase projesi henüz oluşturulmadı; bu nedenle proje kimliği allowlist'e eklenmedi.
- Mevcut sohbet medya yüklemesi `social.js` içinde Firebase Storage kullanır ve ses/video da destekler. Bu Worker yalnızca görsel kabul ettiği ve sohbet üyeliği okuma yetkisini henüz denetlemediği için sohbet ekleri bu Worker'a yönlendirilmemelidir.
- Yönetici market görsel yüklemeleri de mevcut kodda Firebase Storage kullanır. Worker entegrasyonu ve yönetici yetki kontrolü tamamlanana kadar bu akış değiştirilmemelidir.
- Profil/avatar görseli için mevcut upload akışı ayrıca bulunup bağlanmalıdır.

## Sonraki entegrasyon şartları
1. Cloudflare Worker Free hesabında deploy edilip endpoint URL'si alınmalı.
2. `GITHUB_TOKEN`, `MEDIA_SIGNING_SECRET`, `FIREBASE_PROJECT_IDS` ve `ALLOWED_ORIGINS` Worker ayarlarına güvenli şekilde girilmeli.
3. Ana site istemcisine yalnızca Worker URL'si eklenmeli; token istemciye konulmamalı.
4. Profil/avatar yükleme ve görüntüleme akışları Worker API'sine taşınmalı.
5. Yönetici market yüklemeleri için ayrıca admin claim doğrulaması eklenmeli.
6. Sohbet dosyaları için üyelik bazlı okuma, silme, kota ve abuse koruması tamamlanmadan sohbet medyası taşınmamalı.

## Maliyet
Cloudflare Workers Free planının sınırları vardır. GitHub da depolama, dosya ve API sınırları uygular. Bu mimari sınırsız veya garantili ücretsiz depolama değildir. Ücretli plan veya faturalandırma onayı olmadan ilerlenmelidir.

Test veya deploy yapılmadı.
