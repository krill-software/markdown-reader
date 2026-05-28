# Markdown Viewer

> A markdown viewer with live file watch and the two typography knobs
> the rendered document needs to feel like yours.

Part of the [krill](https://krill.software) umbrella of small, calm,
single-purpose Linux apps. See [SPEC.md](SPEC.md) for the full design.

## Why split it off from markdown-editor

The editor is an **authoring** surface — typography there is locked
on purpose. Calmness while writing is the point. But the **rendered
output** is your artifact, not ours; you should be able to pick the
typography it gets rendered with. Splitting solves both: editor stays
opinionated, viewer carries the four knobs (heading font + size, body
font + size) and nothing else.

## Status

Pre-v1. M1: open a `.md`, render it, change typography from the
sidebar. M2 (file watching for live updates) and M3 (persisted font
choices) are next.

## License

MIT
