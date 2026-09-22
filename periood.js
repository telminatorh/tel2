// TEL 2.0 – ühine perioodi filter (valmis perioodid + vaba vahemik "alates – kuni")
// Kasutus:
//   TelPer.html('arved')                 -> filtri HTML (pane lehe filtriribale)
//   TelPer.init('arved', renderList)     -> üks kord: mida teha, kui periood muutub
//   TelPer.test('arved', '2026-09-22')   -> kas kuupäev on valitud perioodis (tühi periood = kõik)
// Valik jääb brauserisse meelde (iga lehe jaoks eraldi).
(function () {
  const PRESETS = [['', 'Kogu aeg'], ['t0', 'Täna'], ['w0', 'See nädal'], ['w1', 'Eelmine nädal'], ['m0', 'See kuu'], ['m1', 'Eelmine kuu'],
    ['q0', 'See kvartal'], ['d30', 'Viimased 30 päeva'], ['d90', 'Viimased 90 päeva'], ['y0', 'See aasta'], ['y1', 'Eelmine aasta'], ['range', 'Vahemik…']];
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const ST = {}, CB = {};
  const load = (k) => { if (!ST[k]) { let v = null; try { v = JSON.parse(localStorage.getItem('tel2.per.' + k) || 'null'); } catch (e) { /* pole oluline */ } ST[k] = v || { p: '', from: '', to: '' }; } return ST[k]; };
  const save = (k) => { try { localStorage.setItem('tel2.per.' + k, JSON.stringify(ST[k])); } catch (e) { /* pole oluline */ } };

  function range(k) {
    const s = load(k), d = new Date(), y = d.getFullYear(), m = d.getMonth();
    const mon = add(new Date(y, m, d.getDate()), -((d.getDay() + 6) % 7));
    switch (s.p) {
      case 't0': return [iso(d), iso(d)];
      case 'w0': return [iso(mon), iso(add(mon, 6))];
      case 'w1': return [iso(add(mon, -7)), iso(add(mon, -1))];
      case 'm0': return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
      case 'm1': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
      case 'q0': { const q = Math.floor(m / 3) * 3; return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))]; }
      case 'd30': return [iso(add(d, -30)), iso(d)];
      case 'd90': return [iso(add(d, -90)), iso(d)];
      case 'y0': return [y + '-01-01', y + '-12-31'];
      case 'y1': return [(y - 1) + '-01-01', (y - 1) + '-12-31'];
      case 'range': return (s.from || s.to) ? [s.from || '0000-01-01', s.to || '9999-12-31'] : null;
      default: return null;
    }
  }
  function test(k, d) { const r = range(k); if (!r) return true; d = (d || '').slice(0, 10); return !!d && d >= r[0] && d <= r[1]; }

  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const st = document.createElement('style');
    st.textContent = '.tper{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}' +
      '.tper select,.tper input{height:34px;border:1px solid #C6C6C6;background:#fff;padding:0 8px;font:inherit;font-size:13px;color:#161616}' +
      '.tper input{width:140px;font-family:"IBM Plex Mono",ui-monospace,monospace}' +
      '.tper select:focus,.tper input:focus{outline:2px solid #0F62FE;outline-offset:-2px}' +
      '.tper.on select{border-color:#0F62FE;background:#EDF5FF;font-weight:600}' +
      '.tper .x{border:none;background:transparent;color:#0F62FE;font-weight:600;font-size:13px;height:34px;padding:0 4px;cursor:pointer}' +
      '@media (max-width:700px){.tper{width:100%}.tper select{flex:1 1 100%}.tper input{flex:1 1 0;width:auto;min-width:0}}';
    document.head.appendChild(st);
  }
  function html(k) {
    style();
    const s = load(k), r = range(k);
    const from = s.p === 'range' ? s.from : (r ? r[0] : ''), to = s.p === 'range' ? s.to : (r ? r[1] : '');
    return '<span class="tper' + (r ? ' on' : '') + '" data-per="' + k + '">' +
      '<select data-pf="p" aria-label="Periood">' + PRESETS.map(([v, l]) => '<option value="' + v + '"' + (v === s.p ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      '<input type="date" data-pf="from" value="' + from + '" aria-label="Alates" title="Alates">' +
      '<span aria-hidden="true">–</span>' +
      '<input type="date" data-pf="to" value="' + to + '" aria-label="Kuni" title="Kuni">' +
      (r ? '<button type="button" class="x" data-pf="clr" title="Kogu aeg">✕</button>' : '') + '</span>';
  }
  // uuendab filtri enda välja (lehtedel, kus filtririba ei joonistata uuesti)
  function refresh(k) { document.querySelectorAll('[data-per="' + k + '"]').forEach((el) => { el.outerHTML = html(k); }); }
  function fire(k) { save(k); if (CB[k]) CB[k](); if (document.querySelector('[data-per="' + k + '"]')) refresh(k); }

  const timers = {};
  document.addEventListener('change', (e) => {
    const box = e.target.closest && e.target.closest('[data-per]'); if (!box) return;
    const k = box.dataset.per, s = load(k), f = e.target.dataset.pf;
    if (f === 'p') {
      const prev = range(k); s.p = e.target.value;
      if (s.p === 'range' && prev) { s.from = prev[0]; s.to = prev[1]; }
      fire(k); return;
    }
    // kuupäeva trükkimise ajal ei joonista kohe ümber (muidu kaob kursor), vaid väikese pausi järel
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => {
      const fr = box.querySelector('[data-pf="from"]'), to = box.querySelector('[data-pf="to"]');
      s.p = 'range'; s.from = fr ? fr.value : ''; s.to = to ? to.value : '';
      if (s.from && s.to && s.from > s.to) s.to = s.from;
      fire(k);
    }, 700);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-per] [data-pf="clr"]'); if (!b) return;
    const k = b.closest('[data-per]').dataset.per; ST[k] = { p: '', from: '', to: '' }; fire(k);
  });

  window.TelPer = { html, test, range, init(k, cb) { CB[k] = cb; }, active(k) { return !!range(k); } };
})();
