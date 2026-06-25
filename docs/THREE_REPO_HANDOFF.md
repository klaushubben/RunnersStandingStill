# Three Repo Handoff

Working model:

1. `RunnersStandingStill` owns the artwork source and project archive.
2. `GenArtContract` owns Solidity contracts, Foundry tests, and deployment staging.
3. `Klausblocks` owns the public website, mint UI, and display viewers.

## Recommended GitHub Setup Order

### 1. RunnersStandingStill

Create the artwork repo first.

Commit:

- `current/source/sketch.runners-standing-still.js`
- `current/artifacts/sketch.runners-standing-still.min.js`
- `current/MANIFEST.md`
- `ARTIFACT_FLOW.md`
- `README.md`
- `REPO_SETUP.md`
- `archive/`, `labs/`, `viewers/`, `test-artifacts/`, `docs/`, `tools/`

This repo is the human-readable artwork source of truth.

### 2. GenArtContract

Commit contract work after the Runners repo exists.

Important current changes:

- Solady dependency/submodule files
- `src/RunnerRenderer.sol`
- `src/RunnerToken.sol`
- `test/Runner.t.sol`
- `foundry.toml`
- `foundry.lock`
- `artifacts/runners-standing-still/sketch.runners-standing-still.min.js`
- `artifacts/runners-standing-still/MANIFEST.md`
- `ARTIFACT_FLOW.md`
- `REPO_SETUP.md`

Run before committing:

```sh
forge test -vv
```

### 3. Klausblocks

Commit site work after the renderer artifact has been tested in `GenArtContract`.

Important current files:

- `README.md`
- `.gitignore`
- `projects/runners-standing-still/index.html`
- `projects/runners-standing-still/style.css`
- `projects/runners-standing-still/mint.js`
- `projects/runners-standing-still/screen-viewer.html`
- `projects/runners-standing-still/sketch.runners-standing-still.min.js`
- `projects/runners-standing-still/ARTIFACT_MANIFEST.md`
- `projects/runners-standing-still/README.md`
- `projects/runners-standing-still/thumbs/`
- `tools/generate-runner-thumbnails.mjs`
- `tools/generate-runner-feedback-thumbnails.mjs`

This repo consumes the tested minified artifact; do not edit renderer source here.

## Artifact Identity

Current minified renderer SHA-256:

```text
24df99a6eadd787f57d015df2726243edd239c2b03156a3cfcb676801befd145
```

Current minified renderer size:

```text
23037 bytes
```

