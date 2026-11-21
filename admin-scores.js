
/* Admin-only score ledger.
   Firestore rules require the verified admin custom claim.
*/
(function (w) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let stop = null;

  function stopListening() {
    if (typeof stop === 'function') {
      stop();
      stop = null;
    }
  }

  function start() {
    const cloud = w.MMCloud;
    const box = $('adminScoresTable');

    if (!box || !cloud || !cloud.admin || !cloud.db) {
      return;
    }

    stopListening();

    box.textContent = 'Skor kayıtları yükleniyor...';

    try {
      stop = cloud.db
        .collection('scores')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .onSnapshot(
          (snapshot) => {
            box.innerHTML = '';

            if (snapshot.empty) {
              box.textContent = 'Henüz skor kaydı yok.';
              return;
            }

            snapshot.forEach((doc) => {
              const data = doc.data();
              const row = document.createElement('div');
              const text = document.createElement('span');

              row.className = 'row';

              text.textContent =
                `${data.playerName || 'Oyuncu'} · ` +
                `${data.score || 0} puan · ` +
                `${({classic:'Klasik',endless:'Sonsuz',retry:'Hata tekrarı',balance:'Denge'}[data.mode] || data.mode || 'Bilinmeyen')} · ` +
                `${data.public === true
                  ? 'Genel tabloda'
                  : 'Yalnızca admin'}`;

              row.appendChild(text);
              box.appendChild(row);
            });
          },
          (error) => {
            console.error('Admin skor tablosu hatası:', error);
            box.textContent =
              'Skor tablosu açılamadı: ' + error.message;
          }
        );
    } catch (error) {
      console.error('Skor tablosu başlatılamadı:', error);
      box.textContent = 'Skor tablosu başlatılamadı.';
    }
  }

  w.addEventListener('mm-auth-ready', (event) => {
    if (event.detail && event.detail.admin === true) {
      start();
    } else {
      stopListening();

      const box = $('adminScoresTable');
      if (box) {
        box.textContent = 'Admin yetkisi gerekli.';
      }
    }
  });

  document.addEventListener('DOMContentLoaded', start);

})(window);
