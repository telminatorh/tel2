// =============================================================================
// TEL 2.0 – jooniste printimine (sql 56, 21.10.2026)
// TelPrint.prindi(sb, read, o) → laeb valitud ridade joonised (Storage "joonised"),
// lisab IGA lehe ülaserva riba (QR + tellimus, detail, kogus, tähtaeg, norm, pink,
// materjal, pinnakate, teostaja) ja paneb kõik üheks PDF-iks. Joonist ennast ei kata:
// leht tehakse riba võrra kõrgemaks. Kõik toimub brauseris (pdf-lib), server ei muutu.
// QR = link tootaja.html?rida=ID → avab töö kaardi (telefoni kaamera või Tööde "Skänni").
// =============================================================================
(function () {
  const LIB = {
    pdf: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    scan: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
  };
  const loaded = {};
  function lae(k) {
    if (!loaded[k]) loaded[k] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIB[k]; s.onload = res;
      s.onerror = () => { loaded[k] = null; rej(new Error('Ei saanud laadida ' + LIB[k] + ' (internet?)')); };
      document.head.appendChild(s);
    });
    return loaded[k];
  }
  const pad = (n) => String(n).padStart(2, '0');
  const dmy = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '–';
  const f1 = (n) => (Math.round(Number(n || 0) * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '');
  // Helvetica (WinAnsi) – eesti tähed on olemas; muu (nt →, ≈) asendatakse
  const OK = /[\x20-\x7E\xA0-\xFFŠšŽžŒœŸƒ–—‘’‚“”„†‡•…‰‹›€™]/;
  const safe = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').split('').map((c) => OK.test(c) ? c : c === '≈' ? '~' : c === '→' ? '>' : '?').join('');
  function fit(font, s, size, w) {
    s = safe(s);
    if (font.widthOfTextAtSize(s, size) <= w) return s;
    while (s.length > 1 && font.widthOfTextAtSize(s + '…', size) > w) s = s.slice(0, -1);
    return s + '…';
  }
  const qrUrl = (base, id) => base + (base.includes('?') ? '&' : '?') + 'rida=' + id;

  // riba ühe lehe ülaossa (y0 = joonise ülaserv)
  function riba(PL, page, r, o, y0, W, H, leht, lehti, F, B) {
    const { rgb } = PL;
    page.drawRectangle({ x: 0, y: y0, width: W, height: H, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: 0, y: y0 + 0.5 }, end: { x: W, y: y0 + 0.5 }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    const m = Math.max(5, H * 0.11), q = H - 2 * m;
    // QR (vektor, terav igas suuruses)
    const qr = window.qrcode(0, 'M'); qr.addData(qrUrl(o.base, r.id)); qr.make();
    const n = qr.getModuleCount(), cell = q / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (qr.isDark(i, j)) {
      page.drawRectangle({ x: m + j * cell, y: y0 + m + (n - 1 - i) * cell, width: cell + 0.05, height: cell + 0.05, color: rgb(0, 0, 0) });
    }
    // parem plokk: KOGUS suurelt + tähtaeg
    const s1 = H * 0.3, s2 = H * 0.19, s3 = H * 0.15;
    const kog = safe(f1(r.kogus) + ' ' + (r.uhik || 'tk'));
    const tt = safe('tähtaeg ' + dmy(r.tahtaeg));
    const rw = Math.max(B.widthOfTextAtSize(kog, s1 * 1.15), B.widthOfTextAtSize(tt, s2));
    const xr = W - m - rw;
    page.drawText(kog, { x: W - m - B.widthOfTextAtSize(kog, s1 * 1.15), y: y0 + H - m - s1 * 1.05, size: s1 * 1.15, font: B });
    page.drawText(tt, { x: W - m - B.widthOfTextAtSize(tt, s2), y: y0 + m + s3 * 1.35, size: s2, font: B, color: o.late && o.late(r) ? rgb(0.85, 0.12, 0.16) : rgb(0, 0, 0) });
    const pr = safe('prinditud ' + o.paev + (lehti > 1 ? ' · leht ' + leht + '/' + lehti : ''));
    page.drawText(pr, { x: W - m - F.widthOfTextAtSize(pr, s3), y: y0 + m * 0.55, size: s3, font: F, color: rgb(0.4, 0.4, 0.4) });
    // vasak plokk: tellimus + detail, siis andmed
    const x0 = m + q + m * 1.6, tw = xr - x0 - m * 2;
    const l1 = (r.tel || '') + '  ' + (r.nimetus || '') + (r.revisjon ? '  rev ' + r.revisjon : '');
    page.drawText(fit(B, l1, s1, tw), { x: x0, y: y0 + H - m - s1 * 1.05, size: s1, font: B });
    const l2 = ['norm ' + f1(r.norm) + ' h', r.pink, r.mat, r.pinnakate ? 'pinnakate: ' + r.pinnakate : '', r.teostaja].filter(Boolean).join('  ·  ');
    page.drawText(fit(F, l2, s2, tw), { x: x0, y: y0 + m + s3 * 1.35, size: s2, font: F });
    const l3 = [r.klient && o.klient ? r.klient : '', r.kt ? 'kliendi tell. ' + r.kt : '', 'töö nr ' + r.id].filter(Boolean).join('  ·  ');
    page.drawText(fit(F, l3, s3, tw), { x: x0, y: y0 + m * 0.55, size: s3, font: F, color: rgb(0.4, 0.4, 0.4) });
  }

  async function prindi(sb, read, o) {
    o = Object.assign({ base: new URL('tootaja.html', location.href).href, klient: false, onProgress: null }, o || {});
    const d = new Date(); o.paev = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    await Promise.all([lae('pdf'), lae('qr')]);
    const PL = window.PDFLib;
    const skip = [], ok = [];
    const withPdf = read.filter((r) => { if (!r.pdf_path) skip.push({ r, why: 'joonis sidumata' }); return !!r.pdf_path; });
    if (!withPdf.length) return { bytes: null, ok, skip };
    // allkirjastatud lingid korraga (100 kaupa)
    const urls = {};
    const paths = [...new Set(withPdf.map((r) => r.pdf_path))];
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await sb.storage.from('joonised').createSignedUrls(paths.slice(i, i + 100), 600);
      if (error) throw error;
      (data || []).forEach((x) => { if (x.signedUrl) urls[x.path] = x.signedUrl; });
    }
    // failid alla (4 korraga), sama fail ainult üks kord
    const bytes = {}; let done = 0;
    const queue = paths.slice();
    await Promise.all([0, 1, 2, 3].map(async () => {
      while (queue.length) {
        const p = queue.shift();
        try { if (!urls[p]) throw new Error('link puudub'); const res = await fetch(urls[p]); if (!res.ok) throw new Error('HTTP ' + res.status); bytes[p] = await res.arrayBuffer(); }
        catch (e) { console.warn('joonis', p, e); bytes[p] = e; }
        done++; if (o.onProgress) o.onProgress(done, paths.length);
      }
    }));
    const out = await PL.PDFDocument.create();
    out.setTitle('Joonised ' + o.paev); out.setCreator('TEL 2.0');
    const F = await out.embedFont(PL.StandardFonts.Helvetica), B = await out.embedFont(PL.StandardFonts.HelveticaBold);
    const docs = {};
    for (const r of withPdf) {
      const b = bytes[r.pdf_path];
      if (!b || b instanceof Error) { skip.push({ r, why: 'faili ei saanud alla laadida' }); continue; }
      try {
        if (!docs[r.pdf_path]) docs[r.pdf_path] = await PL.PDFDocument.load(b, { ignoreEncryption: true });
        const src = docs[r.pdf_path], N = src.getPageCount();
        const emb = await out.embedPdf(src, [...Array(N).keys()]);
        emb.forEach((e, i) => {
          const rot = ((src.getPage(i).getRotation().angle % 360) + 360) % 360;
          const w = e.width, h = e.height, side = rot === 90 || rot === 270;
          const W = side ? h : w, Hh = side ? w : h;
          const H = Math.round(Math.min(76, Math.max(52, Math.min(W, Hh) * 0.08)));
          const pg = out.addPage([W, Hh + H]);
          const deg = PL.degrees;
          if (rot === 90) pg.drawPage(e, { x: 0, y: w, rotate: deg(-90) });
          else if (rot === 180) pg.drawPage(e, { x: w, y: h, rotate: deg(180) });
          else if (rot === 270) pg.drawPage(e, { x: h, y: 0, rotate: deg(90) });
          else pg.drawPage(e, { x: 0, y: 0 });
          riba(PL, pg, r, o, Hh, W, H, i + 1, N, F, B);
        });
        ok.push(r.id);
      } catch (e) { console.warn('PDF', r.pdf_path, e); skip.push({ r, why: 'fail pole loetav PDF' }); }
    }
    return { bytes: ok.length ? await out.save() : null, ok, skip };
  }

  // PDF kasutajale: arvutis uude aknasse (sealt Prindi), telefonis allalaadimine.
  // win = aken, mis avati kohe nupuvajutusel (muidu blokeerib brauser hüpikakna).
  function ava(bytes, nimi, win) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    if (win && !win.closed) { win.location.href = url; }
    else { const a = document.createElement('a'); a.href = url; a.download = nimi || 'joonised.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  }
  // telefonis/tahvlis pole hüpikakent mõtet avada – laeme alla
  const mobiil = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // prinditud märge: mis on pärast printimist muutunud (kogus/tähtaeg/norm/revisjon/joonis)? null = paber kehtib
  function muutus(r) {
    const p = r.prindid; if (!p || !p.info) return null;
    const i = p.info, num = (x) => (x == null || x === '' ? null : Number(x)), m = [];
    if (num(i.kogus) !== num(r.kogus)) m.push('kogus');
    if ((i.tahtaeg || null) !== (r.tahtaeg || null)) m.push('tähtaeg');
    if (num(i.norm) !== num(r.norm)) m.push('norm');
    if ((i.revisjon || null) !== (r.revisjon || null)) m.push('revisjon');
    else if (num(i.joonis_id) !== num(r.joonis_id)) m.push('joonis');
    return m.length ? m : null;
  }
  const vana = (r) => !!muutus(r);
  // read prinditud (sql 56) – snapshot tehakse andmebaasis; tagastab vea või null
  async function margi(sb, ids) {
    if (!ids.length) return null;
    const { error } = await sb.rpc('read_prinditud', { p_ids: ids });
    return error || null;
  }

  // QR-i skännimine kaameraga (Skänni nupp). Tagastab leitud teksti või null (suletud).
  const CSS = '.scan-bg{position:fixed;inset:0;z-index:100;background:#000;display:flex;flex-direction:column}' +
    '.scan-bg video{flex:1;min-height:0;width:100%;object-fit:cover}' +
    '.scan-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));color:#fff;background:#161616;font-size:16px}' +
    '.scan-top button{width:44px;height:44px;border:1px solid #6F6F6F;background:transparent;color:#fff;font-size:20px}' +
    '.scan-box{position:absolute;left:50%;top:50%;width:min(64vw,300px);height:min(64vw,300px);transform:translate(-50%,-40%);border:3px solid #fff;border-radius:12px;box-shadow:0 0 0 100vmax rgba(0,0,0,.35);pointer-events:none}' +
    '.scan-hint{position:absolute;left:0;right:0;bottom:calc(28px + env(safe-area-inset-bottom,0px));text-align:center;color:#fff;font-size:14px;text-shadow:0 1px 3px #000;padding:0 16px}';
  function css() { if (document.getElementById('telPrintCss')) return; const st = document.createElement('style'); st.id = 'telPrintCss'; st.textContent = CSS; document.head.appendChild(st); }
  async function skanni(pealkiri) {
    css();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Selles brauseris kaamerat ei saa kasutada (vaja https ja uuemat brauserit)');
    const native = 'BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats().catch(() => [])).includes('qr_code');
    if (!native) await lae('scan');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { throw new Error(e && e.name === 'NotAllowedError' ? 'Kaamera luba puudub – luba brauseri seadetes' : 'Kaamerat ei saanud avada (' + (e && e.message || e) + ')'); }
    return new Promise((resolve) => {
      const bg = document.createElement('div'); bg.className = 'scan-bg';
      bg.innerHTML = '<div class="scan-top"><b>' + (pealkiri || 'Skänni joonise QR') + '</b><button type="button" data-x aria-label="Sulge">✕</button></div>' +
        '<video playsinline muted autoplay></video><div class="scan-box"></div><div class="scan-hint">Suuna kaamera joonise ülaservas olevale QR-koodile</div>';
      document.body.appendChild(bg);
      const v = bg.querySelector('video'); v.srcObject = stream;
      const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      const det = native ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      let stop = false;
      const fin = (val) => { if (stop) return; stop = true; stream.getTracks().forEach((t) => t.stop()); bg.remove(); resolve(val); };
      bg.querySelector('[data-x]').onclick = () => fin(null);
      const tick = async () => {
        if (stop) return;
        if (v.readyState >= 2) {
          try {
            if (det) { const c = await det.detect(v); if (c && c[0]) { try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} return fin(c[0].rawValue); } }
            else {
              const w = v.videoWidth, h = v.videoHeight, s = Math.min(1, 800 / Math.max(w, h));
              cv.width = Math.round(w * s); cv.height = Math.round(h * s); cx.drawImage(v, 0, 0, cv.width, cv.height);
              const c = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
              if (c && c.data) { try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} return fin(c.data); }
            }
          } catch (e) { /* järgmine kaader */ }
        }
        setTimeout(() => requestAnimationFrame(tick), det ? 120 : 60);
      };
      tick();
    });
  }
  // QR tekstist rea id (ka käsitsi sisestatud number)
  function ridaId(txt) {
    if (!txt) return null;
    const m = String(txt).match(/[?&]rida=(\d+)/) || String(txt).trim().match(/^(\d+)$/);
    return m ? Number(m[1]) : null;
  }

  window.TelPrint = { prindi, ava, mobiil, vana, muutus, margi, skanni, ridaId, lae };
})();
