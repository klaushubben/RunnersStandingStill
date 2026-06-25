# Runners Standing Still Contract Handoff

Last updated: 2026-05-30

## Project Identity

- Project name: Runners Standing Still
- Token symbol: RUNNER
- Artwork repo path: `/Users/nickhubben/Sandbox/TextureMelt/Apr5_staticmelt`
- Active renderer: `sketch.runners-standing-still.js`
- Preview page: `index.runners-standing-still.html`
- Browser autorunner: `index.runners-standing-still.autorunner.html`
- Batch runner: `scripts/render-batch.mjs`

The external artwork folder still uses the historical codename. Contract-facing naming should use `Runners Standing Still` for the project and `RUNNER` for the token.

## Hosting Direction

This project is intended to be self-hosted and minted through Nick's own Solidity contracts, not Art Blocks.

Development should still preserve useful Art Blocks-like conventions:

- Deterministic rendering from a token hash.
- Single-file vanilla JavaScript renderer where possible.
- No p5 dependency in the active contract-facing renderer.
- No external image assets.
- No IPFS/Arweave gateway assumptions in renderer input.
- Renderer should be suitable for chunking/storage or contract-served script assembly later.

## Renderer Input Contract

The canonical browser input is:

```js
globalThis.renderInput = {
  hash: "0x...",
  tokenId: "123",
  contractAddress: "0x...",
  chainId: "1",
  minter: "0x..."
}
```

`hash` must be a 32-byte hex string matching `/^0x[0-9a-fA-F]{64}$/`.

The renderer currently accepts these fallbacks for compatibility:

```js
globalThis.renderInput ||
globalThis.contractTokenData ||
globalThis.tokenData ||
query-string preview values
```

It then normalizes and re-exports:

```js
globalThis.renderInput = renderInput;
globalThis.tokenData = renderInput;
```

`tokenData` is only a compatibility alias. New contract work should prefer `renderInput`.

## Runtime Output API

On setup, the renderer exposes:

```js
globalThis.__runnersStandingStill
globalThis.__generativeRender
globalThis.__textureMelt // legacy alias from the historical renderer name
```

The canonical completion event is:

```js
runners-standing-still:complete
```

Completion detail includes:

```js
{
  projectName: "Runners Standing Still",
  tokenSymbol: "RUNNER",
  renderInput,
  tokenData: renderInput,
  features,
  settings,
  renderMs
}
```

Legacy events are still emitted for current tooling compatibility:

```js
generative-render:complete
texturemelt:complete
```

## Canvas And Render Dimensions

The artwork uses fixed 4K-friendly dimensions:

```txt
imageWidth: 3840
imageHeight: 2160
matte: 96
canvasWidth: 4032
canvasHeight: 2352
matteColor: #ffffff
```

The matte/frame is rendered into the canvas and should be included in token image output.

The active renderer uses progressive batched drawing:

```txt
renderBatchSize: 8
columnStep: 2
```

## Determinism

The renderer uses a local `Random` class seeded from the 32-byte hash:

- first 128 bits seed `prngA`
- second 128 bits seed `prngB`
- both use `sfc32`
- PRNG is warmed up before feature selection

Noise uses a hash-derived integer `noiseSeed` and a custom vanilla JavaScript Perlin-style `NoiseField`.

No `Math.random()` should be used for deterministic artwork decisions.

## Current Feature Ranges

Current high-level choices:

```txt
paletteMode: diverging | split-complement
sourceMode: gradient | stripes
noiseType: perlin
backgroundMode weighted:
  palette-dark: 3.4
  palette-light: 1
  warm-paper: 1
  cool-paper: 1
```

Current geometry/noise ranges:

```txt
meltStrength: 4..7
verticalStretch: 0.3..0.8
targetDrift: -0.16..0.24
noiseBias: derived from verticalStretch, meltStrength, targetDrift
noiseStepX: 0.00028..0.0007
noiseStepY weighted:
  15%: 0.0009..0.00135
  85%: 0.00135..0.003
noiseZ: 1..20
harmonicAmount weighted:
  8%: 0..0.08
  92%: 0.16..0.4
harmonicScale: 1..3.5
tilt: 0.08..0.3
alpha: 50..120
noiseOctaves: 2
noiseFalloff: 0.05
```

Noise bias is intentionally derived:

```js
neutralNoiseBias = 0.5 + verticalStretch / meltStrength;
noiseBias = 0.5 + (verticalStretch - targetDrift) / meltStrength;
effectiveSlope = verticalStretch + meltStrength * (0.5 - noiseBias);
```

`effectiveSlope` should equal `targetDrift`. This is used to avoid compositions where the melt sits overwhelmingly above or below the tilted centerline.

## Palette System

The renderer uses OKLab/OKLCH helpers directly in vanilla JS.

Current palette modes:

- `diverging`
- `split-complement`

Split-complement has additional relationship choices:

```txt
near-complement
split-complement
wide-split
warm-analog
soft-triadic
```

Other split-complement settings:

```txt
splitRole: undertone | middle-flash | deep-accent | two-accent
splitAccentDirection: -1 | 1
splitAngle: 18..54
textureCornerLayout: normal | flip-x | flip-y | rotate
splitAccentStrength: 1
splitHueFamily: any
```

Base hue is weighted toward warm/magenta regions but still permits cooler ranges:

```txt
4..72 weight 4.5
330..360 weight 1.65
286..330 weight 1.25
190..286 weight 0.85
68..150 weight 0.28
150..190 weight 0.15
```

Dark backgrounds are intentionally generated as colored dark grounds in OKLCH rather than by RGB-crushing arbitrary palette swatches.

## Contract Integration Notes

Recommended contract-side assumptions:

- Store or assemble the renderer as vanilla JavaScript/HTML without external dependencies.
- Provide at minimum `hash` and `tokenId` to the browser renderer.
- Optionally provide `contractAddress`, `chainId`, and `minter`; these are already accepted by the renderer.
- Do not include IPFS/Arweave gateway fields unless a future project explicitly needs external assets.
- Keep metadata/traits derived from the same feature selection code used by the renderer.

Useful metadata fields to expose from contract or off-chain indexing:

```txt
Palette
Palette Mode
Background Mode
Noise Type
Source Mode
Palette Relationship
Split Role
Split Accent Direction
Texture Corner Layout
```

The full deterministic settings object is currently emitted to JSON by the local batch runner for debugging and range analysis. Final token metadata can be a smaller curated trait subset.

## Open Questions

- Final contract architecture for multi-project support is still being developed in `GenArtContract`.
- Decide whether renderer source will be fully on-chain, chunked on-chain, or contract-referenced from a self-hosted endpoint.
- Decide whether token hash is minted/stored directly, derived from block data, derived from a seed committed at mint, or supplied by the contract owner.
- Rename or remove remaining legacy aliases once contract tooling no longer depends on them.
- Revisit autorunner page and update it to the new `renderInput`/`runners-standing-still:complete` conventions.
