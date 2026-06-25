# Runners Standing Still Staging Checklist

This is the working checklist for self-hosted contract and mint-flow staging.

Status key:

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[?]` needs Nick decision

## 1. Renderer Package

- [x] Confirm active renderer path: `/Users/nickhubben/Sandbox/TextureMelt/Apr5_staticmelt/sketch.runners-standing-still.js`
- [x] Confirm active preview wrapper: `/Users/nickhubben/Sandbox/TextureMelt/Apr5_staticmelt/index.runners-standing-still.html`
- [x] Validate deterministic constraints with `node tools/runners/check-staging.mjs`
- [x] Generate Terser-minified renderer artifact
- [ ] Browser-verify minified renderer matches unminified renderer for fixed hashes
- [x] Confirm final renderer artifact fits one SSTORE2 chunk
- [x] Measure final renderer `tokenURI` gas and payload size in Foundry
- [x] Choose production script artifact: reviewed Terser-minified renderer

## 2. Local Contract Roundtrip

- [x] Create self-host staging token/minter contract
- [x] Create self-host renderer wrapper that injects `window.renderInput`
- [x] Test sale active, price checks, max supply, `tokenURI`, and script updates
- [x] Add local Anvil roundtrip script:
  - deploy renderer and token
  - load minified Runners script
  - mint token
  - read `tokenURI`
  - decode JSON
  - decode `animation_url`
  - write local preview artifacts
- [x] Add local preview output directory under `artifacts/runners-standing-still/local-mint/`
- [x] Execute local Anvil deploy/mint/decode roundtrip
- [x] Browser-render decoded local mint HTML and capture completion/screenshot
- [~] Re-run local Anvil roundtrip against current final artifact

## 3. Mint Behavior

- [x] Choose staging mint price: `0.0222 ETH`
- [x] Choose staging max supply: `222`
- [x] Choose per-wallet mint rule: none for first testnet pass
- [x] Choose sale activation model: manual owner toggle
  - manual owner toggle
- [x] Choose owner mint policy: owner mints allowed
- [x] Add tests for chosen mint behavior

## 4. Seed / Hash Model

- [x] Choose testnet seed model: `keccak256(block.prevrandao, to, tokenId, address(this))`
- [x] Add tests for chosen seed behavior
- [ ] Ensure `renderInput.hash` exactly matches stored token seed

## 5. Mainnet Storage Strategy

- [x] Replace `string script` staging path with Solady SSTORE2 script storage
- [x] Prototype bytecode/SSTORE2-style script storage
- [ ] Capture deploy/write gas from Anvil or testnet receipts
- [x] Choose production storage strategy: Solady SSTORE2
- [x] Choose freeze policy: freeze renderer after test mint and final review

## 6. Testnet Staging

- [x] Add Foundry tests that load the final minified renderer artifact
- [x] Confirm final renderer artifact is `23,037` bytes
- [x] Confirm final renderer uses `1` SSTORE2 chunk
- [x] Confirm final `tokenURI` gas is below conservative call caps
- [ ] Run Anvil deploy/mint/decode roundtrip for current artifact
- [ ] Choose first public testnet: Sepolia or Holesky
- [ ] Choose funded deployer wallet for testnet
- [ ] Deploy renderer and token to testnet
- [ ] Owner-mint token `1` on testnet
- [ ] Verify `tokenURI` from a public RPC
- [ ] Browser-render decoded testnet `animation_url`
- [ ] Update website config with testnet token address

## 7. Website Mint UI

- [ ] Define contract read surface needed by UI
- [ ] Define transaction write surface needed by UI
- [ ] Mock local mint page against Anvil
- [ ] Show supply, sale status, price, and connected wallet
- [ ] Mint and preview decoded token output
- [?] Choose wallet stack: plain viem, wagmi/RainbowKit, Privy, or other
- [x] Keep live RPC behavior embedded in the on-chain renderer

## Current Working Assumptions

- Project name: `Runners Standing Still`
- Token symbol: `RUNNER`
- Staging max supply: `222` (likely to change)
- Staging mint price: `0.0222 ETH`
- First staging sale mode: manual owner toggle, no per-wallet cap
- Owner mints remain allowed
- Renderer freeze happens after test mint and final review
- Self-hosted minting; not Art Blocks deployment
- Renderer input is `window.renderInput`
- `window.tokenData` remains a compatibility alias only
- No external JS/image dependencies
- Live RPC behavior remains embedded in the on-chain renderer
- Current minified renderer script is `23,037` bytes and fits in one SSTORE2 chunk
- Current measured `tokenURI` gas for final artifact is `4,817,392`
