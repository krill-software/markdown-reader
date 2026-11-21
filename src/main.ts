import "@krill-software/desktop-ui/styles";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import "./styles.css";
import { mountChrome, showBootError } from "@krill-software/desktop-ui";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getMatches } from "@tauri-apps/plugin-cli";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { icons as lucideIcons, createElement as createLucide } from "lucide";

import { installFind, type FindController } from "./find";
import { renderMarkdown, renderMermaidBlocks } from "./preview";
import { balanceTables, softenTableCode } from "./tables";

// ---- App state ------------------------------------------------------

let mainContentEl: HTMLElement;
let renderRoot: HTMLElement;      // the rendered article
let placeholderEl: HTMLElement;   // empty / error state
let tocEl: HTMLElement;           // table of contents in the aux pane
let find: FindController;

let currentPath: string | null = null;
let currentSource: string = "";
let renderGen = 0;                // invalidates in-flight async work

// ---- Lucide ---------------------------------------------------------

function pascal(name: string): string {
  return name.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join("");
}
function iconSvg(name: string, size = 16): SVGElement {
  const node = (lucideIcons as Record<string, any>)[pascal(name)] ?? lucideIcons.FileText;
  const el = createLucide(node);
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  return el;
}

// ---- DOM helpers ----------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// ---- Main pane: render the current document ------------------------

function showPlaceholder(node: HTMLElement | null) {
  placeholderEl.replaceChildren();
  if (node) placeholderEl.append(node);
  mainContentEl.dataset.state = node ? "placeholder" : "document";
}

function renderEmpty() {
  renderRoot.replaceChildren();
  tocEl.replaceChildren();
  tocEntries = [];
  const empty = el("div", { class: "empty-state" });
  empty.append(iconSvg("book-open", 56));
  empty.append(el("h2", {}, "Open a markdown file"));
  empty.append(el("p", {},
    "Drag a .md file onto the window, use Ctrl+O, or pass a path on the command line."));
  showPlaceholder(empty);
}

function renderCurrent(opts: { keepScroll?: boolean } = {}) {
  if (!currentPath) { renderEmpty(); return; }
  const gen = ++renderGen;
  const top = opts.keepScroll ? mainContentEl.scrollTop : 0;
  showPlaceholder(null);
  renderRoot.innerHTML = renderMarkdown(currentSource);
  softenTableCode(renderRoot);
  void renderMermaidBlocks(renderRoot);
  mainContentEl.scrollTop = top;
  find.refresh();
  renderToc();
  // Column balancing needs real font metrics; redo it once fonts are in.
  void document.fonts.ready.then(() => { if (gen === renderGen) balanceTables(renderRoot); });
}

// ---- Table of contents (aux pane) -----------------------------------
//
// Built from the live headings (h1–h3) after each render. Click scrolls
// to the heading; the entry whose heading was last scrolled past is
// highlighted.

interface TocEntry { el: HTMLElement; row: HTMLElement }
let tocEntries: TocEntry[] = [];
let activeToc = -1;

function renderToc() {
  tocEl.replaceChildren();
  tocEntries = [];
  activeToc = -1;
  const heads = Array.from(renderRoot.querySelectorAll<HTMLElement>("h1, h2, h3"))
    .filter(h => h.textContent!.trim().length > 0);
  if (heads.length === 0) return;
  // Indent relative to the shallowest level present, so a doc that
  // starts at h2 doesn't sit one step in.
  const min = Math.min(...heads.map(h => Number(h.tagName[1])));
  const list = el("nav", { class: "toc", "aria-label": "Contents" });
  for (const h of heads) {
    const level = Number(h.tagName[1]) - min;
    const row = el("button", { class: "toc-row", type: "button", "data-level": String(level) });
    row.append(el("span", { class: "toc-text" }, h.textContent!.trim()));
    row.addEventListener("click", () => {
      h.scrollIntoView({ block: "start", behavior: "auto" });
    });
    list.append(row);
    tocEntries.push({ el: h, row });
  }
  tocEl.append(list);
  updateActiveToc();
}

// The active entry is the last heading whose top has scrolled past the
// upper part of the viewport.
function updateActiveToc() {
  if (tocEntries.length === 0) return;
  const view = mainContentEl.getBoundingClientRect();
  const line = view.top + Math.min(120, view.height * 0.2);
  let idx = 0;
  for (let i = 0; i < tocEntries.length; i++) {
    if (tocEntries[i].el.getBoundingClientRect().top <= line) idx = i;
    else break;
  }
  if (idx === activeToc) return;
  if (activeToc >= 0) delete tocEntries[activeToc].row.dataset.active;
  activeToc = idx;
  const row = tocEntries[idx].row;
  row.dataset.active = "true";
  row.scrollIntoView({ block: "nearest" });
}

// ---- Sidebar visibility --------------------------------------------

function toggleSidebar() {
  const visible = document.body.dataset.aux === "visible";
  document.body.dataset.aux = visible ? "hidden" : "visible";
}

// ---- File I/O ------------------------------------------------------

async function openPath(path: string) {
  try {
    const abs = await invoke<string>("absolute_path", { path });
    const text = await invoke<string>("read_md", { path: abs });
    currentPath = abs;
    currentSource = text;
    const title = `${basename(abs)} — Markdown Reader`;
    document.title = title;
    void getCurrentWindow().setTitle(title).catch(() => {});
    renderCurrent();
    // Start watching the new file. Backend drops the previous watcher
    // so swapping files doesn't leak listeners.
    try {
      await invoke("watch_file", { path: abs });
    } catch (e) {
      console.warn("watch_file failed (live updates disabled):", e);
    }
  } catch (e) {
    console.error("openPath failed:", e);
    renderGen++;
    const err = el("div", { class: "empty-state error" });
    err.append(iconSvg("triangle-alert", 56));
    err.append(el("h2", {}, "Couldn't open this file"));
    err.append(el("p", { class: "mono" }, String(e)));
    showPlaceholder(err);
  }
}

// Live re-render path. Debounced: editors often save in bursts (atomic
// rename produces multiple notify events in quick succession), and we
// want exactly one re-fetch per quiet period.
let reloadTimer: number | null = null;
async function scheduleReload() {
  if (reloadTimer != null) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = window.setTimeout(async () => {
    reloadTimer = null;
    if (!currentPath) return;
    try {
      const text = await invoke<string>("read_md", { path: currentPath });
      if (text === currentSource) return; // no-op if nothing actually changed
      currentSource = text;
      // Best-effort scroll preservation. Edits above the viewport
      // shift things and there's no anchor to fix it; this at least
      // keeps you near where you were.
      renderCurrent({ keepScroll: true });
    } catch (e) {
      console.warn("reload failed (file may have been removed):", e);
    }
  }, 80);
}

async function openViaDialog() {
  const picked = await openDialog({
    multiple: false,
    directory: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  if (typeof picked === "string") await openPath(picked);
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

async function installDragDrop() {
  const wv = getCurrentWebview();
  await wv.onDragDropEvent(async (e) => {
    if (e.payload.type === "drop") {
      const path = e.payload.paths.find((p) => /\.(md|markdown)$/i.test(p));
      if (path) await openPath(path);
    }
  });
}

// ---- Boot ----------------------------------------------------------

async function boot() {
  const chrome = mountChrome({
    productName: "Markdown Reader",
    version: __APP_VERSION__,
    layout: "app",
    showAuxPane: true,
    actions: {
      "open": openViaDialog,
      "toggle-sidebar": toggleSidebar,
    },
    customMenu: [
      { group: "edit", items: [{ label: "Find…", shortcut: "Ctrl+F", action: () => find.open() }] },
    ],
    updater: true,
  });

  // The app layout (main top bar + aux hamburger strip) comes from
  // desktop-ui; we just render into the scroll area it provides.
  mainContentEl = chrome.mainContent!;
  mainContentEl.tabIndex = -1;
  renderRoot = el("article", { class: "render" });
  placeholderEl = el("div", { class: "placeholder" });
  mainContentEl.append(renderRoot, placeholderEl);
  // The contents list scrolls in its own box below the (package-owned)
  // aux strip, so the hamburger stays put.
  tocEl = el("div", { class: "toc-list" });
  chrome.aux!.append(tocEl);

  find = installFind({
    host: chrome.viewport,
    root: () => renderRoot,
    scroller: () => mainContentEl,
  });

  let scrollTick = false;
  mainContentEl.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      updateActiveToc();
    });
  }, { passive: true });
  let rebalanceTimer: number | null = null;
  new ResizeObserver(() => {
    if (rebalanceTimer != null) clearTimeout(rebalanceTimer);
    rebalanceTimer = window.setTimeout(() => {
      rebalanceTimer = null;
      if (currentPath) balanceTables(renderRoot);
    }, 150);
  }).observe(mainContentEl);

  renderEmpty();

  // Live re-renders on file change. Path filtering happens here too:
  // the backend already filters, but if we ever watch multiple files
  // this gate becomes useful.
  await listen<string>("file-changed", (e) => {
    if (!currentPath || e.payload !== currentPath) return;
    void scheduleReload();
  });

  await installDragDrop();

  // Try CLI arg first.
  let opened = false;
  try {
    const matches = await getMatches();
    const arg = matches.args.file?.value;
    if (typeof arg === "string" && arg.length > 0) {
      await openPath(arg);
      opened = true;
    }
  } catch { /* cli plugin unavailable */ }

  // Dev convenience: open a fixture if one exists.
  if (!opened && import.meta.env.DEV) {
    try {
      const dev = await invoke<string | null>("dev_test_file");
      if (dev) await openPath(dev);
    } catch { /* none */ }
  }
}

boot().catch((e) => {
  console.error("boot failed:", e);
  showBootError(e);
});
