// TEL 2.0 – ühine lehtede navigatsioon (ülemine must riba)
// Kasutus lehel:  <nav class="tn" id="tn"></nav>  ülemises ribas + <script src="nav.js"></script>
// Pärast sisselogimist: TelNav.roll(me.roll)  -> näitab ainult lubatud lehti
(function () {
  // [fail, nimi, rollid kellele nähtav]
  // järjekord = avalehe rühmad: Tootmine, Müük, Ost, Juhtimine
  const PAGES = [
    ['ulevaade.html', 'Ülevaade', ['admin', 'raamatupidaja']],
    ['tootaja.html', 'Tööd', ['admin', 'raamatupidaja']],
    ['tellimused.html', 'Tellimused', ['admin', 'raamatupidaja']],
    ['ulevaade.html?vaade=allhange', 'Allhange', ['admin', 'raamatupidaja']],
    ['tootaja.html?vaade=ladu', 'Ladu', ['admin', 'raamatupidaja']],
    ['saatelehed.html', 'Saatelehed', ['admin', 'raamatupidaja']],
    ['arved.html', 'Arved', ['admin', 'raamatupidaja']],
    ['reklamatsioonid.html', 'Reklamatsioonid', ['admin', 'raamatupidaja']],
    ['ostutellimused.html', 'Ostutellimused', ['admin', 'raamatupidaja']],
    ['ostuarved.html', 'Ostuarved', ['admin', 'raamatupidaja']],
    ['aruanded.html', 'Aruanded', ['admin', 'raamatupidaja']],
    ['admin.html', 'Kontor', ['admin']]
  ];

  const css = `
  .top a.brand { color: inherit; text-decoration: none; }
  .top .brand, .top button, .top small { white-space: nowrap; flex-shrink: 0; }
  .tn { display: flex; align-self: stretch; margin-left: -8px; }
  .tn .tn-list { display: flex; }
  .tn a { display: flex; align-items: center; padding: 0 12px; color: #C6C6C6; text-decoration: none; font-size: 14px; white-space: nowrap;
    border-top: 3px solid transparent; border-bottom: 3px solid transparent; }
  .tn a:hover { color: #fff; background: #262626; }
  .tn a.on { color: #fff; font-weight: 600; background: #262626; border-bottom-color: #0F62FE; }
  .tn a:focus-visible, .tn .tn-btn:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
  .tn .tn-btn { display: none; }
  /* kitsas riba: lehed peituvad nupu alla */
  .top.tn-c .tn { position: relative; align-self: center; margin-left: 0; }
  .top.tn-c .tn .tn-btn { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .top.tn-c .tn .tn-list { display: none; position: absolute; top: calc(100% + 10px); left: 0; z-index: 40; flex-direction: column;
    min-width: 220px; background: #161616; box-shadow: 0 12px 28px rgba(0,0,0,.35); }
  .top.tn-c .tn.open .tn-list { display: flex; }
  .top.tn-c .tn a { height: 48px; padding: 0 16px; border: none; border-left: 3px solid transparent; }
  .top.tn-c .tn a.on { border-left-color: #0F62FE; }
  .tn .tn-car { font-style: normal; }
  /* Avaleht-nupp (nagu Tööde lehel), logi välja nupu ees */
  .top a.tn-home { display: flex; align-items: center; justify-content: center; align-self: stretch; width: 44px; color: #C6C6C6; text-decoration: none; flex-shrink: 0; }
  .top a.tn-home:hover, .top a.tn-home:focus-visible { color: #fff; background: #262626; outline: none; }
  .top a.tn-home svg { width: 20px; height: 20px; }
  @media (max-width: 600px) { .top .brand { display: none; } }   /* telefonis asendab Avaleht-ikoon "TEL 2.0" lingi */
  @media (max-width: 480px) { .tn .tn-car { display: none; } .top.tn-c .tn .tn-btn { gap: 6px; } }
  `;

  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const vaade = new URLSearchParams(location.search).get('vaade');
  const here = vaade ? file + '?vaade=' + vaade.toLowerCase() : file;   // nt ulevaade.html?vaade=allhange = oma menüüpunkt
  let nav, top, role = null;

  function build() {
    nav = document.getElementById('tn');
    if (!nav) return;
    top = nav.closest('.top');
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cur = PAGES.find((p) => p[0] === here);
    nav.setAttribute('aria-label', 'Lehed');
    nav.innerHTML = '<button type="button" class="tn-btn" aria-expanded="false" aria-haspopup="true">☰ <span>' + (cur ? cur[1] : 'Lehed') + '</span><i class="tn-car">▾</i></button>' +
      '<div class="tn-list">' + PAGES.map((p) => '<a href="' + p[0] + '" data-p="' + p[0] + '"' + (p[0] === here ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>').join('') + '</div>';
    if (!top.querySelector('.tn-home')) {
      const h = document.createElement('a'); h.className = 'tn-home'; h.href = 'index.html'; h.title = 'Avaleht';
      h.setAttribute('aria-label', 'Avaleht');
      h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/></svg>';
      const lo = top.querySelector('#logout'); if (lo) lo.before(h); else top.appendChild(h);
    }
    const btn = nav.querySelector('.tn-btn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!nav.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    apply();
    // ka ülariba sisu muutumisel (nt "Uuendatud 14:35" tekst ilmub alles pärast laadimist) – muidu võib "Logi välja" ekraanilt välja jääda
    if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(top); [...top.children].forEach((c) => ro.observe(c)); } else window.addEventListener('resize', fit);
  }
  function setOpen(v) { nav.classList.toggle('open', v); nav.querySelector('.tn-btn').setAttribute('aria-expanded', v ? 'true' : 'false'); }
  function apply() {
    if (!nav) return;
    nav.querySelectorAll('a[data-p]').forEach((a) => {
      const p = PAGES.find((x) => x[0] === a.dataset.p);
      a.hidden = !role || !p[2].includes(role);
    });
    fit();
  }
  // kui lingid ribale ära ei mahu, lähevad need ☰ nupu alla
  function fit() {
    if (!top || !top.offsetWidth) return;
    top.classList.remove('tn-c');
    if (top.scrollWidth > top.clientWidth + 1) top.classList.add('tn-c');
    else setOpen(false);
  }

  window.TelNav = { roll(r) { role = r; apply(); requestAnimationFrame(fit); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
