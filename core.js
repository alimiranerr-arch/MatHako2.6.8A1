/* Matematik Macerası ortak başlangıç ve sekme gezinme katmanı. */
(function (w, d) {
  'use strict';

  const app = w.MatematikMacerasi = w.MatematikMacerasi || {};
  app.version = '2.7.0';
  app.modules = app.modules || {};

  function sections() {
    return Array.from(d.querySelectorAll('main > section, body > section'))
      .filter(section => /^s\d+$/.test(section.id));
  }

  function navigate(id, options) {
    const target = d.getElementById(id);
    if (!target || !/^s\d+$/.test(id)) return false;

    // Admin bölümü yalnızca doğrulanmış yönetici oturumunda açılabilir.
    if (id === 's3' && !w.MMCloud?.admin) return false;

    sections().forEach(section => {
      const active = section === target;
      section.classList.toggle('hide', !active);
      section.setAttribute('aria-hidden', String(!active));
    });

    d.querySelectorAll('[role="tab"][data-go]').forEach(tab => {
      const active = tab.dataset.go === id;
      tab.setAttribute('aria-selected', String(active));
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    app.activeSection = id;
    if (!options?.silent) {
      const heading = target.querySelector('h1, h2');
      if (heading && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus?.({ preventScroll: true });
      w.scrollTo?.({ top: 0, behavior: 'auto' });
    }
    return true;
  }

  function onDocumentClick(event) {
    const profileButton=event.target?.closest?.('#meChip');
    if(profileButton){if(!w.MMCloud?.user){d.getElementById('profileQuickMenu')?.classList.remove('show');d.getElementById('profileQuickMenu')?.setAttribute('aria-hidden','true');profileButton.setAttribute('aria-expanded','false');d.querySelector('.gLogin')?.click();event.preventDefault();return;}const menu=d.getElementById('profileQuickMenu');if(menu){const open=!menu.classList.contains('show');menu.classList.toggle('show',open);menu.setAttribute('aria-hidden',String(!open));profileButton.setAttribute('aria-expanded',String(open));}event.preventDefault();return;}
    if(!event.target?.closest?.('#profileQuickMenu')){const menu=d.getElementById('profileQuickMenu');if(menu){menu.classList.remove('show');menu.setAttribute('aria-hidden','true');d.getElementById('meChip')?.setAttribute('aria-expanded','false');}}
    const quick=event.target?.closest?.('[data-profile-go]');if(quick){const target=quick.dataset.profileGo;d.getElementById('profileQuickMenu')?.classList.remove('show');d.getElementById('profileQuickMenu')?.setAttribute('aria-hidden','true');d.getElementById('meChip')?.setAttribute('aria-expanded','false');if(!w.MMCloud?.user){d.querySelector('.gLogin')?.click();}else if(target==='profile'){navigate('s6');d.getElementById('profileCard')?.scrollIntoView({behavior:'smooth',block:'start'});}else navigate(target);event.preventDefault();return;}
    const homeTab = event.target?.closest?.('[data-home-tab]');
    if (homeTab && !homeTab.disabled) {
      const key = homeTab.dataset.homeTab;
      const panels = Array.from(d.querySelectorAll('[data-home-panel]'));
      if (panels.some(panel => panel.dataset.homePanel === key)) {
        panels.forEach(panel => {
          const active = panel.dataset.homePanel === key;
          panel.classList.toggle('hide', !active);
          panel.setAttribute('aria-hidden', String(!active));
        });
        d.querySelectorAll('[data-home-tab]').forEach(tab => {
          tab.setAttribute('aria-selected', String(tab === homeTab));
        });
      }
      return;
    }
    const control = event.target?.closest?.('[data-go]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const id = control.dataset.go;
    if (!id) return;
    if (navigate(id)) {
      if (control.matches('[role="tab"]')) event.preventDefault();
    }
  }

  function showError(message, code) {
    let box=d.getElementById('mmErrorToast');
    if(!box){box=d.createElement('div');box.id='mmErrorToast';box.setAttribute('role','alert');box.setAttribute('aria-live','assertive');box.className='mm-error-toast';d.body.appendChild(box);}
    box.replaceChildren();
    const title=d.createElement('strong');title.textContent='⚠️ Bir sorun oluştu';box.appendChild(title);
    const body=d.createElement('span');body.textContent=String(message||'İşlem tamamlanamadı.');box.appendChild(body);
    if(code){const badge=d.createElement('b');badge.className='mm-error-code';badge.textContent='Hata kodu: '+String(code);box.appendChild(badge);}
    const close=d.createElement('button');close.type='button';close.textContent='Kapat';close.addEventListener('click',()=>box.remove());box.appendChild(close);
    box.classList.add('show');return box;
  }
  function init() {
    if (app.navigationReady) return;
    app.navigationReady = true;
    // Capture aşaması, modül butonlarının bubble aşamasında olayı durdurmasından etkilenmez.
    d.addEventListener('click', onDocumentClick, true);

    const adminSection = d.getElementById('s3');
    if (adminSection && !w.MMCloud?.admin) adminSection.classList.add('hide');
    const visible = sections().find(section => !section.classList.contains('hide'));
    if (!visible || !d.getElementById('s0')) navigate('s0', { silent: true });
    else {
      // İlk açılışta HTML'deki sekme durumunu görünür bölüme eşitle.
      d.querySelectorAll('[role="tab"][data-go]').forEach(tab => {
        const active = tab.dataset.go === visible.id;
        tab.setAttribute('aria-selected', String(active));
        if (active) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
      });
      app.activeSection = visible.id;
    }
  }

  app.navigate = navigate;
  w.MMError={show:showError};
  app.register = function (name, api) {
    app.modules[name] = api || {};
  };
  app.register('core', { navigate, init });
  app.ready = true;

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
