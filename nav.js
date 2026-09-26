// TEL 2.0 – ühine lehtede navigatsioon (ülemine must riba)
// Kasutus lehel:  <nav class="tn" id="tn"></nav>  ülemises ribas + <script src="nav.js"></script>
// Pärast sisselogimist: TelNav.roll(me.roll)  -> näitab ainult lubatud lehti
(function () {
  // [fail, nimi, rollid kellele nähtav, rühm] – rühmad ja järjekord nagu avalehel
  const O = ['admin', 'raamatupidaja'];
  const PAGES = [
    ['ulevaade.html', 'Ülevaade', O, 'Tootmine'],
    ['tootaja.html', 'Tööd', O, 'Tootmine'],
    ['tellimused.html', 'Tellimused', O, 'Tootmine'],
    ['ulevaade.html?vaade=allhange', 'Allhange', O, 'Tootmine'],
    ['tootaja.html?vaade=ladu', 'Ladu', O, 'Tootmine'],
    ['saatelehed.html', 'Saatelehed', O, 'Müük'],
    ['arved.html', 'Arved', O, 'Müük'],
    ['reklamatsioonid.html', 'Reklamatsioonid', O, 'Müük'],
    ['ostutellimused.html', 'Ostutellimused', O, 'Ost'],
    ['ostuarved.html', 'Ostuarved', O, 'Ost'],
    ['aruanded.html', 'Aruanded', O, 'Juhtimine'],
    ['admin.html', 'Kontor', ['admin'], 'Juhtimine']
  ];
  const GROUPS = ['Tootmine', 'Müük', 'Ost', 'Juhtimine'];

  // Lehtede menüü on alati rippmenüü (☰ Praegune leht ▾); arvutis rühmad kõrvuti, telefonis üksteise all.
  const css = `
  .top a.brand { color: inherit; text-decoration: none; }
  .top .brand, .top button, .top small { white-space: nowrap; flex-shrink: 0; }
  .tn { position: relative; align-self: center; flex-shrink: 0; }
  .tn .tn-btn { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .tn .tn-car { font-style: normal; }
  .tn .tn-list { display: none; position: absolute; top: calc(100% + 10px); left: 0; z-index: 40; background: #161616; box-shadow: 0 12px 28px rgba(0,0,0,.35);
    grid-template-columns: repeat(4, auto); padding: 8px 0; }
  .tn.open .tn-list { display: grid; }
  .tn .tn-g { display: flex; flex-direction: column; padding: 0 4px; min-width: 170px; }
  .tn .tn-g + .tn-g { border-left: 1px solid #333; }
  .tn .tn-g b { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #8D8D8D; padding: 8px 14px 4px; }
  .tn a { display: flex; align-items: center; height: 40px; padding: 0 14px; color: #C6C6C6; text-decoration: none; font-size: 14px; white-space: nowrap; border-left: 3px solid transparent; }
  .tn a:hover { color: #fff; background: #262626; }
  .tn a.on { color: #fff; font-weight: 600; background: #262626; border-left-color: #0F62FE; }
  .tn a:focus-visible, .tn .tn-btn:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
  .tn .tn-g.empty { display: none; }
  /* Avaleht: maja ikoon ja kiri all (nagu Tööde lehel), "Logi välja" ees */
  .top a.tn-home { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; align-self: stretch; padding: 0 10px; color: #C6C6C6; text-decoration: none; flex-shrink: 0; font-size: 10.5px; font-weight: 600; }
  .top a.tn-home:hover, .top a.tn-home:focus-visible { color: #fff; background: #262626; outline: none; }
  .top a.tn-home svg { width: 20px; height: 20px; }
  @media (max-width: 700px) { .tn .tn-list { grid-template-columns: 1fr; min-width: 230px; max-height: calc(100dvh - 80px); overflow-y: auto; }
    .tn .tn-g + .tn-g { border-left: none; border-top: 1px solid #333; } }
  @media (max-width: 600px) { .top .brand { display: none; } }   /* telefonis asendab Avaleht "TEL 2.0" lingi */
  @media (max-width: 480px) { .tn .tn-car { display: none; } .tn .tn-btn { gap: 6px; } }
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
      '<div class="tn-list">' + GROUPS.map((g) => '<div class="tn-g" data-g="' + g + '"><b>' + g + '</b>' + PAGES.filter((p) => p[3] === g).map((p) =>
        '<a href="' + p[0] + '" data-p="' + p[0] + '"' + (p[0] === here ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>').join('') + '</div>').join('') + '</div>';
    if (!top.querySelector('.tn-home')) {
      const h = document.createElement('a'); h.className = 'tn-home'; h.href = 'index.html'; h.title = 'Avaleht';
      h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/></svg><span>Avaleht</span>';
      const lo = top.querySelector('#logout'); if (lo) lo.before(h); else top.appendChild(h);
    }
    const btn = nav.querySelector('.tn-btn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!nav.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    apply();
  }
  function setOpen(v) { nav.classList.toggle('open', v); nav.querySelector('.tn-btn').setAttribute('aria-expanded', v ? 'true' : 'false'); }
  function apply() {
    if (!nav) return;
    nav.querySelectorAll('a[data-p]').forEach((a) => {
      const p = PAGES.find((x) => x[0] === a.dataset.p);
      a.hidden = !role || !p[2].includes(role);
    });
    nav.querySelectorAll('.tn-g').forEach((g) => g.classList.toggle('empty', !g.querySelector('a:not([hidden])')));
  }

  window.TelNav = { roll(r) { role = r; apply(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
