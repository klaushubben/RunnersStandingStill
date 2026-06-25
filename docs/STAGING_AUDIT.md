# TextureMelt Staging Audit

Current target: static vanilla Canvas 2D generator for Art Blocks staging on Ethereum.

## Current Project State

- Active sketch: `sketch.optimized.artblocks.js`
- Staging script: `static-melt/sketch.runners-standing-still.js`
- Local runner: `runner.html`
- Local command: `npm run dev`
- Script type direction: vanilla `js`, not p5
- Canvas/output size: `3840 x 2160`
- Source texture size: `3840 x 2160`
- Foundry status: installed locally, but this folder does not yet contain a Foundry project.
- Missing Foundry files: `foundry.toml`, `src/*.sol`, `script/*.s.sol`, `test/*.t.sol`, `broadcast/`

## Art Blocks Fit

The active sketch already has useful Art Blocks-like pieces:

- Uses `tokenData.hash` as the seed source when `tokenData` exists.
- Has a local `tokenData` fallback for previewing.
- Derives visual decisions in `pickFeatures()`.
- Assigns `globalThis.$features`.
- Uses no p5 in the optimized sketch.
- Uses no external runtime library for the optimized sketch.

Items still needed before staging:

- Continue hardening the production generator file extracted from the runner/module version.
- Use the canvas provided by the Art Blocks vanilla JS wrapper.
- Decide which current UI controls become hash-derived traits and which become fixed constants.
- Add a determinism check using fixed hashes.

Initial staging extraction:

- `static-melt/sketch.runners-standing-still.js` is a single-file vanilla script with no module exports.
- It uses the Art Blocks-style `tokenData` global when present.
- Local fallback uses a fixed preview hash or `?hash=...`, never `Math.random()`.
- It renders a fixed white `96px` matte into the canvas.
- It preserves progressive batched rendering with `requestAnimationFrame`.

## Current Hash-Derived Ranges

These are currently chosen in `pickFeatures()`.

| Parameter | Current random/default behavior |
| --- | --- |
| `paletteIndex` | random fixed palette index, but ignored when procedural palette mode is selected |
| `backgroundIndex` | random index into selected fixed palette |
| `paletteMode` | fixed to `fixed` |
| `backgroundMode` | fixed to `palette-dark` |
| `paletteBaseHue` | `0..360` |
| `paletteAccentOffset` | `-18..18` |
| `paletteDivergeSpread` | `128..172` |
| `backgroundHueOffset` | one of `120`, `180`, `240` |
| `splitHueFamily` | fixed to `any` |
| `splitAccentStrength` | fixed to `0.25` |
| `splitRole` | fixed to `undertone` |
| `noiseSeed` | `1..999999999` |
| `noiseType` | fixed to `perlin` |
| `noiseStepX` | `0.0009..0.0011` |
| `noiseStepY` | `0.0009..0.0011` |
| `noiseZ` | `0..20` |
| `harmonicAmount` | fixed to `0.12` |
| `harmonicScale` | fixed to `2.25` |
| `noiseBias` | `0.47..0.48` |
| `meltStrength` | `3.85..4.15` |
| `tilt` | `0.09..0.11` |
| `verticalStretch` | `0.485..0.515` |
| `alpha` | integer `50..60` |
| `noiseOctaves` | fixed to `2` |
| `noiseFalloff` | fixed to `0.22` |
| `columnStep` | fixed to `1` |
| `sourceMode` | fixed to `gradient` |
| `thinWhiteLines` | fixed to `false` |
| `renderBatchSize` | one of `4`, `6`, `8`, `12`; local rendering concern only |

## Current UI Exploration Ranges

These ranges exist in `props` for local auditioning. They are broader than the settled random ranges.

| Parameter | UI range/options |
| --- | --- |
| `paletteMode` | `fixed`, `split-complement`, `diverging` |
| `backgroundMode` | `palette-dark`, `palette-light`, `palette-companion`, `warm-paper`, `cool-paper`, `painterly-paper` |
| `splitHueFamily` | `any`, `warm`, `earth`, `cool`, `acid` |
| `splitAccentStrength` | `0..1` |
| `splitRole` | `undertone`, `middle-flash`, `deep-accent`, `two-accent` |
| `noiseType` | `perlin`, `domain-warped-perlin` |
| `noiseStepX` | `0.0001..0.004` |
| `noiseStepY` | `0.0001..0.004` |
| `noiseZ` | `0..20` |
| `harmonicAmount` | `0..0.5` |
| `harmonicScale` | `1..4` |
| `meltStrength` | `1..8` |
| `tilt` | `0..0.35` |
| `verticalStretch` | `0.25..0.85` |
| `noiseBias` | `0.35..1` |
| `noiseOctaves` | `1..8` |
| `noiseFalloff` | `0.05..0.75` |
| `alpha` | `10..120` |
| `columnStep` | `1..8` |
| `sourceMode` | `gradient`, `stripes` |
| `thinWhiteLines` | boolean |
| `showTextureMap` | boolean, local runner only |
| `renderBatchSize` | `1..64`, local runner only |

## Recommended Staging Decisions

Current user-notated staging decisions:

| Parameter | Staging decision |
| --- | --- |
| `imageWidth` | `3840` |
| `imageHeight` | `2160` |
| `matte` | fixed `96px`, rendered into canvas |
| `canvasWidth` | `4032` |
| `canvasHeight` | `2352` |
| `noiseType` | fixed `perlin` |
| `noiseStepX` | `0.00028..0.0007` |
| `noiseStepY` | `0.0009..0.003`; raised after labeled analysis showed low values overrepresented in dislikes |
| `noiseZ` | `1..20` |
| `harmonicAmount` | weighted: ~18% edge cases at `0..0.08`, otherwise `0.12..0.4` |
| `harmonicScale` | `1..3.5` |
| `meltStrength` | `4..7` |
| `tilt` | `0.08..0.3` |
| `verticalStretch` | `0.3..0.8` |
| `noiseBias` | derived 1:1 from tested anchors: `meltStrength 2 -> 0.8`, `meltStrength 7 -> 0.5`; current `4..7` range maps to `0.68..0.5` |
| `noiseOctaves` | fixed `2` |
| `noiseFalloff` | fixed `0.05` |
| `alpha` | integer `50..120` |
| `columnStep` | fixed `2` |
| `sourceMode` | `gradient`, `stripes` |
| `thinWhiteLines` | fixed `false` |
| `showTextureMap` | fixed `false`; not part of production output |
| `paletteMode` | `diverging`, `split-complement` |
| `backgroundMode` | weighted: `palette-dark` 2.25, `palette-light` 1, `warm-paper` 1, `cool-paper` 1 |
| `matteColor` | fixed white for now |
| `splitHueFamily` | fixed `any` |
| `splitAccentStrength` | fixed `1` |
| `splitRole` | `undertone`, `middle-flash`, `deep-accent`, `two-accent` |
| option weighting | palette/source/split options equal for now; background mode is weighted toward dark |
| `paletteBaseHue` | pushed test: orange/yellow-red strongly favored, magenta increased, greens/cyan heavily reduced |
| palette chroma | pushed test via `PALETTE_CHROMA_PUSH = 1.32`; split-complement and diverging chroma intentionally overdriven for auditioning |
| render behavior | progressive batched render with static `renderBatchSize = 8` |

Good candidates to become token traits:

- Palette Mode
- Palette Family
- Background Mode
- Source Mode
- Linework
- Noise Field
- Harmonic Depth
- Melt Energy
- Tilt
- Density

Good candidates to freeze:

- Canvas aspect ratio and fixed matte
- `columnStep = 2`
- `noiseOctaves = 2`
- `noiseFalloff = 0.05`
- Smart y-anchor calculation
- Source texture preview hidden from production output
- White matte/frame included in the Art Blocks canvas render

Needs a final call:

- Whether `domain-warped-perlin` survives as a rare trait or stays out.
- Noise bias range and named trait categories.
- Final palette hue/accent/divergence/offset settings.

## Staging Path

1. Create a production `index.html` and single-file vanilla `sketch.artblocks.prod.js`.
2. Convert `features` into final hash-derived decisions only.
3. Remove local UI-only controls from the production script.
4. Add deterministic test hashes and compare repeated PNG output.
5. Initialize Foundry only after the generator is packaged, because Foundry will manage deployment/staging metadata rather than fix generator determinism.
6. Add contract/deploy scaffolding once the target Art Blocks staging contract flow is chosen.
