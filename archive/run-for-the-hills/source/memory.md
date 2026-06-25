# Run for the Hills - Thread Handoff

## Project Direction

This is a new fork idea from the RUN word sketch, tentatively titled **"run for the hills"**.

The piece should keep only the core **RUN-as-brush** idea from the current stitch/RUN fork, and may otherwise become a substantial rewrite.

Chosen first direction: **Ridge Bands**.

## Visual Intent

- Use the word `RUN` as the mark/brush.
- Build a landscape from stacked hill/ridge bands.
- Foreground should feel calm, flatter, and less turbulent.
- Background should become increasingly hilly as calculated depth/z-space recedes.
- The image should read as a static landscape, not just a texture field.
- The title/idea connects to **"run for the hills"** while still fitting the broader "Runners Standing Still" exploration.

## Current Reusable Source

Likely source fork before this folder is moved:

`/Users/nickhubben/Sandbox/TextureMelt/Apr5_staticmelt/stitch/`

Important files:

- `sketch.runners-standing-still.stitch-field.js`
- `index.runners-standing-still.stitch-field.html`

Copied seed files now included in this folder:

- `seed/sketch.run-brush-seed.js`
- `seed/index.run-brush-seed.html`

These are not meant to be the final **run for the hills** implementation. They are copied seed material so a new thread can reuse the `RUN` brush, deterministic PRNG, local noise, preview controls, and live redraw scaffolding without depending on the old project folder.

Reusable pieces from that fork:

- Leon Sans single-line `RUN` glyph paths:
  - `LEON_RUN_GLYPHS`
  - `drawRunWord(...)`
- Deterministic hash/PRNG setup.
- Local vanilla JS Perlin-style `NoiseField`.
- Preview UI pattern with query params and random hash button.
- Optional live ETH epoch redraw scaffolding, if useful later.

## Current RUN Fork Notes

The current RUN fork is still structurally based on the previous melt renderer:

- Iterates source texture columns/rows.
- Computes noise/melt displacement.
- Places `RUN` words at sampled positions.
- Recently forced `sourceMode = "stripes"`.
- Has monochrome mode:
  - near-black inner background
  - off-white `RUN` marks
- Has controls for:
  - word angle
  - word size
  - row step
  - column step
  - letter spacing
  - monochrome

For **run for the hills**, do not assume this architecture should stay. The likely better model is a purpose-built ridge-band landscape renderer.

## Suggested First Implementation Shape

Create a new HTML/JS preview in this folder.

Recommended v1 renderer:

- Fixed 4K-friendly canvas and matte, matching prior sketches.
- Deterministic features from hash.
- Generate multiple horizontal ridge bands from back to front or front to back.
- Each band has:
  - a depth value `z` from foreground to background
  - a baseline screen Y
  - height/noise amplitude that increases with depth/background
  - frequency/detail that increases with depth/background
  - density of `RUN` marks controlled by depth
  - word size likely larger in foreground and smaller in background, unless audition suggests otherwise
- Draw `RUN` marks along/inside the ridge bands rather than following the old melt-column algorithm.

## Open Questions For New Thread

- Should the new fork start monochrome-only, or keep palette options?
- Should ridges be drawn as silhouettes filled with `RUN`, as contour edges made of `RUN`, or both?
- Should the background/horizon have atmosphere/fade?
- Should live ETH epoch redraw behavior be included in v1 or left out until the static landscape works?
