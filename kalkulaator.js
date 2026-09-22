/* TEL 2.0 – materjali kalkulaator (Exceli "Hinna arvutus" järgi).
   Kasutus: TELKalk.open({ nimetus, kogus, materjalid, materjal_id, onApply(res) })
   res = { mat: €/tk, materjal_id, anood: €/tk, tyyp: 'Hall anood' | 'Must anood' | null } */
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numIn = (v) => v === null || v === undefined ? '' : String(v).replace('.', ',');
  const toNum = (v) => { const t = String(v || '').trim(); if (!t) return null; const n = Number(t.replace(/\s/g, '').replace(',', '.')); return Number.isNaN(n) ? undefined : n; };
  const eur = (n) => (n || 0).toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const CSS = `
  .kalk-bg { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; display: flex; align-items: center; justify-content: center; padding: 16px; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #161616; }
  .kalk { width: 100%; max-width: 720px; max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; background: #fff; border: 1px solid #161616; }
  .kalk header { background: #161616; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .kalk header button { background: transparent; border: none; color: #fff; font-size: 22px; height: 32px; width: 32px; cursor: pointer; }
  .kalk .mb { padding: 14px 16px; display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 16px; align-items: start; overflow-y: auto; min-height: 0; }
  .kalk .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kalk .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .kalk label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: #525252; min-width: 0; }
  .kalk input:not([type=checkbox]), .kalk select { width: 100%; min-width: 0; height: 38px; border: 1px solid #C6C6C6; background: #F4F4F4; padding: 0 8px; font-size: 15px; color: #161616; font-family: inherit; }
  .kalk input:not([type=checkbox]) { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .kalk .res { background: #EDF5FF; padding: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .kalk .res small { display: block; font-size: 11px; color: #525252; }
  .kalk .res b, .kalk .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .kalk .res b { font-size: 17px; }
  .kalk .ft { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #E0E0E0; }
  .kalk .ft button { height: 44px; padding: 0 16px; border: 1px solid #C6C6C6; background: #fff; font-weight: 600; cursor: pointer; font-family: inherit; }
  .kalk .ft .ok { flex-grow: 1; border: none; background: #0F62FE; color: #fff; font-size: 15px; }
  .kalk .ft .ok:disabled { opacity: .5; cursor: default; }
  @media (max-width: 680px) {
    .kalk-bg { padding: 0; align-items: stretch; }
    .kalk { max-width: none; max-height: none; height: 100dvh; border: none; }
    .kalk .mb { grid-template-columns: 1fr; flex-grow: 1; }
    .kalk .ft { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
  }`;
  if (!document.getElementById('kalk-css')) { const st = document.createElement('style'); st.id = 'kalk-css'; st.textContent = CSS; document.head.appendChild(st); }
  const PROFIILID = {
    plaat:  { l: 'Plaat', dims: ['A', 'B', 'L'] },
    varras: { l: 'Ümarvarras', dims: ['D', 'L'] },
    toru:   { l: 'Toru', dims: ['D', 'd', 'L'] },
    kuusk:  { l: 'Kuuskant', dims: ['C', 'L'] }
  };
  const PILT = {
    plaat: '<svg viewBox="0 0 300 180" width="100%" height="170"><polygon points="70,80 170,40 260,70 160,110" fill="#C9D3EE" stroke="#393939"/><polygon points="70,80 160,110 160,140 70,110" fill="#6F7482" stroke="#393939"/><polygon points="160,110 260,70 260,100 160,140" fill="#9AA3B8" stroke="#393939"/><g stroke="#525252" stroke-width="0.8" fill="none"><path d="M70,115 L70,150 M160,145 L160,175 M72,148 L158,173"/><path d="M165,145 L165,175 M260,105 L260,135 M167,173 L258,133"/><path d="M60,80 L40,80 M60,110 L40,110 M45,82 L45,108"/></g><g font-family="IBM Plex Mono,monospace" font-size="14" fill="#161616"><text x="105" y="176">A</text><text x="215" y="166">B</text><text x="30" y="100">L</text></g></svg>',
    varras: '<svg viewBox="0 0 300 180" width="100%" height="170"><ellipse cx="80" cy="90" rx="22" ry="45" fill="#9AA3B8" stroke="#393939"/><path d="M80,45 L230,45 A22,45 0 0 1 230,135 L80,135" fill="#C9D3EE" stroke="#393939"/><ellipse cx="80" cy="90" rx="22" ry="45" fill="#6F7482" stroke="#393939"/><g stroke="#525252" stroke-width="0.8"><path d="M80,150 L230,150 M80,145 L80,155 M230,145 L230,155 M45,45 L45,135 M40,45 L50,45 M40,135 L50,135"/></g><g font-family="IBM Plex Mono,monospace" font-size="14" fill="#161616"><text x="150" y="170">L</text><text x="26" y="95">D</text></g></svg>',
    toru: '<svg viewBox="0 0 300 180" width="100%" height="170"><path d="M80,45 L230,45 A22,45 0 0 1 230,135 L80,135" fill="#C9D3EE" stroke="#393939"/><ellipse cx="80" cy="90" rx="22" ry="45" fill="#6F7482" stroke="#393939"/><ellipse cx="80" cy="90" rx="12" ry="25" fill="#fff" stroke="#393939"/><g stroke="#525252" stroke-width="0.8"><path d="M80,150 L230,150 M80,145 L80,155 M230,145 L230,155 M45,45 L45,135 M40,45 L50,45 M40,135 L50,135 M80,65 L80,115"/></g><g font-family="IBM Plex Mono,monospace" font-size="14" fill="#161616"><text x="150" y="170">L</text><text x="26" y="95">D</text><text x="86" y="95">d</text></g></svg>',
    kuusk: '<svg viewBox="0 0 300 180" width="100%" height="170"><path d="M80,45 L230,45 L252,68 L252,112 L230,135 L80,135" fill="#C9D3EE" stroke="#393939"/><polygon points="80,45 102,68 102,112 80,135 58,112 58,68" fill="#6F7482" stroke="#393939"/><g stroke="#525252" stroke-width="0.8"><path d="M80,150 L230,150 M80,145 L80,155 M230,145 L230,155 M40,68 L40,112 M35,68 L45,68 M35,112 L45,112"/></g><g font-family="IBM Plex Mono,monospace" font-size="14" fill="#161616"><text x="150" y="170">L</text><text x="22" y="95">C</text></g></svg>'
  };
  // mm -> ruumala mm³ ja täispindala mm²
  function geom(k, v) {
    const { A = 0, B = 0, L = 0, D = 0, d = 0, C = 0 } = v;
    if (k === 'plaat') return { V: A * B * L, S: 2 * (A * B + A * L + B * L) };
    if (k === 'varras') return { V: Math.PI / 4 * D * D * L, S: Math.PI * D * L + Math.PI / 2 * D * D };
    if (k === 'toru') return { V: Math.PI / 4 * (D * D - d * d) * L, S: Math.PI * (D + d) * L + Math.PI / 2 * (D * D - d * d) };
    const side = C / Math.sqrt(3), face = Math.sqrt(3) / 2 * C * C;        // kuuskant, C = võtmemõõt
    return { V: face * L, S: 6 * side * L + 2 * face };
  }
  function open(o) {
    const r = { nimetus: o.nimetus || '', kogus: o.kogus || 0 };
    const LKM = o.materjalid || [];
    const mat0 = LKM.find((m) => m.id === o.materjal_id) || LKM.find((m) => m.aktiivne) || {};
    const bg = document.createElement('div'); bg.className = 'kalk-bg';
    const dimIn = (n) => '<label id="w' + n + '">' + n + ' =<input id="d' + n + '" inputmode="decimal"></label>';
    bg.innerHTML = '<div class="kalk" role="dialog" aria-label="Hinna arvutus"><header><b>Hinna arvutus: ' + esc(r.nimetus) + '</b><button type="button" data-x aria-label="Sulge">×</button></header>' +
      '<div class="mb">' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<label>Profiil<select id="cKuju">' + Object.entries(PROFIILID).map(([k, p]) => '<option value="' + k + '">' + p.l + '</option>').join('') + '</select></label>' +
          '<label>Materjal<select id="cMat">' + LKM.filter((m) => m.aktiivne).map((m) => '<option value="' + m.id + '"' + (m.id === mat0.id ? ' selected' : '') + '>' + esc(m.nimetus) + '</option>').join('') + '</select></label>' +
          '<div class="g2"><label>Erikaal, kg/m³<input id="cT" inputmode="decimal"></label><label>€/kg<input id="cH" inputmode="decimal"></label></div>' +
          '<div style="font-size:12px;font-weight:600;margin-top:4px">Tooriku mõõdud, mm</div>' +
          '<div class="g3">' + ['A', 'B', 'L', 'D', 'd', 'C'].map(dimIn).join('') + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<div id="cPic" style="border:1px solid #E0E0E0;background:#fff;padding:6px"></div>' +
          '<div class="res"><div><small>Kaal</small><b id="rKg">–</b></div><div><small>Ruumala</small><b id="rV">–</b></div><div><small>Täispindala</small><b id="rS">–</b></div></div>' +
          '<div style="display:grid;grid-template-columns:1fr 110px;gap:6px 10px;align-items:center">' +
            '<span style="font-weight:600">Materjali maksumus</span><b id="rP" class="mono" style="font-size:20px;color:#198038;text-align:right">–</b>' +
            '<label style="flex-direction:row;align-items:center;gap:8px;color:#161616;font-size:14px"><input type="checkbox" id="cHall" style="height:18px;width:18px"> Hall anood, €/tk</label><input id="cHallH" inputmode="decimal" value="0">' +
            '<label style="flex-direction:row;align-items:center;gap:8px;color:#161616;font-size:14px"><input type="checkbox" id="cMust" style="height:18px;width:18px"> Must anood, €/tk</label><input id="cMustH" inputmode="decimal" value="0">' +
            '<span style="font-weight:700">Kokku, €/tk</span><b id="rK" class="mono" style="font-size:20px;text-align:right">–</b>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ft"><button type="button" data-x>Välja</button><button type="button" class="ok" id="cOk">Lisa lahtrisse</button></div></div>';
    document.body.appendChild(bg);
    const $c = (id) => bg.querySelector('#' + id);
    const setMat = () => { const m = LKM.find((x) => x.id === Number($c('cMat').value)) || {}; $c('cT').value = m.tihedus ? numIn(Math.round(m.tihedus * 1000)) : ''; $c('cH').value = numIn(m.hind_kg); };
    const setProf = () => { const k = $c('cKuju').value; ['A', 'B', 'L', 'D', 'd', 'C'].forEach((n) => { $c('w' + n).style.display = PROFIILID[k].dims.includes(n) ? '' : 'none'; }); $c('cPic').innerHTML = PILT[k]; };
    let res = null;
    const recalc = () => {
      const k = $c('cKuju').value, v = {};
      PROFIILID[k].dims.forEach((n) => { v[n] = toNum($c('d' + n).value) || 0; });
      const T = toNum($c('cT').value) || 0, H = toNum($c('cH').value) || 0;
      const ok = PROFIILID[k].dims.every((n) => n === 'd' || v[n] > 0);
      if (!ok) { ['rKg', 'rV', 'rS', 'rP', 'rK'].forEach((id) => { $c(id).textContent = '–'; }); res = null; return; }
      const g = geom(k, v);
      const kg = g.V / 1e9 * T;                                   // mm³ -> m³ × kg/m³
      const mat = Math.round(kg * H * 100) / 100;
      const hall = $c('cHall').checked ? (toNum($c('cHallH').value) || 0) : 0;
      const must = $c('cMust').checked ? (toNum($c('cMustH').value) || 0) : 0;
      res = { mat, anood: hall + must, tyyp: $c('cHall').checked ? 'Hall anood' : $c('cMust').checked ? 'Must anood' : null };
      $c('rKg').textContent = kg.toFixed(3).replace('.', ',') + ' kg';
      $c('rV').textContent = Math.round(g.V / 1000).toLocaleString('et-EE') + ' cm³';
      $c('rS').textContent = (g.S / 10000).toFixed(2).replace('.', ',') + ' dm²';
      $c('rP').textContent = eur(mat, 2); $c('rK').textContent = eur(mat + hall + must, 2);
    };
    $c('cHall').addEventListener('change', () => { if ($c('cHall').checked) $c('cMust').checked = false; recalc(); });
    $c('cMust').addEventListener('change', () => { if ($c('cMust').checked) $c('cHall').checked = false; recalc(); });
    setMat(); setProf();
    bg.addEventListener('input', recalc);
    $c('cMat').addEventListener('change', () => { setMat(); recalc(); });
    $c('cKuju').addEventListener('change', () => { setProf(); recalc(); });
    const close = () => bg.remove();
    bg.querySelectorAll('[data-x]').forEach((b) => b.onclick = close);
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $c('dA').focus();
    const apply = async () => {
      if (!res) return;
      const out = { mat: res.mat, materjal_id: Number($c('cMat').value), anood: res.anood, tyyp: res.tyyp };
      const done = await o.onApply(out);
      if (done !== false) close();
    };
    $c('cOk').onclick = apply;
    bg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && res && e.target.tagName !== 'SELECT') { e.preventDefault(); apply(); } });
  }
  window.TELKalk = { open };
})();
