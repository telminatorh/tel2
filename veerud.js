// =============================================================================
// TEL 2.0 – veergude paigutus kasutaja kaupa (27.10.2026, sql 66 kasutaja_seaded)
// Arvutis: lohista veeru pealkirja vasakule / paremale → järjekord muutub ja jääb meelde.
// Paremklõps pealkirjal või ⚙ → veergude peitmine / tagasitoomine + „Taasta vaikimisi“.
// Salvestub andmebaasi kasutaja juurde (käib kaasa igasse arvutisse). Ilma sql 66-ta → ainult selles brauseris.
//
// defs = [{ k: 'tel', l: 'TEL', fix: 'start'|'end' (ei liigu, ei peida), req: true (ei saa peita) }, …] vaikimisi järjekorras
//   TelVeerud.lae(sb)                     – loe kasutaja seaded (1 päring); lehe alguses
//   TelVeerud.jarjestus(voti, defs)       – nähtavad veerud kasutaja järjekorras (defs objektid)
//   TelVeerud.pais(konteiner, voti, defsFn, muutus)
//                                         – lohistamine + menüü päises; päise lahtritel atribuut data-vk="võti"
//   TelVeerud.tabel(table, voti, defs, muutus) – valmis <table> lahtrid ümber (DOM), sh tfoot colspan
// =============================================================================
(function () {
  if (window.TelVeerud) return;
  const LS = 'tel2.veerud.';
  const M = {};          // võti → { j: [...], p: [...] }
  let sbc = null, noDb = false, uid = null;
  try { Object.keys(localStorage).filter((x) => x.startsWith(LS)).forEach((x) => { try { M[x.slice(LS.length)] = JSON.parse(localStorage.getItem(x)); } catch (e) { /* vigane */ } }); } catch (e) { /* privaatne aken */ }

  async function lae(sb) {
    sbc = sb;
    try {
      const { data: s } = await sb.auth.getSession(); uid = s && s.session ? s.session.user.id : null;
      const { data, error } = await sb.from('kasutaja_seaded').select('voti,vaartus').like('voti', 'veerud:%');
      if (error) { noDb = true; return false; }   // sql 66 käivitamata → jääb brauseri meelespidamine
      const enne = JSON.stringify(M);
      Object.keys(M).forEach((k) => { delete M[k]; });
      (data || []).forEach((r) => { M[r.voti.slice(7)] = r.vaartus; });
      try { Object.keys(localStorage).filter((x) => x.startsWith(LS)).forEach((x) => localStorage.removeItem(x)); Object.keys(M).forEach((k) => localStorage.setItem(LS + k, JSON.stringify(M[k]))); } catch (e) { /* */ }
      return JSON.stringify(M) !== enne;   // true = paigutus erines brauseri meelespeetust → joonista uuesti
    } catch (e) { noDb = true; return false; }
  }
  const tt = {};
  function salvesta(key) {
    const v = M[key];
    try { if (v) localStorage.setItem(LS + key, JSON.stringify(v)); else localStorage.removeItem(LS + key); } catch (e) { /* */ }
    if (!sbc || noDb) return;
    clearTimeout(tt[key]);
    tt[key] = setTimeout(async () => {
      try {
        const r = v ? await sbc.from('kasutaja_seaded').upsert({ voti: 'veerud:' + key, vaartus: v }, { onConflict: 'profiil_id,voti' })
          : await sbc.from('kasutaja_seaded').delete().eq('voti', 'veerud:' + key);
        if (r.error && /kasutaja_seaded|PGRST205|42P01/.test((r.error.code || '') + r.error.message)) noDb = true;
      } catch (e) { /* võrguviga – jääb brauserisse */ }
    }, 500);
  }

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
  function sea(key, defs, all, hid) {
    const j = all.filter((d) => !d.fix).map((d) => d.k), p = [...hid];
    const def = defs.filter((d) => !d.fix).map((d) => d.k);
    M[key] = (j.join() === def.join() && !p.length) ? null : { j, p };
    if (!M[key]) delete M[key];
    salvesta(key);
  }

  // ---------- stiil ----------
  const css = '[data-vk]{cursor:grab}[data-vk].tv-fix{cursor:default}body.tv-drag,body.tv-drag *{cursor:grabbing!important;user-select:none}' +
    '.tv-ghost{position:fixed;z-index:9600;pointer-events:none;padding:6px 12px;background:#161616;color:#fff;font:600 13px "IBM Plex Sans",system-ui,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.3);opacity:.92}' +
    '.tv-line{position:fixed;z-index:9599;width:3px;background:#0F62FE;pointer-events:none}' +
    '.tv-gear{float:right;border:0;background:transparent;color:#8D8D8D;font-size:14px;line-height:1;padding:2px 4px;margin:-2px -4px 0 6px;cursor:pointer}.tv-gear:hover{color:#0F62FE}' +
    '.tv-menu{position:fixed;z-index:9601;width:260px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #C6C6C6;box-shadow:0 12px 28px rgba(0,0,0,.25);font:14px "IBM Plex Sans",system-ui,sans-serif;color:#161616;padding:8px 0}' +
    '.tv-menu b{display:block;padding:4px 14px 6px;font-size:13px}.tv-menu small{display:block;padding:0 14px 8px;color:#6F6F6F;font-size:12px;line-height:1.35}' +
    '.tv-menu label{display:flex;align-items:center;gap:8px;padding:5px 14px;cursor:pointer}.tv-menu label:hover{background:#F4F4F4}.tv-menu label.dis{color:#8D8D8D;cursor:default}' +
    '.tv-menu .tv-ft{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #E0E0E0;margin-top:6px;padding:8px 14px 2px}' +
    '.tv-menu button{border:1px solid #C6C6C6;background:#fff;padding:6px 10px;font:600 12px "IBM Plex Sans",system-ui,sans-serif;cursor:pointer}.tv-menu button:hover{border-color:#0F62FE;color:#0F62FE}';
  function stiil() { if (!document.getElementById('tvCss')) { const s = document.createElement('style'); s.id = 'tvCss'; s.textContent = css; document.head.appendChild(s); } }

  // ---------- menüü ----------
  let menu = null;
  function sulge() { if (menu) { menu.remove(); menu = null; } }
  function avaMenyy(key, defs, x, y, muutus) {
    sulge(); stiil();
    const o = order(key, defs);
    menu = document.createElement('div'); menu.className = 'tv-menu';
    menu.innerHTML = '<b>Veerud</b><small>Lohista veeru pealkirja, et järjekorda muuta. Paigutus on ainult sinu oma' + (noDb ? ' (selles brauseris – sql 66 puudu)' : ' ja käib sinuga kaasa') + '.</small>' +
      o.all.filter((d) => d.l).map((d) => '<label class="' + (d.fix || d.req ? 'dis' : '') + '"><input type="checkbox" data-tvk="' + d.k + '"' + (o.hid.has(d.k) ? '' : ' checked') + (d.fix || d.req ? ' disabled' : '') + '> ' + d.l + '</label>').join('') +
      '<div class="tv-ft"><button type="button" data-tvr>Taasta vaikimisi</button><button type="button" data-tvc>Sulge</button></div>';
    document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
    menu.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-tvk]'); if (!cb) return;
      const oo = order(key, defs); if (cb.checked) oo.hid.delete(cb.dataset.tvk); else oo.hid.add(cb.dataset.tvk);
      sea(key, defs, oo.all, oo.hid); muutus();
    });
    menu.querySelector('[data-tvr]').onclick = () => { delete M[key]; salvesta(key); sulge(); muutus(); };
    menu.querySelector('[data-tvc]').onclick = sulge;
  }
  document.addEventListener('mousedown', (e) => { if (menu && !e.target.closest('.tv-menu')) sulge(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sulge(); });
  let noClick = 0;
  addEventListener('click', (e) => { if (Date.now() < noClick) { e.stopPropagation(); e.preventDefault(); noClick = 0; } }, true);

  // ---------- päise lohistamine (hiir; liikumine > 6 px = lohistamine, muidu tavaline klõps / sorteerimine) ----------
  function pais(box, key, defsFn, muutus) {
    if (!box || box['_tv' + key]) return; box['_tv' + key] = 1; stiil();
    box.addEventListener('contextmenu', (e) => {
      const c = e.target.closest('[data-vk]'); if (!c || !box.contains(c)) return;
      e.preventDefault(); avaMenyy(key, defsFn(), e.clientX, e.clientY, muutus);
    });
    box.addEventListener('click', (e) => {
      const g = e.target.closest('.tv-gear'); if (!g || !box.contains(g)) return;
      e.preventDefault(); e.stopPropagation(); const r = g.getBoundingClientRect(); avaMenyy(key, defsFn(), r.right - 260, r.bottom + 6, muutus);
    }, true);
    box.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
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
  // ⚙ nupp viimasesse päise lahtrisse
  const gear = '<button type="button" class="tv-gear" title="Veerud: peida / näita, taasta vaikimisi (veeru järjekorda muuda pealkirja lohistades)" aria-label="Veerud">⚙</button>';

  // ---------- valmis <table> ümberpaigutus ----------
  function tabel(t, key, defs, muutus) {
    if (!t) return; stiil();
    const N = defs.length, o = order(key, defs), vis = o.all.filter((d) => !o.hid.has(d.k));
    const idx = new Map(defs.map((d, i) => [d.k, i]));
    const perm = vis.map((d) => idx.get(d.k));
    const same = perm.length === N && perm.every((p, i) => p === i);
    [...t.rows].forEach((tr) => {
      const cs = [...tr.cells]; let span = 0; cs.forEach((c) => { span += c.colSpan || 1; });
      if (span !== N) return;
      if (cs.length === 1) { cs[0].colSpan = vis.length; return; }   // grupi päis üle kogu tabeli
      const slot = []; cs.forEach((c) => { const n = c.colSpan || 1; slot.push(c); for (let i = 1; i < n; i++) slot.push(null); });
      if (tr.parentElement.tagName === 'THEAD') slot.forEach((c, i) => { if (c) { c.dataset.vk = defs[i].k; if (defs[i].fix) c.classList.add('tv-fix'); } });
      if (same) return;   // vaikimisi paigutus – midagi ei liigutata
      cs.forEach((c) => { c.colSpan = 1; });
      rebuild(tr, slot, perm);
    });
    const hr = t.tHead && t.tHead.rows[0];
    if (hr && !hr.querySelector('.tv-gear')) { const last = [...hr.cells].pop(); if (last) last.insertAdjacentHTML('beforeend', gear); }
    pais(t.tHead || t, key, () => defs, muutus);
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

  window.TelVeerud = { lae, jarjestus, pais, tabel, muudetud, gear, menyy: avaMenyy, get noDb() { return noDb; } };
})();
