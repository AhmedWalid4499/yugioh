/* Excel support:
   - Export a deck to .xlsx with card pictures embedded in the sheet.
   - Import a deck from .xlsx or .csv: card names (or ids), quantities and
     sections are read and matched against the card database.
   - A blank template to fill in by hand.
   The ExcelJS library (vendor/exceljs.min.js, ~1 MB) is loaded only when one
   of these features is used, so the rest of the app stays fast. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const D = App.decks;
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  let libPromise = null;
  function loadLib() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!libPromise) {
      libPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/exceljs.min.js';
        s.onload = () => resolve(window.ExcelJS);
        s.onerror = () => { libPromise = null; reject(new Error('Could not load the Excel library (vendor/exceljs.min.js).')); };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function imageExt(url, contentType) {
    if (/png/i.test(contentType || '') || /\.png(\?|$)/i.test(url)) return 'png';
    if (/gif/i.test(contentType || '')) return 'gif';
    return 'jpeg';
  }

  /* Fetches card pictures a few at a time. Returns url -> {base64, extension} or null. */
  async function fetchImages(urls, onProgress) {
    const out = {};
    let done = 0;
    const queue = urls.slice();
    async function worker() {
      while (queue.length) {
        const url = queue.shift();
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const buf = await res.arrayBuffer();
          out[url] = { base64: toBase64(buf), extension: imageExt(url, res.headers.get('content-type')) };
        } catch (e) {
          out[url] = null;
        }
        done++;
        if (onProgress) onProgress(done, urls.length);
      }
    }
    await Promise.all([0, 1, 2, 3, 4, 5].map(worker));
    return out;
  }

  function levelText(c) {
    if (!c || api.kind(c) !== 'monster') return '';
    if (/Link/i.test(c.type)) return 'Link-' + (c.linkval || '?');
    if (/XYZ/i.test(c.type)) return 'Rank ' + c.level;
    return c.level != null ? 'Level ' + c.level : '';
  }

  function banText(c) {
    const b = c && c.banlist_info && c.banlist_info.ban_tcg;
    return b || 'Unlimited';
  }

  function grouped(ids) {
    const map = new Map();
    ids.forEach((id) => map.set(Number(id), (map.get(Number(id)) || 0) + 1));
    return Array.from(map.entries()).map(([id, n]) => ({ id, n, card: D.cached(id) }));
  }

  const COLUMNS = [
    { key: 'pic', header: 'Picture', width: 11 },
    { key: 'qty', header: 'Qty', width: 6 },
    { key: 'name', header: 'Card Name', width: 34 },
    { key: 'section', header: 'Section', width: 10 },
    { key: 'type', header: 'Card Type', width: 24 },
    { key: 'attr', header: 'Attribute / Sub-type', width: 16 },
    { key: 'level', header: 'Level / Rank', width: 12 },
    { key: 'atk', header: 'ATK', width: 7 },
    { key: 'def', header: 'DEF', width: 7 },
    { key: 'arch', header: 'Archetype', width: 18 },
    { key: 'ban', header: 'Banlist (TCG)', width: 13 },
    { key: 'desc', header: 'Card Effect', width: 80 },
    { key: 'id', header: 'Card ID', width: 11 }
  ];

  const HEADER_ROW = 4;
  const ACCENT = 'FFE3B341';

  function styleHeader(ws) {
    ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
    const row = ws.getRow(HEADER_ROW);
    COLUMNS.forEach((c, i) => { row.getCell(i + 1).value = c.header; });
    row.font = { bold: true, color: { argb: 'FF1A1405' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
    row.alignment = { vertical: 'middle' };
    row.height = 22;
    ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  /* ---------- Export ---------- */

  async function exportDeck(deck, onProgress) {
    const ExcelJS = await loadLib();
    const sections = [['Main', deck.main], ['Extra', deck.extra], ['Side', deck.side]];
    const allCards = [];
    sections.forEach(([, ids]) => grouped(ids).forEach((g) => { if (g.card) allCards.push(g.card); }));
    const urls = Array.from(new Set(allCards.map((c) => api.image(c, 'small')).filter(Boolean)));
    const images = await fetchImages(urls, onProgress);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Duel Vault';
    wb.created = new Date();
    const ws = wb.addWorksheet('Deck', { properties: { defaultRowHeight: 18 } });
    styleHeader(ws);

    ws.getCell('A1').value = deck.name;
    ws.getCell('A1').font = { bold: true, size: 18 };
    ws.getCell('A2').value = 'Main ' + deck.main.length + ' · Extra ' + deck.extra.length + ' · Side ' + deck.side.length +
      ' · Exported from Duel Vault on ' + new Date().toLocaleDateString() + '. You can re-import this file to rebuild the deck.';
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

    let r = HEADER_ROW + 1;
    let missingPics = 0;
    sections.forEach(([label, ids]) => {
      const groups = grouped(ids);
      if (!groups.length) return;
      const sec = ws.getRow(r);
      sec.getCell(3).value = label + ' Deck (' + ids.length + ')';
      sec.font = { bold: true, size: 13 };
      sec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFF4' } };
      sec.height = 24;
      r++;
      groups.forEach((g) => {
        const c = g.card || { id: g.id, name: 'Unknown card #' + g.id };
        const row = ws.getRow(r);
        row.values = {
          qty: g.n,
          name: c.name,
          section: label,
          type: c.type || '',
          attr: api.kind(c) === 'monster' ? [c.attribute, c.race].filter(Boolean).join(' / ') : (c.race || ''),
          level: levelText(c),
          atk: api.kind(c) === 'monster' && c.atk != null ? c.atk : '',
          def: api.kind(c) === 'monster' && c.def != null && !/Link/i.test(c.type || '') ? c.def : '',
          arch: c.archetype || '',
          ban: banText(c),
          desc: c.desc || '',
          id: c.id
        };
        row.height = 76;
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell('qty').alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell('qty').font = { bold: true, size: 14 };
        row.getCell('name').font = { bold: true, color: { argb: 'FF2459C7' }, underline: true };
        row.getCell('name').value = { text: c.name, hyperlink: 'https://ygoprodeck.com/card/?search=' + c.id };
        if (/Banned|Forbidden/.test(banText(c))) row.getCell('ban').font = { bold: true, color: { argb: 'FFD33333' } };
        else if (/Limited/.test(banText(c))) row.getCell('ban').font = { bold: true, color: { argb: 'FFE07B00' } };

        const url = api.image(c, 'small');
        const pic = url && images[url];
        if (pic) {
          const imgId = wb.addImage({ base64: pic.base64, extension: pic.extension });
          ws.addImage(imgId, { tl: { col: 0.08, row: r - 1 + 0.04 }, ext: { width: 66, height: 96 }, editAs: 'oneCell' });
        } else if (url) {
          // Picture could not be downloaded: fall back to Excel 365 / Google Sheets' IMAGE function.
          row.getCell('pic').value = { formula: '_xlfn.IMAGE("' + url + '")' };
          missingPics++;
        }
        r++;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    U.download(safeName(deck.name) + '.xlsx', buf, XLSX_MIME);
    return { pictures: urls.length - missingPics, missingPics: missingPics };
  }

  function safeName(name) {
    return (String(name || 'deck').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')) || 'deck';
  }

  async function downloadTemplate() {
    const ExcelJS = await loadLib();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Deck');
    ws.columns = [{ width: 8 }, { width: 38 }, { width: 12 }, { width: 14 }];
    ws.getCell('A1').value = 'My Deck';
    ws.getCell('A1').font = { bold: true, size: 18 };
    ws.getCell('A2').value = 'Fill in one card per row. Section is Main, Extra or Side (leave it blank and Extra Deck monsters are placed automatically). Card ID is optional.';
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };
    const header = ws.getRow(HEADER_ROW);
    header.values = ['Qty', 'Card Name', 'Section', 'Card ID'];
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
    [[3, 'Ash Blossom & Joyous Spring', 'Main'], [2, 'Infinite Impermanence', 'Main'], [1, 'Accesscode Talker', 'Extra'], [2, 'Dark Ruler No More', 'Side']]
      .forEach((v, i) => { ws.getRow(HEADER_ROW + 1 + i).values = v; });
    const buf = await wb.xlsx.writeBuffer();
    U.download('Duel_Vault_deck_template.xlsx', buf, XLSX_MIME);
  }

  /* ---------- Import ---------- */

  function cellText(cell) {
    if (!cell) return '';
    let v = cell.value;
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map((t) => t.text).join('').trim();
      if (v.text != null) return String(v.text).trim();
      if (v.result != null) return String(v.result).trim();
      if (v.formula) return '';
      if (v instanceof Date) return '';
    }
    return String(v).trim();
  }

  async function rowsFromXlsx(buffer) {
    const ExcelJS = await loadLib();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Deck') || wb.worksheets[0];
    if (!ws) throw new Error('The workbook has no sheets.');
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = [];
      for (let i = 1; i <= Math.max(row.cellCount, 1); i++) cells.push(cellText(row.getCell(i)));
      rows.push(cells);
    });
    return rows;
  }

  function rowsFromCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field.trim()); field = '';
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  const SECTION_RE = /^(main|extra|side)(\s*deck)?\s*(\(\d+\))?:?$/i;

  function sectionOf(text) {
    const t = String(text || '').toLowerCase();
    if (/side/.test(t)) return 'side';
    if (/extra/.test(t)) return 'extra';
    if (/main/.test(t)) return 'main';
    return '';
  }

  /* Turns spreadsheet rows into [{ name, id, qty, section }]. */
  function readEntries(rows) {
    let cols = null;
    let start = 0;
    for (let i = 0; i < Math.min(rows.length, 20) && !cols; i++) {
      const h = rows[i].map((c) => c.toLowerCase());
      const name = h.findIndex((c) => /^(card\s*)?name$|^card$|^cards$/.test(c));
      if (name === -1) continue;
      cols = {
        name: name,
        qty: h.findIndex((c) => /^(qty|quantity|count|copies|amount|#|x|no\.?)$/.test(c)),
        section: h.findIndex((c) => /^(section|deck|zone|location|part)$/.test(c)),
        id: h.findIndex((c) => /^(card\s*)?id$|passcode|password/.test(c))
      };
      start = i + 1;
    }

    const entries = [];
    let current = '';
    rows.slice(start).forEach((cells) => {
      let name = '';
      let qty = null;
      let section = '';
      let id = null;
      if (cols) {
        name = cells[cols.name] || '';
        if (cols.qty !== -1) qty = parseInt(cells[cols.qty], 10);
        if (cols.section !== -1) section = sectionOf(cells[cols.section]);
        if (cols.id !== -1 && /^\d{3,10}$/.test(cells[cols.id] || '')) id = Number(cells[cols.id]);
      } else {
        // No header row: first text cell is the name, a small number is the quantity.
        cells.forEach((c) => {
          if (!c) return;
          if (/^\d{1,2}$/.test(c) && qty == null) qty = parseInt(c, 10);
          else if (/^\d{5,10}$/.test(c) && id == null) id = Number(c);
          else if (!name && !/^(main|extra|side)$/i.test(c)) name = c;
          else if (!section) section = sectionOf(c) || section;
        });
      }

      // "Main Deck (40)"-style rows switch the current section.
      if (name && SECTION_RE.test(name) && !id && (qty == null || isNaN(qty))) { current = sectionOf(name); return; }
      if (!name && !id) return;

      // "3x Ash Blossom" or "3 Ash Blossom" in the name cell.
      const m = /^(\d)\s*x?\s+(.+)$/i.exec(name);
      if (m && (qty == null || isNaN(qty))) { qty = Number(m[1]); name = m[2]; }
      if (qty == null || isNaN(qty)) qty = 1;
      if (qty <= 0) return;
      entries.push({ name: name.trim(), id: id, qty: Math.min(qty, 3), section: section || current });
    });
    return entries;
  }

  const norm = (s) => api.normName(s);

  async function importFile(file, deckName) {
    const isCsv = /\.csv$/i.test(file.name) || /csv/.test(file.type);
    const rows = isCsv ? rowsFromCsv(await file.text()) : await rowsFromXlsx(await file.arrayBuffer());
    const entries = readEntries(rows);
    if (!entries.length) throw new Error('No cards found. Put card names in a column headed "Card Name" (and optionally "Qty" and "Section").');

    // Resolve by id first (exact), then by name.
    const ids = entries.filter((e) => e.id).map((e) => e.id);
    const byId = {};
    if (ids.length) {
      const cards = await api.getCardsByIds(ids);
      cards.forEach((c) => { byId[c.id] = c; (c.card_images || []).forEach((im) => { byId[im.id] = c; }); });
    }
    const names = entries.filter((e) => !(e.id && byId[e.id]) && e.name).map((e) => e.name);
    const byName = names.length ? await api.getCardsByNames(names) : {};

    const parts = { main: [], extra: [], side: [] };
    const notFound = [];
    const resolved = [];
    entries.forEach((e) => {
      const card = (e.id && byId[e.id]) || byName[norm(e.name)];
      if (!card) { notFound.push(e.name || ('#' + e.id)); return; }
      resolved.push(card);
      let zone = e.section === 'side' ? 'side' : (api.isExtraDeck(card) ? 'extra' : 'main');
      for (let i = 0; i < e.qty; i++) parts[zone].push(card.id);
    });
    D.rememberMany(resolved);

    const name = deckName || (rows[0] && rows[0][0] && !/name|qty|card/i.test(rows[0][0]) ? rows[0][0] : '') || file.name.replace(/\.(xlsx|csv)$/i, '');
    const deck = D.create(name, parts);
    if (notFound.length) {
      deck.notes = 'Not found when importing from ' + file.name + ' (check the spelling):\n- ' + Array.from(new Set(notFound)).join('\n- ');
      D.save(deck);
    }
    return { deck: deck, notFound: Array.from(new Set(notFound)), added: parts.main.length + parts.extra.length + parts.side.length };
  }

  App.excel = { exportDeck, downloadTemplate, importFile, readEntries, rowsFromCsv, norm };
})(window.App);
