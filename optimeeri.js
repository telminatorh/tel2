// TEL 2.0 – ✨ Optimeeri (TEST): ühe töömehe tööde järjekorra ettepanek (Tööd → Järjekord, admin)
// Laetakse alles nupuvajutusel (kiirus). Kasutab plaan.js (TelPlaan) sama plaani loogikat, mis Koormus
// (Norm või Ajalugu – see, mis on valitud), ja otsib järjekorra, mis:
//   1) viib võimalikult palju TELLIMUSI TÄIES MAHUS tähtajaks valmis (arvestab teiste meeste sama tellimuse ridu,
//      allhanget ja pinnakatte varu – tellimus on valmis alles siis, kui viimane rida on valmis)
//   2) vähendab hilinevaid töid ja hilinemise päevi (pinnakattega detail peab valmis olema varu võrra varem)
//   3) koondab sama materjali (materjali pere → sama materjal → sama paksus) ja sama pingi tööd (vähem seadistust)
//   4) lõpetab tellimused võimalikult vara (vähem pooleli tellimusi korraga)
// Lukus kohad (sql 31) jäävad paigale. Midagi ei salvestata enne "Rakenda".
// Lisaks: soovitused tööde ümbertõstmiseks teisele mehele (ainult soovitus, ei muuda midagi).
(function () {
  const P = () => window.TelPlaan;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ddmm = (s) => (s ? s.slice(8, 10) + '.' + s.slice(5, 7) : '–');
  const n1 = (v) => (Math.round(Number(v || 0) * 10) / 10).toString().replace('.', ',');
  const ACTIVE = ['cam', 'toos'];
  const OPEN = ['cam', 'toos', 'ok', 'pinnakattes', 'allhankes'];
  const W = { lateOrd: 1000, ordDays: 60, lateRow: 40, rowDays: 8, setup: 3, flow: 0.4 };   // kaalud (lihtsasti muudetavad)

  // materjali "pere" (Alumiinium 6082 ja Alumiinium 7075 = sama pere), materjal, paksus
  const fam = (r) => String(r.mat || '').trim().toLowerCase().split(/[\s,/-]+/)[0] || '';
  const matId = (r) => r.materjal_id || String(r.mat || '').trim().toLowerCase();
  const thick = (r) => (Number(r.paksus) > 0 ? Math.round(Number(r.paksus) * 2) / 2 : null);
  function setupCost(a, b) {
    if (!a || !b) return 0;
    let c = 0;
    if (fam(a) !== fam(b)) c += 1; else if (matId(a) !== matId(b)) c += 0.5;
    else if (thick(a) !== null && thick(b) !== null && thick(a) !== thick(b)) c += 0.25;
    if (a.pink_id && b.pink_id && a.pink_id !== b.pink_id) c += 0.3;
    return c;
  }
  const setups = (seq) => { let c = 0; for (let i = 1; i < seq.length; i++) c += setupCost(seq[i - 1], seq[i]); return c; };
  const setupN = (seq) => { let c = 0; for (let i = 1; i < seq.length; i++) if (fam(seq[i - 1]) !== fam(seq[i]) || matId(seq[i - 1]) !== matId(seq[i]) || (thick(seq[i - 1]) !== null && thick(seq[i]) !== null && thick(seq[i - 1]) !== thick(seq[i]))) c++; return c; };

  // ---- andmed: kõik lahtised read (tellimuse täitmise jaoks) + puhkused kõigile
  async function loadAll(sb) {
    const base = 'id,tellimus_id,teostaja_id,staatus,norm,kogus,tahtaeg,pinnakate,allhange,pink_id,materjal_id,nimetus,tellimused(nr,tarneaeg),materjalid(nimetus)';
    const extra = ['laost', 'tehtud_pct', 'materjal_saabub', 'jrk', 'jrk_lukus', 'paksus', 'laius', 'pikkus'];   // laius + pikkus: ilma nendeta ei saanud gabariiti kontrollida (fits() andis alati "teadmata")
    let use = extra.slice(), data, error;
    for (let k = 0; k < 9; k++) {
      ({ data, error } = await sb.from('tellimuse_read').select(use.join(',') + (use.length ? ',' : '') + base).in('staatus', OPEN).limit(5000));
      if (!error) break;
      const bad = use.find((c) => error.message.includes(c)); if (!bad) break; use = use.filter((c) => c !== bad);
    }
    if (error) throw error;
    const rows = (data || []).map((r) => ({ ...r, norm: Number(r.norm || 0), mat: r.materjalid ? r.materjalid.nimetus : '', tel: r.tellimused ? r.tellimused.nr : '' }));
    const T = P().today();
    const [{ data: lv }, pR, aR] = await Promise.all([
      sb.from('puhkused').select('profiil_id,algus,lopp').gte('lopp', T),
      sb.from('pingid').select('id,nimi,max_x,max_y,max_z'),            // sql 45 (max gabariit); ilma selleta ainult nimi
      sb.from('pingi_asendused').select('kust_pink_id,kuhu_pink_id,tegur,markus,aktiivne')
    ]);
    let pingid = pR && !pR.error ? pR.data || [] : null;
    if (!pingid) { const r2 = await sb.from('pingid').select('id,nimi'); pingid = r2.data || []; }
    const subs = new Map();
    (aR && !aR.error ? aR.data || [] : []).filter((x) => x.aktiivne !== false).forEach((x) => { if (!subs.has(x.kust_pink_id)) subs.set(x.kust_pink_id, []); subs.get(x.kust_pink_id).push({ kuhu: x.kuhu_pink_id, tegur: Number(x.tegur) || 1, markus: x.markus }); });
    return { rows, lvs: lv || [], pingid: new Map(pingid.map((x) => [x.id, x])), subs, noSubs: !aR || !!aR.error };
  }

  // ---- ühe järjestuse hinnang
  function makeEval(w, myRows, ctx) {
    const T = P().today(), SM = ctx.seisMap;
    const ordIds = [...new Set(myRows.map((r) => r.tellimus_id))];
    return function evalSeq(seq) {
      const pl = P().plan(w, myRows, { order: seq, lvs: ctx.lvs, extra: ctx.extra, seisMap: SM, A: ctx.Aw, noBase: true });
      const val = new Map();
      let lateRow = 0, rowDays = 0;
      pl.jobs.forEach((j) => {
        if (!j.fin) return;
        const vr = P().pkVaru(j.r.pinnakate, ctx.pk);
        const v = j.r.pinnakate && vr ? P().addWorkdays(j.fin, vr) : j.fin;
        val.set(j.r.id, v);
        if (j.r.tahtaeg && v > j.r.tahtaeg) { lateRow++; rowDays += P().daysBetween(j.r.tahtaeg, v); }
      });
      let lateOrd = 0, ordDays = 0, flow = 0, onTime = 0;
      const ordDone = new Map();
      ordIds.forEach((oid) => {
        let c = ctx.otherFin.get(oid) || '';
        myRows.forEach((r) => { if (r.tellimus_id === oid) { const v = val.get(r.id); if (v && v > c) c = v; } });
        const due = ctx.ordDue.get(oid);
        ordDone.set(oid, c);
        if (c) flow += Math.max(0, P().daysBetween(T, c));
        if (due && c && c > due) { lateOrd++; ordDays += P().daysBetween(due, c); } else if (due) onTime++;
      });
      const su = setups(seq);
      const score = W.lateOrd * lateOrd + W.ordDays * ordDays + W.lateRow * lateRow + W.rowDays * rowDays + W.setup * su + W.flow * flow;
      const seisIds = new Set(); if (SM && SM.size) pl.jobs.forEach((j) => { const bl = j.r.pink_id && SM.get(j.r.pink_id); if (bl && j.fin && [...bl].some((d) => d <= j.fin)) seisIds.add(j.r.id); });
      return { seisIds, score, lateOrd, ordDays, lateRow, rowDays, su, suN: setupN(seq), flow, onTime, nOrd: ordIds.filter((o) => ctx.ordDue.get(o)).length, free: pl.free, val, ordDone, dn: pl.dn };
    };
  }

  // ---- otsing: lukkude vahelised lõigud eraldi; algvariandid + kohtade vahetamine (insertion) ajapiiranguga
  function optimize(w, myRows, list, isLk, ctx, budgetMs) {
    const evalSeq = makeEval(w, myRows, ctx);
    const t0 = Date.now();
    const edd = (a, b) => String(a.tahtaeg || '9999').localeCompare(String(b.tahtaeg || '9999')) || a.id - b.id;
    const ordKey = (r) => ctx.ordDue.get(r.tellimus_id) || r.tahtaeg || '9999';
    // lõigud
    const segs = []; let cur = [];
    list.forEach((r) => { if (isLk(r)) { if (cur.length) segs.push({ free: cur }); cur = []; segs.push({ lock: r }); } else cur.push(r); });
    if (cur.length) segs.push({ free: cur });
    const build = (parts) => { const out = []; segs.forEach((s, i) => { if (s.lock) out.push(s.lock); else out.push(...parts[i]); }); return out; };
    let parts = segs.map((s) => (s.free ? s.free.slice() : null));
    let best = evalSeq(build(parts)), bestParts = parts.map((p) => (p ? p.slice() : p));
    const cand = (fn) => { const pp = segs.map((s) => (s.free ? fn(s.free.slice()) : null)); const e = evalSeq(build(pp)); if (e.score < best.score) { best = e; bestParts = pp; } };
    cand((l) => l.sort(edd));
    // tellimuse tähtaeg → tellimus koos → materjal
    cand((l) => l.sort((a, b) => String(ordKey(a)).localeCompare(String(ordKey(b))) || (a.tellimus_id - b.tellimus_id) || fam(a).localeCompare(fam(b)) || edd(a, b)));
    // materjali pere → materjal → paksus, perede järjekord varaseima tähtaja järgi
    cand((l) => {
      const fmin = new Map(); l.forEach((r) => { const k = fam(r) + '|' + matId(r); const d = r.tahtaeg || '9999'; if (!fmin.has(k) || d < fmin.get(k)) fmin.set(k, d); });
      return l.sort((a, b) => String(fmin.get(fam(a) + '|' + matId(a))).localeCompare(String(fmin.get(fam(b) + '|' + matId(b)))) || fam(a).localeCompare(fam(b)) || String(matId(a)).localeCompare(String(matId(b))) || (thick(a) || 0) - (thick(b) || 0) || edd(a, b));
    });
    // kohalik otsing: tõsta töö teise kohta; tõsta sama materjali/tellimuse plokk korraga
    let improved = true, passes = 0;
    while (improved && passes < 2000 && Date.now() - t0 < budgetMs) {
      improved = false; passes++;
      for (let si = 0; si < segs.length; si++) {
        const seg = bestParts[si]; if (!seg || seg.length < 2) continue;
        for (let i = 0; i < seg.length && Date.now() - t0 < budgetMs; i++) {
          for (let j = 0; j < seg.length; j++) {
            if (j === i) continue;
            const l = seg.slice(); const x = l.splice(i, 1)[0]; l.splice(j, 0, x);
            const pp = bestParts.slice(); pp[si] = l; const e = evalSeq(build(pp));
            if (e.score < best.score - 1e-6) { best = e; bestParts = pp; improved = true; break; }
          }
          if (improved) break;
        }
        if (improved) break;
        // plokid: sama materjal või sama tellimus järjest
        for (const key of [(r) => fam(r) + '|' + matId(r) + '|' + thick(r), (r) => 't' + r.tellimus_id]) {
          if (Date.now() - t0 >= budgetMs) break;
          const groups = new Map(); seg.forEach((r) => { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
          for (const [, g] of groups) {
            if (g.length < 2 || Date.now() - t0 >= budgetMs) continue;
            const rest = seg.filter((r) => !g.includes(r));
            for (let j = 0; j <= rest.length; j++) {
              const l = rest.slice(); l.splice(j, 0, ...g.slice().sort(edd));
              const pp = bestParts.slice(); pp[si] = l; const e = evalSeq(build(pp));
              if (e.score < best.score - 1e-6) { best = e; bestParts = pp; improved = true; break; }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }
    const seq = build(bestParts);
    return { seq, best, cur: evalSeq(list), ms: Date.now() - t0, passes, evalSeq };
  }

  // ---- pingid: gabariit ja asendused (sql 45). fits: true / false / null (teadmata)
  function fits(r, pk) {
    const d = [r.paksus, r.laius, r.pikkus].map(Number); const m = pk ? [pk.max_x, pk.max_y, pk.max_z].map(Number) : [];
    if (!d.every((x) => x > 0) || m.length < 3 || !m.every((x) => x > 0)) return null;
    d.sort((a, b) => a - b); m.sort((a, b) => a - b); return d.every((x, i) => x <= m[i]);
  }
  // pingid, kus töö r saab tehtud: oma pink (tegur 1) + asendused, mis gabariidi järgi ei ole välistatud
  function pinkCands(r, ctx) {
    const out = [{ pink: r.pink_id || null, tegur: 1, markus: '', fit: true }];
    if (r.pink_id) (ctx.subs.get(r.pink_id) || []).forEach((x) => { const f = fits(r, ctx.pingid.get(x.kuhu)); if (f !== false) out.push({ pink: x.kuhu, tegur: x.tegur, markus: x.markus || '', fit: f }); });
    return out;
  }
  // aja tegur plaanis: rea koopial _tegur (teine pink aeglasem) – ilma selleta sama mis enne
  function withTegur(A) {
    if (A) return Object.assign({}, A, { jaak: (r) => A.jaak(r) * (r._tegur || 1) });
    return { jaak: (r) => P().jaak(r) * (r._tegur || 1), paev: (w) => (w && w.nadala_norm ? Number(w.nadala_norm) / 5 : 0) };
  }

  // ---- soovitused (ei muuda midagi): hilinev või seisaku taga ootav töö
  //   a) teisele mehele – tema pingile, kui see on sama või lubatud asendus (aeg × tegur, gabariit)
  //   b) samale mehele teisele pingile (kui tema pink seisab või töö hilineb)
  function suggest(w, res, myRows, ctx, workers, allRows) {
    const out = [];
    const flag = res.seq.filter((r) => (r.tahtaeg && (res.best.val.get(r.id) || '') > r.tahtaeg) || (r.pink_id && res.best.seisIds && res.best.seisIds.has(r.id)));
    if (!flag.length) return out;
    const others = workers.filter((x) => x.id !== w.id && x.aktiivne !== false && ctx.Aw.paev(x));
    const lateDays = (pl) => pl.jobs.reduce((a, j) => a + (j.r.tahtaeg && j.fin && j.fin > j.r.tahtaeg ? P().daysBetween(j.r.tahtaeg, j.fin) : 0), 0);
    const pinksOf = (rows) => new Set(rows.map((x) => x.pink_id).filter(Boolean));
    const baseMe = res.best.rowDays;
    const o = { lvs: ctx.lvs, extra: ctx.extra, seisMap: ctx.seisMap, A: ctx.Aw, noBase: true };
    const myPinks = pinksOf(myRows);
    flag.slice(0, 8).forEach((r) => {
      const cands = pinkCands(r, ctx);
      const hrs = ctx.Aw.jaak(r);
      const mine = res.seq.filter((x) => x.id !== r.id);
      const meAfter = res.evalSeq(mine).rowDays;
      // a) teine mees
      others.forEach((w2) => {
        const theirs = allRows.filter((x) => x.teostaja_id === w2.id && ACTIVE.includes(x.staatus) && !x.allhange);
        const pk2 = pinksOf(theirs);
        cands.filter((c) => !c.pink || !pk2.size || pk2.has(c.pink)).forEach((c) => {
          if (c.pink && !pk2.has(c.pink) && pk2.size) return;
          const b = P().plan(w2, theirs, o);
          const add = P().plan(w2, theirs.concat([Object.assign({}, r, { jrk: null, jrk_lukus: false, teostaja_id: w2.id, pink_id: c.pink, _tegur: c.tegur })]), o);
          const j = add.jobs.find((x) => x.r.id === r.id); if (!j || !j.fin) return;
          const gain = (baseMe - meAfter) - (lateDays(add) - lateDays(b));
          const rank = gain - (c.tegur - 1) * 6 - (c.fit === null && c.pink !== r.pink_id ? 1 : 0);   // aeglasem pink = vähem mõistlik
          if (gain > 0 && rank > 0) out.push({ r, w2, c, gain, rank, fin: j.fin, late: r.tahtaeg && j.fin > r.tahtaeg, hrs });
        });
      });
      // b) sama mees, teine pink
      cands.filter((c) => c.pink && c.pink !== r.pink_id && myPinks.has(c.pink)).forEach((c) => {
        const seq2 = res.seq.map((x) => (x.id === r.id ? Object.assign({}, x, { pink_id: c.pink, _tegur: c.tegur }) : x));
        const e = res.evalSeq(seq2); const gain = baseMe - e.rowDays;
        const v = e.val.get(r.id);
        const rank = gain - (c.tegur - 1) * 6;
        if (gain > 0 && rank > 0) out.push({ r, w2: w, c, gain, rank, fin: v, late: r.tahtaeg && v > r.tahtaeg, hrs, self: true });
      });
    });
    out.sort((a, b) => b.rank - a.rank);
    const seen = new Set(); return out.filter((s) => (seen.has(s.r.id) ? false : (seen.add(s.r.id), true))).slice(0, 5);
  }

  // ---- UI
  function css() {
    if (document.getElementById('opt-css')) return;
    const st = document.createElement('style'); st.id = 'opt-css';
    st.textContent = `
    .opt-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60; display: flex; align-items: center; justify-content: center; padding: 12px; }
    .opt { background: #fff; border: 1px solid #161616; width: 100%; max-width: 860px; max-height: calc(100vh - 24px); display: flex; flex-direction: column; font-size: 14px; }
    .opt header { background: #161616; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .opt header b { font-size: 16px; } .opt header small { color: #C6C6C6; font-size: 12px; }
    .opt header button { background: transparent; border: none; color: #fff; font-size: 22px; width: 32px; height: 32px; cursor: pointer; }
    .opt .ob { overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
    .opt table { border-collapse: collapse; width: 100%; }
    .opt th, .opt td { padding: 6px 8px; border-bottom: 1px solid #E0E0E0; text-align: left; }
    .opt th { background: #F4F4F4; font-size: 12px; font-weight: 600; }
    .opt td.n { text-align: right; font-family: 'IBM Plex Mono', monospace; }
    .opt .better { color: #198038; font-weight: 700; } .opt .worse { color: #DA1E28; font-weight: 700; }
    .opt ol { margin: 0; padding: 0; list-style: none; border: 1px solid #E0E0E0; }
    .opt li { display: grid; grid-template-columns: 34px 46px minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 6px 8px; border-bottom: 1px solid #E0E0E0; border-left: 4px solid var(--mc, #C6C6C6); }
    .opt li:last-child { border-bottom: none; } .opt li.late { background: #FFF1F1; }
    .opt li .nr { font-family: 'IBM Plex Mono', monospace; color: #525252; text-align: right; }
    .opt li .mv { font-family: 'IBM Plex Mono', monospace; font-size: 12px; } .opt li .mv.up { color: #198038; } .opt li .mv.dn { color: #8E6A00; }
    .opt li .t b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .opt li .t small { color: #525252; font-size: 12px; }
    .opt li .r { text-align: right; font-size: 12px; white-space: nowrap; } .opt li .r .neg { color: #DA1E28; font-weight: 600; } .opt li .r .pos { color: #198038; }
    .opt .tg { display: inline-block; font-size: 11px; padding: 0 5px; margin-right: 4px; background: #F4F4F4; border: 1px solid #E0E0E0; }
    .opt .sg { border: 1px solid #F1C21B; background: #FFFBEB; padding: 8px 12px; font-size: 13px; }
    .opt .sg div + div { margin-top: 4px; }
    .opt .note { font-size: 12px; color: #525252; }
    .opt footer { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #E0E0E0; }
    .opt footer button { height: 44px; padding: 0 16px; font-weight: 600; cursor: pointer; border: 1px solid #C6C6C6; background: #fff; }
    .opt footer .ok { flex-grow: 1; background: #0F62FE; color: #fff; border: none; }
    .opt footer .ok:disabled { background: #C6C6C6; cursor: default; }
    @media (max-width: 600px) { .opt li { grid-template-columns: 26px 40px minmax(0,1fr); } .opt li .r { grid-column: 3; text-align: left; } }`;
    document.head.appendChild(st);
  }
  function matColor(key) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360; return 'hsl(' + h + ' 60% 45%)'; }

  // avalik: TelOpt.open({ sb, w, list, isLk, lvs, extra, seis, pk, A, workers, onApply(seqIds) })
  async function open(o) {
    css();
    const bg = document.createElement('div'); bg.className = 'opt-bg';
    bg.innerHTML = '<div class="opt" role="dialog" aria-modal="true" aria-label="Optimeeritud järjekord"><header><div><b>✨ Optimeeri (test) – ' + esc(o.w.nimi || '') + '</b><br><small>arvutan… (tellimused, materjalid, tähtajad, pinnakatte varu)</small></div><button type="button" data-x aria-label="Sulge">×</button></header><div class="ob"><div class="note">Laen kõigi lahtiste tellimuste read…</div></div></div>';
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    try {
      const T = P().today();
      const D = await loadAll(o.sb);
      const byId = new Map(D.rows.map((r) => [r.id, r]));
      // mehe read värskete andmetega (materjal_id, paksus, tellimus_id), järjekord = praegune (lehel)
      const list = o.list.map((r) => Object.assign({}, r, byId.get(r.id) || {}, { mat: r.mat || (byId.get(r.id) || {}).mat, jrk_lukus: r.jrk_lukus }));
      const myIds = new Set(list.map((r) => r.id));
      // ajaloo mudel kõigi ridadega (kui plaan on ajaloo järgi)
      let A = null;
      if (o.A) { const m = await P().AJ.lae(o.sb, D.rows, null).catch(() => null); A = m && !m.error ? m : o.A; }
      // teiste meeste plaan praeguse järjekorraga → iga tellimuse "muud read valmis" kuupäev
      const lvs = D.lvs.length ? D.lvs : (o.lvs || []);
      const prog = P().prognoos(D.rows.filter((r) => !myIds.has(r.id)), o.workers, { lvs, extra: o.extra, pk: o.pk, seis: o.seis, A });
      const otherFin = new Map(), ordDue = new Map();
      D.rows.forEach((r) => {
        const oid = r.tellimus_id;
        const d = (r.tellimused && r.tellimused.tarneaeg) || null;
        const cur = ordDue.get(oid); const cand = d || r.tahtaeg || null;
        if (cand && (!cur || cand < cur)) ordDue.set(oid, cand);
        if (myIds.has(r.id)) return;
        let f = null;
        const p = prog.get(r.id);
        if (p && p.valmib) f = p.valmib;
        else if (r.staatus === 'allhankes' || r.allhange) f = r.tahtaeg && r.tahtaeg > T ? r.tahtaeg : T;
        else if (r.staatus === 'ok') f = T;
        if (f && (!otherFin.get(oid) || f > otherFin.get(oid))) otherFin.set(oid, f);
      });
      const ctx = { lvs, extra: o.extra, pk: o.pk, A, Aw: withTegur(A), seisMap: P().seisMap(o.seis, T), otherFin, ordDue, pingid: D.pingid, subs: D.subs, noSubs: D.noSubs };
      const res = optimize(o.w, list, list, o.isLk, ctx, 1500);
      const sug = suggest(o.w, res, list, ctx, o.workers, D.rows);
      render(bg, o, list, res, sug, ctx, close);
    } catch (e) {
      bg.querySelector('.ob').innerHTML = '<div class="sg">Ei õnnestunud: ' + esc(e.message || e) + '</div>';
    }
  }

  function render(bg, o, list, res, sug, ctx, close) {
    const c = res.cur, b = res.best;
    const cmp = (lab, x, y, lowGood, fmt) => { const f = fmt || ((v) => String(v)); const cls = x === y ? '' : (y < x) === lowGood ? 'better' : 'worse';
      return '<tr><td>' + lab + '</td><td class="n">' + f(x) + '</td><td class="n ' + cls + '">' + f(y) + '</td></tr>'; };
    const same = res.seq.every((r, i) => r.id === list[i].id);
    const pos0 = new Map(list.map((r, i) => [r.id, i]));
    const items = res.seq.map((r, i) => {
      const v = b.val.get(r.id), late = r.tahtaeg && v && v > r.tahtaeg;
      const mv = pos0.get(r.id) - i;
      const prev = res.seq[i - 1], next = res.seq[i + 1];
      const tags = [];
      if ((prev && prev.tellimus_id === r.tellimus_id) || (next && next.tellimus_id === r.tellimus_id)) tags.push('🔗 ' + esc(r.tel || 'tellimus') + ' koos');
      if (prev && setupCost(prev, r) === 0 && fam(prev)) tags.push('🧱 sama materjal' + (thick(r) ? ' ' + n1(thick(r)) + ' mm' : ''));
      if (r.pinnakate) tags.push('🎨 ' + esc(r.pinnakate) + ' (+' + P().pkVaru(r.pinnakate, ctx.pk) + ' p)');
      if (r.materjal_saabub && r.materjal_saabub > P().today()) tags.push('📦 ' + ddmm(r.materjal_saabub));
      const od = ctx.ordDue.get(r.tellimus_id), oc = b.ordDone.get(r.tellimus_id);
      return '<li class="' + (late ? 'late' : '') + '" style="--mc:' + matColor(fam(r) + '|' + matId(r)) + '"><span class="nr">' + (i + 1) + '</span>' +
        '<span class="mv ' + (mv > 0 ? 'up' : mv < 0 ? 'dn' : '') + '">' + (o.isLk(r) ? '🔒' : mv > 0 ? '↑' + mv : mv < 0 ? '↓' + (-mv) : '·') + '</span>' +
        '<span class="t"><b>' + esc(r.nimetus) + '</b><small>' + esc(r.mat || 'materjal?') + (thick(r) ? ' ' + n1(thick(r)) + ' mm' : '') + ' · ' + n1(r.kogus) + ' tk · ' + esc(r.tel || '') + '</small><br>' + tags.map((t) => '<span class="tg">' + t + '</span>').join('') + '</span>' +
        '<span class="r">tähtaeg ' + ddmm(r.tahtaeg) + '<br><span class="' + (late ? 'neg' : 'pos') + '">valmib ' + ddmm(v) + (late ? ' +' + P().daysBetween(r.tahtaeg, v) + ' p' : '') + '</span>' +
        (od && oc ? '<br><span class="' + (oc > od ? 'neg' : 'pos') + '" title="Kogu tellimus (ka teiste meeste read, allhange)">tellimus ' + ddmm(oc) + '</span>' : '') + '</span></li>';
    }).join('');
    bg.querySelector('header small').textContent = 'plaan: ' + (ctx.A ? 'ajaloo järgi' : 'normi järgi') + ' · ' + res.seq.length + ' tööd · arvutus ' + res.ms + ' ms';
    bg.querySelector('.ob').innerHTML =
      '<table><thead><tr><th></th><th style="text-align:right">Praegu</th><th style="text-align:right">Pakutud</th></tr></thead><tbody>' +
      cmp('Tellimusi tähtajaks täies mahus', c.onTime + '/' + c.nOrd, b.onTime + '/' + b.nOrd, false, (v) => v) +
      cmp('Hilinevaid tellimusi', c.lateOrd, b.lateOrd, true) +
      cmp('Hilinevaid töid (sh pinnakatte varu)', c.lateRow, b.lateRow, true) +
      cmp('Hilinemise päevi kokku', c.rowDays, b.rowDays, true) +
      cmp('Materjali / paksuse vahetusi', c.suN, b.suN, true) +
      cmp('Kõik tööd valmis', c.free || '–', b.free || '–', true, (v) => (v === '–' ? v : ddmm(v))) +
      '</tbody></table>' +
      (same ? '<div class="sg">Praegune järjekord on juba parim, mida see arvutus leidis. 👍</div>' : '') +
      (sug.length ? '<div class="sg"><b>Soovitused (ei muuda midagi):</b>' + sug.map((x) => { const pn = (id) => ((ctx.pingid.get(id) || {}).nimi || 'pink?');
        const pinkTxt = x.c.pink && x.c.pink !== x.r.pink_id ? ' pingil <b>' + esc(pn(x.c.pink)) + '</b>' + (x.c.tegur > 1 ? ' (aeglasem: ~' + n1(x.hrs * x.c.tegur) + ' h, ×' + n1(x.c.tegur) + ')' : '') + (x.c.fit === null ? ' ⚠ kontrolli gabariiti' : '') : '';
        return '<div>➜ <b>' + esc(x.r.nimetus) + '</b> (' + esc(x.r.tel || '') + ', ' + esc(pn(x.r.pink_id)) + ', tähtaeg ' + ddmm(x.r.tahtaeg) + ') → ' + (x.self ? 'sama mees' : '<b>' + esc(x.w2.nimi) + '</b>') + pinkTxt + ': valmiks ' + ddmm(x.fin) + (x.late ? ' (ikka hilja)' : ' – tähtajaks') + ', hilinemist kokku −' + Math.round(x.gain) + ' p</div>'; }).join('') +
        (ctx.noSubs ? '<div class="note">Pinkide asendusi pole seadistatud (sql 45) – soovitused ainult sama pingiga meestele.</div>' : '') + '</div>' : '') +
      '<ol>' + items + '</ol>' +
      '<div class="note">Kuidas arvutatud: sama plaan mis Koormuses (' + (ctx.A ? 'tegelik aeg ajaloost' : 'normtunnid') + ', puhkused, pühad, pinkide seisakud, materjali saabumine). Tellimus loetakse valmis, kui ka teiste meeste read (nende praeguse järjekorraga), allhange ja pinnakate on valmis. ' +
        'Eelistus: 1) tellimused täies mahus tähtajaks, 2) vähem hilinevaid töid ja päevi, 3) vähem materjali/paksuse/pingi vahetusi, 4) tellimused varem valmis. 🔒 kohad jäävad paigale. Soovitused arvestavad pingi asendusi ja aja tegurit (Kontor → Pingi asendused) ning pingi max gabariiti (Kontor → Pingid). Tagi: 🔗 sama tellimus järjest, 🧱 sama materjal, 🎨 pinnakatte varu, 📦 materjal saabub.</div>';
    const ft = document.createElement('footer');
    ft.innerHTML = '<button type="button" data-x>Loobu</button><button type="button" class="ok"' + (same ? ' disabled' : '') + '>Rakenda järjekorraks</button>';
    bg.querySelector('.opt').appendChild(ft);
    ft.querySelector('.ok').addEventListener('click', () => { o.onApply(res.seq.map((r) => r.id)); close(); });
  }

  window.TelOpt = { open, _optimize: optimize, _setupCost: setupCost, _fits: fits, _pinkCands: pinkCands };
})();
