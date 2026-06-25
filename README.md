# Runners Standing Still

Standalone working folder for the evolved Runners project.

## Folder Map

- `current/` - canonical current renderer source, contract preview, and packaged artifacts.
- `viewers/` - website-facing project page and display viewers.
- `labs/` - research and tuning tools, including the weight lab.
- `test-artifacts/` - copied thumbnails and decoded local mint outputs.
- `archive/` - older exploratory branches preserved for reference.
- `docs/` - handoffs, staging checklists, and audit notes.
- `tools/` - helper scripts copied from site/contract repos.

## Source Of Truth

The current unminified renderer is:

```text
current/source/sketch.runners-standing-still.js
```

The current minified renderer artifact is:

```text
current/artifacts/sketch.runners-standing-still.min.js
```

This folder is meant to preserve the artwork project as its own unit. The contract repo should consume `current/artifacts/`; the Klausblocks site should consume a copied minified renderer plus viewer/page files.
