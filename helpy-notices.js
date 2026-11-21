(function () {
  "use strict";
  const KEY = "hako_public_notice_v1";
  const defaults = {
    maintenance: false,
    important: false,
    severe: false,
    maintenanceImage: "bakim-molasi.png",
    importantImage: "helpy-onemli-is.webp"
  };
  const $ = (id) => document.getElementById(id);
  const read = () => {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (_) { return Object.assign({}, defaults); }
  };
  const isVisible = (el) => !!el && !el.classList.contains("hide") &&
    getComputedStyle(el).display !== "none" && !el.hidden;
  // Admin UI must be unlocked by the existing login flow; merely visiting /admin is insufficient.
  function isAdminSession() {
    return isVisible($("adminOpen")) && isVisible($("tabAdmin"));
  }
  function asset(name) {
    const allowed = ["bakim-molasi.png", "helpy-onemli-is.webp", "helpy-teknik-onarim.gif"];
    return "/assets/" + (allowed.includes(name) ? name : "bakim-molasi.png");
  }
  function render() {
    const state = read();
    const overlay = $("hakoPublicNotice");
    if (!overlay) return;
    if (isAdminSession()) {
      overlay.hidden = true;
      document.body.classList.remove("hako-notice-open");
      return;
    }
    let title = "", message = "", image = "";
    if (state.severe) {
      title = "Büyük Teknik Sorun";
      message = "Sistemimizde önemli bir teknik sorun tespit edildi. Ekibimiz sorunu gidermek için çalışıyor.";
      image = asset(state.maintenanceImage === "helpy-teknik-onarim.gif" ? state.maintenanceImage : "helpy-teknik-onarim.gif");
    } else if (state.maintenance) {
      title = "Bakım Molası";
      message = "Sistem üzerinde bakım çalışması yapılıyor. Lütfen daha sonra tekrar deneyin.";
      image = asset(state.maintenanceImage);
    } else if (state.important) {
      title = "Önemli Teknik Çalışma";
      message = "Önemli bir işlem yürütülüyor. Kısa süreli kesintiler yaşanabilir.";
      image = asset(state.importantImage);
    } else {
      overlay.hidden = true;
      document.body.classList.remove("hako-notice-open");
      return;
    }
    $("hakoNoticeTitle").textContent = title;
    $("hakoNoticeText").textContent = message;
    $("hakoNoticeImage").src = image;
    $("hakoNoticeImage").alt = title;
    $("hakoNoticeClose").hidden = state.maintenance || state.severe;
    overlay.hidden = false;
    document.body.classList.add("hako-notice-open");
  }
  function fillAdminControls() {
    const state = read();
    const pairs = [
      ["hakoMaintenanceToggle", "maintenance"],
      ["hakoImportantToggle", "important"],
      ["hakoSevereToggle", "severe"]
    ];
    pairs.forEach(([id, key]) => { if ($(id)) $(id).checked = !!state[key]; });
    if ($("hakoMaintenanceImage")) $("hakoMaintenanceImage").value = state.maintenanceImage;
    if ($("hakoImportantImage")) $("hakoImportantImage").value = state.importantImage;
  }
  function save() {
    if (!isAdminSession()) {
      const msg = $("hakoGifAdminMsg");
      if (msg) msg.textContent = "Ayarları değiştirmek için önce admin olarak giriş yapmalısın.";
      return;
    }
    const state = {
      maintenance: !!$("hakoMaintenanceToggle")?.checked,
      important: !!$("hakoImportantToggle")?.checked,
      severe: !!$("hakoSevereToggle")?.checked,
      maintenanceImage: $("hakoMaintenanceImage")?.value || defaults.maintenanceImage,
      importantImage: $("hakoImportantImage")?.value || defaults.importantImage
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      const msg = $("hakoGifAdminMsg");
      if (msg) msg.textContent = "Ayarlar bu tarayıcıya kaydedildi.";
      render();
    } catch (_) {
      const msg = $("hakoGifAdminMsg");
      if (msg) msg.textContent = "Tarayıcı ayarları kaydedemedi.";
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    fillAdminControls();
    $("hakoSaveGifSettings")?.addEventListener("click", save);
    $("hakoNoticeClose")?.addEventListener("click", function () {
      $("hakoPublicNotice").hidden = true;
      document.body.classList.remove("hako-notice-open");
    });
    window.addEventListener("storage", function (event) {
      if (event.key === KEY) render();
    });
    // Admin login state is controlled by the original application scripts.
    const observer = new MutationObserver(render);
    observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"]});
    render();
  });
})();