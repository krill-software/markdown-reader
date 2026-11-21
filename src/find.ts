// In-document text search. Ctrl+F opens a small bar in the top-right of
// the viewport; matches are wrapped in <mark class="find-hit"> (the
// current one also gets data-current), Enter / Shift+Enter cycle,
// Escape closes and clears. Matching is case-insensitive and per text
// node — a phrase spanning an inline boundary (bold word) won't match,
// which is a fine trade for a ~150-line implementation.

import { icons as lucideIcons, createElement as createLucide } from "lucide";

export interface FindOptions {
  /** Where the bar is mounted (positioned absolutely inside it). */
  host: HTMLElement;
  /** Returns the element whose text should be searched. */
  root: () => HTMLElement;
  /** Scroll container, used to bring the current hit into view. */
  scroller: () => HTMLElement;
}

export interface FindController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Re-run the current query — call after the document re-renders. */
  refresh(): void;
  next(): void;
  prev(): void;
}

export function installFind(opts: FindOptions): FindController {
  let hits: HTMLElement[] = [];
  let current = -1;
  let query = "";

  const bar = document.createElement("div");
  bar.className = "find-bar";
  bar.hidden = true;
  bar.setAttribute("role", "search");

  const input = document.createElement("input");
  input.type = "search";
  input.className = "find-input";
  input.placeholder = "Find…";
  input.setAttribute("aria-label", "Find in document");
  input.spellcheck = false;

  const count = document.createElement("span");
  count.className = "find-count";

  const mkBtn = (icon: keyof typeof lucideIcons, title: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "find-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    const svg = createLucide(lucideIcons[icon]);
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    b.append(svg);
    b.addEventListener("click", () => { fn(); input.focus(); });
    return b;
  };

  bar.append(
    input,
    count,
    mkBtn("ChevronUp", "Previous match (Shift+Enter)", () => prev()),
    mkBtn("ChevronDown", "Next match (Enter)", () => next()),
    mkBtn("X", "Close (Esc)", () => close()),
  );
  opts.host.append(bar);

  input.addEventListener("input", () => {
    query = input.value;
    search();
    if (hits.length) go(0);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? prev() : next(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });

  function clear() {
    for (const m of hits) {
      const parent = m.parentNode;
      if (!parent) continue;
      m.replaceWith(...Array.from(m.childNodes));
      parent.normalize();
    }
    hits = [];
    current = -1;
  }

  function search() {
    clear();
    const q = query.trim().toLowerCase();
    if (!q) { report(); return; }
    const root = opts.root();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = (n as Text).parentElement;
        if (!p || p.closest("script, style, .find-bar")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const texts: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) texts.push(n as Text);

    for (const t of texts) {
      let node: Text = t;
      let idx = node.data.toLowerCase().indexOf(q);
      while (idx !== -1) {
        const hit = node.splitText(idx);
        const rest = hit.splitText(q.length);
        const mark = document.createElement("mark");
        mark.className = "find-hit";
        hit.replaceWith(mark);
        mark.append(hit);
        hits.push(mark);
        node = rest;
        idx = node.data.toLowerCase().indexOf(q);
      }
    }
    report();
  }

  function go(i: number) {
    if (hits.length === 0) return;
    if (current >= 0 && hits[current]) hits[current].removeAttribute("data-current");
    current = ((i % hits.length) + hits.length) % hits.length;
    const m = hits[current];
    m.setAttribute("data-current", "true");
    m.scrollIntoView({ block: "center", behavior: "auto" });
    report();
  }

  function report() {
    if (bar.hidden) return;
    count.textContent = query.trim() ? `${hits.length ? current + 1 : 0} / ${hits.length}` : "";
    count.dataset.empty = query.trim() && !hits.length ? "true" : "false";
  }

  function next() { go(current + 1); }
  function prev() { go(current - 1); }

  function open() {
    bar.hidden = false;
    input.focus();
    input.select();
    if (query) { search(); if (hits.length) go(Math.max(current, 0)); }
    report();
  }
  function close() {
    clear();
    bar.hidden = true;
    // Return focus to the scroller so keyboard scrolling works again.
    opts.scroller().focus?.();
  }
  function refresh() {
    if (bar.hidden || !query.trim()) return;
    // The old marks were discarded with the old DOM; just re-search.
    hits = [];
    current = -1;
    search();
    if (hits.length) go(0);
  }

  return { open, close, isOpen: () => !bar.hidden, refresh, next, prev };
}
