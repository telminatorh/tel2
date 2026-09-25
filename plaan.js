// TEL 2.0 – ühine tööde plaan ja prognoos (Tööd, Ülevaade, Tellimused)
// Kasutus: <script src="plaan.js"></script>   →   window.TelPlaan
//
//   TelPlaan.plan(w, rows, { lvs, extra, minDays, order, seis })  – ühe töömehe plaan (vt allpool)
//   TelPlaan.prognoos(rows, workers, { lvs, extra, pk, sinceAt, seis })  – Map(rea id → { fin, valmib, late, lateDays, pk, ... })
//
// Reeglid: tööd mehe järjekorras (jrk; seadmata tööd tähtaja järgi õigesse kohta), päeva võimsus = nädala norm / 5
// tööpäeval (riigipühad ja puhkused = 0). TÄNA arvestatakse ainult järelejäänud tööaeg (vaikimisi 8:00–16:30).
// Pinnakattega detailile liidetakse pinnakatte varu (tööpäevi, muudetav Kontor → Pinnakatted).
// Pooleli töö: planeeritakse ainult tegemata jääk (tehtud_pct). Materjal pole kohal (materjal_saabub > täna) → tööd ei alustata enne seda päeva.
(function () {
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => iso(new Date());
  const ACTIVE = ['cam', 'toos'];
  const DAY_START = 8, DAY_END = 16.5;          // tööpäev (tundides), tänase järelejäänud osa arvutamiseks
  const PK_VAIKE = 5;                           // pinnakatte varu, kui pinnakatet pole tabelis

  const _hol = {};
  function holidays(y) {
    if (_hol[y]) return _hol[y];
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    _hol[y] = new Set(['01-01', '02-24', '05-01', '06-23', '06-24', '08-20', '12-24', '12-25', '12-26'].map((x) => y + '-' + x).concat([iso(new Date(y, mo - 1, da - 2))]));
    return _hol[y];
  }
  function isWorkday(s) { const d = new Date(s + 'T12:00:00'); const wd = d.getDay(); return wd !== 0 && wd !== 6 && !holidays(d.getFullYear()).has(s); }
  function isoWeek(s) {
    const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  }
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
  function addWorkdays(s, n) { const d = new Date(s + 'T12:00:00'); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (isWorkday(iso(d))) k++; } return iso(d); }
  // tänasest tööpäevast järel (0..1)
  function todayLeft() { const n = new Date(); const h = n.getHours() + n.getMinutes() / 60; return Math.max(0, Math.min(1, (DAY_END - h) / (DAY_END - DAY_START))); }

  // tegemata jääk tundides: norm × (1 − tehtud %)  (tehtud_pct, sql 26)
  const jaak = (r) => { const n = Number(r.norm || 0), p = Number(r.tehtud_pct || 0); return p > 0 ? n * Math.max(0, 100 - p) / 100 : n; };
  const EDD = (a, b) => String(a.tahtaeg || '9999').localeCompare(String(b.tahtaeg || '9999')) || (b.staatus === 'toos') - (a.staatus === 'toos') || a.id - b.id;
  function orderRows(act) {
    const ranked = act.filter((r) => r.jrk !== null && r.jrk !== undefined).sort((a, b) => a.jrk - b.jrk || a.id - b.id);
    const rest = act.filter((r) => r.jrk === null || r.jrk === undefined).sort(EDD);
    const out = ranked.slice();
    let from = 0; out.forEach((x, k) => { if (x.jrk_lukus) from = k + 1; });   // sql 31: uued tööd mitte ühegi lukus töö ette
    rest.forEach((r) => { const i = out.findIndex((x, k) => k >= from && (x.tahtaeg || '9999') > (r.tahtaeg || '9999')); if (i < 0) out.push(r); else out.splice(i, 0, r); });
    return out;
  }

  // pinkide seisakud: [{pink_id, algus, lopp, lopetatud, liik}] → Map(pink_id → Set(iso päevad, mil pink seisab))
  // lopp puudub (lõpp teadmata) → arvestame, et seisab kuni tänaseni (kaasa arvatud).
  // lopetatud (pink töötab jälle) → sellest päevast alates vaba.
  function seisEnd(x, T) {
    let e = x.lopp || T; if (!x.lopp && e < x.algus) e = x.algus;
    if (x.lopetatud) { const l = String(x.lopetatud).slice(0, 10); const d = new Date(l + 'T12:00:00'); d.setDate(d.getDate() - 1); const y = iso(d); if (y < e) e = y; }
    return e;
  }
  function seisMap(seis, T) {
    const m = new Map(); if (!seis || !seis.length) return m;
    seis.forEach((x) => {
      if (!x || !x.pink_id || !x.algus) return;
      const e = seisEnd(x, T); if (e < T) return;
      let set = m.get(x.pink_id); if (!set) { set = new Set(); m.set(x.pink_id, set); }
      const d = new Date((x.algus > T ? x.algus : T) + 'T12:00:00');
      for (let k = 0; k < 400 && iso(d) <= e; k++) { set.add(iso(d)); d.setDate(d.getDate() + 1); }
    });
    return m;
  }
  // kas seisak on aktiivne / tulevikus (kuvamiseks)
  function seisActive(seis, T) { T = T || today(); return (seis || []).filter((x) => x && x.pink_id && x.algus && seisEnd(x, T) >= T); }

  // ühe mehe plaan
  // o.seis = pinkide seisakud → seisva pingi töid neil päevil ei tehta; mees teeb vahepeal järjekorrast järgmist sobivat tööd.
  function plan(w, rows, o) {
    o = o || {};
    const T = today(); const left = todayLeft();
    const lv = (o.lvs || []).filter((p) => p.profiil_id === (w && w.id));
    const dn = w && w.nadala_norm ? Number(w.nadala_norm) / 5 : 0;
    const onLeave = (s) => lv.some((p) => p.algus <= s && p.lopp >= s);
    // ületunnid / lisapäevad (sql 27): tööpäeval + tunnid; nädalavahetusel/pühal ainult ühe päeva kirje (algus = lopp)
    const ex = (o.extra || []).filter((p) => p.profiil_id === (w && w.id) && p.lopp >= T);
    const extraOn = (s, wd) => ex.reduce((a, p) => a + (p.algus <= s && p.lopp >= s && (wd || p.algus === p.lopp) ? Number(p.tunnid || 0) : 0), 0);
    const days = []; const used = []; const d = new Date(T + 'T12:00:00');
    const ensure = (i) => { while (days.length <= i) { const s = iso(d); const wd = isWorkday(s), lvx = wd && onLeave(s); const x = dn && !lvx && ex.length ? extraOn(s, wd) : 0;
      days.push({ iso: s, wd, leave: lvx, extra: x, cap: dn && !lvx ? ((wd ? dn : 0) + x) * (s === T ? left : 1) : 0 }); used.push(0); d.setDate(d.getDate() + 1); } };
    const act = (o.order || orderRows(rows.filter((r) => ACTIVE.includes(r.staatus)))).filter((r) => ACTIVE.includes(r.staatus));
    const SM = o.seisMap || seisMap(o.seis, T);
    const jobs = []; let front = 0;
    const free = (i) => days[i].cap - used[i] > 1e-9;
    act.forEach((r) => {
      const norm = jaak(r);
      const j = { r, overdue: !!r.tahtaeg && r.tahtaeg < T };
      const mat = r.materjal_saabub && r.materjal_saabub > T ? r.materjal_saabub : null;   // materjal pole veel kohal
      if (mat) { j.mat = mat; }
      if (dn) {
        const blk = r.pink_id ? SM.get(r.pink_id) : null;
        ensure(front);
        while (!free(front) && front < 2000) { front++; ensure(front); }
        let i = front, h = norm, s = null;
        const ok = (k) => { ensure(k); return free(k) && !(blk && blk.has(days[k].iso)) && !(mat && days[k].iso < mat); };
        while (!ok(i) && i < 2000) i++;
        s = i + used[i] / days[i].cap;
        while (h > 1e-9 && i < 2000) {
          if (!ok(i)) { i++; continue; }
          const t = Math.min(days[i].cap - used[i], h); h -= t; used[i] += t;
          if (h > 1e-9) i++;
        }
        ensure(i);
        j.s = s;
        j.e = i + (days[i].cap ? used[i] / days[i].cap : 1);
        j.fin = days[i].iso;
        j.late = !!r.tahtaeg && j.fin > r.tahtaeg;
        j.lateDays = r.tahtaeg && j.late ? daysBetween(r.tahtaeg, j.fin) : 0;
      }
      jobs.push(j);
    });
    // mis tööd seisakute tõttu hilisemaks jäävad (võrdlus plaaniga ilma seisakuteta; ainult kui seisak puudutab mehe töid)
    if (dn && SM.size && !o.noBase && act.some((r) => r.pink_id && SM.has(r.pink_id))) {
      const base = plan(w, rows, Object.assign({}, o, { seisMap: new Map(), noBase: true }));
      const bf = new Map(base.jobs.map((b) => [b.r.id, b.fin]));
      jobs.forEach((j) => { const b = bf.get(j.r.id); if (b && j.fin && j.fin > b) { j.seis = true; j.seisDays = daysBetween(b, j.fin); } });
    }
    const last = jobs.reduce((m, j) => (j.fin && j.fin > m ? j.fin : m), '');
    const lastIdx = last ? days.findIndex((x) => x.iso === last) : 0;
    ensure(Math.max(o.minDays || 0, lastIdx + 1, front + 1));
    return { w, dn, days, jobs, total: act.reduce((a, r) => a + jaak(r), 0), free: dn ? (last || T) : null,
      overdue: jobs.filter((j) => j.overdue), risk: jobs.filter((j) => j.late && !j.overdue), seisMap: SM };
  }
  // seisakute mõju mehe plaanile: [{x: seisak, pink, n: mitu tööd lükkub, days: max lükkumine tööpäevades}]
  function seisMoju(w, rows, o) {
    o = o || {}; const T = today();
    const act = seisActive(o.seis, T); if (!act.length) return [];
    const pinks = new Set(rows.filter((r) => ACTIVE.includes(r.staatus) && r.pink_id).map((r) => r.pink_id));
    const rel = act.filter((x) => pinks.has(x.pink_id)); if (!rel.length) return [];
    const P = o.plan || plan(w, rows, o);
    return rel.map((x) => {
      let n = 0, mx = 0;
      P.jobs.forEach((j) => { if (j.seis && j.r.pink_id === x.pink_id) { n++; mx = Math.max(mx, j.seisDays || 0); } });
      return { x, n, days: mx, end: seisEnd(x, T) };
    });
  }
  function weeksN(n) {
    const d0 = new Date(today() + 'T12:00:00'); const mon = new Date(d0); mon.setDate(d0.getDate() - (d0.getDay() + 6) % 7);
    const out = [];
    for (let i = 0; i < n; i++) { const s = new Date(mon); s.setDate(mon.getDate() + i * 7); const e = new Date(s); e.setDate(s.getDate() + 6); out.push({ s: iso(s), e: iso(e) }); }
    return out;
  }
  const wIdx = (r, weeks) => { const t = r.tahtaeg; if (!t || t < weeks[0].s) return 0; return weeks.findIndex((x) => t >= x.s && t <= x.e); };
  function weekStats(P, weeks) {
    const T = today();
    const nW = weeks.map(() => 0), cW = weeks.map(() => 0); let later = 0;
    P.jobs.forEach((j) => { const i = wIdx(j.r, weeks); const h = jaak(j.r); if (i >= 0) nW[i] += h; else later += h; });
    const capMap = new Map(P.days.map((x) => [x.iso, x.cap]));
    weeks.forEach((x, i) => { for (let d = new Date(x.s + 'T12:00:00'); iso(d) <= x.e; d.setDate(d.getDate() + 1)) { const s = iso(d); if (s >= T) cW[i] += capMap.has(s) ? capMap.get(s) : (P.dn && isWorkday(s) ? P.dn : 0); } });
    let kn = 0, kc = 0; const slack = weeks.map((x, i) => { kn += nW[i]; kc += cW[i]; return kc - kn; });
    return { nW, cW, slack, later };
  }

  // pinnakatte varu (tööpäevi); pk = [{nimetus, varu_paevi}], vaikimisi seadetest
  function pkVaru(nimi, pk, vaike) {
    if (!nimi) return 0;
    const x = (pk || []).find((p) => String(p.nimetus || '').trim().toLowerCase() === String(nimi).trim().toLowerCase());
    const v = x && x.varu_paevi !== null && x.varu_paevi !== undefined ? Number(x.varu_paevi) : null;
    return v !== null && !Number.isNaN(v) ? v : (vaike !== undefined && vaike !== null ? vaike : PK_VAIKE);
  }
  // kõigi ridade prognoos: rows = tellimuse_read (vaja id, staatus, norm, tahtaeg, teostaja_id, jrk, pinnakate, allhange)
  // workers = töömehed (id, nadala_norm), o.lvs = puhkused, o.pk = pinnakatted, o.pkVaike, o.sinceAt = {id: iso} (millal pinnakattesse läks)
  function prognoos(rows, workers, o) {
    o = o || {}; const T = today(); const out = new Map(); const SM = seisMap(o.seis, T);
    const byW = new Map();
    rows.forEach((r) => { if (ACTIVE.includes(r.staatus) && r.teostaja_id && !r.allhange) { if (!byW.has(r.teostaja_id)) byW.set(r.teostaja_id, []); byW.get(r.teostaja_id).push(r); } });
    byW.forEach((list, wid) => {
      const w = (workers || []).find((x) => x.id === wid); if (!w || !w.nadala_norm) return;
      plan(w, list, { lvs: o.lvs, extra: o.extra, seisMap: SM }).jobs.forEach((j) => { out.set(j.r.id, { fin: j.fin, seis: !!j.seis, mat: j.mat || null }); });
    });
    rows.forEach((r) => {
      const varu = pkVaru(r.pinnakate, o.pk, o.pkVaike);
      let x = out.get(r.id), fin = null, how = '';
      if (x) { fin = x.fin; how = x.mat ? 'mat' : x.seis ? 'seisak' : 'plaan'; }
      else if (r.staatus === 'ok') { fin = T; how = 'ok'; }                       // tehtud, ootab edasi (pinnakate / valmis)
      else if (r.staatus === 'pinnakattes') { const s = (o.sinceAt && o.sinceAt[r.id]) || T; out.set(r.id, { fin: s, valmib: [addWorkdays(s, varu), T].sort()[1], pk: varu, how: 'pinnakattes' }); return; }
      if (!fin) return;
      const valmib = r.pinnakate && varu ? addWorkdays(fin, varu) : fin;
      out.set(r.id, { fin, valmib, pk: r.pinnakate ? varu : 0, how, mat: x && x.mat ? x.mat : null });
    });
    out.forEach((v, id) => { const r = rows.find((x) => x.id === id); v.late = !!(r && r.tahtaeg && v.valmib > r.tahtaeg); v.lateDays = v.late ? daysBetween(r.tahtaeg, v.valmib) : 0; });
    return out;
  }

  // korduvad tööd: tegelik aeg ajaloost (viimased kuni 5 tehtud korda, tegelik_aeg > 0)
  // normiga täpselt võrdsed jäetakse välja (tõenäoliselt "Nagu norm" nupp). ≥ 3 eri kogusega → seadistus + tükiaeg (lineaarne).
  function ajaloost(hist, kogus) {
    const all = (hist || []).filter((x) => Number(x.tegelik_aeg) > 0 && Number(x.kogus) > 0);
    const h = all.filter((x) => !(Number(x.norm) > 0 && Math.abs(Number(x.tegelik_aeg) - Number(x.norm)) < 0.01)).slice(0, 5);
    if (!h.length) return all.length ? { n: 0, skipped: all.length } : null;
    const t = h.reduce((a, x) => a + Number(x.tegelik_aeg), 0), q = h.reduce((a, x) => a + Number(x.kogus), 0), nn = h.reduce((a, x) => a + Number(x.norm || 0), 0);
    let a0 = 0, b = t / q, how = 'tk';
    if (new Set(h.map((x) => Number(x.kogus))).size >= 3) {
      const mq = q / h.length, mt = t / h.length;
      let sxy = 0, sxx = 0; h.forEach((x) => { const xq = Number(x.kogus) - mq; sxy += xq * (Number(x.tegelik_aeg) - mt); sxx += xq * xq; });
      const bb = sxx ? sxy / sxx : 0, aa = mt - bb * mq;
      if (bb > 0 && aa >= 0) { a0 = aa; b = bb; how = 'lin'; }
    }
    const k = Number(kogus) || 0;
    return { n: h.length, skipped: all.length - h.length, perPc: t / q, setup: a0, perPcLin: b, how, ratio: nn ? t / nn : null,
      est: k ? Math.round((a0 + b * k) * 10) / 10 : null, last: h[0] };
  }
  window.TelPlaan = { ajaloost, holidays, isWorkday, isoWeek, daysBetween, addWorkdays, todayLeft, EDD, jaak, orderRows, plan, seisMap, seisActive, seisEnd, seisMoju, weeksN, wIdx, weekStats, pkVaru, prognoos, ACTIVE, iso, today };
})();
