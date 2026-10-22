// =============================================================================
// TEL 2.0 – rea teekond (sql 61, 22.10.2026) – koguste liikumised, 2. samm
// TelTeekond.ava(sb, rida_id)      → aken: ühe töö kogu teekond kogustega (staatused, pinnakate välja/tagasi,
//                                    ladu, saatelehed, arved, kreeditarved, reklamatsioonid)
// TelTeekond.kokku(sb, rida_id, el) → lühike kokkuvõte "Tarnitud 6 / 10 · Arvel 4 / 10" + link "Teekond"
// Ainult kontor. Laetakse alles avamisel (1 RPC). Ilma sql 61-ta ei näidata midagi.
// =============================================================================
(function () {
  const ST = { cam: 'CAM teha', toos: 'Töös', ok: 'Pingilt OK', pinnakattes: 'Pinnakattes', allhankes: 'Allhankes', valmis: 'Valmis' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const aeg = (iso) => { const d = new Date(iso); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const kp = (s) => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '';
  const k = (x) => String(Math.round(Math.abs(Number(x) || 0) * 100) / 100).replace('.', ',');
  let pole = false;

  function css() {
    if (document.getElementById('telTkCss')) return;
    const s = document.createElement('style'); s.id = 'telTkCss';
    s.textContent =
      '.tk-bg{position:fixed;inset:0;background:rgba(22,22,22,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px}' +
      '.tk-w{background:var(--panel,#fff);color:var(--ink,#161616);width:100%;max-width:760px;max-height:86vh;display:flex;flex-direction:column;border:1px solid var(--line2,#C6C6C6);box-shadow:0 8px 28px rgba(0,0,0,.25)}' +
      '.tk-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line,#E0E0E0)}.tk-h b{font-size:16px;flex-grow:1;line-height:1.3}.tk-h b small{display:block;font-weight:400;font-size:12px;color:var(--muted,#6F6F6F)}' +
      '.tk-h button,.tk-f button{height:32px;padding:0 12px;border:1px solid var(--line2,#C6C6C6);background:var(--panel,#fff);font:inherit;font-size:13px;cursor:pointer}' +
      '.tk-s{display:flex;flex-wrap:wrap;gap:6px 18px;padding:10px 16px;border-bottom:1px solid var(--line,#E0E0E0);font-size:13px}.tk-s span{color:var(--muted,#6F6F6F)}.tk-s b{color:var(--ink,#161616);font-variant-numeric:tabular-nums}' +
      '.tk-b{overflow:auto;padding:2px 16px 12px}.tk-e{display:grid;grid-template-columns:104px 1fr auto;gap:2px 12px;padding:7px 0;border-bottom:1px solid var(--line,#E0E0E0);font-size:13px;line-height:1.45}' +
      '.tk-e .t{color:var(--muted,#6F6F6F);font-variant-numeric:tabular-nums}.tk-e .w{color:var(--muted,#6F6F6F);font-size:12px;text-align:right;white-space:nowrap}.tk-e b{font-weight:600}' +
      '.tk-e .g{display:inline-block;width:8px;height:8px;margin-right:6px;vertical-align:1px;background:#A8A8A8}.tk-e .g.out{background:#8A3FFC}.tk-e .g.in{background:#198038}.tk-e .g.doc{background:#0F62FE}.tk-e .g.bad{background:#DA1E28}' +
      '.tk-e .o{font-size:11px;padding:0 5px;border:1px solid var(--line2,#C6C6C6);color:var(--muted,#6F6F6F);margin-left:6px}.tk-x{padding:20px 0;color:var(--muted,#6F6F6F)}' +
      '.tk-f{display:flex;gap:8px;padding:10px 16px;border-top:1px solid var(--line,#E0E0E0)}' +
      '.tk-k{font-size:13px;line-height:1.5}.tk-k a{color:var(--accent,#0F62FE);cursor:pointer}' +
      '@media(max-width:600px){.tk-bg{padding:12px}.tk-e{grid-template-columns:1fr auto}.tk-e .m{grid-column:1/-1}}';
    document.head.appendChild(s);
  }
  const OLK = (o) => o === 'koostamisel' ? '<span class="o">koostamisel</span>' : o === 'tuhistatud' ? '<span class="o">tühistatud</span>' : '';
  function rida(e, uh) {
    const L = e.liik === 'pinnakate' ? 'pinnakatte' : 'allhanke';
    let g = '', m = '';
    switch (e.liik) {
      case 'loodud': m = 'lisati tellimusele <b>' + esc(e.dok) + '</b>'; break;
      case 'staatus': g = e.olek === 'valmis' ? 'in' : ''; m = 'staatus → <b>' + esc(ST[e.olek] || e.olek) + '</b>'; break;
      case 'print': m = 'joonis prinditud' + (Number(e.kogus) > 1 ? ' (' + e.kogus + '×)' : ''); break;
      case 'ladu': g = Number(e.kogus) < 0 ? 'out' : 'in'; m = (Number(e.kogus) < 0 ? 'võeti laost <b>' : 'pandi lattu <b>') + k(e.kogus) + ' ' + esc(uh) + '</b>' + (e.info ? ' – ' + esc(e.info) : ''); break;
      case 'pinnakate': case 'allhange':
        if (e.olek === 'valja') { g = Number(e.kogus) > 0 ? 'out' : 'bad'; m = (Number(e.kogus) > 0 ? L + 'sse <b>' : L + ' saatmine tühistati <b>−') + k(e.kogus) + ' ' + esc(uh) + '</b>'; }
        else { g = Number(e.kogus) < 0 ? 'in' : 'bad'; m = (Number(e.kogus) < 0 ? L + 'st tagasi <b>' : 'saabumine võeti tagasi <b>−') + k(e.kogus) + ' ' + esc(uh) + '</b>'; }
        m += e.dok ? ' · ' + esc(e.dok) : ''; if (e.info === 'algseis') m += ' <span class="o">algseis</span>'; break;
      case 'saateleht': g = 'doc'; m = 'saatelehel <b>' + esc(e.dok) + '</b>: ' + k(e.kogus) + ' ' + esc(uh) + (e.kp ? ' · ' + kp(e.kp) : '') + OLK(e.olek); break;
      case 'arve': g = 'doc'; m = 'arvel <b>' + esc(e.dok) + '</b>: ' + k(e.kogus) + ' ' + esc(uh) + (e.kp ? ' · ' + kp(e.kp) : '') + OLK(e.olek); break;
      case 'kreedit': g = 'bad'; m = 'kreeditarvel <b>' + esc(e.dok) + '</b>: −' + k(e.kogus) + ' ' + esc(uh) + (e.kp ? ' · ' + kp(e.kp) : '') + OLK(e.olek); break;
      case 'jagatud': g = 'doc'; m = e.olek === 'reast' ? 'jagati reast <b>töö ' + esc(e.dok) + '</b> (' + k(e.kogus) + ' ' + esc(uh) + ')' : 'jagati: <b>' + k(e.kogus) + ' ' + esc(uh) + '</b> eraldi tööks ' + esc(e.dok); break;
      case 'rekl': g = 'bad'; m = 'reklamatsioon <b>' + k(e.kogus) + ' ' + esc(uh) + '</b> – ' + esc(e.olek === 'umbertegemine' ? 'ümbertegemine' : e.olek === 'kreeditarve' ? 'kreeditarve' : e.olek || '') + (e.info ? ': ' + esc(e.info) : ''); break;
      default: m = esc(e.liik);
    }
    return '<div class="tk-e"><span class="t">' + aeg(e.aeg) + '</span><span class="m"><span class="g ' + g + '"></span>' + m + '</span><span class="w">' + esc(e.kes || '') + '</span></div>';
  }
  function kokkuHtml(d) {
    const r = d.rida, s = d.kokku, uh = esc(r.uhik), q = Number(r.kogus);
    const part = [['Kogus', k(q) + ' ' + uh], ['Tarnitud', k(s.tarnitud) + ' / ' + k(q) + (Number(s.sl_koostamisel) ? ' (+' + k(s.sl_koostamisel) + ' saatelehel koostamisel)' : '')]];
    if (r.arvele !== false) part.push(['Arveldatud', k(s.arveldatud) + ' / ' + k(q) + (Number(s.arve_koostamisel) ? ' (+' + k(s.arve_koostamisel) + ' arvel koostamisel)' : '') + (Number(s.krediteeritud) ? ' · krediit −' + k(s.krediteeritud) : '')]);
    Object.entries(s.valjas || {}).forEach(([l, v]) => { if (Number(v) > 0.0001) part.push([l === 'pinnakate' ? 'Pinnakattes' : 'Allhankes', k(v)]); });
    if (Number(s.rekl)) part.push(['Reklamatsioon', k(s.rekl)]);
    return part.map(([a, b]) => '<span>' + a + ' <b>' + b + '</b></span>').join('');
  }
  async function lae(sb, id) {
    if (pole) return null;
    const { data, error } = await sb.rpc('rea_teekond', { p_rida: Number(id) });
    if (error) { if (/rea_teekond|PGRST202|function/i.test(error.message + error.code)) pole = true; return { viga: error.message }; }
    return data;
  }
  async function ava(sb, id) {
    css();
    const bg = document.createElement('div'); bg.className = 'tk-bg';
    bg.innerHTML = '<div class="tk-w" role="dialog" aria-label="Rea teekond"><div class="tk-h"><b>Teekond<small>töö ' + esc(id) + '</small></b><button type="button" data-x>Sulge</button></div><div class="tk-b"><div class="tk-x">Laen…</div></div></div>';
    const sulge = () => { bg.remove(); document.removeEventListener('keydown', ek); };
    const ek = (e) => { if (e.key === 'Escape') sulge(); };
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) sulge(); });
    document.addEventListener('keydown', ek); document.body.appendChild(bg);
    const d = await lae(sb, id);
    if (!d || d.viga) { bg.querySelector('.tk-b').innerHTML = '<div class="tk-x">' + esc(d && d.viga ? (pole ? 'Rea teekond pole veel sisse lülitatud (sql 61).' : d.viga) : 'Rea teekond pole veel sisse lülitatud (sql 61).') + '</div>'; return; }
    const r = d.rida;
    bg.querySelector('.tk-h b').innerHTML = esc(r.nimetus) + (r.revisjon ? ' rev ' + esc(r.revisjon) : '') + '<small>töö ' + r.id + ' · ' + esc(r.tellimus || '') + (r.kliendi_tellimus ? ' · ' + esc(r.kliendi_tellimus) : '') + ' · ' + esc(r.klient || '') + ' · ' + esc(ST[r.staatus] || r.staatus) + '</small>';
    bg.querySelector('.tk-h').insertAdjacentHTML('afterend', '<div class="tk-s">' + kokkuHtml(d) + '</div>');
    bg.querySelector('.tk-b').innerHTML = (d.sundmused || []).length ? d.sundmused.map((e) => rida(e, r.uhik)).join('') : '<div class="tk-x">Sündmusi pole.</div>';
    bg.querySelector('.tk-w').insertAdjacentHTML('beforeend', '<div class="tk-f">' +
      (location.pathname.indexOf('tellimused.html') < 0 ? '<button type="button" data-tl>Ava tellimus</button>' : '') +
      (window.TelLogi ? '<button type="button" data-lg>Muudatuste logi</button>' : '') + '</div>');
    const tl = bg.querySelector('[data-tl]'); if (tl) tl.onclick = () => { location.href = 'tellimused.html?id=' + r.tellimus_id; };
    const lg = bg.querySelector('[data-lg]'); if (lg) lg.onclick = () => window.TelLogi.ava(sb, 'tellimused', r.tellimus_id, r.tellimus);
  }
  async function kokku(sb, id, el) {
    if (!el || pole) return;
    const d = await lae(sb, id);
    if (!d || d.viga || !el.isConnected) { if (el) el.innerHTML = ''; return; }
    css();
    el.innerHTML = '<div class="tk-k">' + kokkuHtml(d).replace(/<\/span><span>/g, '</span><br><span>') + '<br><a data-tk>Teekond →</a></div>';
    el.querySelector('[data-tk]').onclick = () => ava(sb, id);
  }
  // ---- rea jagamine / osaline OK (sql 62, ainult admin): "10-st 6 on tehtud" → 6 tk eraldi reaks (OK), 4 tk jääb
  async function jaga(sb, r, onDone) {
    css();
    const nr = 'normRaw' in r ? r.normRaw : r.norm;   // Ülevaates on norm arvuks tehtud, toorväärtus normRaw
    const q0 = Number(r.kogus), n0 = nr === null || nr === undefined || nr === '' ? null : Number(nr), uh = esc(r.uhik || 'tk');
    const isOk = r.staatus === 'ok';
    const bg = document.createElement('div'); bg.className = 'tk-bg';
    bg.innerHTML = '<div class="tk-w" role="dialog" aria-label="Jaga rida" style="max-width:460px"><div class="tk-h"><b>Jaga rida<small>' + esc(r.nimetus) + ' · töö ' + r.id + ' · ' + k(q0) + ' ' + uh +
      (n0 !== null ? ' · norm ' + k(n0) + ' h' : '') + ' · ' + esc(ST[r.staatus] || r.staatus) + '</small></b><button type="button" data-x>Sulge</button></div>' +
      '<div class="tk-b" style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;font-size:14px">' +
        '<label style="display:flex;align-items:center;gap:8px">Eraldi reaks <input id="tjK" inputmode="decimal" style="width:90px;height:36px;border:1px solid var(--line2,#C6C6C6);padding:0 8px;font:inherit"> ' + uh + '</label>' +
        (isOk ? '<div style="color:var(--muted,#6F6F6F);font-size:13px">Rida on juba Pingilt OK – mõlemad osad jäävad OK-ks, OK kuu (boonus) ei muutu. Norm ja tegelik aeg jagunevad koguse järgi.</div>'
          : '<label style="display:block;line-height:1.4"><input type="checkbox" id="tjOk" checked style="vertical-align:-2px;margin-right:6px">Märgi see osa <b>Pingilt OK</b> <small style="color:var(--muted,#6F6F6F)">(täna → selle kuu boonusesse)</small></label>' +
            '<label id="tjTw" style="display:flex;align-items:center;gap:8px">Tegelik aeg <input id="tjT" inputmode="decimal" style="width:90px;height:36px;border:1px solid var(--line2,#C6C6C6);padding:0 8px;font:inherit"> h <small style="color:var(--muted,#6F6F6F)">(selle osa kohta, võib jätta tühjaks)</small></label>') +
        '<div id="tjP" style="font-size:13px;line-height:1.6;background:var(--bg,#F4F4F4);padding:8px 10px"></div>' +
        '<div id="tjE" style="color:#DA1E28;font-size:13px"></div></div>' +
      '<div class="tk-f"><span style="flex-grow:1"></span><button type="button" data-x>Tühista</button><button type="button" id="tjGo" style="background:var(--accent,#0F62FE);color:#fff;border-color:var(--accent,#0F62FE)">Jaga</button></div></div>';
    const $q = (s) => bg.querySelector(s);
    const num = (v) => { const x = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
    const sulge = () => { bg.remove(); document.removeEventListener('keydown', ek); };
    const ek = (e) => { if (e.key === 'Escape') sulge(); };
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) sulge(); });
    document.addEventListener('keydown', ek); document.body.appendChild(bg);
    const prev = () => {
      const a = num($q('#tjK').value), ok = isOk || ($q('#tjOk') && $q('#tjOk').checked);
      if ($q('#tjTw')) $q('#tjTw').style.display = ok ? 'flex' : 'none';
      if (!(a > 0 && a < q0)) { $q('#tjP').innerHTML = 'Sisesta kogus, mis on väiksem kui ' + k(q0) + '.'; $q('#tjGo').disabled = true; return; }
      const na = n0 === null ? null : Math.round(n0 * a / q0 * 100) / 100;
      $q('#tjP').innerHTML = '<b>Uus rida:</b> ' + k(a) + ' ' + uh + (na !== null ? ' · norm ' + k(na) + ' h' : '') + ' → ' + (ok ? 'Pingilt OK' : esc(ST[r.staatus] || r.staatus)) +
        '<br><b>Jääb:</b> ' + k(q0 - a) + ' ' + uh + (na !== null ? ' · norm ' + k(n0 - na) + ' h' : '') + ' → ' + esc(ST[r.staatus] || r.staatus);
      $q('#tjGo').disabled = false;
    };
    bg.addEventListener('input', prev); bg.addEventListener('change', prev); prev(); $q('#tjK').focus();
    $q('#tjGo').onclick = async () => {
      const a = num($q('#tjK').value), ok = isOk || $q('#tjOk').checked, t = $q('#tjT') ? $q('#tjT').value.trim() : '';
      if (t && !(num(t) >= 0)) { $q('#tjE').textContent = 'Vigane tegelik aeg'; return; }
      $q('#tjGo').disabled = true; $q('#tjE').textContent = '';
      const { data, error } = await sb.rpc('rida_jaga', { p_rida: r.id, p_kogus: a, p_ok: ok, p_tegelik: t ? num(t) : null });
      if (error) { $q('#tjE').textContent = /rida_jaga|PGRST202/.test(error.message + error.code) ? 'Rea jagamine pole veel sisse lülitatud (sql 62).' : error.message; $q('#tjGo').disabled = false; return; }
      sulge(); if (onDone) onDone(data);
    };
  }
  window.TelTeekond = { ava, kokku, jaga };
})();
