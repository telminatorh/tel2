// =============================================================================
// TEL 2.0 – infonupud ⓘ (22.10.2026)
// Väike hall ⓘ nupu / välja kõrval; klõps → 1–2 lauset selgitust. Kõik tekstid on SIIN ühes kohas
// (lehtede koodi ei muudeta – ⓘ lisatakse ise, ka hiljem joonistatud elementidele).
// Välja/sisse: avalehe all „Näita infonuppe ⓘ“ või hüpikus „Peida infonupud“ (kehtib selles seadmes).
// Kiirus: tekst näidatakse alles klõpsul; kontroll käib ≤ 4× sekundis ja ainult siis, kui leht muutus.
// =============================================================================
(function () {
  if (window.TelAbi) return;
  const KEY = 'tel2.abi';
  const sees = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\?.*$/, '') || 'index.html';

  // [selektor, pealkiri, tekst] lehe kaupa. Tekst: 1–2 lauset – mis see on ja millal kasutada.
  const T = {
    'index.html': [
      ['#T .todo h2', 'Täna vaja', 'Ainult asjad, mis ootavad tegevust: hilinevad tööd, valmis aga saatmata, saadetud aga arveldamata, tähtaja ületanud arved jne. Klõps viib õigele lehele. „Kõik korras ✓“ = midagi pole ootel.']
    ],
    'tellimused.html': [
      ['#tkBtn', 'Tarneaeg?', 'Kiirpäring kliendi küsimise jaoks: joonise nr + kogus + pink → eeldatav valmimise kuupäev praeguse järjekorra järgi. Midagi ei salvestata.'],
      ['#oTaAll', 'Kõigile ridadele', 'Paneb ülal oleva tarneaja kõigile ridadele (valmis read jäävad muutmata). Salvestub nupuga Salvesta.'],
      ['#oCopy', 'Kopeeri uueks', 'Loob uue tellimuse samade ridadega (kordustellimus). Hinnad ja normid tulevad kaasa – kontrolli üle.'],
      ['#oTg', 'TG PDF', 'Tech Group AS ostutellimuse PDF: loeb read (nr, rev, kogus, hind, tähtaeg). Päise (klient, kliendi tellimuse nr) täida ise.'],
      ['#oJn', 'Seo joonised', 'Otsib OneDrive\'i tellimuse kaustast PDF-id ja STEP-id, seob need ridadega ning loeb joonistelt materjali ja pinnakatte.'],
      ['#oSum .ttw', 'Tunnitulu', 'Tunnitulu = (hind − materjal − ost) × kogus ÷ oodatav TEGELIK aeg (sama detaili viimased tehtud korrad). Punane = alla piiri (Kontor → Seaded → tunnitulu_min). Normi järgi ei arvutata, sest norm on hinnast tuletatud.'],
      ['#oLogi .tl-r', 'Viimati muutis', 'Kes ja millal seda tellimust või selle ridu viimati muutis. Klõps = kogu muudatuste ajalugu (enne → pärast, ka kustutatud read).']
    ],
    'ulevaade.html': [
      ['#hoolBtn', 'Hooldused', 'Meeste hooldustööd (pink + kuupäev, ka korduvad). Punane number = mees märkis tehtuks, ootab sinu kinnitust.'],
      ['#soovBtn', 'Tellimissoovid', 'Meeste tööriista- ja materjalisoovid. Märgi tellituks / saabunuks – mees näeb oma lehel.'],
      ['.ekb', 'Tehase ekraan', 'Töökoja teleri vaade: pingid (kes mida teeb), hilinevad, tähtajad, hooldused. Ilma hindadeta. Teleris logi sisse ekraani kontoga.'],
      ['#eJaga', 'Jaga', 'Osa kogusest eraldi reaks (nt 4 tk → 2 + 2). Norm jaguneb koguse järgi. Linnukesega saab uue osa kohe Pingilt OK märkida (osaline OK).'],
      ['#eTeek .tk-k', 'Teekond', 'Selle töö kogused: tarnitud ja arveldatud (miinus kreeditarved). „Teekond →“ = kõik sündmused: staatused, pinnakate välja/tagasi, saatelehed, arved.']
    ],
    'tootaja.html': [
      ['#scanBtn2', 'Skänni', 'Skänni joonise QR telefoniga → töö avaneb ja tulevad suured nupud Töös / OK.'],
      ['#tScan', 'Skänni', 'Skänni joonise QR → töö avaneb ja tulevad suured nupud Töös / OK.'],
      ['#pickBtn', 'Prindi joonised', 'Vali tööd → joonised prinditakse ribaga (tellimus, kogus, tähtaeg, norm, QR). Prinditud töö saab märke 🖨.'],
      ['#narrowBtn', 'Kitsas vaade', 'Kompaktne tabel nagu Ülevaates – rohkem töid ühel ekraanil.'],
      ['#tjBtn', 'Jaga rida', 'Osa kogusest eraldi reaks (nt 4 tk → 2 + 2). Norm jaguneb koguse järgi, kokku jääb sama. Ainult admin.'],
      ['#tkBtn', 'Rea teekond', 'Selle töö kogu teekond: staatused, pinnakate välja/tagasi, saatelehed, arved, kreeditarved, reklamatsioonid.'],
      ['#liikBox .hist > b', 'Pinnakate / allhange', 'Mitu tk on välja saadetud ja mitu tagasi tulnud. Kirjed tekivad ostutellimusest ise; kui kõik on tagasi, läheb töö Valmis.'],
      ['.jk b', 'Tehtud %', 'Pika töö puhul märgi, kui palju on tehtud – plaan arvestab ainult ülejäänud aega. Normtunde see ei muuda.']
    ],
    'arved.html': [
      ['#kredit', 'Kreeditarve', 'Tee selle arve pealt kreeditarve (K-…): valitud read või osa kogusest. Väljastatud arvet ei muudeta – parandus käib kreeditarvega.'],
      ['#aLogi .tl-r', 'Viimati muutis', 'Kes ja millal seda arvet või selle ridu viimati muutis. Klõps = kogu muudatuste ajalugu.']
    ],
    'ostutellimused.html': [
      ['#send', 'Saada tarnijale', 'Saadab ostutellimuse ja märgib saadetuks: pinnakatte / allhanke tööd lähevad staatusesse Pinnakattes / Allhankes.'],
      ['#allArr', 'Kõik saabus', 'Märgib kõik read saabunuks. Kui töö kogu kogus on tagasi, läheb töö Valmis. Vale märke saab saabunud koguse muutmisega tagasi võtta.'],
      ['#poLiik summary', 'Liikumised', 'Iga saatmine ja saabumine kuupäeva ja kogusega (ka parandused ja tühistamised).']
    ],
    'admin.html': [
      ['#addUserBtn', 'Lisa kasutaja', 'Loob kasutaja kasutajanime ja ajutise parooliga (vajab Supabase\'is funktsiooni kasutaja-loo). Esimesel sisselogimisel vahetab ta parooli ise.']
    ]
  };
  const list = T[page] || [];
  if (!list.length) { window.TelAbi = { uuenda() {} }; return; }

  const css = '.abi-i{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;min-width:17px;border-radius:50%;border:1px solid #A8A8A8;color:#6F6F6F;background:transparent;' +
    'font:600 11px/1 "IBM Plex Sans",system-ui,sans-serif;cursor:help;padding:0;margin:0 0 0 5px;vertical-align:middle;flex-shrink:0;align-self:center}' +
    '.abi-i:hover{border-color:#0F62FE;color:#0F62FE}' +
    '.abi-p{position:fixed;z-index:9500;max-width:320px;background:#161616;color:#F4F4F4;padding:10px 12px 8px;font:13px/1.45 "IBM Plex Sans",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}' +
    '.abi-p b{display:block;margin-bottom:3px;font-size:13px}.abi-p a{color:#A6C8FF;font-size:12px;cursor:pointer;display:inline-block;margin-top:6px}';
  let pop = null;
  function sulge() { if (pop) { pop.remove(); pop = null; } }
  function ava(btn, it) {
    sulge();
    pop = document.createElement('div'); pop.className = 'abi-p'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = '<b></b><span></span><br><a data-abi-off>Peida infonupud</a>';
    pop.querySelector('b').textContent = it[1]; pop.querySelector('span').textContent = it[2];
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(Math.max(8, r.left - 10), innerWidth - w - 8), y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    pop.querySelector('[data-abi-off]').onclick = () => { try { localStorage.setItem(KEY, '0'); } catch (e) { /* ignore */ } sulge(); uuenda(); const cb = document.getElementById('abiOn'); if (cb) cb.checked = false; };
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.abi-i');
    if (b) { e.preventDefault(); e.stopPropagation(); const it = list[Number(b.dataset.abi)]; if (pop && pop._b === b) return sulge(); ava(b, it); pop._b = b; return; }
    if (pop && !e.target.closest('.abi-p')) sulge();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sulge(); });
  addEventListener('scroll', sulge, true);

  function nahtav(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden'; }
  function uuenda() {
    const on = sees();
    if (!on) { document.querySelectorAll('.abi-i').forEach((x) => x.remove()); return; }
    if (!document.getElementById('abiCss')) { const s = document.createElement('style'); s.id = 'abiCss'; s.textContent = css; document.head.appendChild(s); }
    list.forEach((it, i) => {
      document.querySelectorAll(it[0]).forEach((el) => {
        const nx = el.nextElementSibling, has = nx && nx.classList && nx.classList.contains('abi-i') && nx.dataset.abi === String(i);
        const show = nahtav(el);
        if (show && !has) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'abi-i'; b.dataset.abi = String(i); b.textContent = 'i';
          b.setAttribute('aria-label', 'Selgitus: ' + it[1]); b.title = it[1] + ' – selgitus';
          el.insertAdjacentElement('afterend', b);
        } else if (!show && has) nx.remove();
      });
    });
  }
  let t = null;
  const kick = () => { if (t) return; t = setTimeout(() => { t = null; mo.disconnect(); uuenda(); mo.observe(document.body, OBS); }, 250); };
  const OBS = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] };
  const mo = new MutationObserver(kick);
  const start = () => { uuenda(); mo.observe(document.body, OBS); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.TelAbi = { uuenda, sees, set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } uuenda(); } };
})();
