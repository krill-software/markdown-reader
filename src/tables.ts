// Table column balancing: pick column widths that minimise the table's
// height.
//
// The browser's auto layout hands spare width out in proportion to each
// column's max-content width, clamped by min-content — which is not
// the same as "fewest wrapped lines". A column holding one long
// unbreakable token hogs width, a column of long paragraphs gets
// starved and wraps into a tall sliver. Here we measure what the
// browser knows (per-column min / max widths, per-cell one-line text
// widths), then hill-climb the widths against an estimated line count
// and pin the result with <colgroup> + table-layout: fixed.

const STEP_FRACTION = 0.01;   // width moved per hill-climb step
const MAX_ITER = 400;

export function balanceTables(root: HTMLElement) {
  for (const t of root.querySelectorAll<HTMLTableElement>("table")) {
    try { balance(t); } catch (e) { console.warn("table balance failed:", e); }
  }
}

/** Insert soft break opportunities into code spans inside table cells
 *  so paths / identifiers can wrap after separators instead of forcing
 *  the column wide. Idempotent (skips nodes that already have <wbr>). */
export function softenTableCode(root: HTMLElement) {
  for (const code of root.querySelectorAll<HTMLElement>("td code, th code")) {
    if (code.closest("pre") || code.querySelector("wbr")) continue;
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) texts.push(n as Text);
    for (const t of texts) {
      const parts = t.data.split(/(?<=[\/.\-_,:])/);
      if (parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((p, i) => {
        frag.append(p);
        if (i < parts.length - 1) frag.append(document.createElement("wbr"));
      });
      t.replaceWith(frag);
    }
  }
}

function balance(table: HTMLTableElement) {
  // Undo a previous pass so measurement sees the natural layout.
  table.querySelector(":scope > colgroup[data-balanced]")?.remove();
  table.style.tableLayout = "";
  table.style.width = "";

  const rows = Array.from(table.rows);
  if (rows.length < 2) return;
  const ncol = rows[0].cells.length;
  if (ncol < 2) return;
  for (const r of rows) {
    if (r.cells.length !== ncol) return;
    for (const c of Array.from(r.cells)) if (c.colSpan !== 1 || c.rowSpan !== 1) return;
  }

  const avail = table.getBoundingClientRect().width;
  if (avail <= 0) return;

  // --- Measure -------------------------------------------------------
  const range = document.createRange();
  const colWidths = (): number[] =>
    Array.from({ length: ncol }, (_, c) =>
      Math.max(...rows.map(r => r.cells[c].getBoundingClientRect().width)));

  table.style.width = "max-content";
  const maxW = colWidths();
  // Per-cell one-line content width (every cell is on one line now).
  const text: number[][] = rows.map(r => Array.from(r.cells).map(cell => {
    range.selectNodeContents(cell);
    return range.getBoundingClientRect().width;
  }));
  const pad: number[] = Array.from({ length: ncol }, (_, c) => {
    const cs = getComputedStyle(rows[0].cells[c]);
    return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  });

  table.style.width = "min-content";
  const minW = colWidths();
  table.style.width = "";

  const sumMax = maxW.reduce((a, b) => a + b, 0);
  const sumMin = minW.reduce((a, b) => a + b, 0);
  if (sumMax <= avail + 0.5) return;   // nothing wraps; browser layout is fine
  if (sumMin > avail + 0.5) return;    // can't fit anyway; leave it to the browser

  // --- Optimise ------------------------------------------------------
  const lines = (c: number, r: number, w: number) =>
    Math.ceil(text[r][c] / Math.max(1, w - pad[c]));
  const cost = (w: number[]) => {
    let total = 0;
    for (let r = 0; r < rows.length; r++) {
      let rowLines = 1;
      for (let c = 0; c < ncol; c++) rowLines = Math.max(rowLines, lines(c, r, w[c]));
      total += rowLines;
    }
    return total;
  };

  // Start: min widths plus the spare distributed like the browser does
  // (proportional to max − min), then improve from there.
  const w = minW.slice();
  let spare = avail - sumMin;
  const room = maxW.map((m, c) => m - minW[c]);
  const roomSum = room.reduce((a, b) => a + b, 0) || 1;
  for (let c = 0; c < ncol; c++) w[c] += spare * (room[c] / roomSum);
  spare = 0;

  const step = Math.max(4, avail * STEP_FRACTION);
  let best = cost(w);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let bi = -1, bj = -1, bc = best;
    for (let i = 0; i < ncol; i++) {
      if (w[i] - step < minW[i]) continue;
      for (let j = 0; j < ncol; j++) {
        if (i === j || w[j] + step > maxW[j]) continue;
        w[i] -= step; w[j] += step;
        const cst = cost(w);
        w[i] += step; w[j] -= step;
        if (cst < bc) { bc = cst; bi = i; bj = j; }
      }
    }
    if (bi < 0) break;
    w[bi] -= step; w[bj] += step; best = bc;
  }

  // Any width still unused (columns capped at max) goes to the widest
  // wrapping column so the table keeps filling its line.
  const used = w.reduce((a, b) => a + b, 0);
  if (used < avail) {
    let target = 0;
    for (let c = 1; c < ncol; c++) if (room[c] > room[target]) target = c;
    w[target] += avail - used;
  }

  // --- Apply ---------------------------------------------------------
  const cg = document.createElement("colgroup");
  cg.dataset.balanced = "true";
  for (let c = 0; c < ncol; c++) {
    const col = document.createElement("col");
    col.style.width = `${(100 * w[c] / avail).toFixed(3)}%`;
    cg.append(col);
  }
  table.prepend(cg);
  table.style.tableLayout = "fixed";
  table.style.width = "100%";
}
