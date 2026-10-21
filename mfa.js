// =============================================================================
// TEL 2.0 – kahefaktoriline sisselogimine (2FA), sql 57 (21.10.2026)
// Laetakse enne lehe skripti (nav.js laeb selle; tootaja.html ja index.html otse).
// Haakub supabase.createClient külge: pärast sisselogimist / lehe avamisel kontrollib
// kinnituse taset. Kui kasutajal on 2FA → küsib 6-kohalise koodi. Kui 2FA on kohustuslik
// (Kontor → Kasutajad) ja seadistamata → juhendab seadistama (QR / telefonis nupp).
// Google Authenticator ja Microsoft Authenticator töötavad mõlemad (TOTP standard).
// Jõustamine on andmebaasis (sql 57) – see fail on ainult kasutajaliides.
// =============================================================================
(function () {
  if (window.TelMFA || !window.supabase || !window.supabase.createClient) return;
  const orig = window.supabase.createClient;
  let cli = null, busy = false, shown = false;

  const CSS = '.mfa-bg{position:fixed;inset:0;z-index:1000;background:#F4F4F4;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(24px,6vh) 16px 24px;font-family:"IBM Plex Sans",system-ui,sans-serif;color:#161616}' +
    '.mfa{width:100%;max-width:440px;background:#fff;border:1px solid #161616;box-shadow:0 12px 32px rgba(0,0,0,.12)}' +
    '.mfa header{background:#161616;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}' +
    '.mfa header b{font-family:"IBM Plex Mono",monospace;font-size:16px}.mfa header button{background:none;border:1px solid #6F6F6F;color:#fff;height:32px;padding:0 10px;font:inherit;font-size:13px;cursor:pointer}' +
    '.mfa .b{padding:18px;display:flex;flex-direction:column;gap:12px}.mfa h2{margin:0;font-size:20px}.mfa p{margin:0;font-size:14px;line-height:1.45;color:#393939}' +
    '.mfa ol{margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:#393939}.mfa ol li{margin:4px 0}' +
    '.mfa .qr{align-self:center;width:200px;height:200px;border:1px solid #E0E0E0;padding:6px;background:#fff}.mfa .qr img{width:100%;height:100%;display:block}' +
    '.mfa .key{font-family:"IBM Plex Mono",monospace;font-size:14px;background:#F4F4F4;padding:8px 10px;word-break:break-all;display:flex;gap:8px;align-items:center;justify-content:space-between}' +
    '.mfa .key button,.mfa .lnk{border:1px solid #8D8D8D;background:#fff;height:34px;padding:0 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#161616;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.mfa .lnk.big{height:46px;font-size:15px;border-color:#0F62FE;color:#0F62FE}' +
    '.mfa input.code{height:56px;font-family:"IBM Plex Mono",monospace;font-size:28px;letter-spacing:.35em;text-align:center;border:1px solid #8D8D8D;background:#F4F4F4;width:100%;padding:0 8px}' +
    '.mfa input.code:focus{outline:2px solid #0F62FE;border-color:#0F62FE}' +
    '.mfa .go{height:48px;border:none;background:#0F62FE;color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer}.mfa .go:disabled{opacity:.5}' +
    '.mfa .err{color:#DA1E28;font-size:13px;min-height:18px}.mfa small{color:#6F6F6F;font-size:12px;line-height:1.4}' +
    '.mfa .tel{display:none}@media (pointer:coarse){.mfa a.tel{display:flex}.mfa small.tel{display:block}.mfa .pc{display:none}}';

  function css() { if (document.getElementById('mfaCss')) return; const s = document.createElement('style'); s.id = 'mfaCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function kast(html) {
    css(); let bg = document.getElementById('mfaBg');
    if (!bg) { bg = document.createElement('div'); bg.id = 'mfaBg'; bg.className = 'mfa-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); document.body.appendChild(bg); }
    bg.innerHTML = '<div class="mfa"><header><b>TEL 2.0</b><button type="button" data-mfa-out>Logi välja</button></header><div class="b">' + html + '</div></div>';
    bg.querySelector('[data-mfa-out]').onclick = async () => { try { await cli.auth.signOut(); } catch (e) { /* ikka edasi */ } location.reload(); };
    shown = true; return bg;
  }
  // koodi lahter: ainult numbrid, 6 numbri juures saadab ise
  function koodiLahter(bg, onCode) {
    const inp = bg.querySelector('input.code'), btn = bg.querySelector('.go'), err = bg.querySelector('.err');
    const send = async () => {
      const c = inp.value.replace(/\D/g, '');
      if (c.length !== 6) { err.textContent = 'Kood on 6 numbrit'; inp.focus(); return; }
      btn.disabled = true; inp.disabled = true; err.textContent = '';
      const e = await onCode(c);
      if (e) { err.textContent = e; btn.disabled = false; inp.disabled = false; inp.value = ''; inp.focus(); }
    };
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); if (inp.value.length === 6) send(); });
    btn.onclick = send;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    setTimeout(() => inp.focus(), 50);
  }
  const vigaTekst = (e) => /invalid|code|verify/i.test((e && e.message) || '') ? 'Vale kood – proovi uuesti (kood vahetub iga 30 s järel)' : 'Ei õnnestunud: ' + ((e && e.message) || e);
  const valmis = () => { const bg = document.getElementById('mfaBg'); if (bg) bg.querySelector('.b').innerHTML = '<h2>✓ Kinnitatud</h2><p>Laen lehte…</p>'; setTimeout(() => location.reload(), 300); };

  // koodi küsimine (2FA on seadistatud)
  function kysi(factor) {
    const bg = kast('<h2>Kinnita sisselogimine</h2><p>Ava telefonis autentimisäpp (<b>Google Authenticator</b>) ja sisesta <b>TEL 2.0</b> 6-kohaline kood.</p>' +
      '<input class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="6-kohaline kood">' +
      '<div class="err"></div><button type="button" class="go">Kinnita</button>' +
      '<small>Telefon kadunud või vahetatud? Admin saab 2FA lähtestada (Kontor → Kasutajad), siis seadistad uue telefoni.</small>');
    koodiLahter(bg, async (code) => {
      const { error } = await cli.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) return vigaTekst(error);
      valmis(); return null;
    });
  }

  // seadistamine (esimene kord)
  async function seadista(kohustuslik) {
    // poolelijäänud (kinnitamata) katsed ära, muidu uus registreerimine ei õnnestu
    const { data: lf } = await cli.auth.mfa.listFactors();
    for (const f of ((lf && lf.all) || []).filter((x) => x.status !== 'verified')) { try { await cli.auth.mfa.unenroll({ factorId: f.id }); } catch (e) { /* edasi */ } }
    const { data, error } = await cli.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TEL 2.0 ' + new Date().toISOString().slice(0, 16).replace('T', ' ') });
    if (error) { kast('<h2>2FA seadistamine</h2><p class="err">Ei õnnestunud: ' + esc(error.message) + '</p><button type="button" class="go" onclick="location.reload()">Proovi uuesti</button>'); return; }
    const t = data.totp, key = (t.secret || '').replace(/(.{4})/g, '$1 ').trim();
    // Supabase annab SVG-i toorelt (data:image/svg+xml;utf-8,<svg…>) – "#" vms võib pildi katki teha → kodeerime
    const qm = String(t.qr_code || '').match(/^data:image\/svg\+xml;utf-8,([\s\S]*)$/);
    const qr = qm && !/^%3C/i.test(qm[1]) ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qm[1]) : t.qr_code;
    const uri = (t.uri || '').replace(/^otpauth:\/\/totp\/[^?]*/, 'otpauth://totp/' + encodeURIComponent('TEL 2.0'));
    const bg = kast('<h2>Seadista 2FA (üks kord)</h2>' +
      '<p>' + (kohustuslik ? 'Sisselogimiseks on nüüd vaja ka telefoni koodi. ' : '') + 'Paigalda telefoni <b>Google Authenticator</b> (Play pood / App Store; sobib ka Microsoft Authenticator).</p>' +
      '<ol class="pc"><li>Ava äpp → <b>+</b> → <b>Skänni QR-kood</b></li><li>Suuna telefon sellele koodile:</li></ol>' +
      '<div class="qr pc"><img alt="QR-kood autentimisäpile" src="' + esc(qr) + '"></div>' +
      '<a class="lnk big tel" href="' + esc(uri) + '">Lisa Google Authenticatorisse</a>' +
      '<small class="tel">Kui nupp ei ava äppi: äpis <b>+</b> → <b>Sisesta seadistusvõti</b> ja kopeeri allolev võti.</small>' +
      '<div class="key"><span>' + esc(key) + '</span><button type="button" data-copy>Kopeeri</button></div>' +
      '<p>Siis sisesta äpis näha olev <b>6-kohaline kood</b>:</p>' +
      '<input class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="6-kohaline kood">' +
      '<div class="err"></div><button type="button" class="go">Kinnita ja lõpeta</button>');
    bg.querySelector('[data-copy]').onclick = async (e) => { try { await navigator.clipboard.writeText(t.secret); e.target.textContent = 'Kopeeritud ✓'; } catch (x) { e.target.textContent = 'Vali ja kopeeri käsitsi'; } };
    koodiLahter(bg, async (code) => {
      const { error: e2 } = await cli.auth.mfa.challengeAndVerify({ factorId: data.id, code });
      if (e2) return vigaTekst(e2);
      valmis(); return null;
    });
  }

  async function kontroll() {
    if (busy || shown || !cli) return; busy = true;
    try {
      const { data: s } = await cli.auth.getSession(); if (!s || !s.session) return;
      const { data: a, error } = await cli.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !a) return;
      if (a.currentLevel !== 'aal2') {
        if (a.nextLevel === 'aal2') {   // seadistatud → küsi koodi
          const { data: lf } = await cli.auth.mfa.listFactors();
          const f = lf && lf.totp && lf.totp.find((x) => x.status === 'verified');
          if (f) { kysi(f); return; }
        }
        const { data: req, error: re } = await cli.rpc('mfa_noue');
        if (!re && req === true) { await seadista(true); return; }   // kohustuslik, aga seadistamata
      }
      // sql 58: admin määras ajutise parooli → enne tööd tuleb oma parool panna
      const { data: p, error: pe } = await cli.from('profiilid').select('parool_vahetada').eq('id', s.session.user.id).maybeSingle();
      if (!pe && p && p.parool_vahetada) parool(true);
    } catch (e) { console.warn('2FA kontroll', e); }
    finally { busy = false; }
  }

  window.supabase.createClient = function () {
    const c = orig.apply(this, arguments);
    if (!cli) {
      cli = c;
      c.auth.onAuthStateChange((ev, session) => {
        // NB! siin ei tohi otse supabase'i kutsuda (lukk) → järgmisel tiksul
        if (session && ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(ev)) setTimeout(kontroll, 0);
      });
    }
    return c;
  };
  // vabatahtlik seadistamine (Kontor → Kasutajad → "Seadista minu 2FA")
  // parooli vahetus (sql 58): sundus = ajutine parool (ainult "Logi välja"), muidu vabatahtlik (Loobu)
  function parool(sundus) {
    const bg = kast('<h2>' + (sundus ? 'Vali endale parool' : 'Muuda parooli') + '</h2>' +
      (sundus ? '<p>Admin andis sulle ajutise parooli. Vali nüüd oma parool – seda ei tea keegi teine.</p>' : '') +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#525252">Uus parool<input type="password" class="pw" autocomplete="new-password" style="height:46px;font-size:17px;border:1px solid #8D8D8D;background:#F4F4F4;padding:0 10px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#525252">Korda parooli<input type="password" class="pw2" autocomplete="new-password" style="height:46px;font-size:17px;border:1px solid #8D8D8D;background:#F4F4F4;padding:0 10px"></label>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" class="pwn"> Näita parooli</label>' +
      '<small>Vähemalt 12 märki, tähed ja numbrid. Hea parool on mitu sõna kokku, nt <b>kollane-Freespink-27</b>.</small>' +
      '<div class="err"></div><button type="button" class="go">Salvesta parool</button>' + (sundus ? '' : '<button type="button" class="lnk" data-x>Loobu</button>'));
    const a = bg.querySelector('.pw'), b = bg.querySelector('.pw2'), err = bg.querySelector('.err'), go = bg.querySelector('.go');
    bg.querySelector('.pwn').onchange = (e) => { a.type = b.type = e.target.checked ? 'text' : 'password'; };
    const x = bg.querySelector('[data-x]'); if (x) x.onclick = () => { bg.remove(); shown = false; };
    const save = async () => {
      const v = a.value;
      if (v.length < 12) { err.textContent = 'Parool peab olema vähemalt 12 märki'; a.focus(); return; }
      if (!/[0-9]/.test(v) || !/[A-Za-zÕÄÖÜŠŽõäöüšž]/.test(v)) { err.textContent = 'Paroolis peab olema nii tähti kui numbreid'; a.focus(); return; }
      if (v !== b.value) { err.textContent = 'Paroolid ei ühti'; b.focus(); return; }
      go.disabled = true; err.textContent = '';
      const { error } = await cli.auth.updateUser({ password: v });
      if (error) {
        go.disabled = false;
        const m = error.message || '';
        err.textContent = /different from the old|same/i.test(m) ? 'Uus parool peab olema eelmisest erinev'
          : /reauth|nonce|recent/i.test(m) ? 'Turvakaalutlusel logi välja ja uuesti sisse, siis vaheta parool'
          : /weak|short|characters/i.test(m) ? 'Parool on liiga nõrk – pikem või mitmest sõnast'
          : /aal2|mfa/i.test(m) ? 'Enne parooli vahetust kinnita 2FA kood (logi uuesti sisse)'
          : 'Ei õnnestunud: ' + m;
        return;
      }
      try { await cli.rpc('parool_vahetatud'); } catch (e) { /* sql 58 puudub – pole oluline */ }
      bg.querySelector('.b').innerHTML = '<h2>✓ Parool muudetud</h2><p>Järgmine kord logi sisse uue parooliga.</p>';
      setTimeout(() => { if (sundus) location.reload(); else { bg.remove(); shown = false; } }, 1200);
    };
    go.onclick = save;
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => a.focus(), 50);
  }

  window.TelMFA = {
    parool: () => { if (!cli) return; shown = false; parool(false); },
    seadista: () => { if (!cli) return; shown = false; return seadista(false); },
    tase: async () => { if (!cli) return null; const { data } = await cli.auth.mfa.getAuthenticatorAssuranceLevel(); return data; }
  };
})();
