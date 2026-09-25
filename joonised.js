/* TEL 2.0 – jooniste sidumine tellimuse redaktoris ("Seo joonised").
   Laetakse alles nupuvajutusel. Kasutus: TelJoonised.open({ sb, O, L, toast, onDone })
   1) OneDrive'i jooniste kaust (brauser jätab meelde) → tellimuse kaust ("SO-7906 …" / "TEST-7906 …")
   2) iga rea PDF + STEP nimetuse järgi (revisjon failinimest "…-REV_B")
   3) PDF-i nurgatemplist materjal ja pinnakate, STEP-ist gabariit + keerukus, materjali hind (tihedus × €/kg)
   4) ülevaatus → PDF + pisipilt üles (nagu joonised.py), read täidetakse; automaatsed väärtused märgitakse (auto_valjad) → kollane */
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nrm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.,/]/g, '');
  const n2 = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
  const toNum = (v) => { const t = String(v ?? '').trim(); if (!t) return null; const n = Number(t.replace(/\s/g, '').replace(',', '.')); return Number.isNaN(n) ? undefined : n; };
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  function loadPdfjs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = PDFJS + 'pdf.min.js'; sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(); }; sc.onerror = () => bad(new Error('PDF-i lugejat ei saanud laadida')); document.head.appendChild(sc); });
  }

  // ---------------- kausta valik (Chrome/Edge: File System Access API, meeldejääv; muidu kausta üleslaadimise aken)
  const IDB = { get(k) { return new Promise((ok) => { try { const r = indexedDB.open('tel2', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }; r.onerror = () => ok(null); } catch (e) { ok(null); } }); },
    set(k, v) { return new Promise((ok) => { try { const r = indexedDB.open('tel2', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(true); t.onerror = () => ok(false); }; r.onerror = () => ok(false); } catch (e) { ok(false); } }); } };
  const hasFS = () => typeof window.showDirectoryPicker === 'function';
  async function rootHandle(forceNew) {
    let h = forceNew ? null : await IDB.get('joonisteKaust');
    if (h) { try { let p = await h.queryPermission({ mode: 'read' }); if (p !== 'granted') p = await h.requestPermission({ mode: 'read' }); if (p === 'granted') return h; } catch (e) { /* uuesti valima */ } }
    h = await window.showDirectoryPicker({ id: 'tel-joonised', mode: 'read' });
    await IDB.set('joonisteKaust', h); return h;
  }
  const orderRx = (nr) => { const m = String(nr || '').match(/(\d+)\s*$/); return m ? new RegExp('^(SO|TEST)[-_ ]?' + m[1] + '(?!\\d)', 'i') : null; };
  async function findOrderDir(root, nr) {
    const rx = orderRx(nr); if (!rx) return null;
    const lvl = [root];
    for (let depth = 0; depth < 3 && lvl.length; depth++) {   // tellimuse kaust ülemkaustas või kuni 2 taset sügavamal (nt aasta kaust)
      const next = [];
      for (const d of lvl) for await (const [name, h] of d.entries()) { if (h.kind !== 'directory') continue; if (rx.test(name)) return h; if (depth < 2 && next.length < 400) next.push(h); }
      lvl.splice(0, lvl.length, ...next);
    }
    return null;
  }
  async function listFiles(dir, base, out) {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') await listFiles(h, base + name + '/', out);
      else if (/\.(pdf|step|stp)$/i.test(name)) out.push({ name, path: base + name, get: () => h.getFile() });
    }
    return out;
  }
  function pickFolderInput() {   // tagavara: <input webkitdirectory> (Firefox jm) – vali tellimuse kaust
    return new Promise((ok) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true; inp.style.display = 'none'; inp.id = 'tjDirInput';
      inp.onchange = () => { const fs = [...inp.files].filter((f) => /\.(pdf|step|stp)$/i.test(f.name)); const top = (inp.files[0]?.webkitRelativePath || '').split('/')[0];
        ok({ dirName: top, files: fs.map((f) => ({ name: f.name, path: f.webkitRelativePath || f.name, get: async () => f, lm: f.lastModified })) }); inp.remove(); };
      inp.addEventListener('cancel', () => { ok(null); inp.remove(); });
      document.body.appendChild(inp); inp.click();
    });
  }

  // ---------------- failide sobitamine ridadega
  const revOf = (name, nimetus) => {
    const m = name.match(/rev[_\- ]?([a-z0-9]{1,3})(?=[^a-z0-9]|$)/i); if (m) return m[1].toUpperCase();
    const s = name.replace(/\.[^.]+$/, ''); const i = s.toLowerCase().indexOf(String(nimetus).toLowerCase());
    if (i < 0) return null; const r = s.slice(i + String(nimetus).length).replace(/^[\s\-_.]+/, ''); return /^[a-z0-9]{1,3}$/i.test(r) ? r.toUpperCase() : null;
  };
  function pickFile(files, r, ext) {
    const key = nrm(r.nimetus); if (key.length < 3) return null;
    const c = files.filter((f) => ext.test(f.name) && nrm(f.name.replace(/\.[^.]+$/, '')).includes(key));
    if (!c.length) return null;
    const rv = (r.revisjon || '').toUpperCase();
    const same = rv ? c.filter((f) => revOf(f.name, r.nimetus) === rv) : [];
    const pool = same.length ? same : c;
    pool.sort((a, b) => (revOf(b.name, r.nimetus) || '').localeCompare(revOf(a.name, r.nimetus) || '') || (b.lm || 0) - (a.lm || 0));
    return pool[0];
  }

  // ---------------- PDF: nurgatempli väljad (silt → väärtus sildi all), pisipilt, räsi
  const TB = { mat: /^(material|materjal|werkstoff)\s*:?$/i, pk: /^(surface\s*treatment|oberfl(ä|ae)chenbehandlung|pinnakate|finish|coating)\s*:?$/i };
  function tbField(items, rx) {
    const L = items.find((t) => rx.test(t.str.trim())); if (!L) return '';
    const below = items.filter((t) => t !== L && t.y < L.y - 2 && t.y > L.y - 30 && t.x >= L.x - 12 && t.x < L.x + 60);
    if (!below.length) return '';
    const y = Math.max(...below.map((t) => t.y));
    return below.filter((t) => Math.abs(t.y - y) < 2.5).sort((a, b) => a.x - b.x).map((t) => t.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
  }
  async function readPdf(file) {
    const buf = await file.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const doc = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    const items = tc.items.filter((t) => t.str && t.str.trim()).map((t) => ({ str: t.str, x: t.transform[4], y: t.transform[5] }));
    const vp0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: 480 / vp0.width });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const jpg = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.8));
    const res = { hash, buf, jpg, lehti: doc.numPages, mat: tbField(items, TB.mat), pk: tbField(items, TB.pk) };
    doc.destroy(); return res;
  }

  // ---------------- STEP: gabariit (tipud + ringjooned + splainid), tahkude arv → keerukus
  function stepAnalyze(text) {
    const i0 = text.indexOf('DATA;'); const body = i0 >= 0 ? text.slice(i0 + 5) : text;
    const E = new Map(); const re = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/g; let m, faces = 0, edges = 0;
    const KEEP = new Set(['CARTESIAN_POINT', 'VERTEX_POINT', 'CIRCLE', 'AXIS2_PLACEMENT_3D', 'DIRECTION', 'B_SPLINE_CURVE_WITH_KNOTS', 'CYLINDRICAL_SURFACE']);
    while ((m = re.exec(body))) { const t = m[2]; if (t === 'ADVANCED_FACE' || t === 'FACE_SURFACE') faces++; else if (t === 'EDGE_CURVE') edges++; if (KEEP.has(t)) E.set(m[1], [t, m[3]]); }
    let scale = 1; const um = /SI_UNIT\s*\(\s*\.?(\w*)\.?\s*,\s*\.METRE\./.exec(text);
    if (um) scale = um[1] === 'MILLI' ? 1 : um[1] === 'CENTI' ? 10 : 1000;
    if (/CONVERSION_BASED_UNIT\s*\(\s*'INCH'/i.test(text)) scale = 25.4;
    const nums = (s) => (s.replace(/'[^']*'/g, '').replace(/#\d+/g, '').match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(Number);
    const refs = (s) => (s.match(/#(\d+)/g) || []).map((x) => x.slice(1));
    const pt = (id) => { const e = E.get(id); if (!e || e[0] !== 'CARTESIAN_POINT') return null; const n = nums(e[1]); return n.length >= 3 ? n.slice(0, 3) : null; };
    const dir = (id) => { const e = E.get(id); if (!e || e[0] !== 'DIRECTION') return null; const n = nums(e[1]); if (n.length < 3) return null; const L = Math.hypot(n[0], n[1], n[2]) || 1; return n.slice(0, 3).map((v) => v / L); };
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const add = (p, r) => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - (r ? r[k] : 0)); hi[k] = Math.max(hi[k], p[k] + (r ? r[k] : 0)); } };
    let maxCyl = 0;
    for (const [, [t, a]] of E) {
      if (t === 'VERTEX_POINT') { const p = pt(refs(a)[0]); if (p) add(p); }
      else if (t === 'CIRCLE') { const r = nums(a).pop(); const A = E.get(refs(a)[0]); if (!A || !r) continue; const [c, z] = refs(A[1]); const p = pt(c); const n = dir(z) || [0, 0, 1]; if (p) add(p, n.map((v) => r * Math.sqrt(Math.max(0, 1 - v * v)))); }
      else if (t === 'B_SPLINE_CURVE_WITH_KNOTS') { const lst = a.match(/\(([^()]*#[^()]*)\)/); if (lst) refs(lst[1]).forEach((id) => { const p = pt(id); if (p) add(p); }); }
      else if (t === 'CYLINDRICAL_SURFACE') { const r = nums(a).pop(); if (r > maxCyl) maxCyl = r; }
    }
    if (!isFinite(lo[0])) return null;
    const dims = [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * scale * 10) / 10).sort((a, b) => a - b);
    let cyl = null; const R = maxCyl * scale;
    if (R > 0) {
      if (dims[0] / dims[1] > 0.95 && Math.abs(dims[1] - 2 * R) / dims[1] < 0.03) cyl = { d: Math.round(2 * R * 10) / 10, l: dims[2] };
      else if (dims[1] / dims[2] > 0.95 && Math.abs(dims[2] - 2 * R) / dims[2] < 0.03) cyl = { d: Math.round(2 * R * 10) / 10, l: dims[0] };
    }
    // keerukus 1–10: tahkude arv logaritmiliselt (6 tahku = 1, iga kahekordistus +1) – ainult soovitus
    const keerukus = faces ? Math.max(1, Math.min(10, Math.round(Math.log2(faces / 6)) + 1)) : null;
    return { dims, cyl, faces, edges, keerukus };
  }

  // ---------------- materjal ja pinnakate: nimi / analoogid, siis märksõnad (analyze_parts.py / marksoned.xlsx)
  const MAT_KAT = [['Roostevaba teras', /\b(1\.4\d{3}|AISI\s*3[01]\d|inox|stainless|roostevaba|A[24][- ]?[78]0)\b/i], ['Messing', /\b(CuZn\w*|CW61[47]N|MS\s*58|brass|messing|bronze)\b/i],
    ['Alumiinium', /\b(EN\s*AW[- ]?\d{4}|AW[- ]?\d{4}|Al\s*Mg\w*|AlCu\w*|AlSi\w*|AlZn\w*|3\.\d{4}|6061|6082|7075|5083|5754|aluminium|aluminum)\b/i],
    ['Teras', /\b(S235|S275|S355|C45|C60|CK\d+|1\.0\d{3}|1\.1\d{3}|steel|teras)\b/i], ['Plastik', /\b(POM|PA\s*6{1,2}|PTFE|PEEK|PE[- ]?HD|HDPE|PVC|plastic|nylon)\b/i]];
  const PK_KAT = [['anood', /anod|elox/i], ['kromaat', /chromat|kromaat/i], ['nikkel', /nickel|nikkel/i], ['tsink', /\bzn\b|zinc|verzink|galvan|tsink/i], ['värv', /paint|pulver|powder|ral\s*\d{4}|värv/i]];
  function matchMat(raw, mats) {
    if (!raw) return { id: null, hint: '' };
    const parts = [raw, ...raw.split(/\s+-\s+|\s*\/\s*|\s*;\s*/)].map(nrm).filter((x) => x.length >= 2);
    const act = mats.filter((m) => m.aktiivne !== false);
    for (const p of parts) { const m = act.find((x) => nrm(x.nimetus) === p || (x.analoogid || []).some((a) => nrm(a) === p)); if (m) return { id: m.id, hint: '' }; }
    const k = MAT_KAT.find(([, rx]) => rx.test(raw)); return { id: null, hint: k ? k[0] + '?' : '' };
  }
  function matchPk(raw, pks) {
    if (!raw || /^[-–—]?$/.test(raw.trim()) || /^(none|ohne|keine|puudub)$/i.test(raw.trim())) return { name: null, hint: '' };
    const n = nrm(raw); const act = pks.filter((p) => p.aktiivne !== false);
    const ex = act.find((p) => nrm(p.nimetus) === n || (p.analoogid || []).some((a) => nrm(a) === n)); if (ex) return { name: ex.nimetus, hint: '' };
    const k = PK_KAT.find(([, rx]) => rx.test(raw)); if (!k) return { name: null, hint: '' };
    let c = act.filter((p) => k[1].test(p.nimetus) || (p.analoogid || []).some((x) => k[1].test(x)) || (k[0] === 'anood' && /anood/i.test(p.nimetus)));
    if (k[0] === 'anood' && c.length > 1) { const blk = /black|schwarz|must/i.test(raw); const c2 = c.filter((p) => (blk ? /must|black/i : /hall|natur|clear|hõbe/i).test(p.nimetus)); if (c2.length) c = c2; }
    return c.length === 1 ? { name: c[0].nimetus, hint: 'märksõna' } : { name: null, hint: k[0] + '?' };
  }
  function matPrice(mat, g) {   // €/tk valmis detaili gabariidist + lisavaru (plaat A×B×L või ümarvarras)
    if (!mat || !mat.tihedus || !mat.hind_kg || !g) return null;
    const v = g.cyl ? Math.PI / 4 * (g.cyl.d + 2 * g.va) ** 2 * (g.cyl.l + 2 * g.va) : g.dims.reduce((a, d) => a * (d + 2 * g.va), 1);
    return Math.round(v / 1e9 * mat.tihedus * 1000 * mat.hind_kg * 100) / 100;   // tihedus kg/dm³ → kg/m³
  }

  // ---------------- peafunktsioon
  async function open(o) {
    const { sb, O, L, toast } = o;
    const rows = O.rows.filter((r) => r.id && (r.nimetus || '').trim());
    if (!O.id || !rows.length) return toast('Salvesta tellimus enne jooniste sidumist', true);
    const bg = document.createElement('div'); bg.className = 'tj-bg';
    bg.innerHTML = '<div class="tj" role="dialog" aria-label="Seo joonised"><header><b>Seo joonised – ' + esc(O.nr) + '</b><button type="button" data-x aria-label="Sulge">×</button></header><div class="mb" id="tjBody"><div class="tjmsg">Vali OneDrive\'is jooniste ülemkaust (kus on tellimuste kaustad "SO-…"). Brauser jätab selle meelde.</div>' +
      '<div class="tjbtns"><button type="button" class="primary" id="tjGo">' + (hasFS() ? 'Otsi tellimuse kaustast' : 'Vali tellimuse kaust') + '</button>' + (hasFS() ? '<button type="button" class="btn" id="tjNew">Vali muu ülemkaust</button><button type="button" class="btn" id="tjDir">Vali otse tellimuse kaust</button>' : '') + '</div></div></div>';
    document.body.appendChild(bg);
    const q = (id) => bg.querySelector('#' + id); const close = () => bg.remove();
    bg.querySelectorAll('[data-x]').forEach((b) => (b.onclick = close));
    const status = (t) => { q('tjBody').innerHTML = '<div class="tjmsg">' + t + '</div>'; };
    const start = async (mode) => {
      let files = null, dirName = '';
      try {
        if (!hasFS() || mode === 'input') { const r = await pickFolderInput(); if (!r) return; files = r.files; dirName = r.dirName; }
        else if (mode === 'dir') { const d = await window.showDirectoryPicker({ id: 'tel-tellimus', mode: 'read' }); dirName = d.name; status('Loen faile…'); files = await listFiles(d, d.name + '/', []); }
        else {
          const root = await rootHandle(mode === 'new'); status('Otsin kausta ' + esc(O.nr) + '…');
          const d = await findOrderDir(root, O.nr);
          if (!d) { status('Kausta, mille nimi algab "' + esc(O.nr) + '" (või SO-/TEST- sama numbriga), ei leitud kaustas "' + esc(root.name) + '".<div class="tjbtns"><button type="button" class="primary" id="tjDir2">Vali tellimuse kaust käsitsi</button></div>'); q('tjDir2').onclick = () => start('dir'); return; }
          dirName = d.name; status('Loen faile kaustast ' + esc(d.name) + '…'); files = await listFiles(d, d.name + '/', []);
        }
      } catch (e) { if (e && e.name === 'AbortError') return; status('Kausta ei saanud lugeda: ' + esc(e.message || e)); return; }
      for (const f of files) if (f.lm === undefined) { try { f.lm = (await f.get()).lastModified; } catch (e) { f.lm = 0; } }
      await analyse(files, dirName);
    };
    q('tjGo').onclick = () => start('root'); if (q('tjNew')) q('tjNew').onclick = () => start('new'); if (q('tjDir')) q('tjDir').onclick = () => start('dir');

    let R = [];
    async function analyse(files, dirName) {
      status('Loen jooniseid ja STEP-e… (' + files.length + ' faili)');
      try { await loadPdfjs(); } catch (e) { status(esc(e.message)); return; }
      R = [];
      for (const r of rows) {
        const pf = pickFile(files, r, /\.pdf$/i), sf = pickFile(files, r, /\.(step|stp)$/i);
        const x = { r, pf, sf, rev: (pf && revOf(pf.name, r.nimetus)) || (sf && revOf(sf.name, r.nimetus)) || null };
        try { if (pf) x.pdf = await readPdf(await pf.get()); } catch (e) { x.err = 'PDF: ' + e.message; }
        try { if (sf) x.step = stepAnalyze(await (await sf.get()).text()); } catch (e) { x.err = (x.err ? x.err + '; ' : '') + 'STEP: ' + e.message; }
        const mm = matchMat(x.pdf?.mat, L.materjalid), pm = matchPk(x.pdf?.pk, L.pk || []);
        x.mat = { raw: x.pdf?.mat || '', id: mm.id, hint: mm.hint, auto: !!mm.id };
        x.pk = { raw: x.pdf?.pk || '', name: pm.name, hint: pm.hint, auto: !!pm.name };
        x.gab = x.step ? x.step.dims.slice() : null; x.keer = x.step?.keerukus ?? null;
        R.push(x);
        q('tjBody').querySelector('.tjmsg').textContent = 'Loen… ' + R.length + ' / ' + rows.length;
      }
      review(dirName, files.length);
    }
    const VA_KEY = 'tel2.tj.lisavaru';
    function review(dirName, nFiles) {
      let va = 0; try { va = Number(localStorage.getItem(VA_KEY)) || 0; } catch (e) { /* */ }
      const mOpts = (id) => '<option value="">–</option>' + L.materjalid.filter((m) => m.aktiivne !== false || m.id === id).map((m) => '<option value="' + m.id + '"' + (m.id === id ? ' selected' : '') + '>' + esc(m.nimetus) + '</option>').join('');
      const pOpts = (n) => '<option value="">–</option>' + (L.pk || []).filter((p) => p.aktiivne !== false || p.nimetus === n).map((p) => '<option' + (p.nimetus === n ? ' selected' : '') + '>' + esc(p.nimetus) + '</option>').join('');
      const found = R.filter((x) => x.pf || x.sf).length;
      q('tjBody').innerHTML = '<div class="tjmsg">Kaust <b>' + esc(dirName) + '</b>: ' + nFiles + ' faili, leitud ' + found + ' / ' + R.length + ' reale. <span class="tjy">Kollane</span> = leitud automaatselt – kontrolli. Real juba olemas olevaid väärtusi üle ei kirjutata, v.a kui valid siin ise uue.</div>' +
        '<div class="tjtw"><table class="tjt"><thead><tr><th><input type="checkbox" id="tjAll" checked aria-label="Kõik"></th><th>Rida</th><th>Joonis</th><th>Rev</th><th>Materjal <small>(joonisel)</small></th><th>Pinnakate <small>(joonisel)</small></th><th>Gabariit, mm</th><th>Keer.</th><th>Mat. €/tk</th></tr></thead><tbody>' +
        R.map((x, i) => {
          const r = x.r; const has = !!(x.pf || x.sf);
          return '<tr data-i="' + i + '"' + (has ? '' : ' class="miss"') + '><td><input type="checkbox" data-ok="' + i + '"' + (has ? ' checked' : ' disabled') + '></td>' +
            '<td><b>' + esc(r.nimetus) + '</b>' + (r.revisjon ? ' <small>rev ' + esc(r.revisjon) + '</small>' : '') + '</td>' +
            '<td class="tjf">' + (x.pf ? '📄 ' + esc(x.pf.name) : '<span class="tjno">PDF puudu</span>') + '<br>' + (x.sf ? '🧊 ' + esc(x.sf.name) : '<span class="tjno">STEP puudu</span>') + (x.err ? '<br><span class="tjno">' + esc(x.err) + '</span>' : '') + '</td>' +
            '<td>' + esc(x.rev || '') + (x.rev && r.revisjon && x.rev !== String(r.revisjon).toUpperCase() ? ' <span class="tjno" title="Tellimuses on teine revisjon">≠ ' + esc(r.revisjon) + '</span>' : '') + '</td>' +
            '<td><select data-f="mat" data-i="' + i + '" class="' + (x.mat.auto ? 'au' : x.mat.raw ? 'need' : '') + '">' + mOpts(x.mat.id) + '</select><small title="Joonisel">' + esc(x.mat.raw || '') + (x.mat.hint ? ' · ' + esc(x.mat.hint) : '') + '</small>' + (r.materjal_id && r.materjal_id !== x.mat.id ? '<small>praegu: ' + esc((L.materjalid.find((m) => m.id === r.materjal_id) || {}).nimetus || '') + '</small>' : '') + '</td>' +
            '<td><select data-f="pk" data-i="' + i + '" class="' + (x.pk.auto ? 'au' : x.pk.raw ? 'need' : '') + '">' + pOpts(x.pk.name) + '</select><small>' + esc(x.pk.raw || '') + (x.pk.hint && !x.pk.name ? ' · ' + esc(x.pk.hint) : '') + '</small>' + (r.pinnakate && r.pinnakate !== x.pk.name ? '<small>praegu: ' + esc(r.pinnakate) + '</small>' : '') + '</td>' +
            '<td><input data-f="gab" data-i="' + i + '" class="' + (x.gab ? 'au' : '') + '" value="' + esc(x.gab ? x.gab.map(n2).join('×') : '') + '" placeholder="–">' + (x.step?.cyl ? '<small>Ø' + n2(x.step.cyl.d) + ' × ' + n2(x.step.cyl.l) + '</small>' : '') + '</td>' +
            '<td><input data-f="keer" data-i="' + i + '" class="num' + (x.keer ? ' au' : '') + '" value="' + esc(x.keer || '') + '" title="Soovitus tahkude arvu järgi (' + (x.step?.faces || 0) + ' tahku)"></td>' +
            '<td class="mono tjp" data-p="' + i + '"></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="tjopt"><label title="Lisatakse igast küljest gabariidile (toorik on suurem kui valmis detail)">Tooriku lisavaru, mm <input id="tjVa" class="num" value="' + n2(va) + '"></label>' +
        '<label><input type="checkbox" id="tjHind" checked> Täida materjali hind, kui rea hind on tühi</label>' +
        '<label><input type="checkbox" id="tjLearn" checked> Jäta käsitsi valitud materjalid/pinnakatted meelde (lisatakse analoogideks)</label></div>' +
        '<div class="err" id="tjErr"></div>';
      bg.querySelector('.tj').insertAdjacentHTML('beforeend', '<div class="ft"><button type="button" data-x>Tühista</button><button type="button" class="primary" id="tjOk">Kinnita ja seo</button></div>');
      bg.querySelectorAll('[data-x]').forEach((b) => (b.onclick = close));
      const price = () => { const v = toNum(q('tjVa').value) || 0; R.forEach((x, i) => { const mid = x.r.materjal_id && !x.mat.manual ? x.r.materjal_id : x.mat.id; const m = L.materjalid.find((y) => y.id === mid); const p = x.gab && x.gab.length === 3 ? matPrice(m, { dims: x.gab, cyl: x.step?.cyl && x.gab.join() === x.step.dims.join() ? x.step.cyl : null, va: v }) : null; x.price = p; const td = bg.querySelector('[data-p="' + i + '"]'); if (td) td.textContent = p !== null ? n2(p) : ''; }); };
      price();
      bg.addEventListener('change', (e) => {
        const t = e.target; const i = Number(t.dataset.i); const x = R[i];
        if (t.id === 'tjAll') { bg.querySelectorAll('[data-ok]:not(:disabled)').forEach((c) => (c.checked = t.checked)); return; }
        if (t.id === 'tjVa') { try { localStorage.setItem(VA_KEY, String(toNum(t.value) || 0)); } catch (er) { /* */ } price(); return; }
        if (!x) return;
        if (t.dataset.f === 'mat') { x.mat.id = Number(t.value) || null; x.mat.auto = false; x.mat.manual = true; t.className = ''; price(); }
        if (t.dataset.f === 'pk') { x.pk.name = t.value || null; x.pk.auto = false; x.pk.manual = true; t.className = ''; }
        if (t.dataset.f === 'gab') { const d = t.value.split(/[x×*\s;]+/i).map(toNum).filter((v) => v > 0); x.gab = d.length === 3 ? d.sort((a, b) => a - b) : null; x.gabManual = true; t.className = ''; price(); }
        if (t.dataset.f === 'keer') { const k = Math.round(toNum(t.value) || 0); x.keer = k >= 1 && k <= 10 ? k : null; x.keerManual = true; t.className = 'num'; }
      });
      q('tjOk').onclick = () => apply();
    }

    async function apply() {
      const err = (m) => { q('tjErr').textContent = m; };
      const sel = R.filter((x, i) => bg.querySelector('[data-ok="' + i + '"]')?.checked);
      if (!sel.length) return err('Midagi pole valitud.');
      q('tjOk').disabled = true; err('');
      const fillPrice = q('tjHind').checked, learn = q('tjLearn').checked;
      try {
        // olemasolevad joonised räsi järgi (1 päring), siis puuduvad üles
        const hashes = [...new Set(sel.filter((x) => x.pdf).map((x) => x.pdf.hash))];
        const known = new Map();
        if (hashes.length) { const { data, error } = await sb.from('joonised').select('id,rasi').in('rasi', hashes); if (error) throw error; (data || []).forEach((j) => known.set(j.rasi, j.id)); }
        let up = 0, n = 0;
        for (const x of sel) {
          q('tjOk').textContent = 'Seon… ' + (++n) + ' / ' + sel.length;
          const r = x.r; const upd = {}; const auto = new Set(r.auto_valjad || []);
          if (x.pdf) {
            let jid = known.get(x.pdf.hash);
            if (!jid) {
              const st = sb.storage.from('joonised');
              let e1 = (await st.upload(x.pdf.hash + '.pdf', new Blob([x.pdf.buf], { type: 'application/pdf' }), { upsert: true, contentType: 'application/pdf' })).error; if (e1) throw e1;
              e1 = (await st.upload(x.pdf.hash + '.jpg', x.pdf.jpg, { upsert: true, contentType: 'image/jpeg' })).error; if (e1) throw e1;
              const { data, error } = await sb.from('joonised').insert({ rasi: x.pdf.hash, pdf_path: x.pdf.hash + '.pdf', pisipilt_path: x.pdf.hash + '.jpg', failinimi: x.pf.name, suurus: x.pdf.buf.byteLength, lehti: x.pdf.lehti }).select('id').single();
              if (error) throw error; jid = data.id; known.set(x.pdf.hash, jid); up++;
            }
            upd.joonis_id = jid; upd.pdf_tee = x.pf.path;
          }
          if (x.sf) upd.step_tee = x.sf.path;
          if (x.rev && !r.revisjon) upd.revisjon = x.rev;
          if (x.mat.id && (!r.materjal_id || x.mat.manual)) { upd.materjal_id = x.mat.id; if (x.mat.manual) auto.delete('materjal'); else auto.add('materjal'); }
          if (x.pk.name && (!r.pinnakate || x.pk.manual)) { upd.pinnakate = x.pk.name; if (x.pk.manual) auto.delete('pinnakate'); else auto.add('pinnakate'); }
          if (x.gab && !o.noV27 && (r.paksus == null || x.gabManual)) { [upd.paksus, upd.laius, upd.pikkus] = x.gab; if (x.gabManual) auto.delete('gabariit'); else auto.add('gabariit'); }
          if (x.keer && !o.noV27 && (r.keerukus == null || x.keerManual)) { upd.keerukus = x.keer; if (x.keerManual) auto.delete('keerukus'); else auto.add('keerukus'); }
          if (fillPrice && x.price != null && r.materjali_hind == null) { upd.materjali_hind = x.price; auto.add('materjali_hind'); }
          if (!o.noV32) upd.auto_valjad = [...auto];
          if (Object.keys(upd).length) { const { error } = await sb.from('tellimuse_read').update(upd).eq('id', r.id); if (error) throw error; }
        }
        // õpi: käsitsi valitud väärtus → joonisel olnud tekst analoogiks
        if (learn) {
          const addAn = async (table, id, key, list, raw) => { const cur = list || []; if (!raw || cur.some((a) => nrm(a) === nrm(raw))) return; const { error } = await sb.from(table).update({ analoogid: cur.concat(raw) }).eq(key, id); if (!error) list?.push?.(raw); };
          for (const x of sel) {
            if (x.mat.manual && x.mat.id && x.mat.raw) { const m = L.materjalid.find((y) => y.id === x.mat.id); if (m) { m.analoogid = m.analoogid || []; await addAn('materjalid', m.id, 'id', m.analoogid, x.mat.raw); } }
            if (x.pk.manual && x.pk.name && x.pk.raw && !o.noV32) { const p = (L.pk || []).find((y) => y.nimetus === x.pk.name); if (p && p.id !== undefined) { p.analoogid = p.analoogid || []; await addAn('pinnakatted', p.id, 'id', p.analoogid, x.pk.raw); } }
          }
        }
        close(); toast(sel.length + ' rida seotud' + (up ? ', ' + up + ' joonist üles laetud' : '') + '. Kollased väärtused kontrolli üle.');
        if (o.onDone) o.onDone();
      } catch (e) { q('tjOk').disabled = false; q('tjOk').textContent = 'Kinnita ja seo'; err('Viga: ' + (e.message || e) + (/auto_valjad/.test(e.message || '') ? ' (käivita sql/32)' : '')); }
    }
  }

  const CSS = `
  .tj-bg { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .tj { width: 100%; max-width: 1180px; max-height: calc(100dvh - 32px); display: flex; flex-direction: column; background: #fff; border: 1px solid #161616; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #161616; }
  .tj header { background: #161616; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .tj header button { background: transparent; border: none; color: #fff; font-size: 22px; width: 32px; height: 32px; cursor: pointer; }
  .tj .mb { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; overflow: auto; min-height: 0; flex-grow: 1; }
  .tj .ft { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #E0E0E0; }
  .tj .ft button, .tj .tjbtns button { height: 40px; padding: 0 16px; border: 1px solid #C6C6C6; background: #fff; font-weight: 600; cursor: pointer; font-family: inherit; }
  .tj .primary { background: #0F62FE !important; color: #fff; border: none !important; }
  .tj .ft .primary { flex-grow: 1; } .tj .primary:disabled { opacity: .6; }
  .tj .err { color: #DA1E28; font-size: 13px; min-height: 16px; }
  .tj .mono { font-family: 'IBM Plex Mono', monospace; }
  .tj .tjmsg { font-size: 13px; color: #393939; }
  .tj .tjbtns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .tj .tjtw { overflow: auto; max-height: calc(100dvh - 330px); border: 1px solid #E0E0E0; }
  .tj table.tjt { border-collapse: collapse; width: 100%; font-size: 13px; }
  .tj .tjt th { position: sticky; top: 0; background: #E0E0E0; text-align: left; padding: 6px; font-size: 12px; white-space: nowrap; z-index: 1; }
  .tj .tjt td { padding: 5px 6px; border-bottom: 1px solid #E0E0E0; vertical-align: top; }
  .tj .tjt tr.miss td { color: #8D8D8D; }
  .tj .tjt small { display: block; color: #6F6F6F; font-size: 11px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tj .tjt select, .tj .tjt input:not([type=checkbox]) { height: 30px; border: 1px solid #C6C6C6; background: #fff; padding: 0 6px; font-size: 13px; max-width: 190px; }
  .tj .tjt input[data-f=gab] { width: 120px; font-family: 'IBM Plex Mono', monospace; } .tj .tjt input.num { width: 48px; text-align: right; }
  .tj .au, .tj .tjy { background: #FFF4C2 !important; border-color: #F1C21B !important; }
  .tj .tjy { padding: 0 4px; border: 1px solid; }
  .tj .need { border-color: #DA1E28 !important; }
  .tj .tjf { font-size: 12px; max-width: 280px; word-break: break-all; }
  .tj .tjno { color: #DA1E28; font-size: 12px; }
  .tj .tjopt { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; font-size: 13px; }
  .tj .tjopt label { display: flex; gap: 6px; align-items: center; }
  .tj .tjopt input.num { width: 56px; height: 30px; border: 1px solid #C6C6C6; padding: 0 6px; text-align: right; }`;
  if (!document.getElementById('tj-css')) { const st = document.createElement('style'); st.id = 'tj-css'; st.textContent = CSS; document.head.appendChild(st); }
  window.TelJoonised = { open, stepAnalyze, matchMat, matchPk };
})();
