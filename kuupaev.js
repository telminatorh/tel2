// TEL 2.0 – kuupäevad alati eesti kujul pp.kk.aaaa (brauseri keelest sõltumata)
// Brauseri <input type="date"> näitab kuupäeva brauseri keele järgi (inglise keeles kk/pp/aaaa → 08/10 = 10. august).
// See fail asendab iga type="date" välja nähtava osa tekstiväljaga "08.10.2026" + kalendri nupuga.
// Algne väli jääb alles (peidetuna) ja hoiab väärtust ISO kujul (2026-10-08) – lehtede kood ei muutu:
// .value, id, name, change/input sündmused töötavad nagu enne. Uued väljad (innerHTML) leitakse ise.
// Sisestus: 8.10.2026, 8.10.26, 8.10 (see aasta), 08102026, 081026, 0810 (see aasta), 2026-10-08. Nooled ↑↓ = ±1 päev, Alt+↓ = kalender.
(function () {
  if (window.TelKP) return;
  const D = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const css = `
  .kp { display: inline-flex; position: relative; vertical-align: middle; max-width: 100%; }
  .kp > input.kp-t { flex: 1 1 auto; min-width: 0; width: 100%; font-variant-numeric: tabular-nums; padding-right: 28px !important; }
  .kp > input.kp-t.kp-bad { outline: 2px solid #da1e28; outline-offset: -2px; }
  .kp > button.kp-b { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; padding: 0; border: 0; background: transparent;
    color: inherit; opacity: .55; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .kp > button.kp-b:hover, .kp > button.kp-b:focus-visible { opacity: 1; }
  .kp > button.kp-b:disabled { display: none; }
  input.kp-n { position: absolute !important; width: 1px !important; height: 1px !important; min-width: 0 !important; opacity: 0; pointer-events: none; margin: 0 0 0 -30px !important; padding: 0 !important; border: 0 !important; }
  `;
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);
  const ICON = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="13" height="11.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';

  const pad = (n) => String(n).padStart(2, '0');
  function fmt(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  // tagastab ISO, '' (tühi) või null (vigane)
  function parse(s) {
    s = (s || '').trim(); if (!s) return '';
    let d, m, y, x;
    if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = /^(\d{1,2})[.\/, -](\d{1,2})(?:[.\/, -](\d{2}|\d{4}))?\.?$/.exec(s))) { d = +x[1]; m = +x[2]; y = x[3] ? +x[3] : new Date().getFullYear(); }
    else if ((x = /^(\d{2})(\d{2})(\d{2}|\d{4})?$/.exec(s))) { d = +x[1]; m = +x[2]; y = x[3] ? +x[3] : new Date().getFullYear(); }
    else return null;
    if (y < 100) y += 2000;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }

  const TPL = document.createElement('span'); TPL.className = 'kp';
  TPL.innerHTML = '<input type="text" class="kp-t" placeholder="pp.kk.aaaa" autocomplete="off" spellcheck="false" inputmode="numeric" maxlength="10">' +
    '<button type="button" class="kp-b" tabindex="-1" aria-label="Ava kalender" title="Kalender">' + ICON + '</button>';
  function enhance(inp, L) {
    inp.dataset.kp = '1';
    const wrap = TPL.cloneNode(true); const t = wrap.firstChild; const b = wrap.lastChild;
    if (inp.className) t.className = inp.className + ' kp-t';
    if (inp.style.cssText) t.style.cssText = inp.style.cssText;
    const lab = inp.getAttribute('aria-label') || (inp.id && inp.labels && inp.labels[0] ? inp.labels[0].textContent.trim() : '');
    if (lab) t.setAttribute('aria-label', lab);
    if (inp.title) t.title = inp.title;
    if (inp.disabled || inp.readOnly) { t.disabled = inp.disabled; t.readOnly = inp.readOnly; b.disabled = true; }
    if (inp.required) t.required = true;
    if (L.flex) { wrap.style.flex = L.flex; if (L.grow === '0' && L.w > 0) wrap.style.width = L.w + 'px'; }
    else if (L.fill) wrap.style.width = '100%';
    else if (!L.grid && L.w > 0) wrap.style.width = L.w + 'px';
    inp.parentNode.insertBefore(wrap, inp);
    inp.classList.add('kp-n'); inp.tabIndex = -1; inp.setAttribute('aria-hidden', 'true');
    if (inp.required) { inp.required = false; inp.dataset.kpReq = '1'; }  // brauseri teade tuleb nähtava välja juurde
    const sync = () => { t.value = fmt(D.get.call(inp)); t.classList.remove('kp-bad'); t.setCustomValidity(''); };
    Object.defineProperty(inp, 'value', { configurable: true, get() { return D.get.call(this); }, set(v) { D.set.call(this, v); sync(); } });
    sync();
    inp.addEventListener('change', sync);
    inp.addEventListener('focus', () => t.focus());   // <label for=…> klõps
    function commit() {
      const iso = parse(t.value);
      if (iso === null) { t.classList.add('kp-bad'); t.setCustomValidity('Kuupäev kujul pp.kk.aaaa'); return; }
      t.classList.remove('kp-bad'); t.setCustomValidity('');
      if (iso !== D.get.call(inp)) {
        D.set.call(inp, iso);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      t.value = fmt(D.get.call(inp));
    }
    t.addEventListener('change', (e) => { e.stopPropagation(); commit(); });
    t.addEventListener('input', (e) => { e.stopPropagation(); t.classList.remove('kp-bad'); });  // lehe 'input' kuularid saavad sündmuse algselt väljalt
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); open(); }
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.altKey) {       // nooled: ±1 päev
        const iso = parse(t.value) || D.get.call(inp); if (!iso) return;
        e.preventDefault();
        const dt = new Date(iso + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() + (e.key === 'ArrowUp' ? 1 : -1));
        t.value = fmt(dt.toISOString().slice(0, 10)); commit();
      }
    });
    function open() {
      if (t.disabled || t.readOnly) return;
      try { inp.showPicker(); } catch (e) { try { inp.focus({ preventScroll: true }); inp.click(); } catch (e2) { /* vana brauser */ } }
    }
    b.addEventListener('click', open);
  }

  // kõik mõõtmised enne muutmist (üks paigutuse arvutus ka 300 rea korral)
  function scan(roots) {
    const list = [];
    roots.forEach((root) => {
      if (!root.isConnected) return;
      if (root.matches && root.matches('input[type="date"]:not([data-kp])')) list.push(root);
      if (root.querySelectorAll) root.querySelectorAll('input[type="date"]:not([data-kp])').forEach((x) => list.push(x));
    });
    if (!list.length) return;
    const m = list.map((inp) => {
      const p = inp.parentNode; const w = inp.offsetWidth; const L = { w };
      if (p && p.nodeType === 1 && w > 0) {
        const ps = getComputedStyle(p); const d = ps.display;
        if (d.indexOf('grid') >= 0) L.grid = true;
        else if (d.indexOf('flex') >= 0) { const cs = getComputedStyle(inp); L.flex = cs.flex; L.grow = cs.flexGrow; }
        else if (d !== 'inline') L.fill = Math.abs(p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) - w) <= 2;
      }
      return { inp, L };
    });
    m.forEach((x) => { if (x.inp.parentNode && !x.inp.dataset.kp) enhance(x.inp, x.L); });
  }

  const mo = new MutationObserver((recs) => {
    const nodes = [];
    recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) nodes.push(n); }));
    if (nodes.length) scan(nodes);
  });
  function start() { scan([document.body]); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.TelKP = { fmt, parse, scan: (el) => scan([el || document.body]) };
})();
