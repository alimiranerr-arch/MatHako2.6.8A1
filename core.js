/* Matematik Macerası ortak başlangıç ve sekme gezinme katmanı. */
(function (w, d) {
  'use strict';

  const app = w.MatematikMacerasi = w.MatematikMacerasi || {};
  app.version = '2.7.1';
  app.modules = app.modules || {};

  function sections() {
    return Array.from(d.querySelectorAll('main > section, body > section'))
      .filter(section => /^s\\d+$/.test(section.id));
  }

  function navigate(id, options) {
    const target = d.getElementById(id);
    if (!target || !/^s\\d+$/.test(id)) return false;

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
    const control = event.target?.closest?.('[data-go]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const id = control.dataset.go;
    if (!id) return;
    if (navigate(id)) {
      if (control.matches('[role="tab"]')) event.preventDefault();
    }
  }

  function init() {
    if (app.navigationReady) return;
    app.navigationReady = true;
    d.addEventListener('click', onDocumentClick);

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
  app.register = function (name, api) {
    app.modules[name] = api || {};
  };
  app.register('core', { navigate, init });
  app.ready = true;

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
