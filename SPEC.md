# Markdown Reader — Spec (v1)

A minimal Linux markdown reader. Open an `.md` file, see it rendered
in one fixed, carefully-set typographic design. The reader watches the
file so saves in any external editor (vim, markdown-editor, VS Code…)
update the render live.

## In one sentence

**A markdown reader with live file watch and one fixed, book-like
typographic design.**

## Identity

| Where                | Value                                            |
|----------------------|--------------------------------------------------|
| Slug                 | `markdown-reader`                                |
| Binary               | `krill-markdown-reader`                          |
| Cargo package        | `krill-markdown-reader`                          |
| Cargo lib            | `krill_markdown_reader_lib`                      |
| `package.json` name  | `krill-markdown-reader`                          |
| Bundle identifier    | `software.krill.markdown-reader`                 |
| productName          | `Markdown Reader`                                |
| State dir            | `$XDG_STATE_HOME/krill-markdown-reader/`         |
| GitHub repo          | `krill-software/markdown-reader`                 |
| Lucide icon          | `book-open`                                      |

## Why split it off from markdown-editor

The editor is an **authoring** surface — typography there is locked
on purpose (Inter / Source Serif 4 / JetBrains Mono, our muted-syntax
look). That calmness is what makes writing in it feel good.

**Reading** wants something else: a book-like serif at a comfortable
measure and a table of contents. Splitting lets each surface be
designed for its one job — the editor for writing, the reader for
long-form reading.

## Typography — one fixed design, no knobs

The reader ships with **zero** typography controls. (v0.1 had four —
heading/body font + size — and they made the app feel like a CSS
panel; every combination but one looked worse than the one.) The
single design follows the reading research rather than taste:

- **Measure 55–75 characters per line** — the strongest lever for
  reading comfort (Bringhurst; Dyson & Haselgrove 2001). Prose is
  capped at `68ch`.
- **Body: Charter 16px, line-height 1.55.** Charter (Carter, 1987) was
  drawn to survive low-resolution output and holds up on a webview
  canvas. Serif vs. sans is a legibility wash; serif wins on
  preference for long-form reading.
- **Headings: Charter bold, 1.2 modular scale** (28 / 23 / 19 / 16px;
  h5–h6 as small tracked caps), tight tracking, line-height 1.2, and
  roughly 2:1 space above vs. below so a heading binds to what follows.
- **Paragraph spacing 0.75em, no indent.** Code at 87.5% in JetBrains
  Mono; tables with quiet uppercase headers on a rule, no bands.

Everything lives in `styles.css` → "Rendered document". Chrome stays
in Inter / JetBrains Mono per desktop-ui. If export-to-PDF/HTML ever
lands it inherits this design verbatim.

## Architecture

### Shell-family layout

```
+--- Markdown Reader ---------------------------------------------+
| [◐][☰]                                               ─ □ ✕     |
+------------+----------------------------------------------------+
|            |                                                    |
|            |         # The Quiet Stack                          |
|            |                                                    |
|  The Quiet…|         A short essay on building software         |
|   On opin… |         that gets out of the way.                  |
|   On calm  |                                                    |
|            |         ## On opinionated defaults                 |
|            |                                                    |
|            |         The product is the calm; the calm comes…   |
|            |                                                    |
|            |                                                    |
|            |                                                    |
|            |                                                    |
|            |                                                    |
+------------+----------------------------------------------------+
```

App-layout chrome, straight from desktop-ui's
`mountChrome({ layout: "app" })` — nothing local:
- No titlebar — color-mode toggle + hamburger top-left of sidebar,
  window controls top-right of main pane, drag region across both top
  strips
- No status line
- Sidebar and main both Ghost White, split by a 1px rule

### Sidebar contents

- **Contents**: h1–h3 of the live document, click to jump, current
  heading highlighted. Nothing else.

No file list / recents / favorites in v1. One window = one file.

### File handling

- **Open** (`Ctrl+O`): file dialog filtered to `.md`
- **CLI**: `krill-markdown-reader path/to/file.md` opens that file
- **Drag-drop**: drop a `.md` onto the window
- **File association**: `.md` registered as a candidate handler
  (alongside markdown-editor — Linux's "Open with…" picks between
  them; user chooses default)
- **No save / no edit** — strictly a reader

### File watching for live updates

Once a file is open, watch it with the `notify` crate (Rust side).
On every change event:

1. Re-read the file
2. Re-render the markdown
3. Preserve scroll position if reasonable

The watch is debounced at 80ms so a rapid save burst (text editors
sometimes do atomic-rename which fires multiple events) renders once.

The reader makes no assumption about *which* editor wrote the file.
It works equally well with markdown-editor, vim, VS Code, or echoing
into the file from a script.

### Renderer

Inherit the entire pipeline from markdown-editor's `preview.ts`:

- `markdown-it` with `linkify`, `typographer`, `breaks: false`
- `markdown-it-task-lists` for `- [ ]` boxes
- `highlight.js` for code-block syntax highlighting
- KaTeX for math (the `mathPreserve` plugin from markdown-editor)
- Mermaid for `\`\`\`mermaid` blocks, lazy-loaded
- Front-matter rendered as a `<pre>` block at the top of the document
- Tables: column widths are balanced to minimise the table's height
  (`src/tables.ts` — measure min/max/one-line widths, hill-climb an
  estimated line count, pin with `<colgroup>`); code in cells gets
  soft break opportunities after `/ . - _ , :`

No reason for the reader to render less than the editor's preview —
that'd be a regression. The renderer code can either be lifted
verbatim or extracted into a small shared package later.

## What v1 is

- Open a `.md` file (CLI arg / dialog / drag-drop / file-association)
- Render with full markdown-editor parity (KaTeX, Mermaid, hljs,
  task lists, front-matter)
- One fixed, research-backed typography (see "Typography" above)
- Live update on file change (notify-based watch, 80ms debounce)
- Contents (h1–h3) in the sidebar
- Find in document (`Ctrl+F`, Enter / Shift+Enter cycle, Esc closes)
- Links: a relative link to another markdown file opens it in the same
  window (`other.md#heading` jumps to the heading); `#heading` scrolls;
  web / mail links go to the system handler; anything else is inert.
  Back / forward (`Alt+←` / `Alt+→`, arrows at the left of the main top
  bar, hidden until there is history) retrace the path, scroll position
  included
- App-layout chrome (no titlebar, no status line)
- Linux x86_64 · AppImage + .deb · in-app updater

## What v1 is *not*

- **No editing.** It's a reader. Period.
- **No multi-document tabs.** One window per file (krill rule).
- **No export to HTML / PDF.** Deferred — easy to add later as a
  menu action that respects the live typography choices.
- **No paged view.** One continuous column. (An A4 paged view with
  thumbnails and zoom was built and removed.)
- **No theme picker.** Just the light/dark toggle every krill app
  gets from `mountChrome()`.
- **No settings file.** Nothing is persisted.
- **No typography knobs at all.** See "Typography" above.
- **No saving the user-provided file in any way.**

## Future (deferred decisions)

- **Export to HTML / PDF** — natural next milestone. Self-contained
  HTML (bundle the chosen fonts as `@font-face` data URIs) is the
  simplest path; print stylesheet plus webview-to-PDF for the print
  flow.
- **Linked reader mode** — markdown-editor could spawn a reader
  pointed at the file currently being edited via a small action
  (`Ctrl+Shift+P`). Editor stays uncoupled (just shells out), reader
  doesn't know about the editor — the watch handles synchronization.

## Stack

- **Shell:** Tauri 2 + TypeScript + Vite + Rust.
- **Chrome:** `@krill-software/desktop-ui` with shell-family overrides
  (same pattern as file-drop / photo-importer).
- **State / fs:** `krill-desktop-core` for XDG dirs.
- **Markdown:** `markdown-it` + `markdown-it-task-lists` + `katex` +
  `mermaid` + `highlight.js`, lifted from markdown-editor.
- **File watching:** `notify` crate (Rust), 80ms debounce.

## Milestones

- **M1 — Render.** Scaffold (shell-family chrome). Open a `.md` via
  CLI arg / Ctrl+O / drag-drop. Render with the markdown-editor
  pipeline. *(done — originally with four typography pickers, since
  removed in favour of the fixed design.)*
- **M2 — File watching.** notify-based watcher, 80ms debounce.
  Re-renders on every save. Preserves scroll position. *(done)*
- **M3 — Contents + find.** Sidebar contents list, `Ctrl+F`. *(done)*
- **M3.5 — Links.** Follow relative markdown links, back / forward. *(done)*
- **M4 — Polish + packaging.** Per-app docs landing page (rich style,
  chrome.css). README. AppImage + .deb. Updater wiring. Add card
  to org site.
