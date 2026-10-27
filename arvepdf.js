/* TEL 2.0 – müügi- ja kreeditarve PDF-i sisu (27.10.2026). Ühine brauseri (arved.html) ja öise varukoopia (varukoopia.mjs, Node) jaoks,
   et arhiivi PDF oleks täpselt sama mis TEL-ist alla laaditud.
   TELArve.o(arve) -> TELDoc.pdf() sisend; arve = arved rida + kliendid, kontaktid, arve_read[], viide (kreeditarvel algne arve)
   TELArve.fileName(arve), TELArve.T / TK – tekstid (et / en) */
(function (root) {
  const D = () => root.TELDoc;
  const fd = (s) => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '';
  const kog = (v) => { const n = Number(v || 0); return n % 1 ? String(n).replace('.', ',') : String(Math.round(n)); };
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const isK = (a) => a.liik === 'kreedit';
  function sums(a) {
    const net = r2(a.arve_read.reduce((s, r) => s + Number(r.kogus) * Number(r.hind || 0), 0));
    const vat = r2(net * Number(a.km_maar) / 100);
    return { net, vat, tot: r2(net + vat) };
  }
  const T = {
    et: { title: 'ARVE', nr: 'Arve nr', date: 'Kuupäev', due: 'Maksetähtaeg', ref: 'Viitenumber', payer: 'Maksja', payee: 'Makse saaja', no: 'Jrk', desc: 'Nimetus', qty: 'Kogus', price: 'Hind, €', sum: 'Kokku, €', order: 'Tellimus',
      net: 'Summa ilma käibemaksuta', vat: 'Käibemaks', total: 'Kokku tasuda, EUR', contact: 'Kontakt', vatno: 'KMKR', pay: 'Palume tasuda arve maksetähtajaks, makse selgitusse märkige viitenumber.', late: 'Viivis 0,2% päevas.',
      poordmaks: 'Käibemaks 0%: ühendusesisene käive / pöördmaksustamine.', eksport: 'Käibemaks 0%: kauba eksport.', subj: 'Arve', body: 'Tere,<br><br>saadame manuses arve ' },
    en: { title: 'INVOICE', nr: 'Invoice no', date: 'Date', due: 'Due date', ref: 'Reference no', payer: 'Bill to', payee: 'Payee', no: 'No', desc: 'Description', qty: 'Qty', price: 'Price, €', sum: 'Amount, €', order: 'Order',
      net: 'Subtotal', vat: 'VAT', total: 'Total due, EUR', contact: 'Contact', vatno: 'VAT no', pay: 'Please pay by the due date and quote the reference number.', late: 'Late payment interest 0.2% per day.',
      poordmaks: 'VAT 0%: intra-Community supply / reverse charge.', eksport: 'VAT 0%: export of goods.', subj: 'Invoice', body: 'Hello,<br><br>please find attached invoice ' }
  };
  const TK = {
    et: { title: 'KREEDITARVE', nr: 'Kreeditarve nr', due: 'Tagastamise tähtaeg', total: 'Kreeditarve kokku, EUR', ref: 'Viide arvele', reason: 'Põhjus', subj: 'Kreeditarve', body: 'Tere,<br><br>saadame manuses kreeditarve ',
      off: (nr) => 'Summa tasaarveldatakse arvega ' + nr + '.', back: 'Summa tagastatakse Teie arveldusarvele.' },
    en: { title: 'CREDIT NOTE', nr: 'Credit note no', due: 'Refund due', total: 'Total credit, EUR', ref: 'Refers to invoice', reason: 'Reason', subj: 'Credit note', body: 'Hello,<br><br>please find attached credit note ',
      off: (nr) => 'The amount will be offset against invoice ' + nr + '.', back: 'The amount will be refunded to your bank account.' }
  };
  const fileName = (a) => (isK(a) ? (a.keel === 'en' ? 'CreditNote_' : 'Kreeditarve_') : (a.keel === 'en' ? 'Invoice_' : 'Arve_')) + a.nr + '.pdf';
  function o(a) {
    const K = isK(a), W = K ? { ...(T[a.keel] || T.et), ...(TK[a.keel] || TK.et) } : (T[a.keel] || T.et), s = sums(a), k = a.kliendid || {}, F = D().FIRMA, pn = D().pnum;
    const addr2 = [k.postiindeks, k.linn].filter(Boolean).join(' ');
    const vnr = a.viide ? a.viide.nr : '';
    // tasaarveldus: väljastatud kreeditarvel tegelik, koostamisel eeldatav (algse arve tasumata jäägi järgi)
    const off = !K ? 0 : a.olek === 'valjastatud' ? Number(a.tasaarveldatud || 0) : a.viide ? Math.max(0, Math.min(Number(a.viide.summa) - Number(a.viide.tasutud) - Number(a.viide.kreeditud || 0), -s.tot)) : 0;
    const note = K ? [W.reason + ': ' + (a.pohjus || ''), a.markused, a.km_liik !== 'tavaline' ? W[a.km_liik] : '', vnr ? W.ref + ' ' + vnr + (a.viide.kuupaev ? ' (' + fd(a.viide.kuupaev) + ')' : '') + '. ' + (off > 0.005 ? W.off(vnr) + ' ' : '') + (-s.tot - off > 0.005 ? W.back : '') : ''].filter(Boolean).join('\n')
      : [a.markused, a.km_liik !== 'tavaline' ? W[a.km_liik] : '', W.pay + ' ' + W.late].filter(Boolean).join('\n');
    return ({
      lang: a.keel, title: W.title, nr: a.nr,
      meta: K ? [{ l: W.nr, v: a.nr }, { l: (T[a.keel] || T.et).date, v: fd(a.kuupaev) }, { l: W.ref, v: vnr || '–', hi: true }, { l: (T[a.keel] || T.et).ref, v: a.viitenumber || '–' }]
        : [{ l: W.nr, v: a.nr }, { l: W.date, v: fd(a.kuupaev) }, { l: W.due, v: fd(a.maksetahtaeg), hi: true }, { l: W.ref, v: a.viitenumber || '–' }],
      parties: [{ l: K ? (a.keel === 'en' ? 'Customer' : 'Klient') : W.payer, lines: [k.nimi || '', k.aadress, addr2, k.riik && (k.riik !== 'Eesti' || a.keel === 'en') ? k.riik : '', k.kmkr ? W.vatno + ': ' + k.kmkr : '', a.kontaktid ? W.contact + ': ' + a.kontaktid.nimi : ''] },
        { l: K ? (a.keel === 'en' ? 'Issued by' : 'Väljastaja') : W.payee, lines: [F.nimi, 'IBAN ' + F.iban, F.pank + ', SWIFT ' + F.swift, (T[a.keel] || T.et).ref + ': ' + (a.viitenumber || '–')] }],
      table: { head: [{ t: W.no, w: 22 }, { t: W.desc }, { t: W.qty, w: 48, right: true }, { t: W.price, w: 58, right: true }, { t: W.sum, w: 62, right: true }, { t: W.order, w: 80 }],
        rows: a.arve_read.map((r, i) => [i + 1, r.nimetus, kog(r.kogus) + ' ' + r.uhik, pn(r.hind), pn(Number(r.kogus) * Number(r.hind || 0)), r.tellimus || '']) },
      totals: [{ l: W.net, v: pn(s.net) }, { l: W.vat + ' ' + kog(a.km_maar) + '%', v: pn(s.vat) }, { l: W.total, v: pn(s.tot) }],
      words: D().words(s.tot, a.keel), note, sign: null
    });
  }
  root.TELArve = { o, fileName, T, TK, sums };
})(typeof window !== 'undefined' ? window : globalThis);
