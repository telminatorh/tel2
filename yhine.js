// TEL 2.0 – ühised abid kõigile lehtedele (10.11.2026, ülevaatuse parandused B1–B5)
//   TelYhine.viga(e)            → arusaadav veateade nimekirja kohale (+ „Proovi uuesti“), mitte tühi nimekiri ega toores inglise tekst
//   TelYhine.yhendus(sb, e)     → profiili ei saanud lugeda (võrk / server): EI logi välja, näitab „Proovi uuesti“
//   TelYhine.oigus(sb, me, t)   → vale roll sellele lehele: EI logi välja, näitab „Avalehele“
//   TelYhine.seanss(e, status)  → true, kui viga tähendab aegunud seanssi (siis on õige uuesti sisse logida)
//   TelYhine.kord(fn)           → nupu käsitleja, mis ei käivitu teist korda enne, kui esimene on lõpetanud (topeltklõps)
//   TelYhine.lahkumine(fn)      → brauseri hoiatus lehelt lahkumisel, kui fn() ütleb, et on salvestamata muudatusi
// Laeb nav.js (kontorilehed); tootaja.html, index.html ja ekraan.html otse. Lehed töötavad ka ilma selle failita (vana käitumine).
(function () {
  if (window.TelYhine) return;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const msgOf = (e) => String((e && (e.message || e.error_description || e.msg)) || e || '');
  function liik(e, status) {
    const m = msgOf(e), c = (e && e.code) || '';
    if (status === 401 || c === 'PGRST301' || /JWT|token is expired|invalid claim|session_not_found/i.test(m)) return 'seanss';
    if (c === '42501' || status === 403) return 'oigus';
    if (/Failed to fetch|NetworkError|Load failed|ERR_INTERNET|network|timeout/i.test(m) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'vork';
    return 'server';
  }
  const TXT = {
    vork: 'Serveriga ei saanud ühendust. Kontrolli internetiühendust ja proovi uuesti.',
    server: 'Server andis vea. Proovi mõne hetke pärast uuesti.',
    seanss: 'Seanss on aegunud. Laadi leht uuesti ja logi sisse.',
    oigus: 'Sul pole selle vaatamiseks õigust.'
  };
  const BTN = 'height:38px;padding:0 16px;border:1px solid #8D8D8D;background:#fff;color:#161616;font:inherit;font-weight:600;cursor:pointer';
  // veateade nimekirja asemel – andmed EI ole kadunud, neid lihtsalt ei saanud laadida
  function viga(e, status) {
    const k = liik(e, status), m = msgOf(e);
    return '<div class="empty tel-viga" role="alert" style="padding:36px 16px;text-align:center;color:#161616">' +
      '<div style="font-weight:700;font-size:16px;color:#A2191F">⚠ Andmeid ei saanud laadida</div>' +
      '<div style="margin:6px 0 14px">' + TXT[k] + '</div>' +
      '<button type="button" style="' + BTN + '" onclick="location.reload()">Proovi uuesti</button>' +
      (m ? '<div style="margin-top:12px;font-size:12px;color:#6F6F6F">Tehniline teade: ' + esc(m.slice(0, 300)) + '</div>' : '') + '</div>';
  }
  // terve lehe peatus (sisselogimise järel), ilma välja logimata
  function peatus(pealkiri, tekst, nupud, detail) {
    let el = document.getElementById('telPeatus'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'telPeatus'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', pealkiri);
    el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F4F4F4;display:flex;align-items:center;justify-content:center;padding:20px;font-family:\'IBM Plex Sans\',system-ui,sans-serif;color:#161616';
    el.innerHTML = '<div style="width:100%;max-width:420px;background:#fff;border:1px solid #E0E0E0;padding:26px">' +
      '<div style="font-family:\'IBM Plex Mono\',ui-monospace,monospace;font-weight:600;margin-bottom:14px">TEL 2.0</div>' +
      '<h1 style="margin:0 0 8px;font-size:20px">' + esc(pealkiri) + '</h1><p style="margin:0 0 18px;line-height:1.45">' + tekst + '</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' + nupud.map((n, i) => '<button type="button" data-i="' + i + '" style="' + BTN + (n.pea ? ';background:#0F62FE;border-color:#0F62FE;color:#fff' : '') + ';height:44px;flex:1 1 auto">' + esc(n.t) + '</button>').join('') + '</div>' +
      (detail ? '<div style="margin-top:14px;font-size:12px;color:#6F6F6F">Tehniline teade: ' + esc(String(detail).slice(0, 300)) + '</div>' : '') + '</div>';
    el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-i]'); if (!b) return; b.disabled = true; nupud[Number(b.dataset.i)].f(); });
    document.body.appendChild(el);
    const f = el.querySelector('button'); if (f) f.focus();
    return el;
  }
  const valja = (sb) => async () => { try { await sb.auth.signOut(); } catch (e) { /* ka võrguta: seanss kustub brauserist */ } location.reload(); };
  function yhendus(sb, e) {
    peatus('Serveriga ei saanud ühendust', 'Sind <b>ei logitud välja</b>. Kontrolli internetiühendust ja proovi uuesti.',
      [{ t: 'Proovi uuesti', pea: true, f: () => location.reload() }, { t: 'Logi välja', f: valja(sb) }], msgOf(e));
  }
  const ROLL = { admin: 'admin', raamatupidaja: 'raamatupidaja', toomees: 'töömees', ekraan: 'ekraan' };
  function oigus(sb, me, tekst) {
    const kodu = me && me.roll === 'ekraan' ? 'ekraan.html' : me && me.roll === 'toomees' ? 'tootaja.html' : 'index.html?menyy';
    peatus('Sellele lehele sul õigust pole', esc(tekst || '') + (me ? ' Oled sisse logitud: <b>' + esc(me.nimi || '') + '</b> (' + esc(ROLL[me.roll] || me.roll || '') + ').' : ''),
      [{ t: me && me.roll === 'toomees' ? 'Minu tööd' : me && me.roll === 'ekraan' ? 'Ekraan' : 'Avalehele', pea: true, f: () => location.replace(kodu) }, { t: 'Logi välja', f: valja(sb) }]);
  }
  // topeltklõpsu kaitse: sama nupp ei käivita käsitlejat uuesti enne, kui eelmine kord on lõpetanud
  function kord(fn) {
    return async function (ev) {
      const b = ev && ev.currentTarget && ev.currentTarget.nodeType === 1 ? ev.currentTarget : null;
      if (b && b.dataset.telToos) return;
      if (b) b.dataset.telToos = '1';
      try { return await fn.apply(this, arguments); }
      finally { if (b) delete b.dataset.telToos; }
    };
  }
  function lahkumine(onPooleli) {
    window.addEventListener('beforeunload', (e) => { let d = false; try { d = !!onPooleli(); } catch (er) { d = false; } if (d) { e.preventDefault(); e.returnValue = ''; } });
  }
  window.TelYhine = { viga, liik, yhendus, oigus, kord, lahkumine, seanss: (e, status) => liik(e, status) === 'seanss' };
})();
