// TEL – rakenduseks installimine (PWA). Lisatakse igale lehele: <script src="pwa.js" defer></script>
// Nupp/link, millel on atribuut data-pwa-install, ilmub ainult siis, kui brauser pakub installimist (Android Chrome, arvuti Chrome/Edge).
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* pole oluline */ }); });
  }
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let ev = null;
  const show = (on) => document.querySelectorAll('[data-pwa-install]').forEach((b) => { b.hidden = !on; });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ev = e; if (!standalone()) show(true); });
  window.addEventListener('appinstalled', () => { ev = null; show(false); });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-pwa-install]'); if (!b || !ev) return;
    e.preventDefault(); ev.prompt();
    try { await ev.userChoice; } catch (x) { /* pole oluline */ }
    ev = null; show(false);
  });
  document.addEventListener('DOMContentLoaded', () => show(false));
})();
