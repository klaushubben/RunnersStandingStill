# Current Manifest

Snapshot created during repo organization.

## Source Renderer

```text
current/source/sketch.runners-standing-still.js
bytes: 50509
sha256: 5191f552454a9d54555a608f9e1a37aa73d371c4776cf64cfae479d555306409
```

Source has diverged from TextureMelt original:

```text
/Users/nickhubben/Sandbox/TextureMelt/Apr5_staticmelt/contract-deterministic-renderer/sketch.runners-standing-still.contract.js
```

(Hash-native trait derivation added; see changelog below.)

## Minified Renderer

```text
current/artifacts/sketch.runners-standing-still.min.js
bytes: 21209
sha256: dbc39fc7f821a3ac991d67bbaad87da2d87fd4ff9550234f4bdff6055da1c246
```

Matches downstream copies at:

```text
/Users/nickhubben/Sandbox/GenArtContract/artifacts/runners-standing-still/sketch.runners-standing-still.min.js
/Users/nickhubben/Sandbox/Klausblocks/projects/runners-standing-still/sketch.runners-standing-still.min.js
```

## Changelog

**Latest** — Dead-code audit: removed unused 2D noise chain (`fbm`/`sampleBase`/`perlin`/`grad`), the dormant `domain-warped-perlin` mode, `guidedSplitHue`/`hueFromRanges` (pinned to identity), `neutralLiveState`, unread feature fields (`neutralNoiseBias`, `noiseBiasDelta`, `effectiveSlope`, `splitHueFamily`), and consolidated three OKLab->RGB matrix copies into one. No PRNG draws touched. Verified output-identical against pre-audit source across all source-texture modes and both palette families (draw-stream checksums, ~4.3M ops/render); minified artifact verified identical to source the same way. Trait parity re-verified for 38 seeds; Anvil roundtrip green.

**Previous** — Traits now derived in the art script from raw hash bits, matching on-chain `RunnerRenderer._traits` derivation. SVG thumbnails, metadata attributes, and canvas renders now agree. Legacy `window.__runnerTraits` injection hook removed; PRNG draws formerly used for trait selection are burned to maintain stable downstream draw positions.

