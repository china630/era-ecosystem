/**
 * Classic boot: dynamic-import overlay.js (ES module).
 * Used by content_scripts and by background executeScript (PWA / Open-as-window).
 */
(function () {
  if (window.__eraEwOverlayBoot) return;
  window.__eraEwOverlayBoot = true;
  import(chrome.runtime.getURL("overlay.js")).catch(() => {
    window.__eraEwOverlayBoot = false;
  });
})();
