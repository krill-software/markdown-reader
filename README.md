# Markdown Reader

> A markdown reader with live file watch and one carefully set
> typography.

Part of the [krill](https://krill.software) umbrella of small, calm,
single-purpose Linux apps. See [SPEC.md](SPEC.md) for the full design.

## Why split it off from markdown-editor

The editor is an **authoring** surface — muted syntax look, locked on
purpose, calm while writing. The **rendered output** wants a reading
typography instead: a book-like serif at a comfortable measure.
Splitting keeps both opinionated
without either becoming a settings panel.

## Status

Open a `.md` (CLI arg, dialog, drag-drop), live-reload on save, find
in document, contents list in the sidebar.

## License

MIT
