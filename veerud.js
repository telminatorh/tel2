// =============================================================================
// TEL 2.0 – tabelite tööriistad arvutis (27.10.2026, sql 66 kasutaja_seaded) – kõik kasutaja kaupa
//  • Veergude järjekord: lohista veeru pealkirja vasakule / paremale.
//  • Veeru laius: lohista pealkirja paremat serva; topeltklõps servale = tagasi vaikimisi laiusele.
//  • Peida / näita: paremklõps pealkirjal või ⚙ → linnukesed, „Taasta vaikimisi“.
//  • Salvestatud vaated: nupp „Vaated ▾“ – filtrid + sortimine + veerud ühe nimega; ★ = avaneb ise.
//  • Valitud ridade kokkuvõte: Ctrl+klõps (või Shift+klõps vahemik) reale → all riba summadega.
//  • Klaviatuur: / otsing · ↑ ↓ rida · Enter ava · tühik vali · Esc tühista · ? abi.
// Salvestub andmebaasi kasutaja juurde (käib kaasa igasse arvutisse). Ilma sql 66-ta → ainult selles brauseris.
//
// defs = [{ k: 'tel', l: 'TEL', fix: 'start'|'end' (ei liigu, ei peida), req: true (ei saa peita), w: '120px' }, …]
//   TelVeerud.lae(sb)                       – loe kasutaja seaded (1 päring); lehe alguses
//   TelVeerud.jarjestus(voti, defs)         – nähtavad veerud kasutaja järjekorras
//   TelVeerud.mall(voti, defs)              – CSS grid-template-columns (kasutaja laiustega)
//   TelVeerud.pais(konteiner, voti, defsFn, muutus, { live })  – lohistamine, laius, menüü (päise lahtrid data-vk="võti")
//   TelVeerud.tabel(table, voti, defs, muutus, { kleep: N })  – valmis <table> ümber + laiused + N esimest veergu kleepuvad
//   TelVeerud.vaated(nupp, voti, { get(), set(olek), tabelid: [võtmed] }) – salvestatud vaadete menüü
//   TelVeerud.vaikeVaade(voti)              – ★-ga vaade (avamisel) või null
// =============================================================================
(function () {
  if (window.TelVeerud) return;
  const LS = 'tel2.veerud.', LSV = 'tel2.vaated.';
  const M = {};          // võti → { j: [...], p: [...], w: { veerg: px } }
  const V = {};          // võti → { l: [{ n, s, v, d }] }  salvestatud vaated
  let sbc = null, noDb = false;
  const lsLoe = (pref, obj) => { try { Object.keys(localStorage).filter((x) => x.startsWith(pref)).forEach((x) => { try { obj[x.slice(pref.length)] = JSON.parse(localStorage.getItem(x)); } catch (e) { /* vigane */ } }); } catch (e) { /* privaatne aken */ } };
  lsLoe(LS, M); lsLoe(LSV, V);

  async function lae(sb) {
    sbc = sb;
    try {
      const { data, error } = await sb.from('kasutaja_seaded').select('voti,vaartus');
      if (error) { noDb = true; return false; }   // sql 66 käivitamata → jääb brauseri meelespidamine
      const enne = JSON.stringify([M, V]);
      [M, V].forEach((o) => Object.keys(o).forEach((k) => { delete o[k]; }));
      (data || []).forEach((r) => { if (r.voti.startsWith('veerud:')) M[r.voti.slice(7)] = r.vaartus; else if (r.voti.startsWith('vaated:')) V[r.voti.slice(7)] = r.vaartus; });
      try {
        Object.keys(localStorage).filter((x) => x.startsWith(LS) || x.startsWith(LSV)).forEach((x) => localStorage.removeItem(x));
        Object.keys(M).forEach((k) => localStorage.setItem(LS + k, JSON.stringify(M[k]))); Object.keys(V).forEach((k) => localStorage.setItem(LSV + k, JSON.stringify(V[k])));
      } catch (e) { /* */ }
      return JSON.stringify([M, V]) !== enne;   // true = erines brauseri meelespeetust → joonista uuesti
    } catch (e) { noDb = true; return false; }
  }
  const tt = {};
  function kirjuta(pref, lsPref, obj, key) {
    const v = obj[key], full = pref + key;
    try { if (v) localStorage.setItem(lsPref + key, JSON.stringify(v)); else localStorage.removeItem(lsPref + key); } catch (e) { /* */ }
    if (!sbc || noDb) return;
    clearTimeout(tt[full]);
    tt[full] = setTimeout(async () => {
      try {
        const r = v ? await sbc.from('kasutaja_seaded').upsert({ voti: full, vaartus: v }, { onConflict: 'profiil_id,voti' })
          : await sbc.from('kasutaja_seaded').delete().eq('voti', full);
        if (r.error && /kasutaja_seaded|PGRST205|42P01/.test((r.error.code || '') + r.error.message)) noDb = true;
      } catch (e) { /* võrguviga – jääb brauserisse */ }
    }, 500);
  }
  const salvesta = (key) => kirjuta('veerud:', LS, M, key);
  const salvestaV = (key) => kirjuta('vaated:', LSV, V, key);

  // kasutaja järjekord + vaikimisi järjekorra uued veerud õigesse kohta
  function order(key, defs) {
    const keys = defs.map((d) => d.k), u = M[key];
    const mov = defs.filter((d) => !d.fix).map((d) => d.k);
    let j = u && Array.isArray(u.j) ? u.j.filter((k) => mov.includes(k)) : mov.slice();
    mov.forEach((k, i) => {
      if (j.includes(k)) return;
      let at = 0; for (let x = i - 1; x >= 0; x--) { const p = j.indexOf(mov[x]); if (p >= 0) { at = p + 1; break; } }
      j.splice(at, 0, k);
    });
    const hid = new Set(u && Array.isArray(u.p) ? u.p : []);
    const start = defs.filter((d) => d.fix === 'start' || d.fix === true), end = defs.filter((d) => d.fix === 'end');
    const by = new Map(defs.map((d) => [d.k, d]));
    return { all: [...start, ...j.map((k) => by.get(k)), ...end], hid: new Set([...hid].filter((k) => keys.includes(k) && !by.get(k).fix && !by.get(k).req)) };
  }
  function jarjestus(key, defs) { const o = order(key, defs); return o.all.filter((d) => !o.hid.has(d.k)); }
  function muudetud(key) { return !!M[key]; }
  const laiused = (key) => (M[key] && M[key].w) || {};
  function mall(key, defs) { const w = laiused(key); return jarjestus(key, defs).map((d) => (w[d.k] ? w[d.k] + 'px' : d.w || 'auto')).join(' '); }
  function puhasta(key) { const m = M[key]; if (m && !(m.j && m.j.length) && !(m.p && m.p.length) && !(m.w && Object.keys(m.w).length)) delete M[key]; }
  function sea(key, defs, all, hid) {
    const j = all.filter((d) => !d.fix).map((d) => d.k), p = [...hid];
    const def = defs.filter((d) => !d.fix).map((d) => d.k), w = M[key] && M[key].w;
    M[key] = { j: j.join() === def.join() ? [] : j, p, ...(w ? { w } : {}) };
    puhasta(key); salvesta(key);
  }

  // ---------- stiil ----------
  const F = '"IBM Plex Sans",system-ui,sans-serif';
  const css = '[data-vk]{cursor:grab}[data-vk].tv-fix{cursor:default}[data-vk]:not(th){position:relative}body.tv-drag,body.tv-drag *{cursor:grabbing!important;user-select:none}body.tv-rsz,body.tv-rsz *{cursor:col-resize!important;user-select:none}' +
    '.tv-rs{position:absolute;top:0;right:0;width:9px;height:100%;cursor:col-resize;z-index:4}.tv-rs:hover,.tv-rs.on{background:linear-gradient(90deg,transparent 6px,#0F62FE 6px,#0F62FE 9px)}' +
    '.tv-ghost{position:fixed;z-index:9600;pointer-events:none;padding:6px 12px;background:#161616;color:#fff;font:600 13px ' + F + ';box-shadow:0 8px 20px rgba(0,0,0,.3);opacity:.92}' +
    '.tv-line{position:fixed;z-index:9599;width:3px;background:#0F62FE;pointer-events:none}' +
    '.tv-gear{float:right;border:0;background:transparent;color:#8D8D8D;font-size:14px;line-height:1;padding:2px 4px;margin:-2px -4px 0 6px;cursor:pointer}.tv-gear:hover{color:#0F62FE}' +
    '.tv-menu{position:fixed;z-index:9601;width:280px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #C6C6C6;box-shadow:0 12px 28px rgba(0,0,0,.25);font:14px ' + F + ';color:#161616;padding:8px 0}' +
    '.tv-menu b{display:block;padding:4px 14px 6px;font-size:13px}.tv-menu small{display:block;padding:0 14px 8px;color:#6F6F6F;font-size:12px;line-height:1.35}' +
    '.tv-menu label{display:flex;align-items:center;gap:8px;padding:5px 14px;cursor:pointer}.tv-menu label:hover{background:#F4F4F4}.tv-menu label.dis{color:#8D8D8D;cursor:default}' +
    '.tv-menu .tv-ft{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #E0E0E0;margin-top:6px;padding:8px 14px 2px}' +
    '.tv-menu button{border:1px solid #C6C6C6;background:#fff;padding:6px 10px;font:600 12px ' + F + ';cursor:pointer}.tv-menu button:hover{border-color:#0F62FE;color:#0F62FE}' +
    '.tv-menu .tv-v{display:flex;align-items:center;gap:2px;padding:0 8px 0 4px}.tv-menu .tv-v:hover{background:#F4F4F4}.tv-menu .tv-v.on{background:#EDF5FF}' +
    '.tv-menu .tv-v button{border:0;background:transparent;padding:7px 8px;font-weight:400;font-size:14px}.tv-menu .tv-v .tv-vn{flex:1;text-align:left;font-weight:600}' +
    '.tv-menu .tv-v .tv-vd{color:#A8A8A8}.tv-menu .tv-v .tv-vd.on{color:#F1C21B}.tv-menu .tv-v .tv-vx{color:#A8A8A8}.tv-menu .tv-v .tv-vx:hover{color:#DA1E28}' +
    '.tv-menu .tv-new{display:flex;gap:6px;padding:8px 14px 2px;border-top:1px solid #E0E0E0;margin-top:6px}.tv-menu .tv-new input{flex:1;min-width:0;height:30px;border:1px solid #C6C6C6;padding:0 8px;font:14px ' + F + '}' +
    '.tv-vbtn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #C6C6C6;background:#fff;font:600 13px ' + F + ';cursor:pointer;white-space:nowrap}.tv-vbtn:hover{border-color:#0F62FE;color:#0F62FE}.tv-vbtn em{font-style:normal;color:#0F62FE;max-width:140px;overflow:hidden;text-overflow:ellipsis}' +
    '.tv-sel,.tv-sel>*,.tv-sel td{background:#D0E2FF!important}.tv-kb{outline:2px solid #0F62FE!important;outline-offset:-2px}' +
    '.tv-sum{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9500;display:flex;align-items:center;gap:14px;flex-wrap:wrap;max-width:calc(100vw - 32px);padding:9px 10px 9px 16px;background:#161616;color:#fff;font:13px ' + F + ';box-shadow:0 8px 24px rgba(0,0,0,.3)}' +
    '.tv-sum b{font-weight:600}.tv-sum span{color:#C6C6C6}.tv-sum span i{font-style:normal;color:#fff;font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:600}.tv-sum button{border:1px solid #6F6F6F;background:transparent;color:#fff;padding:4px 10px;cursor:pointer;font:600 12px ' + F + '}' +
    '.tv-help{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9700;background:#fff;border:1px solid #C6C6C6;box-shadow:0 16px 40px rgba(0,0,0,.3);padding:16px 20px;font:14px ' + F + ';color:#161616;min-width:320px}' +
    '.tv-help h3{margin:0 0 10px;font-size:15px}.tv-help table{border-collapse:collapse}.tv-help td{padding:4px 14px 4px 0}.tv-help kbd{display:inline-block;min-width:22px;text-align:center;padding:1px 6px;border:1px solid #C6C6C6;border-bottom-width:2px;background:#F4F4F4;font:600 12px "IBM Plex Mono",monospace}';
  function stiil() { if (!document.getElementById('tvCss')) { const s = document.createElement('style'); s.id = 'tvCss'; s.textContent = css; document.head.appendChild(s); } }

  // ---------- veergude menüü ----------
  let menu = null;
  function sulge() { if (menu) { menu.remove(); menu = null; } }
  function pane(el, x, y) {
    document.body.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; el.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
  }
  function avaMenyy(key, defs, x, y, muutus) {
    sulge(); stiil();
    const o = order(key, defs);
    menu = document.createElement('div'); menu.className = 'tv-menu';
    menu.innerHTML = '<b>Veerud</b><small>Lohista pealkirja = järjekord, lohista pealkirja paremat serva = laius (topeltklõps servale = vaikimisi). Ainult sinu oma' + (noDb ? ' (selles brauseris – sql 66 puudu)' : ' ja käib sinuga kaasa') + '.</small>' +
      o.all.filter((d) => d.l).map((d) => '<label class="' + (d.fix || d.req ? 'dis' : '') + '"><input type="checkbox" data-tvk="' + d.k + '"' + (o.hid.has(d.k) ? '' : ' checked') + (d.fix || d.req ? ' disabled' : '') + '> ' + d.l + '</label>').join('') +
      '<div class="tv-ft"><button type="button" data-tvr>Taasta vaikimisi</button><button type="button" data-tvc>Sulge</button></div>';
    pane(menu, x, y);
    menu.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-tvk]'); if (!cb) return;
      const oo = order(key, defs); if (cb.checked) oo.hid.delete(cb.dataset.tvk); else oo.hid.add(cb.dataset.tvk);
      sea(key, defs, oo.all, oo.hid); muutus();
    });
    menu.querySelector('[data-tvr]').onclick = () => { delete M[key]; salvesta(key); sulge(); muutus(); };
    menu.querySelector('[data-tvc]').onclick = sulge;
  }
  document.addEventListener('mousedown', (e) => { if (menu && !e.target.closest('.tv-menu')) sulge(); }, true);
  let noClick = 0;
  addEventListener('click', (e) => { if (Date.now() < noClick) { e.stopPropagation(); e.preventDefault(); noClick = 0; } }, true);

  // ---------- päis: järjekord (lohista), laius (serv), menüü (paremklõps / ⚙) ----------
  const rsH = '<span class="tv-rs" title="Lohista: veeru laius · topeltklõps: vaikimisi"></span>';
  function pais(box, key, defsFn, muutus, opt) {
    if (!box || box['_tv' + key]) return; box['_tv' + key] = 1; stiil();
    const live = (opt && opt.live) || null;
    box.addEventListener('contextmenu', (e) => {
      const c = e.target.closest('[data-vk]'); if (!c || !box.contains(c)) return;
      e.preventDefault(); avaMenyy(key, defsFn(), e.clientX, e.clientY, muutus);
    });
    box.addEventListener('click', (e) => {
      const g = e.target.closest('.tv-gear'); if (!g || !box.contains(g)) return;
      e.preventDefault(); e.stopPropagation(); const r = g.getBoundingClientRect(); avaMenyy(key, defsFn(), r.right - 280, r.bottom + 6, muutus);
    }, true);
    box.addEventListener('dblclick', (e) => {
      const h = e.target.closest('.tv-rs'); if (!h || !box.contains(h)) return;
      e.preventDefault(); e.stopPropagation();
      const k = h.closest('[data-vk]').dataset.vk; if (M[key] && M[key].w) { delete M[key].w[k]; puhasta(key); salvesta(key); } muutus();
    }, true);
    box.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const h = e.target.closest('.tv-rs');
      if (h && box.contains(h)) {   // ---- laius
        e.preventDefault(); e.stopPropagation();
        const cell = h.closest('[data-vk]'), k = cell.dataset.vk, x0 = e.clientX, w0 = cell.getBoundingClientRect().width / (zoomOf(cell) || 1);
        let raf = 0, moved = false; h.classList.add('on'); document.body.classList.add('tv-rsz');
        const mv = (ev) => {
          moved = true; const w = Math.max(32, Math.round(w0 + (ev.clientX - x0) / (zoomOf(cell) || 1)));
          M[key] = M[key] || {}; M[key].w = { ...(M[key].w || {}), [k]: w };
          if (!raf) raf = requestAnimationFrame(() => { raf = 0; (live || muutus)(); });
        };
        const up = () => {
          removeEventListener('mousemove', mv, true); removeEventListener('mouseup', up, true);
          document.body.classList.remove('tv-rsz'); h.classList.remove('on'); noClick = Date.now() + 350;
          if (moved) { salvesta(key); muutus(); }
        };
        addEventListener('mousemove', mv, true); addEventListener('mouseup', up, true);
        return;
      }
      const c = e.target.closest('[data-vk]'); if (!c || !box.contains(c) || c.classList.contains('tv-fix') || e.target.closest('input,select,.tv-gear')) return;
      const row = c.parentElement, x0 = e.clientX, y0 = e.clientY; let drag = false, ghost = null, line = null, tgt = null;
      const cells = () => [...row.children].filter((x) => x.dataset && x.dataset.vk);
      function mv(ev) {
        if (!drag) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 7) return; drag = true; document.body.classList.add('tv-drag');
          ghost = document.createElement('div'); ghost.className = 'tv-ghost'; ghost.textContent = (c.textContent || '').replace(/[▲▼▾⚙]/g, '').trim() || 'Veerg'; document.body.appendChild(ghost);
          line = document.createElement('div'); line.className = 'tv-line'; document.body.appendChild(line); }
        ev.preventDefault();
        ghost.style.left = (ev.clientX + 12) + 'px'; ghost.style.top = (ev.clientY + 10) + 'px';
        const cs = cells().filter((x) => !x.classList.contains('tv-fix') || x === c); let best = null;
        cs.forEach((x) => { const r = x.getBoundingClientRect(); [[r.left, x, 0], [r.right, x, 1]].forEach(([px, el, side]) => { const d = Math.abs(ev.clientX - px); if (!best || d < best.d) best = { d, el, side, px }; }); });
        if (!best) return; tgt = best;
        const rr = row.getBoundingClientRect(); line.style.left = (best.px - 1) + 'px'; line.style.top = rr.top + 'px'; line.style.height = Math.max(24, rr.height) + 'px';
      }
      function up() {
        removeEventListener('mousemove', mv, true); removeEventListener('mouseup', up, true);
        if (!drag) return;
        document.body.classList.remove('tv-drag'); ghost && ghost.remove(); line && line.remove();
        noClick = Date.now() + 350;   // lohistamise lõpp pole sorteerimise klõps
        if (!tgt || tgt.el === c) return;
        const defs = defsFn(), o = order(key, defs), from = c.dataset.vk;
        const rest = o.all.filter((d) => d.k !== from); let at = rest.findIndex((d) => d.k === tgt.el.dataset.vk); if (at < 0) return; if (tgt.side) at += 1;
        const fixS = rest.filter((d) => d.fix === 'start' || d.fix === true).length, fixE = rest.filter((d) => d.fix === 'end').length;
        at = Math.max(fixS, Math.min(at, rest.length - fixE));
        rest.splice(at, 0, o.all.find((d) => d.k === from));
        sea(key, defs, rest, o.hid); muutus();
      }
      addEventListener('mousemove', mv, true); addEventListener('mouseup', up, true);
    });
  }
  function zoomOf(el) { let z = 1; for (let x = el; x && x !== document.documentElement; x = x.parentElement) { const v = parseFloat(x.style && x.style.zoom); if (v) z *= v; } return z; }
  // ⚙ nupp viimasesse päise lahtrisse
  const gear = '<button type="button" class="tv-gear" title="Veerud: peida / näita, taasta vaikimisi (järjekord: lohista pealkirja, laius: lohista serva)" aria-label="Veerud">⚙</button>';

  // ---------- valmis <table> ümberpaigutus + laiused + kleepuvad esimesed veerud ----------
  function tabel(t, key, defs, muutus, opt) {
    if (!t) return; stiil();
    const N = defs.length, o = order(key, defs), vis = o.all.filter((d) => !o.hid.has(d.k));
    const idx = new Map(defs.map((d, i) => [d.k, i]));
    const perm = vis.map((d) => idx.get(d.k));
    const same = perm.length === N && perm.every((p, i) => p === i);
    t.dataset.tvkey = key;
    [...t.rows].forEach((tr) => {
      const cs = [...tr.cells]; let span = 0; cs.forEach((c) => { span += c.colSpan || 1; });
      if (span !== N) return;
      if (cs.length === 1) { cs[0].colSpan = vis.length; return; }   // grupi päis üle kogu tabeli
      const slot = []; cs.forEach((c) => { const n = c.colSpan || 1; slot.push(c); for (let i = 1; i < n; i++) slot.push(null); });
      if (tr.parentElement.tagName === 'THEAD') slot.forEach((c, i) => { if (c) { c.dataset.vk = defs[i].k; if (defs[i].fix) c.classList.add('tv-fix'); else if (!c.querySelector('.tv-rs')) c.insertAdjacentHTML('beforeend', rsH); } });
      if (same) return;   // vaikimisi paigutus – midagi ei liigutata
      cs.forEach((c) => { c.colSpan = 1; });
      rebuild(tr, slot, perm);
    });
    const hr = t.tHead && t.tHead.rows[0];
    if (hr && !hr.querySelector('.tv-gear')) { const last = [...hr.cells].pop(); if (last) last.insertAdjacentHTML('beforeend', gear); }
    const kleep = (opt && opt.kleep) || 0;
    const reeglid = () => tabelStiil(t, key, vis, kleep);
    reeglid();
    pais(t.tHead || t, key, () => defs, muutus, { live: reeglid });
  }
  function tabelStiil(t, key, vis, kleep) {
    const id = 'tvw-' + key.replace(/\W/g, '_'); let st = document.getElementById(id);
    if (!st) { st = document.createElement('style'); st.id = id; document.head.appendChild(st); }
    const w = laiused(key), sel = (i) => 'table[data-tvkey="' + key + '"]>thead>tr>:nth-child(' + i + '),table[data-tvkey="' + key + '"]>tbody>tr>:nth-child(' + i + '):not([colspan])';
    let s = '';
    vis.forEach((d, i) => { const px = w[d.k]; if (px) s += sel(i + 1) + '{width:' + px + 'px;min-width:' + px + 'px;max-width:' + px + 'px;overflow:hidden;text-overflow:ellipsis}'; });
    st.textContent = s;
    if (kleep) {   // esimesed N veergu jäävad horisontaalsel kerimisel paigale
      const hr = t.tHead && t.tHead.rows[0]; let left = 0;
      for (let i = 0; i < Math.min(kleep, vis.length); i++) {
        s += sel(i + 1) + '{position:sticky;left:' + left + 'px;z-index:1}:where(table[data-tvkey="' + key + '"]>tbody>tr>:nth-child(' + (i + 1) + ')){background:#fff}' +
          'table[data-tvkey="' + key + '"]>thead>tr>:nth-child(' + (i + 1) + '){z-index:3}';
        const c = hr && hr.cells[i]; left += c ? c.getBoundingClientRect().width / (zoomOf(c) || 1) : 0;
      }
      s += 'table[data-tvkey="' + key + '"]>tbody>tr>:nth-child(' + Math.min(kleep, vis.length) + '):not([colspan]){box-shadow:inset -1px 0 0 #C6C6C6}';
      st.textContent = s;
    }
  }
  function rebuild(tr, slot, perm) {
    const fr = document.createDocumentFragment(); let last = null, lastSpan = false;
    perm.forEach((p) => {
      const c = slot[p];
      if (c) { fr.appendChild(c); last = c; lastSpan = !/(^|\s)(r|n)(\s|$)/.test(c.className) && !!c.textContent.trim(); }
      else if (last && lastSpan) last.colSpan += 1;
      else { const e = document.createElement(tr.parentElement.tagName === 'THEAD' ? 'th' : 'td'); fr.appendChild(e); last = e; lastSpan = false; }
    });
    slot.forEach((c, i) => { if (c && !perm.includes(i)) c.remove(); });
    tr.appendChild(fr);
  }

  // ---------- salvestatud vaated ----------
  // opt: { get: () => lehe olek (filtrid, sortimine, otsing…), set: (olek) => taasta + joonista, tabelid: [veergude võtmed], nimi: () => praeguse vaate silt }
  const VA = {};   // võti → { opt, nupp, aktiivne }
  function vaated(nupp, key, opt) {
    if (!nupp) return; stiil();
    VA[key] = { ...(VA[key] || {}), opt, nupp };
    nupp.classList.add('tv-vbtn');
    const akt = VA[key].aktiivne;
    nupp.innerHTML = '☰ Vaated' + (akt ? ' <em>' + esc(akt) + '</em>' : '') + ' ▾';
    nupp.title = 'Salvestatud vaated – filtrid, sortimine ja veerud ühe nimega';
    nupp.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const r = nupp.getBoundingClientRect(); avaVaated(key, r.left, r.bottom + 6); };
  }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function rakenda(key, v) {
    const a = VA[key]; if (!a) return;
    (a.opt.tabelid || []).forEach((tk) => { if (v.v && v.v[tk]) M[tk] = JSON.parse(JSON.stringify(v.v[tk])); else delete M[tk]; salvesta(tk); });
    a.aktiivne = v.n; a.opt.set(JSON.parse(JSON.stringify(v.s || {})));
    if (a.nupp && a.nupp.isConnected) vaated(a.nupp, key, a.opt);
  }
  function avaVaated(key, x, y) {
    sulge(); const a = VA[key]; const L = (V[key] && V[key].l) || [];
    menu = document.createElement('div'); menu.className = 'tv-menu';
    menu.innerHTML = '<b>Vaated</b><small>Salvesta praegused filtrid, sortimine ja veerud ühe nimega. ★ = see vaade avaneb ise.</small>' +
      (L.length ? L.map((v, i) => '<div class="tv-v' + (a && a.aktiivne === v.n ? ' on' : '') + '"><button type="button" class="tv-vd' + (v.d ? ' on' : '') + '" data-vd="' + i + '" title="' + (v.d ? 'Ära ava ise' : 'Ava see vaade ise') + '">★</button><button type="button" class="tv-vn" data-va="' + i + '">' + esc(v.n) + '</button><button type="button" class="tv-vx" data-vx="' + i + '" title="Kustuta vaade">✕</button></div>').join('')
        : '<small style="color:#8D8D8D">Salvestatud vaateid pole veel.</small>') +
      '<div class="tv-new"><input type="text" maxlength="40" placeholder="Uue vaate nimi, nt Hilinevad FLIR" aria-label="Vaate nimi"><button type="button" data-vs>Salvesta</button></div>';
    pane(menu, x, y);
    const inp = menu.querySelector('.tv-new input');
    const save = () => {
      const n = inp.value.trim(); if (!n || !a) { inp.focus(); return; }
      const v = { n, s: a.opt.get(), v: {} }; (a.opt.tabelid || []).forEach((tk) => { if (M[tk]) v.v[tk] = JSON.parse(JSON.stringify(M[tk])); });
      const l = L.filter((x) => x.n !== n); const old = L.find((x) => x.n === n); if (old && old.d) v.d = true;
      l.push(v); V[key] = { l }; salvestaV(key); a.aktiivne = n; vaated(a.nupp, key, a.opt); sulge();
    };
    menu.querySelector('[data-vs]').onclick = save;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); e.stopPropagation(); });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.va) { rakenda(key, L[+b.dataset.va]); sulge(); }
      else if (b.dataset.vd) { const i = +b.dataset.vd, on = !L[i].d; L.forEach((v) => { delete v.d; }); if (on) L[i].d = true; V[key] = { l: L }; salvestaV(key); avaVaated(key, x, y); }
      else if (b.dataset.vx) { const i = +b.dataset.vx; if (a && a.aktiivne === L[i].n) a.aktiivne = null; L.splice(i, 1); V[key] = { l: L }; if (!L.length) delete V[key]; salvestaV(key); if (a) vaated(a.nupp, key, a.opt); avaVaated(key, x, y); }
    });
    setTimeout(() => inp.focus(), 0);
  }
  function vaikeVaade(key) { const L = (V[key] && V[key].l) || []; return L.find((v) => v.d) || null; }
  function avaVaikimisi(key) { const v = vaikeVaade(key); if (v && VA[key]) { rakenda(key, v); return true; } return false; }

  // ---------- read: valik (Ctrl / Shift + klõps, tühik), kokkuvõte, klaviatuur ----------
  const RIDA = 'table tbody tr, .row.dk, li.ji';
  const desk = () => matchMedia('(min-width: 1100px)').matches;
  function lahtrid(r) { if (r.tagName === 'TR') return [...r.cells]; if (r.classList.contains('dk')) { const o = r.querySelector('.open'); return [r.querySelector('.st'), ...(o ? [...o.children] : [])].filter(Boolean); } return [...r.children]; }
  function paiseLahtrid(r) {
    if (r.tagName === 'TR') { const t = r.closest('table'), h = t && t.tHead && t.tHead.rows[t.tHead.rows.length - 1]; return h ? [...h.cells] : []; }
    const box = r.closest('#list') || r.closest('#jrk') || r.closest('main') || document; const h = box.querySelector(r.classList.contains('dk') ? '.lhead' : '.jhead'); return h ? [...h.children] : [];
  }
  const sobib = (r) => r && r.isConnected && !(r.tagName === 'TR' && (r.classList.contains('gh') || r.querySelector('td[colspan]') && r.cells.length === 1)) && r.offsetParent !== null;
  let valitud = [], ankur = null, sumEl = null, kb = null;
  function rühm(r) { return r.tagName === 'TR' ? r.closest('table') : r.closest('#list, #jrk, ol, main') ; }
  function arv(t) {
    t = String(t || '').replace(/ /g, ' ').trim(); if (!t) return null;
    const m = t.match(/^([-−]?\d{1,3}(?:[  ]\d{3})*(?:,\d+)?|[-−]?\d+(?:,\d+)?)\s*(tk|h|€|kg|m|%)?(?:\s|$)/);
    if (!m) return null; return { n: Number(m[1].replace(/[  ]/g, '').replace('−', '-').replace(',', '.')), u: m[2] || '' };
  }
  const fmt = (n, d) => n.toLocaleString('et-EE', { minimumFractionDigits: d, maximumFractionDigits: d });
  function kokkuvote() {
    valitud = valitud.filter((r) => r.isConnected);
    document.querySelectorAll('.tv-sel').forEach((r) => { if (!valitud.includes(r)) r.classList.remove('tv-sel'); });
    valitud.forEach((r) => r.classList.add('tv-sel'));
    if (!valitud.length) { if (sumEl) { sumEl.remove(); sumEl = null; } return; }
    const head = paiseLahtrid(valitud[0]); const sums = [];
    head.forEach((h, i) => {
      const lab = (h.textContent || '').replace(/[▲▼▾⚙]/g, '').replace(/\s+/g, ' ').trim(); if (!lab || /^(aeg|#|jrk|tähtaeg|kuupäev|valmib|nr)\b/i.test(lab)) return;
      let s = 0, n = 0, d = 0, u = '';
      for (const r of valitud) {
        const c = lahtrid(r)[i]; if (!c) continue;
        const al = getComputedStyle(c).textAlign; if (al !== 'right' && al !== 'end' && !c.classList.contains('c-n') && !c.classList.contains('jc-kog') && !c.classList.contains('jc-norm')) { n = -1; break; }
        const el = c.querySelector('input'); const v = arv(el ? el.value : c.textContent); if (!v) continue;
        s += v.n; n++; u = u || v.u; const dec = (String(el ? el.value : c.textContent).match(/,(\d+)/) || [, ''])[1].length; d = Math.max(d, Math.min(2, dec));
      }
      if (n > 0) sums.push(lab.replace(/,?\s*€$/, '') + ' <i>' + fmt(s, d) + (u ? ' ' + u : /€/.test(lab) ? ' €' : '') + '</i>');
    });
    if (!sumEl) { stiil(); sumEl = document.createElement('div'); sumEl.className = 'tv-sum'; document.body.appendChild(sumEl); }
    sumEl.innerHTML = '<b>' + valitud.length + ' rida valitud</b>' + sums.map((x) => '<span>' + x + '</span>').join('') + '<button type="button" title="Tühista valik (Esc)">✕</button>';
    sumEl.querySelector('button').onclick = tühista;
  }
  function tühista() { valitud = []; ankur = null; kokkuvote(); }
  function vali(r, range) {
    const chk = r.querySelector('input.chk[type=checkbox]');   // Ülevaade: ridadel oma linnukesed → kasuta neid
    if (chk) { chk.click(); return; }
    if (valitud.length && rühm(valitud[0]) !== rühm(r)) valitud = [];
    if (range && ankur && ankur.isConnected && rühm(ankur) === rühm(r)) {
      const all = [...rühm(r).querySelectorAll(RIDA)].filter(sobib), a = all.indexOf(ankur), b = all.indexOf(r);
      if (a >= 0 && b >= 0) { const [x, y] = a < b ? [a, b] : [b, a]; all.slice(x, y + 1).forEach((z) => { if (!valitud.includes(z)) valitud.push(z); }); }
    } else { const i = valitud.indexOf(r); if (i >= 0) valitud.splice(i, 1); else valitud.push(r); ankur = r; }
    kokkuvote();
  }
  addEventListener('click', (e) => {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey) || !desk()) return;
    if (e.target.closest('input,select,textarea,a,[data-vk],.tv-menu,.tv-sum')) return;
    const r = e.target.closest(RIDA); if (!r || !sobib(r) || !r.closest('main, #app, .app, body')) return;
    if (r.closest('thead, tfoot')) return;
    e.preventDefault(); e.stopPropagation(); getSelection && getSelection().removeAllRanges(); vali(r, e.shiftKey);
  }, true);
  // uus joonistus (innerHTML) kaotab valitud read → kokkuvõte kaob ise
  const mo = new MutationObserver(() => { if (valitud.length && valitud.some((r) => !r.isConnected)) kokkuvote(); if (kb && !kb.isConnected) kb = null; });
  const startMo = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) startMo(); else document.addEventListener('DOMContentLoaded', startMo);

  // ---- klaviatuur (arvutis): / otsing · ↑ ↓ rida · Enter ava · tühik vali · Esc · ?
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
  function read() {
    const sets = ['table.pos tbody tr', '#list .row.dk', '#jl li.ji', 'table.nt tbody tr[data-open]', 'main table tbody tr.row', 'main table tbody tr[data-id]', 'main table tbody tr[data-aopen]', 'main table tbody tr.clk', 'table tbody tr'];
    const modal = document.querySelector('.modal:not(.hidden), .tm-bg, .sdlg, .qk-bg, [role=dialog]:not([hidden])'); if (modal) return [];
    for (const s of sets) { const r = [...document.querySelectorAll(s)].filter(sobib); if (r.length) return r; }
    return [];
  }
  function fookus(r) { if (kb) kb.classList.remove('tv-kb'); kb = r; if (r) { r.classList.add('tv-kb'); r.scrollIntoView({ block: 'nearest' }); } }
  function ava(r) {
    const t = r.querySelector('[data-open]') || (r.matches('[data-open]') ? r : null);
    if (t) return t.click();
    const nm = r.querySelector('td.nm, td[data-row]'); if (nm) return nm.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const o = r.querySelector('.open'); if (o) return o.click();
    r.click();
  }
  function abi() {
    const old = document.querySelector('.tv-help'); if (old) { old.remove(); return; }
    stiil(); const d = document.createElement('div'); d.className = 'tv-help';
    d.innerHTML = '<h3>Klaviatuur ja tabelid</h3><table>' + [['/', 'otsing'], ['↑ ↓', 'liigu ridade vahel'], ['Enter', 'ava rida'], ['tühik', 'vali rida (kokkuvõte all)'], ['Ctrl + klõps', 'vali rida'], ['Shift + klõps', 'vali vahemik'], ['Esc', 'tühista valik / sulge'], ['?', 'see abi']]
      .map(([k, t]) => '<tr><td>' + k.split(' ').map((x) => /^[+]$/.test(x) ? ' + ' : '<kbd>' + x + '</kbd>').join(' ') + '</td><td>' + t + '</td></tr>').join('') + '</table>' +
      '<p style="margin:10px 0 0;font-size:12px;color:#6F6F6F">Veerud: lohista pealkirja (järjekord) või selle paremat serva (laius); paremklõps / ⚙ = peida. „Vaated ▾“ = salvesta filtrid + veerud.</p>';
    document.body.appendChild(d); setTimeout(() => document.addEventListener('mousedown', function f(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener('mousedown', f, true); } }, true), 0);
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      sulge(); const h = document.querySelector('.tv-help'); if (h) { h.remove(); return; }
      if (valitud.length) { tühista(); return; }
      if (typing(e.target) && /search|^q$/i.test(e.target.type + ' ' + e.target.id)) { e.target.blur(); return; }
      if (kb) fookus(null);
      return;
    }
    if (!desk() || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.key === '/') {
      const q = document.querySelector('#q:not([disabled]), #search, input[type=search], .search input');
      if (q && q.offsetParent !== null) { e.preventDefault(); q.focus(); q.select && q.select(); }
      return;
    }
    if (e.key === '?') { e.preventDefault(); abi(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const r = read(); if (!r.length) return; e.preventDefault();
      let i = kb ? r.indexOf(kb) : -1; i = i < 0 ? (e.key === 'ArrowDown' ? 0 : r.length - 1) : Math.max(0, Math.min(r.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      fookus(r[i]); if (e.shiftKey) vali(r[i], false);
      return;
    }
    if (kb && kb.isConnected && e.key === 'Enter') { e.preventDefault(); ava(kb); return; }
    if (kb && kb.isConnected && e.key === ' ') { e.preventDefault(); vali(kb, false); }
  });

  window.TelVeerud = { lae, jarjestus, mall, laiused, pais, tabel, muudetud, gear, rs: rsH, menyy: avaMenyy, vaated, vaikeVaade, avaVaikimisi, tühista, get noDb() { return noDb; } };
})();
