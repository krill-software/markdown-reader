# Markdown Viewer — Spec (v1)

A minimal Linux markdown reader. Open an `.md` file, see it rendered,
pick the typography you want. The viewer watches the file so saves in
any external editor (vim, markdown-editor, VS Code…) update the
render live. The reader's output is **your document**, not ours —
the two font knobs let you make it look the way you want.

## In one sentence

**A markdown viewer with live file watch and the two typography
knobs the rendered document needs to feel like yours.**

## Identity

| Where                | Value                                            |
|----------------------|--------------------------------------------------|
| Slug                 | `markdown-viewer`                                |
| Binary               | `krill-markdown-viewer`                          |
| Cargo package        | `krill-markdown-viewer`                          |
| Cargo lib            | `krill_markdown_viewer_lib`                      |
| `package.json` name  | `krill-markdown-viewer`                          |
| Bundle identifier    | `software.krill.markdown-viewer`                 |
| productName          | `Markdown Viewer`                                |
| State dir            | `$XDG_STATE_HOME/krill-markdown-viewer/`         |
| GitHub repo          | `krill-software/markdown-viewer`                 |
| Lucide icon          | `book-open`                                      |

## Why split it off from markdown-editor

The editor is an **authoring** surface — typography there is locked
on purpose (Inter / Source Serif 4 / JetBrains Mono, our muted-syntax
look). That calmness is what makes writing in it feel good.

But the **rendered output** is the user's artifact, not ours.
Different documents want different feels: a CV reads better in
classical serif; a tech post in Charter; a recipe in something with
real character. Letting the editor sprawl into typography
configuration would re-pollute the very surface we kept clean.

Splitting solves both: the editor stays opinionated and quiet, the
viewer carries the two knobs that genuinely matter for output
(heading font + body font, plus their sizes).

## Hard scope — the typography surface stays bounded

This is the krill-uncomfortable part of the SPEC. The viewer **must**
ship with only **four** typography controls, ever:

- **Heading font** — picked from a curated list (~8 options)
- **Heading size** — number input or stepper
- **Body font** — picked from a curated list (~8 options)
- **Body size** — number input or stepper

Anything else (weights, line-height, margins, code font, blockquote
styling, link color, table styling) is **explicitly off the table for
v1 and not on the roadmap**. The discipline is the same as the locked
palette: a small fixed surface lets the user feel in control without
the app becoming a CSS panel.

If at some point we add an export-to-PDF / export-to-HTML feature,
those exports inherit the live typography choices verbatim. They do
not introduce additional knobs.

## Curated font list

Bundled or system-safe choices, chosen to span styles people actually
want for documents:

- **Source Serif 4** (krill default; transitional serif)
- **Inter** (krill default; humanist sans)
- **JetBrains Mono** (krill default; mono)
- **Charter** (old-style serif, often pre-installed)
- **Georgia** (old-style serif, ubiquitous)
- **Times New Roman** (classical serif)
- **Helvetica** (geometric sans)
- **system-ui** (whatever the user's OS picks)

Both pickers offer the same eight options. The heading and body can
be the same font (sometimes you want that). System fallbacks at the
CSS level so missing fonts degrade quietly to the next stack entry.

## Architecture

### Shell-family layout

```
+--- Markdown Viewer ---------------------------------------------+
| [☰]                                                  ─ □ ✕     |
+------------+----------------------------------------------------+
|            |                                                    |
|  TYPOGRAPHY|         # The Quiet Stack                          |
|            |                                                    |
|  Heading   |         A short essay on building software         |
|  [Source   |         that gets out of the way.                  |
|   Serif 4▾]|                                                    |
|  [22 px ▾] |         ## On opinionated defaults                 |
|            |                                                    |
|  Body      |         The product is the calm; the calm comes…   |
|  [Inter ▾] |                                                    |
|  [16 px ▾] |                                                    |
|            |                                                    |
|            |                                                    |
| v0.1.0     |                                                    |
+------------+----------------------------------------------------+
```

Shell-family chrome (same as file-drop / photo-importer):
- No titlebar — hamburger top-left of sidebar, window controls
  top-right of main pane, drag region across both top strips
- No status line — version pinned at bottom of sidebar
- Sidebar lightly tinted, main is pure Ghost White

### Sidebar contents

- Four typography controls (the only thing in the sidebar)
- Version footer

No file list / recents / favorites in v1. One window = one file.

### File handling

- **Open** (`Ctrl+O`): file dialog filtered to `.md`
- **CLI**: `krill-markdown-viewer path/to/file.md` opens that file
- **Drag-drop**: drop a `.md` onto the window
- **File association**: `.md` registered as a candidate handler
  (alongside markdown-editor — Linux's "Open with…" picks between
  them; user chooses default)
- **No save / no edit** — strictly a viewer

### File watching for live updates

Once a file is open, watch it with the `notify` crate (Rust side).
On every change event:

1. Re-read the file
2. Re-render the markdown
3. Preserve scroll position if reasonable

The watch is debounced at 80ms so a rapid save burst (text editors
sometimes do atomic-rename which fires multiple events) renders once.

The viewer makes no assumption about *which* editor wrote the file.
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

No reason for the viewer to render less than the editor's preview —
that'd be a regression. The renderer code can either be lifted
verbatim or extracted into a small shared package later.

## What v1 is

- Open a `.md` file (CLI arg / dialog / drag-drop / file-association)
- Render with full markdown-editor parity (KaTeX, Mermaid, hljs,
  task lists, front-matter)
- Sidebar with four typography knobs (heading font + size, body font
  + size); choices persist to `settings.json`
- Live update on file change (notify-based watch, 80ms debounce)
- Shell-family chrome (no titlebar / no status line)
- Linux x86_64 · AppImage + .deb · in-app updater

## What v1 is *not*

- **No editing.** It's a viewer. Period.
- **No multi-document tabs.** One window per file (krill rule).
- **No export to HTML / PDF.** Deferred — easy to add later as a
  menu action that respects the live typography choices.
- **No table-of-contents sidebar** (the SPEC's sidebar slot is
  reserved for the typography controls and the version label).
- **No theme switcher.** Light-only, no dark mode toggle. The
  palette inverts via `prefers-color-scheme`, same as every krill app.
- **No additional typography knobs.** See "Hard scope" above.
- **No saving the user-provided file in any way.**

## Future (deferred decisions)

- **Export to HTML / PDF** — natural next milestone. Self-contained
  HTML (bundle the chosen fonts as `@font-face` data URIs) is the
  simplest path; print stylesheet plus webview-to-PDF for the print
  flow.
- **Outline / TOC overlay** — could surface in a popover or a brief
  overlay, *not* as a permanent panel — preserves the calm.
- **Linked viewer mode** — markdown-editor could spawn a viewer
  pointed at the file currently being edited via a small action
  (`Ctrl+Shift+P`). Editor stays uncoupled (just shells out), viewer
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

- **M1 — Render + sidebar controls.** Scaffold (shell-family chrome
  mirroring file-drop / photo-importer). Open a `.md` via CLI arg /
  Ctrl+O / drag-drop. Render with the markdown-editor pipeline.
  Sidebar has the four pickers; changing them updates the rendered
  view live (no persistence yet, no file watching yet).
- **M2 — File watching.** notify-based watcher, 80ms debounce.
  Re-renders on every save. Preserves scroll position.
- **M3 — Persist font choices.** Save the four picks to
  `settings.json`. Restore on launch. Per-file overrides are out of
  scope — choices are app-global, the user's "I prefer this look."
- **M4 — Polish + packaging.** Per-app docs landing page (rich style,
  chrome.css). README. AppImage + .deb. Updater wiring. Add card
  to org site.
