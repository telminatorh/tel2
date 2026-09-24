// TEL 2.0 – ühine tööde plaan ja prognoos (Tööd, Ülevaade, Tellimused)
// Kasutus: <script src="plaan.js"></script>   →   window.TelPlaan
//
//   TelPlaan.plan(w, rows, { lvs, minDays, order })  – ühe töömehe plaan (vt allpool)
//   TelPlaan.prognoos(rows, workers, { lvs, pk, sinceAt })  – Map(rea id → { fin, valmib, late, lateDays, pk, ... })
//
// Reeglid: tööd mehe järjekorras (jrk; seadmata tööd tähtaja järgi õigesse kohta), päeva võimsus = nädala norm / 5
// tööpäeval (riigipühad ja puhkused = 0). TÄNA arvestatakse ainult järelejäänud tööaeg (vaikimisi 8:00–16:30).
// Pinnakattega detailile liidetakse pinnakatte varu (tööpäevi, muudetav Kontor → Pinnakatted).
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

  const EDD = (a, b) => String(a.tahtaeg || '9999').localeCompare(String(b.tahtaeg || '9999')) || (b.staatus === 'toos') - (a.staatus === 'toos') || a.id - b.id;
  function orderRows(act) {
    const ranked = act.filter((r) => r.jrk !== null && r.jrk !== undefined).sort((a, b) => a.jrk - b.jrk || a.id - b.id);
    const rest = act.filter((r) => r.jrk === null || r.jrk === undefined).sort(EDD);
    const out = ranked.slice();
    rest.forEach((r) => { const i = out.findIndex((x) => (x.tahtaeg || '9999') > (r.tahtaeg || '9999')); if (i < 0) out.push(r); else out.splice(i, 0, r); });
    return out;
  }

  // ühe mehe plaan
  function plan(w, rows, o) {
    o = o || {};
    const T = today(); const left = todayLeft();
    const lv = (o.lvs || []).filter((p) => p.profiil_id === (w && w.id));
    const dn = w && w.nadala_norm ? Number(w.nadala_norm) / 5 : 0;
    const onLeave = (s) => lv.some((p) => p.algus <= s && p.lopp >= s);
    const days = []; const d = new Date(T + 'T12:00:00');
    const ensure = (i) => { while (days.length <= i) { const s = iso(d); const wd = isWorkday(s), lvx = wd && onLeave(s); days.push({ iso: s, wd, leave: lvx, cap: dn && wd && !lvx ? dn * (s === T ? left : 1) : 0 }); d.setDate(d.getDate() + 1); } };
    const act = (o.order || orderRows(rows.filter((r) => ACTIVE.includes(r.staatus)))).filter((r) => ACTIVE.includes(r.staatus));
    const jobs = []; let di = 0, used = 0;
    act.forEach((r) => {
      const norm = Number(r.norm || 0);
      const j = { r, overdue: !!r.tahtaeg && r.tahtaeg < T };
      if (dn) {
        ensure(di);
        while (days[di].cap - used <= 1e-9 && di < 2000) { di++; used = 0; ensure(di); }
        j.s = di + used / days[di].cap;
        let h = norm;
        while (h > 1e-9 && di < 2000) { ensure(di); const av = days[di].cap - used; if (av <= 1e-9) { di++; used = 0; continue; } const t = Math.min(av, h); h -= t; used += t; }
        ensure(di);
        j.e = di + (days[di].cap ? used / days[di].cap : 1);
        j.fin = days[di].iso;
        j.late = !!r.tahtaeg && j.fin > r.tahtaeg;
        j.lateDays = r.tahtaeg && j.late ? daysBetween(r.tahtaeg, j.fin) : 0;
      }
      jobs.push(j);
    });
    ensure(Math.max(o.minDays || 0, di + 1));
    return { w, dn, days, jobs, total: act.reduce((a, r) => a + Number(r.norm || 0), 0), free: dn ? (jobs.length ? jobs[jobs.length - 1].fin : T) : null,
      overdue: jobs.filter((j) => j.overdue), risk: jobs.filter((j) => j.late && !j.overdue) };
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
    P.jobs.forEach((j) => { const i = wIdx(j.r, weeks); if (i >= 0) nW[i] += Number(j.r.norm || 0); else later += Number(j.r.norm || 0); });
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
    o = o || {}; const T = today(); const out = new Map();
    const byW = new Map();
    rows.forEach((r) => { if (ACTIVE.includes(r.staatus) && r.teostaja_id && !r.allhange) { if (!byW.has(r.teostaja_id)) byW.set(r.teostaja_id, []); byW.get(r.teostaja_id).push(r); } });
    byW.forEach((list, wid) => {
      const w = (workers || []).find((x) => x.id === wid); if (!w || !w.nadala_norm) return;
      plan(w, list, { lvs: o.lvs }).jobs.forEach((j) => { out.set(j.r.id, { fin: j.fin }); });
    });
    rows.forEach((r) => {
      const varu = pkVaru(r.pinnakate, o.pk, o.pkVaike);
      let x = out.get(r.id), fin = null, how = '';
      if (x) { fin = x.fin; how = 'plaan'; }
      else if (r.staatus === 'ok') { fin = T; how = 'ok'; }                       // tehtud, ootab edasi (pinnakate / valmis)
      else if (r.staatus === 'pinnakattes') { const s = (o.sinceAt && o.sinceAt[r.id]) || T; out.set(r.id, { fin: s, valmib: [addWorkdays(s, varu), T].sort()[1], pk: varu, how: 'pinnakattes' }); return; }
      if (!fin) return;
      const valmib = r.pinnakate && varu ? addWorkdays(fin, varu) : fin;
      out.set(r.id, { fin, valmib, pk: r.pinnakate ? varu : 0, how });
    });
    out.forEach((v, id) => { const r = rows.find((x) => x.id === id); v.late = !!(r && r.tahtaeg && v.valmib > r.tahtaeg); v.lateDays = v.late ? daysBetween(r.tahtaeg, v.valmib) : 0; });
    return out;
  }

  window.TelPlaan = { holidays, isWorkday, isoWeek, daysBetween, addWorkdays, todayLeft, EDD, orderRows, plan, weeksN, wIdx, weekStats, pkVaru, prognoos, ACTIVE, iso, today };
})();
