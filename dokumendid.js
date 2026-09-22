/* TEL 2.0 – dokumentide PDF (hele tehniline stiil D), pdfmake.
   TELDoc.pdf({ title, nr, meta, parties, table, totals, words, note, sign, signName }) -> Promise<Blob>
   meta:    [{ l, v, hi }]             andmelahtrite rida (hi = helesinine esiletõst)
   parties: [{ l, lines: [nimi, ...] }] kaks plokki kõrvuti
   table:   { head: [{ t, w, right }], rows: [[...]], boldCol }
   totals:  [{ l, v, strong }] | null ; words: summa sõnadega | null
   note:    tekst | null ; sign: ['Vasak', 'Parem'] | null ; signName: vasakusse kasti nimi */
(function () {
  const FIRMA = { nimi: 'Hecada OÜ', reg: '12056773', aadress: 'Suur-Sõjamäe 29A, 11415 Tallinn, Estonia', tel: '+372 56 506 528', web: 'www.hecada.com',
    mail: 'info@hecada.com', pank: 'Swedbank, code 767', iban: 'EE252200221051693326', swift: 'HABAEE2X', kmkr: 'EE101519461' };
  const PC = { ink: '#161616', muted: '#525252', line: '#C6C6C6', rule: '#E0E0E0', acc: '#0F62FE', soft: '#EDF5FF', head: '#DDE6F3', note: '#F4F4F4' };
  const pnum = (n) => (Number(n) || 0).toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const script = (src) => new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => bad(new Error('PDF-i teeki ei saanud laadida')); document.head.appendChild(sc); });
  async function lib() {
    if (!window.pdfMake) await script('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js');
    if (!window.pdfMake.vfs || !Object.keys(window.pdfMake.vfs).length) await script('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js');
  }
  let LOGO;
  async function logo() {
    if (LOGO !== undefined) return LOGO;
    try { const b = await (await fetch('hecada-logo.png')).blob(); if (!b.type.startsWith('image')) throw 0;
      LOGO = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); }
    catch (e) { LOGO = null; }
    return LOGO;
  }
  const frame = (topAcc) => ({ hLineWidth: (i) => (topAcc && i === 0 ? 1.5 : 0.75), hLineColor: (i) => (topAcc && i === 0 ? PC.acc : PC.line), vLineWidth: () => 0.75, vLineColor: () => PC.line,
    paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 });
  async function pdf(o) {
    await lib();
    const lg = await logo();
    const cell = (m) => ({ stack: [{ text: m.l, fontSize: 7.5, color: PC.muted }, { text: m.v || '–', fontSize: 10, bold: true, margin: [0, 1, 0, 0] }], fillColor: m.hi ? PC.soft : null, margin: [6, 5, 6, 5] });
    const party = (p) => ({ stack: [{ text: p.l, fontSize: 7.5, color: PC.muted }, { text: p.lines[0] || '', fontSize: 11.5, bold: true, margin: [0, 1, 0, 2] }]
      .concat(p.lines.slice(1).filter(Boolean).map((x) => ({ text: x, fontSize: 9 }))) });
    const T = o.table;
    const body = [T.head.map((h) => ({ text: h.t, bold: true, fontSize: 8, fillColor: PC.head, alignment: h.right ? 'right' : 'left' }))]
      .concat(T.rows.map((r) => r.map((c, j) => ({ text: c === null || c === undefined ? '' : String(c), alignment: T.head[j].right ? 'right' : 'left', bold: j === (T.boldCol ?? 1) }))));
    const content = [
      { columns: [lg ? { image: lg, width: 70 } : { text: 'HECADA', bold: true, fontSize: 16 },
        { width: '*', stack: [{ text: o.title, fontSize: 19, bold: true, characterSpacing: 1, alignment: 'right' }, { text: o.nr, fontSize: 15, bold: true, color: PC.acc, alignment: 'right', margin: [0, 2, 0, 0] }] }], margin: [0, 0, 0, 12] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.75, lineColor: PC.line }], margin: [0, 0, 0, 14] },
      { table: { widths: o.meta.map(() => '*'), body: [o.meta.map(cell)] }, layout: frame(true), margin: [0, 0, 0, 14] },
      { columns: o.parties.map(party), columnGap: 20, margin: [0, 0, 0, 14] },
      { table: { headerRows: 1, widths: T.head.map((h) => h.w || '*'), body }, layout: { hLineWidth: (i, n) => (i === 0 || i === n.table.body.length ? 0.75 : 0.5),
        hLineColor: (i) => (i === 1 ? '#8D8D8D' : i === 0 ? PC.line : PC.rule), vLineWidth: (i, n) => (i === 0 || i === n.table.widths.length ? 0.75 : 0), vLineColor: () => PC.line,
        paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 6, paddingRight: () => 6 } }
    ];
    if (o.totals && o.totals.length) {
      const last = o.totals.length - 1;
      content.push({ columns: [{ text: '', width: '*' }, { width: 230, stack: [{ table: { widths: ['*', 'auto'], body: o.totals.map((t, i) => [
        { text: t.l, bold: i === last, fontSize: i === last ? 10.5 : 9, fillColor: i === last ? PC.soft : null }, { text: t.v, bold: i === last, fontSize: i === last ? 10.5 : 9, alignment: 'right', fillColor: i === last ? PC.soft : null }]) },
        layout: { hLineWidth: (i) => (i === last ? 1.5 : 0.75), hLineColor: (i) => (i === last ? PC.acc : PC.line), vLineWidth: (i) => (i === 1 ? 0 : 0.75), vLineColor: () => PC.line,
          paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 8, paddingRight: () => 8 } }].concat(o.words ? [{ text: o.words, italics: true, fontSize: 8, alignment: 'right', margin: [0, 4, 0, 0] }] : []) }], margin: [0, 12, 0, 0] });
    }
    if (o.note) content.push({ table: { widths: ['*'], body: [[{ stack: [{ text: 'Märkused', fontSize: 7.5, color: PC.muted }, { text: o.note, margin: [0, 1, 0, 0] }], fillColor: PC.note, margin: [4, 4, 4, 4] }]] }, layout: 'noBorders', margin: [0, 14, 0, 0] });
    if (o.sign) {
      const box = (t, name) => ({ stack: [{ text: t, fontSize: 7.5, color: PC.muted }, { text: name || ' ', margin: [0, 3, 0, 18] }, { text: 'Nimi, allkiri, kuupäev', fontSize: 7, color: PC.muted }], margin: [6, 5, 6, 5] });
      content.push({ table: { widths: ['*', '*'], body: [[box(o.sign[0], o.signName), box(o.sign[1], '')]] }, layout: frame(false), margin: [0, 18, 0, 0], unbreakable: true });
    }
    const dd = {
      pageSize: 'A4', pageMargins: [40, 36, 40, 88], defaultStyle: { fontSize: 9, color: PC.ink, lineHeight: 1.15 },
      info: { title: o.title + ' ' + o.nr, author: FIRMA.nimi }, content,
      footer: (cur, cnt) => ({ margin: [40, 10, 40, 0], stack: [
        { text: 'Lehekülg ' + cur + '/' + cnt, alignment: 'center', fontSize: 7.5, color: PC.muted, margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: PC.acc }] },
        { columns: [
          { stack: [{ text: FIRMA.nimi, bold: true }, 'Reg. nr ' + FIRMA.reg, FIRMA.aadress], fontSize: 7.5 },
          { stack: [FIRMA.tel, FIRMA.mail, FIRMA.web], alignment: 'center', fontSize: 7.5 },
          { stack: [FIRMA.pank, 'IBAN ' + FIRMA.iban, 'SWIFT ' + FIRMA.swift + ' · KMKR ' + FIRMA.kmkr], alignment: 'right', fontSize: 7.5 }], margin: [0, 5, 0, 0], color: '#393939' }] })
    };
    return new Promise((ok, bad) => { try { window.pdfMake.createPdf(dd).getBlob(ok); } catch (e) { bad(e); } });
  }
  window.TELDoc = { pdf, FIRMA, pnum };
})();
