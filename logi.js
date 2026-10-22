// =============================================================================
// TEL 2.0 – muudatuste logi (sql 59, 22.10.2026)
// TelLogi.rida(sb, 'tellimused', id, el)  → hall rida "muutis Raimo 22.10 14:05" (klõps = ajalugu)
// TelLogi.ava(sb, 'tellimused', id, 'SO-7901') → selle kirje (ja ridade) muudatuste ajalugu
// TelLogi.koik(sb) → kõik muudatused (admin: Kontor → Muudatuste logi)
// Kiirus: rida = 1 väike päring (indeks), ajalugu laetakse alles klõpsul. Ilma sql 59-ta ei näidata midagi.
// =============================================================================
(function () {
  const TAB = { tellimused: 'tellimus', tellimuse_read: 'rida', arved: 'arve', arve_read: 'arve rida', saatelehed: 'saateleht', saatelehe_read: 'saatelehe rida',
    kanded: 'kanne', aj_arved: 'AJ-arve', ostuarved: 'ostuarve', profiilid: 'kasutaja' };
  const TABG = { tellimused: 'tellimuse', tellimuse_read: 'rea', arved: 'arve', arve_read: 'arve rea', saatelehed: 'saatelehe', saatelehe_read: 'saatelehe rea',
    kanded: 'kande', aj_arved: 'AJ-arve', ostuarved: 'ostuarve', profiilid: 'kasutaja' };   // lisas rea / kustutas tellimuse
  const TABP = { tellimused: 'Tellimused', arved: 'Müügiarved', saatelehed: 'Saatelehed', kanded: 'Kanded', aj_arved: 'AJ-arved', ostuarved: 'Ostuarved', profiilid: 'Kasutajad' };
  const VALI = { nimetus: 'nimetus', kogus: 'kogus', uhik: 'ühik', tk_hind: 'tk hind', hind: 'hind', ostuhind: 'ostuhind', tahtaeg: 'tähtaeg', tarneaeg: 'tarneaeg',
    materjal_id: 'materjal', materjali_hind: 'materjal €/tk', norm: 'norm', tegelik_aeg: 'tegelik aeg', pink_id: 'pink', teostaja_id: 'teostaja', allhange: 'allhange',
    allhankija: 'allhankija', pinnakate: 'pinnakate', pinnakatte_hind: 'pinnakatte hind', staatus: 'staatus', markused: 'märkused', markus: 'märkus', revisjon: 'revisjon',
    tarnitud: 'tarnitud', arvel: 'arvel', arvele: 'arvele', tehtud_pct: 'tehtud %', materjal_saabub: 'materjal saabub', klient_id: 'klient', kontakt_id: 'ostja',
    kliendi_tellimus: 'kliendi tellimus', kuupaev: 'kuupäev', maksetahtaeg: 'maksetähtaeg', olek: 'olek', summa: 'summa', summa_neto: 'summa neto', summa_km: 'KM',
    tasutud: 'tasutud', saadetud: 'saadetud', km_liik: 'KM liik', km_maar: 'KM %', keel: 'keel', pohjus: 'põhjus', roll: 'roll', aktiivne: 'aktiivne',
    pohipalk: 'põhipalk', normtunni_tasu: 'normtunni tasu', nadala_norm: 'nädala norm', kp: 'kuupäev', liik: 'liik', kontolt_id: 'kontolt', kontole_id: 'kontole',
    pdf_tee: 'PDF', step_tee: 'STEP', joonis_id: 'joonis', laost: 'laost', jrk_lukus: 'järjekord lukus', ohk: 'õhk', pakke: 'pakke', rida_id: 'töö nr' };
  const NIMED = { teostaja_id: 'profiilid', loonud: 'profiilid', looja: 'profiilid', pink_id: 'pingid', klient_id: 'kliendid', materjal_id: 'materjalid' };
  const ST = { cam: 'CAM', toos: 'Töös', ok: 'Pingilt OK', pinnakattes: 'Pinnakattes', allhankes: 'Allhankes', valmis: 'Valmis', koostamisel: 'koostamisel', valjastatud: 'väljastatud', tuhistatud: 'tühistatud' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const aeg = (iso) => { const d = new Date(iso), y = d.getFullYear() !== new Date().getFullYear(); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + (y ? '.' + d.getFullYear() : '') + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  let pole = false;           // sql 59 käivitamata või pole õigust → vaikselt mitte midagi
  const vahemalu = new Map();  // 'tabel:id' → viimane kirje
  const nimed = {};            // tabel → Map(id → nimi)

  function css() {
    if (document.getElementById('telLogiCss')) return;
    const s = document.createElement('style'); s.id = 'telLogiCss';
    s.textContent =
      '.tl-r{background:none;border:0;padding:0 4px;font:inherit;font-size:12px;font-weight:400;color:var(--muted,#6F6F6F);cursor:pointer;white-space:nowrap;height:auto}' +
      '.tl-r:hover{color:var(--accent,#0F62FE);text-decoration:underline}' +
      '.tl-bg{position:fixed;inset:0;background:rgba(22,22,22,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px}' +
      '.tl-w{background:var(--panel,#fff);color:var(--ink,#161616);width:100%;max-width:820px;max-height:86vh;display:flex;flex-direction:column;border:1px solid var(--line2,#C6C6C6);box-shadow:0 8px 28px rgba(0,0,0,.25)}' +
      '.tl-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line,#E0E0E0)}.tl-h b{font-size:16px;flex-grow:1}' +
      '.tl-h button,.tl-f button{height:32px;padding:0 12px;border:1px solid var(--line2,#C6C6C6);background:var(--panel,#fff);font:inherit;font-size:13px;cursor:pointer}' +
      '.tl-f{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px;border-bottom:1px solid var(--line,#E0E0E0)}.tl-f select,.tl-f input{height:32px;border:1px solid var(--line2,#C6C6C6);padding:0 8px;font:inherit;font-size:13px;min-width:0}.tl-f input{flex:1 1 160px}' +
      '.tl-b{overflow:auto;padding:4px 16px 14px}.tl-e{display:grid;grid-template-columns:96px 110px 1fr;gap:2px 10px;padding:7px 0;border-bottom:1px solid var(--line,#E0E0E0);font-size:13px;line-height:1.45}' +
      '.tl-e .t{color:var(--muted,#6F6F6F);font-variant-numeric:tabular-nums}.tl-e .k{font-weight:600;overflow:hidden;text-overflow:ellipsis}.tl-e .m b{font-weight:600}' +
      '.tl-e .v{color:var(--muted,#6F6F6F)}.tl-e .del{color:#DA1E28}.tl-e .add{color:#198038}.tl-e details{margin-top:2px}.tl-e summary{cursor:pointer;color:var(--muted,#6F6F6F);font-size:12px}' +
      '.tl-e pre{white-space:pre-wrap;font-size:12px;margin:4px 0 0;background:var(--bg,#F4F4F4);padding:6px 8px}.tl-e a{color:var(--accent,#0F62FE)}' +
      '.tl-x{padding:20px 0;color:var(--muted,#6F6F6F)}' +
      '@media(max-width:600px){.tl-bg{padding:12px}.tl-e{grid-template-columns:1fr auto}.tl-e .m{grid-column:1/-1}}';
    document.head.appendChild(s);
  }

  async function lae(sb, need) {   // id → nimi, ainult vajalikud tabelid, üks kord lehe kohta
    const puudu = [...new Set(need)].filter((t) => !nimed[t]);
    await Promise.all(puudu.map(async (t) => {
      const { data } = await sb.from(t).select(t === 'materjalid' ? 'id,nimi:nimetus' : 'id,nimi').limit(1000);
      nimed[t] = new Map((data || []).map((x) => [String(x.id), x.nimi]));
    }));
  }
  function v(k, x) {
    if (x === null || x === undefined || x === '') return '–';
    if (typeof x === 'boolean') return x ? 'jah' : 'ei';
    if (NIMED[k] && nimed[NIMED[k]]) return nimed[NIMED[k]].get(String(x)) || String(x);
    if (k === 'staatus' || k === 'olek') return ST[x] || x;
    if (typeof x === 'number') return String(Math.round(x * 1000) / 1000).replace('.', ',');
    if (typeof x === 'object') return JSON.stringify(x);
    const s = String(x);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('.');
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return aeg(s);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  }
  const nimi = (k) => VALI[k] || k.replace(/_id$/, '').replace(/_/g, ' ');
  function kirjeTxt(e, pea) {   // "rida DET-A (töö 40012)"
    if (e.tabel === pea) return '';
    const t = TAB[e.tabel] || e.tabel;
    return t + (e.silt ? ' <b>' + esc(e.silt) + '</b>' : '') + (e.tabel === 'tellimuse_read' ? ' (töö ' + esc(e.kirje_id) + ')' : '');
  }
  function sisu(e, pea) {
    const kt = kirjeTxt(e, pea);
    const kg = (TABG[e.tabel] || e.tabel) + (e.silt ? ' <b>' + esc(e.silt) + '</b>' : '') + (e.tabel === 'tellimuse_read' ? ' (töö ' + esc(e.kirje_id) + ')' : '');
    if (e.tegevus === 'I') return e.tabel === pea || !pea && e.tabel === e.pea_tabel ? '<span class="add">lõi</span> ' + kg : '<span class="add">lisas</span> ' + kg;
    if (e.tegevus === 'D') {
      const m = e.muutus || {};
      return '<span class="del">kustutas</span> ' + kg +
        '<details><summary>kustutatud kirje</summary><pre>' + esc(Object.keys(m).filter((k) => m[k] !== null && m[k] !== '').map((k) => nimi(k) + ': ' + v(k, m[k])).join('\n')) + '</pre></details>';
    }
    const m = e.muutus || {};
    return (kt ? kt + ': ' : '') + Object.keys(m).map((k) => nimi(k) + ' <span class="v">' + esc(v(k, m[k][0])) + ' →</span> <b>' + esc(v(k, m[k][1])) + '</b>').join('; ');
  }
  function needNames(list) {
    const t = [];
    list.forEach((e) => Object.keys(e.muutus || {}).forEach((k) => { if (NIMED[k]) t.push(NIMED[k]); }));
    return t;
  }
  function aken(pealk, filtrid) {
    css();
    const bg = document.createElement('div'); bg.className = 'tl-bg';
    bg.innerHTML = '<div class="tl-w" role="dialog" aria-label="' + esc(pealk) + '"><div class="tl-h"><b>' + esc(pealk) + '</b><button type="button" data-x>Sulge</button></div>' +
      (filtrid || '') + '<div class="tl-b"><div class="tl-x">Laen…</div></div></div>';
    const sulge = () => { bg.remove(); document.removeEventListener('keydown', esc1); };
    const esc1 = (e) => { if (e.key === 'Escape') sulge(); };
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) sulge(); });
    document.addEventListener('keydown', esc1);
    document.body.appendChild(bg);
    return bg;
  }
  const rida1 = (e, pea, link) => '<div class="tl-e"><span class="t">' + aeg(e.aeg) + '</span><span class="k" title="' + esc(e.kes_nimi || '') + '">' + esc(e.kes_nimi || 'süsteem') + '</span>' +
    '<span class="m">' + (link ? link(e) : '') + sisu(e, pea) + '</span></div>';

  async function rida(sb, tabel, id, el, force) {
    if (!el || !id || pole) { if (el) el.innerHTML = ''; return; }
    const key = tabel + ':' + id;
    let e = force ? undefined : vahemalu.get(key);
    if (e === undefined) {
      const { data, error } = await sb.from('muudatuste_logi').select('aeg,kes_nimi,tegevus').eq('pea_tabel', tabel).eq('pea_id', String(id))
        .order('aeg', { ascending: false }).order('id', { ascending: false }).limit(1);
      if (error) { pole = true; el.innerHTML = ''; return; }
      e = (data || [])[0] || null; vahemalu.set(key, e);
    }
    css();
    el.innerHTML = e ? '<button type="button" class="tl-r" title="Muudatuste ajalugu">' + (e.tegevus === 'I' ? 'lõi ' : 'muutis ') + esc(e.kes_nimi || 'süsteem') + ' ' + aeg(e.aeg) + '</button>' : '';
    const b = el.querySelector('button'); if (b) b.onclick = () => ava(sb, tabel, id, el.dataset.pealk || '');
  }

  async function ava(sb, tabel, id, pealk) {
    const bg = aken('Muudatuste ajalugu' + (pealk ? ' – ' + pealk : ''));
    const box = bg.querySelector('.tl-b');
    const { data, error } = await sb.from('muudatuste_logi').select('*').eq('pea_tabel', tabel).eq('pea_id', String(id))
      .order('aeg', { ascending: false }).order('id', { ascending: false }).limit(500);
    if (error) { box.innerHTML = '<div class="tl-x">' + esc(/muudatuste_logi/.test(error.message) ? 'Muudatuste logi pole veel sisse lülitatud (sql 59).' : error.message) + '</div>'; return; }
    await lae(sb, needNames(data || []));
    box.innerHTML = (data || []).length ? data.map((e) => rida1(e, tabel)).join('') + (data.length === 500 ? '<div class="tl-x">Näidatakse viimased 500.</div>' : '')
      : '<div class="tl-x">Muudatusi pole (logi alates sql 59 käivitamisest).</div>';
  }

  async function koik(sb) {
    const f = '<div class="tl-f"><select data-f="t"><option value="">Kõik</option>' + Object.entries(TABP).map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select>' +
      '<select data-f="k"><option value="">Kõik kasutajad</option></select><select data-f="g"><option value="">Kõik tegevused</option><option value="U">muutis</option><option value="I">lisas</option><option value="D">kustutas</option></select>' +
      '<input data-f="q" type="search" placeholder="Otsi: detail, nr, nimi, töö nr"></div>';
    const bg = aken('Muudatuste logi', f), box = bg.querySelector('.tl-b');
    const S = { lim: 200 };
    const { data: pr } = await sb.from('profiilid').select('id,nimi').order('nimi');
    bg.querySelector('[data-f=k]').insertAdjacentHTML('beforeend', (pr || []).map((p) => '<option value="' + p.id + '">' + esc(p.nimi) + '</option>').join(''));
    const link = (e) => {
      const u = e.pea_tabel === 'tellimused' ? 'tellimused.html?id=' : e.pea_tabel === 'arved' ? 'arved.html?id=' : null;
      const t = (TAB[e.pea_tabel] || e.pea_tabel);
      return '<a href="#" data-pt="' + esc(e.pea_tabel) + '" data-pi="' + esc(e.pea_id) + '" title="Selle kirje kogu ajalugu">' + esc(t) + '</a>' +
        (u && e.tegevus !== 'D' ? ' <a href="' + u + encodeURIComponent(e.pea_id) + '" title="Ava">↗</a>' : '') + ' · ';
    };
    async function lae2() {
      const g = (k) => bg.querySelector('[data-f=' + k + ']').value.trim();
      let q = sb.from('muudatuste_logi').select('*').order('aeg', { ascending: false }).order('id', { ascending: false }).limit(S.lim);
      if (g('t')) q = q.eq('pea_tabel', g('t'));
      if (g('k')) q = q.eq('kes', g('k'));
      if (g('g')) q = q.eq('tegevus', g('g'));
      const s = g('q');
      if (s) { const t = s.replace(/[%,()*]/g, ' ').trim(); q = /^\d+$/.test(t) ? q.or('kirje_id.eq.' + t + ',silt.ilike.*' + t + '*') : q.ilike('silt', '%' + t + '%'); }   // töö nr või detail / nr / nimi
      box.innerHTML = '<div class="tl-x">Laen…</div>';
      const { data, error } = await q;
      if (error) { box.innerHTML = '<div class="tl-x">' + esc(/muudatuste_logi/.test(error.message) ? 'Muudatuste logi pole veel sisse lülitatud (sql 59).' : error.message) + '</div>'; return; }
      await lae(sb, needNames(data || []));
      box.innerHTML = (data || []).length ? data.map((e) => rida1(e, '', link)).join('') + (data.length === S.lim ? '<div class="tl-x"><button type="button" data-more>Näita veel</button></div>' : '')
        : '<div class="tl-x">Muudatusi pole.</div>';
    }
    let tmr = null;
    bg.querySelector('.tl-f').addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { S.lim = 200; lae2(); }, 300); });
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-more]')) { S.lim += 300; lae2(); return; }
      const a = e.target.closest('[data-pt]'); if (a) { e.preventDefault(); ava(sb, a.dataset.pt, a.dataset.pi, (TAB[a.dataset.pt] || '') + ' ' + a.dataset.pi); }
    });
    lae2();
  }

  const unusta = (tabel, id) => vahemalu.delete(tabel + ':' + id);   // pärast salvestamist / uuesti avamist
  window.TelLogi = { rida, ava, koik, unusta };
})();
