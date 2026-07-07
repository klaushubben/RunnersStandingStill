# Contract Deterministic Renderer

This fork is a cleanup branch for moving `Runners Standing Still` back toward a compact self-hosted / contract-integrated renderer.

## Files

- `index.runners-standing-still.contract-preview.html` is a local preview harness.
- `sketch.runners-standing-still.contract.js` is the renderer candidate.

## Current Direction

The renderer still supports preview URL overrides, but the important artwork choices now default from the token / transaction hash via the local PRNG.

Hash-determined choices include:

- source texture mode: `gradient-4pt`, `bw-lerp-field`, `bw-stripes-gradient-slice`
- palette family: `diverging` or `split-complement`
- black vs palette-generated background
- B/W temperature: `neutral`, `warm`, `cool`
- decomposition mode: byte-mask / dither family
- dither pattern: `bayer-4`, `bayer-8`, `line`
- dither levels and block size

Plain B/W stripes and decomposition-off are intentionally excluded from the active trait space. B/W modes use warm, cool, or neutral near-black/near-white values rather than pure `#000000` / `#ffffff`.

## Render Lifecycle

- `initialized` means setup has created the canvas, source texture, noise field, matte, and background.
- `completed` means the deterministic render pass has traversed the source texture and `renderX >= renderWidth`.
- Completion events are emitted only after the deterministic pass completes.
- Live epoch drawing starts after deterministic completion.
- If RPC calls fail or the viewer is offline, `liveState` falls back to deterministic values derived from `renderInput.hash`, so the live loop still has a stable offline state.
- `liveState.source` is `rpc` or `hash-fallback`.

## Cleanup Notes

- Removed `chroma-blocks`; the visual difference was too subtle in this algorithm.
- Removed `composite steps`; the active decomposition direction is now draw-time byte/dither logic.
- Kept `byte-mask-dither-levels` as the likely strongest candidate from recent tests.

## Contract Integration Questions

- Decide how the contract will pass token entropy into `renderInput.hash`.
- Decide whether live epoch/block mutations remain part of this contract-facing fork or become a separate live-view mode.
- Decide final trait names and weightings before encoding metadata.
- Revisit palette generation as a unified system: source texture, gradient slice, B/W temperature, background, and decomposition should share one coherent palette model.
