const config = window.RUNNER_MINT_CONFIG || {};

const state = {
  rendererScript: "",
  manifestVersion: "",
  sortMode: "recent",
  samples: [],
  totalSupply: Number(config.initialMintedCount || 0),
  account: "",
  minting: false,
};

const els = {
  randomPreview: document.querySelector("[data-random-preview]"),
  previewHash: document.querySelector("[data-preview-hash]"),
  previewShell: document.querySelector("[data-preview-shell]"),
  previewFrame: document.querySelector("[data-preview-frame]"),
  fullscreenOpen: document.querySelector("[data-fullscreen-open]"),
  fullscreenClose: document.querySelector("[data-fullscreen-close]"),
  previewOverlay: document.querySelector("[data-preview-overlay]"),
  walletToggle: document.querySelector("[data-wallet-toggle]"),
  mintRandom: document.querySelector("[data-mint-random]"),
  mintedCount: document.querySelector("[data-minted-count]"),
  mintedGrid: document.querySelector("[data-minted-grid]"),
  sortButtons: document.querySelectorAll("[data-sort]"),
  traits: document.querySelectorAll("[data-trait]"),
  liveSource: document.querySelector("[data-live-source]"),
  liveBlock: document.querySelector("[data-live-block]"),
  liveEpoch: document.querySelector("[data-live-epoch]"),
};

const featureKeys = {
  "Source Texture": "src",
  "Palette Mode": "pm",
  Decompose: "dec",
  "Dither Pattern": "dit",
  "Decompose Block Size": "dbs",
  "Composite Levels": "cl",
  "B/W Temperature": "bwt",
};

const featureLabels = {
  pm: {
    div: "diverging",
    split: "split complement",
  },
  bg: {
    black: "black",
    dark: "palette dark",
    light: "palette light",
  },
  src: {
    g4: "gradient-4pt",
    rs: "rich stripes",
    gs: "grayscale",
  },
  dec: {
    mask: "mask",
    "mask-dither": "mask dither",
    "mask-levels": "mask levels",
    "ordered-levels": "ordered levels",
  },
  dit: {
    b4: "bayer-4",
    b8: "bayer-8",
    line: "line",
  },
};

init();

async function init() {
  wireEvents();
  updateWalletUi();
  await loadRendererScript();
  await loadSampleManifest();
  renderMintedCount();
  refreshTotalSupply();
  renderRandomPreview();
  renderSampleGrid();
}

function wireEvents() {
  els.randomPreview.addEventListener("click", renderRandomPreview);
  els.walletToggle.addEventListener("click", toggleWallet);
  els.walletToggle.addEventListener("mouseenter", showDisconnectLabel);
  els.walletToggle.addEventListener("mouseleave", updateWalletUi);
  els.walletToggle.addEventListener("focus", showDisconnectLabel);
  els.walletToggle.addEventListener("blur", updateWalletUi);
  els.mintRandom.addEventListener("click", mintRandomIteration);
  els.fullscreenOpen.addEventListener("click", openFullscreenPreview);
  els.fullscreenClose.addEventListener("click", closeFullscreenPreview);
  els.previewOverlay.addEventListener("click", (event) => {
    if (event.target === els.previewOverlay) closeFullscreenPreview();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.previewOverlay.hidden) closeFullscreenPreview();
  });
  window.addEventListener("message", handleRendererMessage);

  els.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.sortMode = button.dataset.sort;
      renderSampleGrid();
    });
  });

  window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
  window.ethereum?.on?.("chainChanged", () => {
    updateWalletUi();
  });
}

function openFullscreenPreview() {
  if (!els.previewOverlay.hidden) return;
  els.previewOverlay.hidden = false;
  document.body.classList.add("has-preview-overlay");
  els.previewShell.classList.add("is-fullscreen");
  requestAnimationFrame(() => {
    els.previewOverlay.classList.add("is-open");
  });
  els.fullscreenClose.focus({ preventScroll: true });
}

function closeFullscreenPreview() {
  if (els.previewOverlay.hidden) return;
  els.previewOverlay.classList.remove("is-open");
  document.body.classList.remove("has-preview-overlay");
  els.previewShell.classList.remove("is-fullscreen");
  els.previewOverlay.hidden = true;
  els.fullscreenOpen.focus({ preventScroll: true });
}

async function loadRendererScript() {
  const response = await fetch("./sketch.runners-standing-still.min.js", { cache: "no-store" });
  if (!response.ok) {
    console.warn("Preview renderer not found.");
    return;
  }
  state.rendererScript = await response.text();
}

async function loadSampleManifest() {
  try {
    const response = await fetch("./mint-thumbnails.json", { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    state.manifestVersion = manifest.generatedAt || String(Date.now());
    state.samples = (manifest.thumbnails || []).map((sample, index) => ({
      id: sample.tokenId || String(index + 1),
      name: sample.name || `Sample #${index + 1}`,
      image: sample.image || "",
      hash: sample.hash || "",
    }));
  } catch {
    state.samples = [];
  }
}

function renderRandomPreview() {
  renderHash(randomHash(), "preview");
}

async function toggleWallet() {
  if (state.account) {
    state.account = "";
    updateWalletUi();
    renderSampleGrid();
    return;
  }

  if (!window.ethereum) {
    alert("No wallet detected.");
    return;
  }

  try {
    await ensureConfiguredChain();
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.account = accounts[0] || "";
    updateWalletUi();
    renderSampleGrid();
  } catch (error) {
    console.warn("Wallet connection failed", error);
  }
}

function handleAccountsChanged(accounts) {
  state.account = accounts[0] || "";
  updateWalletUi();
  renderSampleGrid();
}

function updateWalletUi() {
  const connected = Boolean(state.account);
  els.walletToggle.textContent = connected ? shortAddress(state.account) : "CONNECT";
  els.mintRandom.disabled = !connected || state.minting || !config.tokenAddress;
  els.mintRandom.textContent = state.minting ? "MINTING" : "MINT RANDOM";
}

function renderMintedCount() {
  const maxSupply = Number(config.maxSupply || 222);
  els.mintedCount.textContent = `${state.totalSupply} / ${maxSupply} minted`;
}

async function refreshTotalSupply() {
  if (!config.rpcUrl || !config.tokenAddress) return;

  try {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_call",
        params: [{ to: config.tokenAddress, data: "0x18160ddd" }, "latest"],
      }),
    });
    const payload = await response.json();
    if (!payload.result) return;
    state.totalSupply = Number(BigInt(payload.result));
    renderMintedCount();
  } catch (error) {
    console.warn("Unable to refresh total supply", error);
  }
}

function showDisconnectLabel() {
  if (state.account) {
    els.walletToggle.textContent = "DISCONNECT";
  }
}

async function ensureConfiguredChain() {
  if (!config.chainId || !window.ethereum) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainId }],
    });
  } catch (error) {
    if (error.code !== 4902 || !config.rpcUrl) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: config.chainId,
        chainName: config.chainName || "Runners Standing Still",
        rpcUrls: [config.rpcUrl],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      }],
    });
  }
}

async function mintRandomIteration() {
  if (!state.account || !window.ethereum || !config.tokenAddress) return;

  state.minting = true;
  updateWalletUi();

  try {
    await ensureConfiguredChain();
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: state.account,
        to: config.tokenAddress,
        value: `0x${BigInt(config.mintPriceWei || "0").toString(16)}`,
        data: "0x1249c58b",
      }],
    });
    console.info("Mint transaction submitted", txHash);
    refreshTotalSupply();
  } catch (error) {
    console.warn("Mint failed", error);
  } finally {
    state.minting = false;
    updateWalletUi();
  }
}

function renderHash(hash, tokenId) {
  els.previewHash.textContent = hash;
  resetTraits();
  els.previewFrame.srcdoc = buildHtml({
    hash,
    tokenId,
    contractAddress: config.tokenAddress || "",
    chainId: config.chainId ? String(Number.parseInt(config.chainId, 16)) : "",
    minter: "",
  });
}

function handleRendererMessage(event) {
  if (event.source !== els.previewFrame.contentWindow) return;
  if (event.data?.project !== "runners-standing-still") return;

  if (event.data.type === "initialized" || event.data.type === "complete") {
    renderTraits(event.data.features || {});
  }

  if (event.data.liveState) {
    renderLiveState(event.data.liveState);
  }
}

function resetTraits() {
  els.traits.forEach((trait) => {
    trait.textContent = "pending";
  });
  renderLiveState({ source: "pending", blockNumber: null, epoch: null });
}

function renderTraits(features) {
  els.traits.forEach((trait) => {
    const key = featureKeys[trait.dataset.trait] || trait.dataset.trait;
    const value = features[key] ?? features[trait.dataset.trait];
    const labels = featureLabels[key];
    trait.textContent = value === undefined || value === ""
      ? "none"
      : String(labels?.[value] ?? value);
  });
}

function renderLiveState(liveState) {
  const source = liveState?.source || "pending";
  els.liveSource.textContent = source;
  els.liveBlock.textContent = liveState?.blockNumber === null || liveState?.blockNumber === undefined
    ? "none"
    : String(liveState.blockNumber);
  els.liveEpoch.textContent = liveState?.epoch === null || liveState?.epoch === undefined
    ? "none"
    : String(liveState.epoch);
}

function renderSampleGrid() {
  els.sortButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.sort === state.sortMode);
  });

  if (!state.samples.length) {
    els.mintedGrid.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "empty-grid";
    empty.textContent = "Sample thumbnails pending.";
    els.mintedGrid.append(empty);
    return;
  }

  const samples = state.sortMode === "collector"
    ? []
    : [...state.samples].sort((a, b) => {
      return state.sortMode === "token" ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
    });

  if (state.sortMode === "collector" && !samples.length) {
    els.mintedGrid.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "empty-grid";
    empty.textContent = state.account ? "No mints found for this wallet yet." : "Connect wallet to view your mints.";
    els.mintedGrid.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  samples.forEach((sample) => {
    const button = document.createElement("button");
    const frameWrap = document.createElement("span");
    const label = document.createElement("span");
    const id = document.createElement("span");

    button.className = "mint-card";
    button.type = "button";
    frameWrap.className = "mint-card-frame";

    if (sample.image) {
      const image = document.createElement("img");
      image.src = versionedAssetUrl(sample.image, state.manifestVersion || sample.hash || sample.id);
      image.alt = sample.name;
      image.loading = "lazy";
      image.decoding = "async";
      frameWrap.append(image);
    } else {
      const pending = document.createElement("span");
      pending.className = "pending-thumb";
      pending.textContent = "pending thumbnail";
      frameWrap.append(pending);
    }

    label.className = "mint-card-label";
    id.textContent = `#${sample.id}`;

    label.append(id);
    button.append(frameWrap, label);
    if (sample.hash) {
      button.addEventListener("click", () => {
        renderHash(sample.hash, sample.id);
      });
    }
    fragment.append(button);
  });

  els.mintedGrid.replaceChildren(fragment);
}

function buildHtml(input) {
  const renderInputJson = JSON.stringify(input);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Runners Standing Still Preview</title><style>html,body{width:100%;height:100%;margin:0;background:#f5f5f2}body{display:grid;place-items:center;overflow:hidden}canvas{display:block;max-width:100vw;max-height:100vh}</style></head><body><canvas></canvas><script>window.renderInput=${renderInputJson};window.tokenData=window.renderInput;function notifyParent(type,event){parent.postMessage({project:"runners-standing-still",type,features:window.$features||{},liveState:event?.detail?.liveState||window.__textureMelt?.liveState||null},"*")}window.addEventListener("runners-standing-still:initialized",event=>notifyParent("initialized",event));window.addEventListener("runners-standing-still:complete",event=>notifyParent("complete",event));window.addEventListener("runners-standing-still:live-block",event=>notifyParent("live-block",event));</script><script>${state.rendererScript}</script></body></html>`;
}

function versionedAssetUrl(url, version) {
  if (!version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function randomHash() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
