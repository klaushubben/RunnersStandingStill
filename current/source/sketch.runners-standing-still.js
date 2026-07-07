const IMAGE_W = 3840;
const IMAGE_H = 2160;
const MATTE = 96;
const CANVAS_W = IMAGE_W + MATTE * 2;
const CANVAS_H = IMAGE_H + MATTE * 2;
const MATTE_COLOR = "#ffffff";
const PROJECT_NAME = "Runners Standing Still";
const TOKEN_SYMBOL = "RUNNER";
const PREVIEW_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const PALETTE_CHROMA_PUSH = 1.32;
const LIVE_BLOCK_EPOCH_SIZE = 4;
const LIVE_BLOCK_POLL_MS = 12000;
const LIVE_ROWS_PER_FRAME = 1;
const LIVE_ROW_SPAN = 1;
const LIVE_RPC_URLS = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com",
    "https://eth.drpc.org",
];
const LIVE_RPC_TIMEOUT_MS = 5000;

let liveRpcPreferredIndex = 0;
let liveRpcFetching = false;
let liveBlockTimer = null;

let liveState;

function mapUnit(value, min, max) {
    return min + (max - min) * value;
}

function blockByte(hash, index) {
    if (!hash || typeof hash !== "string" || hash.length < 66) {
        return 0;
    }

    const pos = 2 + (index % 32) * 2;

    return parseInt(hash.slice(pos, pos + 2), 16) || 0;
}

function unitFromBlockByte(hash, index) {
    return blockByte(hash, index) / 255;
}

function liveStateFromBlock(block) {
    const hash = block.hash;
    const number = parseInt(block.number, 16);

    return {
        available: true,
        source: "rpc",
        blockNumber: number,
        blockHash: hash,
        epoch: Math.floor(number / LIVE_BLOCK_EPOCH_SIZE),
        baseNoiseXOffset: mapUnit(unitFromBlockByte(hash, 0), -0.12, 0.12),
        baseNoiseYOffset: mapUnit(unitFromBlockByte(hash, 1), -0.12, 0.12),
        harmonicNoiseXOffset: mapUnit(unitFromBlockByte(hash, 2), -0.75, 0.75),
        harmonicNoiseYOffset: mapUnit(unitFromBlockByte(hash, 3), -0.75, 0.75),
        harmonicNoiseZOffset: mapUnit(unitFromBlockByte(hash, 4), -1.5, 1.5),
    };
}

function liveStateFromHash(hash) {
    return {
        available: true,
        source: "hash-fallback",
        blockNumber: null,
        blockHash: hash,
        epoch: -1,
        baseNoiseXOffset: mapUnit(unitFromBlockByte(hash, 24), -0.12, 0.12),
        baseNoiseYOffset: mapUnit(unitFromBlockByte(hash, 25), -0.12, 0.12),
        harmonicNoiseXOffset: mapUnit(unitFromBlockByte(hash, 26), -0.75, 0.75),
        harmonicNoiseYOffset: mapUnit(unitFromBlockByte(hash, 27), -0.75, 0.75),
        harmonicNoiseZOffset: mapUnit(unitFromBlockByte(hash, 28), -1.5, 1.5),
    };
}

async function liveRpcAttempt(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_RPC_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getBlockByNumber",
                params: ["latest", false],
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`RPC ${data.error.code}: ${data.error.message}`);
        }

        return data.result;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchLatestLiveBlock() {
    for (let offset = 0; offset < LIVE_RPC_URLS.length; offset++) {
        const index = (liveRpcPreferredIndex + offset) % LIVE_RPC_URLS.length;

        try {
            const block = await liveRpcAttempt(LIVE_RPC_URLS[index]);

            liveRpcPreferredIndex = index;
            return block;
        } catch {
        }
    }

    throw new Error("All live block RPC endpoints failed");
}

function normalizeRenderInput(input) {
    const fallback = {
        hash: PREVIEW_HASH,
        tokenId: "0",
        contractAddress: "",
        chainId: "",
        minter: "",
    };
    const renderInput = { ...fallback, ...(input || {}) };

    renderInput.hash = /^0x[0-9a-fA-F]{64}$/.test(renderInput.hash || "")
        ? renderInput.hash
        : PREVIEW_HASH;
    renderInput.tokenId = String(renderInput.tokenId ?? "0");
    renderInput.contractAddress = String(renderInput.contractAddress ?? "");
    renderInput.chainId = String(renderInput.chainId ?? "");
    renderInput.minter = String(renderInput.minter ?? "");

    return renderInput;
}

function getPreviewRenderInput() {
    const params = new URLSearchParams(globalThis.location?.search || "");

    return normalizeRenderInput({
        hash: params.get("hash"),
        tokenId: params.get("tokenId"),
        contractAddress: params.get("contractAddress"),
        chainId: params.get("chainId"),
        minter: params.get("minter"),
    });
}

const renderInput = normalizeRenderInput(
    globalThis.renderInput ||
    globalThis.tokenData ||
    getPreviewRenderInput()
);

globalThis.renderInput = renderInput;
globalThis.tokenData = renderInput;
liveState = liveStateFromHash(renderInput.hash);

class Random {
    constructor() {
        this.useA = false;
        const sfc32 = function (uint128Hex) {
            let a = parseInt(uint128Hex.substring(0, 8), 16);
            let b = parseInt(uint128Hex.substring(8, 16), 16);
            let c = parseInt(uint128Hex.substring(16, 24), 16);
            let d = parseInt(uint128Hex.substring(24, 32), 16);
            return function () {
                a |= 0;
                b |= 0;
                c |= 0;
                d |= 0;
                let t = (((a + b) | 0) + d) | 0;
                d = (d + 1) | 0;
                a = b ^ (b >>> 9);
                b = (c + (c << 3)) | 0;
                c = (c << 21) | (c >>> 11);
                c = (c + t) | 0;
                return (t >>> 0) / 4294967296;
            };
        };
        this.prngA = new sfc32(renderInput.hash.substring(2, 34));
        this.prngB = new sfc32(renderInput.hash.substring(34, 66));
        for (let i = 0; i < 1e6; i += 2) {
            this.prngA();
            this.prngB();
        }
    }

    random_dec() {
        this.useA = !this.useA;
        return this.useA ? this.prngA() : this.prngB();
    }

    random_num(a, b) {
        return a + (b - a) * this.random_dec();
    }

    random_int(a, b) {
        return Math.floor(this.random_num(a, b + 1));
    }

    random_choice(list) {
        return list[this.random_int(0, list.length - 1)];
    }

    weighted_choice(entries) {
        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        let pick = this.random_num(0, total);

        for (const entry of entries) {
            pick -= entry.weight;
            if (pick <= 0) return entry.value;
        }

        return entries[entries.length - 1].value;
    }
}

class NoiseField {
    constructor(seed) {
        this.seed = seed >>> 0;
        this.perm = new Uint8Array(512);
        const source = new Uint8Array(256);
        let state = this.seed || 1;

        for (let i = 0; i < 256; i++) {
            source[i] = i;
        }

        for (let i = 255; i >= 0; i--) {
            state = (1664525 * state + 1013904223) >>> 0;
            const j = state % (i + 1);
            const value = source[j];
            source[j] = source[i];
            source[i] = value;
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = source[i & 255];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    grad3(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;

        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    perlin3(x, y, z) {
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const zi = Math.floor(z) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const zf = z - Math.floor(z);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const w = this.fade(zf);
        const aaa = this.perm[this.perm[this.perm[xi] + yi] + zi];
        const aba = this.perm[this.perm[this.perm[xi] + yi + 1] + zi];
        const aab = this.perm[this.perm[this.perm[xi] + yi] + zi + 1];
        const abb = this.perm[this.perm[this.perm[xi] + yi + 1] + zi + 1];
        const baa = this.perm[this.perm[this.perm[xi + 1] + yi] + zi];
        const bba = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi];
        const bab = this.perm[this.perm[this.perm[xi + 1] + yi] + zi + 1];
        const bbb = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi + 1];
        const x1 = this.lerp(this.grad3(aaa, xf, yf, zf), this.grad3(baa, xf - 1, yf, zf), u);
        const x2 = this.lerp(this.grad3(aba, xf, yf - 1, zf), this.grad3(bba, xf - 1, yf - 1, zf), u);
        const y1 = this.lerp(x1, x2, v);
        const x3 = this.lerp(this.grad3(aab, xf, yf, zf - 1), this.grad3(bab, xf - 1, yf, zf - 1), u);
        const x4 = this.lerp(this.grad3(abb, xf, yf - 1, zf - 1), this.grad3(bbb, xf - 1, yf - 1, zf - 1), u);
        const y2 = this.lerp(x3, x4, v);

        return this.lerp(y1, y2, w) * 0.5 + 0.5;
    }

    fbm3(x, y, z, octaves, falloff) {
        let sum = 0;
        let amp = 0.5;
        let totalAmp = 0;
        let freq = 1;

        for (let i = 0; i < octaves; i++) {
            sum += this.perlin3(x * freq, y * freq, z) * amp;
            totalAmp += amp;
            amp *= falloff;
            freq *= 2;
        }

        return totalAmp === 0 ? 0 : sum / totalAmp;
    }
}

const rng = new Random();

function previewNumberParam(name, fallback) {
    const params = new URLSearchParams(globalThis.location?.search || "");
    const rawValue = params.get(name);
    if (rawValue === null) return fallback;

    const value = Number(rawValue);

    return Number.isFinite(value) ? value : fallback;
}

function previewOptionalBooleanParam(name) {
    const params = new URLSearchParams(globalThis.location?.search || "");
    const value = params.get(name);

    if (value === null) return null;

    return value === "1" || value === "true";
}

function previewChoiceParam(name, fallback, choices) {
    const params = new URLSearchParams(globalThis.location?.search || "");
    const value = params.get(name);

    return choices.includes(value) ? value : fallback;
}

function previewNumberChoiceParam(name, fallback, choices) {
    const params = new URLSearchParams(globalThis.location?.search || "");
    const value = Number(params.get(name));

    return choices.includes(value) ? value : fallback;
}

// Trait-level settings are sliced from raw hash bits exactly like the
// on-chain RunnerRenderer._traits, so the SVG thumbnail, metadata
// attributes, and canvas render agree for any hash. The PRNG draws these
// settings used to consume are burned (see burnDraws) so every downstream
// draw stays aligned with previous outputs.
function deriveHashTraits(hash) {
    const n = BigInt(/^0x[0-9a-fA-F]{64}$/.test(hash || "") ? hash : PREVIEW_HASH);
    const slice = (shift, mod) => Number((n >> BigInt(shift)) % BigInt(mod));
    const hueRoll = slice(32, 1000);
    const hueValue = slice(42, 1000);
    const hueBand = [
        [519, 4, 69],
        [709, 330, 31],
        [853, 286, 45],
        [951, 190, 97],
        [983, 68, 83],
        [1000, 150, 41],
    ].find((band) => hueRoll < band[0]);
    const sourceRoll = slice(0, 8);

    return {
        sourceTextureMode: sourceRoll < 4 ? "g4" : sourceRoll < 7 ? "rs" : "gs",
        paletteMode: slice(8, 2) === 1 ? "split" : "div",
        ditherPattern: ["line", "b4", "b8"][slice(16, 3)],
        backgroundMode: ["black", "dark", "light"][slice(24, 3)],
        paletteBaseHue: hueBand[1] + Math.floor((hueValue * hueBand[2]) / 1000),
        paletteDivergeSpread: 128 + slice(48, 45),
        paletteAccentOffset: slice(56, 37) - 18,
        splitAngle: 18 + slice(64, 37),
        paletteRelationship: ["nc", "split", "ws", "wa", "st"][slice(72, 5)],
        splitRole: ["u", "mf", "da", "ta"][slice(80, 4)],
        splitAccentDirection: slice(88, 2) === 0 ? -1 : 1,
        backgroundIndex: slice(96, 5),
        bwTemperature: ["neutral", "warm", "cool"][slice(104, 3)],
    };
}

function pickFeatures(random) {
    const hashTraits = deriveHashTraits(renderInput.hash);
    // Every random_choice / random_int / random_num / weighted_choice call
    // consumes exactly one random_dec, so burning that many draws keeps
    // every remaining draw at its original stream position.
    const burnDraws = (count) => {
        for (let i = 0; i < count; i++) random.random_dec();
    };
    const sourceTextureChoices = [
        "g4",
        "gs",
        "rs",
    ];
    burnDraws(2);
    const sourceTextureMode = previewChoiceParam(
        "sourceTextureMode",
        hashTraits.sourceTextureMode,
        sourceTextureChoices
    );
    const gradientBandPaletteMode = previewChoiceParam(
        "paletteFamily",
        hashTraits.paletteMode,
        ["div", "split"]
    );
    const decomposeMode = previewChoiceParam(
        "decomposeMode",
        random.weighted_choice([
            { value: "mask-levels", weight: 4 },
            { value: "mask-dither", weight: 2 },
            { value: "ordered-levels", weight: 2 },
            { value: "mask", weight: 1 },
        ]),
        [
            "mask",
            "mask-dither",
            "mask-levels",
            "ordered-levels",
        ]
    );
    burnDraws(2);
    const ditherPattern = previewChoiceParam(
        "ditherPattern",
        hashTraits.ditherPattern,
        ["b4", "b8", "line"]
    );
    const bwTemperature = previewChoiceParam(
        "bwTemperature",
        hashTraits.bwTemperature,
        ["neutral", "warm", "cool"]
    );
    const compositeLevels = previewNumberChoiceParam(
        "compositeLevels",
        random.weighted_choice([
            { value: 2, weight: 45 },
            { value: 4, weight: 45 },
            { value: 8, weight: 10 },
        ]),
        [2, 4, 8]
    );
    const decomposeBlockChoices = ditherPattern === "line" ? ["8", "16", "32"] : ["8", "16"];
    const decomposeBlockSize = Number(previewChoiceParam(
        "decomposeBlockSize",
        random.weighted_choice(
            decomposeBlockChoices.map((value) => ({
                value,
                weight: value === "16" ? 5 : value === "8" ? 3 : 1,
            }))
        ),
        decomposeBlockChoices
    ));
    const paletteMode = gradientBandPaletteMode;
    burnDraws(4);
    const paletteRelationship = hashTraits.paletteRelationship;
    const splitRole = hashTraits.splitRole;
    const splitAccentDirection = hashTraits.splitAccentDirection;
    const splitAngle = hashTraits.splitAngle;
    const textureCornerLayout = random.random_choice(["n", "fx", "fy", "r"]);
    const backgroundModeOverride = previewChoiceParam("backgroundMode", "", [
        "black",
        "dark",
        "light",
    ]);
    const blackBackgroundOverride = previewOptionalBooleanParam("blackBackground");
    let backgroundMode = backgroundModeOverride ||
        (blackBackgroundOverride === true
            ? "black"
            : blackBackgroundOverride === false
                ? "dark"
                : "");
    if (!backgroundMode) {
        burnDraws(1);
        backgroundMode = hashTraits.backgroundMode;
    }
    const meltStrength = random.random_num(4, 7);
    const verticalStretch = random.random_num(0.3, 0.8);
    const targetDrift = random.random_dec() < 0.357
        ? random.random_num(-0.16, -0.06)
        : random.random_num(0.06, 0.24);
    const noiseBias = 0.5 + (verticalStretch - targetDrift) / meltStrength;
    const harmonicAmount = random.random_dec() < 0.08
        ? random.random_num(0, 0.08)
        : random.random_num(0.16, 0.4);
    const noiseStepY = random.random_dec() < 0.15
        ? random.random_num(0.0009, 0.00135)
        : random.random_num(0.00135, 0.003);

    burnDraws(10);

    return {
        backgroundIndex: hashTraits.backgroundIndex,
        paletteMode,
        backgroundMode,
        sourceTextureMode,
        paletteBaseHue: hashTraits.paletteBaseHue,
        paletteAccentOffset: hashTraits.paletteAccentOffset,
        paletteDivergeSpread: hashTraits.paletteDivergeSpread,
        backgroundHueOffset: random.random_choice([120, 180, 240]),
        paletteRelationship,
        splitAccentStrength: 1,
        splitAccentDirection,
        splitAngle,
        splitRole,
        textureCornerLayout,
        width: CANVAS_W,
        height: CANVAS_H,
        imageWidth: IMAGE_W,
        imageHeight: IMAGE_H,
        matte: MATTE,
        matteColor: MATTE_COLOR,
        textureWidth: IMAGE_W,
        textureHeight: IMAGE_H,
        noiseSeed: random.random_int(1, 999999999),
        noiseType: "perlin",
        noiseStepX: random.random_num(0.00028, 0.0007),
        noiseStepY,
        noiseZ: random.random_num(1, 20),
        harmonicAmount,
        harmonicScale: random.random_num(1, 3.5),
        noiseBias,
        targetDrift,
        meltStrength,
        tilt: random.random_num(0.08, 0.3),
        verticalStretch,
        alpha: Math.max(120, Math.min(200, Math.floor(previewNumberParam("alpha", random.random_int(120, 200))))),
        noiseOctaves: 2,
        noiseFalloff: 0.05,
        columnStep: 2,
        gradientBandPaletteMode,
        stripeSize: Math.max(0.1, Math.min(4, previewNumberParam("stripeSize", 1))),
        decomposeMode,
        ditherPattern,
        bwTemperature,
        compositeLevels,
        decomposeBlockSize,
        renderBatchSize: 1,
    };
}

const features = pickFeatures(rng);
globalThis.$features = {
    pm: features.paletteMode,
    bg: features.backgroundMode,
    fmt: `${features.width}x${features.height}`,
    nt: features.noiseType,
    src: features.sourceTextureMode,
    live: "rows",
    gbp: features.gradientBandPaletteMode,
    dec: features.decomposeMode,
    dit: features.ditherPattern,
    bwt: features.bwTemperature,
    cl: features.compositeLevels,
    dbs: features.decomposeBlockSize,
    ss: features.stripeSize,
    rel: features.paletteMode === "split" ? features.paletteRelationship : "none",
    role: features.paletteMode === "split" ? features.splitRole : "none",
    dir: features.paletteMode === "split" && features.splitAccentDirection < 0 ? "ccw" : "cw",
    layout: features.textureCornerLayout,
};

globalThis.__textureMelt = {
    initialized: false,
    completed: false,
    projectName: PROJECT_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    renderInput,
    tokenData: renderInput,
    liveState,
    features: globalThis.$features,
    settings: features,
};

let gw = features.textureWidth;
let gh = features.textureHeight;
let g;
let renderY = 0;
let renderWidth = 0;
let renderHeight = 0;
let nowTime = 0;
let initialized = false;
let completed = false;

let sourcePixels;
let noise;
let noiseStats;
let activeCtx = null;
let liveRowCursor = 0;
let liveDrawFramePending = false;
let deterministicColumnMelt = null;
let liveColumnMelt = null;
let monoStripeLayout = null;
let monoStripeGradientIndex = -1;

function updateLiveRuntime() {
    globalThis.__textureMelt.initialized = initialized;
    globalThis.__textureMelt.liveState = liveState;
    globalThis.dispatchEvent(new CustomEvent("runners-standing-still:live-block", {
        detail: { liveState },
    }));
}

function sampleLiveNoiseAt(x, y, state) {
    const xNoise = x * features.noiseStepX;
    const yNoise = y * features.noiseStepY;
    const noiseOctaves = Math.max(1, Math.floor(features.noiseOctaves));
    const noiseFalloff = features.noiseFalloff;
    const baseNoise = noise.fbm3(
        xNoise + state.baseNoiseXOffset,
        yNoise + state.baseNoiseYOffset,
        features.noiseZ,
        noiseOctaves,
        noiseFalloff
    );
    const harmonicNoise = noise.fbm3(
        xNoise * features.harmonicScale + state.harmonicNoiseXOffset,
        yNoise * features.harmonicScale + state.harmonicNoiseYOffset,
        features.noiseZ + 9.73 + state.harmonicNoiseZOffset,
        noiseOctaves,
        noiseFalloff
    );
    const rawNoise = mix(baseNoise, harmonicNoise, features.harmonicAmount);
    const centeredNoise = rawNoise - noiseStats.mean + 0.5;

    return centeredNoise - features.noiseBias;
}

function resetLiveColumnMelt() {
    const columnStep = Math.max(1, Math.floor(features.columnStep));
    liveColumnMelt = new Float32Array(Math.ceil(renderWidth / columnStep));
}

function resetDeterministicColumnMelt() {
    const columnStep = Math.max(1, Math.floor(features.columnStep));
    deterministicColumnMelt = new Float32Array(Math.ceil(renderWidth / columnStep));
}

function steppedChannel(value, levels) {
    return Math.round(Math.round(value / 255 * (levels - 1)) / (levels - 1) * 255);
}

function epochByteMasks(state) {
    const hash = state.blockHash || renderInput.hash;
    const choices = [0xf0, 0xe0, 0xc0, 0xf8, 0xfc, 0x88, 0xcc];
    const epoch = Number.isFinite(state.epoch) ? Math.abs(state.epoch) : 0;

    return {
        r: choices[(blockByte(hash, 5) + epoch) % choices.length],
        g: choices[(blockByte(hash, 6) + epoch * 3) % choices.length],
        b: choices[(blockByte(hash, 7) + epoch * 5) % choices.length],
    };
}

const BAYER_4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
];

const BAYER_8 = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21,
];

function ditherPatternUnit(x, y) {
    const block = Math.max(1, Math.floor(features.decomposeBlockSize / 4));

    if (features.ditherPattern === "b8") {
        const matrixX = Math.floor(x / block) & 7;
        const matrixY = Math.floor(y / block) & 7;

        return (BAYER_8[matrixY * 8 + matrixX] + 0.5) / 64;
    }

    if (features.ditherPattern === "line") {
        const period = Math.max(2, Math.floor(features.decomposeBlockSize));
        const line = ((Math.floor(x + y * 1.7) % period) + period) % period;

        return (line + 0.5) / period;
    }

    const matrixX = Math.floor(x / block) & 3;
    const matrixY = Math.floor(y / block) & 3;

    return (BAYER_4[matrixY * 4 + matrixX] + 0.5) / 16;
}

function orderedDitherColor(r, g, b, x, y) {
    const threshold = ditherPatternUnit(x, y) * 255;

    return {
        r: r >= threshold ? 255 : 0,
        g: g >= threshold ? 255 : 0,
        b: b >= threshold ? 255 : 0,
    };
}

function orderedDitherLevelChannel(value, threshold) {
    const levels = features.compositeLevels;
    const dithered = Math.max(0, Math.min(255, value + threshold / levels));

    return steppedChannel(dithered, levels);
}

function orderedDitherLevelsColor(r, g, b, x, y) {
    const threshold = (ditherPatternUnit(x, y) - 0.5) * 255;

    return {
        r: orderedDitherLevelChannel(r, threshold),
        g: orderedDitherLevelChannel(g, threshold),
        b: orderedDitherLevelChannel(b, threshold),
    };
}

function decomposedSourceColor(r, g, b, x, y, state) {
    if (features.decomposeMode === "mask" ||
        features.decomposeMode === "mask-dither" ||
        features.decomposeMode === "mask-levels") {
        const masks = epochByteMasks(state);

        r &= masks.r;
        g &= masks.g;
        b &= masks.b;

        if (features.decomposeMode === "mask-dither") {
            return orderedDitherColor(r, g, b, x, y);
        }

        if (features.decomposeMode === "mask-levels") {
            return orderedDitherLevelsColor(r, g, b, x, y);
        }

        return { r, g, b };
    }

    if (features.decomposeMode === "ordered-levels") {
        return orderedDitherLevelsColor(r, g, b, x, y);
    }

    return { r, g, b };
}

function drawLiveSourceRow(ctx, sourceY, state) {
    const columnStep = Math.max(1, Math.floor(features.columnStep));
    const pixelRowStride = renderWidth * 4;
    const totalTiltDistance = renderWidth * features.tilt;
    const yAnchor = (features.imageHeight / 2) + (totalTiltDistance / 2);
    const y = Math.max(0, Math.min(renderHeight - 1, Math.floor(sourceY)));

    if (!liveColumnMelt) {
        resetLiveColumnMelt();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(features.matte, features.matte, features.imageWidth, features.imageHeight);
    ctx.clip();
    ctx.translate(features.matte, features.matte + yAnchor);
    ctx.globalAlpha = features.alpha / 255;

    for (let x = 0, columnIndex = 0; x < renderWidth; x += columnStep, columnIndex++) {
        const xOffset = x * features.tilt;
        const n = sampleLiveNoiseAt(x, y, state);
        const h = n * features.meltStrength;
        const px = y * pixelRowStride + x * 4;
        const rectY = Math.round(liveColumnMelt[columnIndex] - xOffset + y * features.verticalStretch);
        const color = decomposedSourceColor(
            sourcePixels[px],
            sourcePixels[px + 1],
            sourcePixels[px + 2],
            x,
            y,
            state
        );

        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x, rectY, columnStep, h);

        liveColumnMelt[columnIndex] += h;
    }

    ctx.restore();
}

function drawLiveContinuousRows() {
    if (!activeCtx || !completed) {
        return;
    }

    for (let i = 0; i < LIVE_ROWS_PER_FRAME; i++) {
        drawLiveSourceRow(activeCtx, liveRowCursor, liveState);
        liveRowCursor = (liveRowCursor + LIVE_ROW_SPAN) % renderHeight;

        if (liveRowCursor === 0) {
            resetLiveColumnMelt();
        }
    }
}

function scheduleLiveDrawFrame() {
    if (liveDrawFramePending) {
        return;
    }

    liveDrawFramePending = true;
    requestAnimationFrame(() => {
        liveDrawFramePending = false;
        drawLiveContinuousRows();
        scheduleLiveDrawFrame();
    });
}

async function refreshLiveBlock() {
    if (liveRpcFetching || globalThis.document?.hidden) {
        return;
    }

    liveRpcFetching = true;

    try {
        const block = await fetchLatestLiveBlock();
        const nextLiveState = liveStateFromBlock(block);
        const isNewEpoch = nextLiveState.epoch !== liveState.epoch;

        if (isNewEpoch) {
            liveState = nextLiveState;
            if (sourceUsesGradientSlice()) {
                g = createTexture();
            }
            updateLiveRuntime();
                noiseStats = measureNoiseStats();
        }
    } catch {
        updateLiveRuntime();
    } finally {
        liveRpcFetching = false;
    }
}

function startLiveBlockLoop() {
    if (liveBlockTimer) {
        return;
    }

    refreshLiveBlock();
    scheduleLiveDrawFrame();
    liveBlockTimer = setInterval(refreshLiveBlock, LIVE_BLOCK_POLL_MS);
}

function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const n = parseInt(normalized, 16);
    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
    };
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function mix(a, b, t) {
    return a + (b - a) * t;
}

function wrapHue(hue) {
    return ((hue % 360) + 360) % 360;
}

function hueDistance(a, b) {
    const diff = Math.abs(wrapHue(a) - wrapHue(b));
    return Math.min(diff, 360 - diff);
}

function hueDamping(hue) {
    const h = wrapHue(hue);
    const green = Math.max(0, 1 - hueDistance(h, 135) / 58);
    const purple = Math.max(0, 1 - hueDistance(h, 292) / 54);
    const damping = Math.max(green * 0.46, purple * 0.32);

    return 1 - damping;
}

function warmAnalogHue(mainHue, angle) {
    const forward = mainHue + angle;
    const backward = mainHue - angle;
    const warmCenter = 28;

    return hueDistance(forward, warmCenter) < hueDistance(backward, warmCenter) ? forward : backward;
}

function relationshipAccentHue(mainHue) {
    const side = features.splitAccentDirection;
    const angle = features.splitAngle;
    const offset = features.paletteAccentOffset;

    if (features.paletteRelationship === "nc") {
        return mainHue + 180 + side * angle * 0.3 + offset;
    }

    if (features.paletteRelationship === "ws") {
        return mainHue + 180 + side * (angle + 18) + offset;
    }

    if (features.paletteRelationship === "wa") {
        return warmAnalogHue(mainHue, angle) + offset * 0.45;
    }

    if (features.paletteRelationship === "st") {
        return mainHue + side * (108 + angle * 0.45) + offset;
    }

    return mainHue + 180 + side * angle + offset;
}

function linearToSrgb(value) {
    if (value <= 0.0031308) {
        return 12.92 * value;
    }

    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function oklabToRgbRaw(lab) {
    const lPrime = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const mPrime = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const sPrime = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
    const l3 = lPrime * lPrime * lPrime;
    const m3 = mPrime * mPrime * mPrime;
    const s3 = sPrime * sPrime * sPrime;

    return {
        r: linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
        g: linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
        b: linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
    };
}

function oklchToRgbRaw(l, c, h) {
    const radians = wrapHue(h) * Math.PI / 180;

    return oklabToRgbRaw({ l, a: Math.cos(radians) * c, b: Math.sin(radians) * c });
}

function oklchToHex(l, c, h) {
    let chroma = c * hueDamping(h);
    let rgb = oklchToRgbRaw(l, chroma, h);

    while (
        chroma > 0 &&
        (rgb.r < 0 || rgb.r > 1 || rgb.g < 0 || rgb.g > 1 || rgb.b < 0 || rgb.b > 1)
    ) {
        chroma *= 0.94;
        rgb = oklchToRgbRaw(l, chroma, h);
    }

    const toHex = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0");

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function srgbToLinear(value) {
    const v = value / 255;

    if (v <= 0.04045) {
        return v / 12.92;
    }

    return Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToOklab(hex) {
    const rgb = hexToRgb(hex);
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return {
        l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    };
}

function oklabToHex(lab) {
    const rgb = oklabToRgbRaw(lab);
    const toHex = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0");

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function oklabToRgbBytes(lab) {
    const rgb = oklabToRgbRaw(lab);

    return {
        r: Math.round(clamp01(rgb.r) * 255),
        g: Math.round(clamp01(rgb.g) * 255),
        b: Math.round(clamp01(rgb.b) * 255),
    };
}

function mixOklab(a, b, t) {
    return {
        l: mix(a.l, b.l, t),
        a: mix(a.a, b.a, t),
        b: mix(a.b, b.b, t),
    };
}

function oklabHue(lab) {
    return wrapHue(Math.atan2(lab.b, lab.a) * 180 / Math.PI);
}

function oklabChroma(lab) {
    return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

function addOklabStops(gradient, colors) {
    const labs = colors.map(hexToOklab);
    const segments = colors.length - 1;

    if (segments <= 0) {
        gradient.addColorStop(0, colors[0] || "#000000");
        return;
    }

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j <= 8; j++) {
            if (i > 0 && j === 0) {
                continue;
            }

            const local = j / 8;
            const stop = (i + local) / segments;
            gradient.addColorStop(stop, oklabToHex(mixOklab(labs[i], labs[i + 1], local)));
        }
    }
}

function textureCornerColors(colors) {
    const base = [
        colors[0],
        colors[1 % colors.length],
        colors[Math.max(0, colors.length - 2)],
        colors[colors.length - 1],
    ];

    if (features.textureCornerLayout === "fx") {
        return [base[1], base[0], base[3], base[2]];
    }

    if (features.textureCornerLayout === "fy") {
        return [base[2], base[3], base[0], base[1]];
    }

    if (features.textureCornerLayout === "r") {
        return [base[1], base[3], base[0], base[2]];
    }

    return base;
}

function fillFourCornerOklabTexture(ctx, colors) {
    const labs = textureCornerColors(colors).map(hexToOklab);
    const imageData = ctx.createImageData(gw, gh);
    const data = imageData.data;
    let idx = 0;

    for (let y = 0; y < gh; y++) {
        const ty = gh <= 1 ? 0 : y / (gh - 1);
        const left = mixOklab(labs[0], labs[2], ty);
        const right = mixOklab(labs[1], labs[3], ty);

        for (let x = 0; x < gw; x++) {
            const tx = gw <= 1 ? 0 : x / (gw - 1);
            const rgb = oklabToRgbBytes(mixOklab(left, right, tx));

            data[idx++] = rgb.r;
            data[idx++] = rgb.g;
            data[idx++] = rgb.b;
            data[idx++] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function generatedPalette(modeOverride = features.paletteMode) {
    const mode = modeOverride;
    const h = features.paletteBaseHue;

    if (mode === "split") {
        const mainHue = h;
        const accentStrength = features.splitAccentStrength;
        const role = features.splitRole;
        const accentHue = relationshipAccentHue(mainHue);
        const mainBoost = (1 + accentStrength * 0.48) * PALETTE_CHROMA_PUSH;
        const accentChroma = mix(0.045, 0.168, accentStrength) * PALETTE_CHROMA_PUSH;
        const mainLight = oklchToHex(0.86, 0.035 * mainBoost, mainHue - 14);
        const mainMidLight = oklchToHex(0.73, 0.067 * mainBoost, mainHue - 5);
        const mainMid = oklchToHex(0.59, 0.100 * mainBoost, mainHue + 3);
        const mainDark = oklchToHex(0.42, 0.084 * mainBoost, mainHue + 13);
        const accentPale = oklchToHex(0.76, accentChroma * 0.76, accentHue);
        const accentMid = oklchToHex(0.62, accentChroma, accentHue);
        const accentDeep = oklchToHex(0.39, accentChroma * 1.08, accentHue + 8);
        let colors = [mainLight, mainMidLight, mainMid, mainDark, accentPale];

        if (role === "mf") {
            colors = [mainLight, mainMidLight, accentMid, mainMid, mainDark];
        } else if (role === "da") {
            colors = [mainLight, mainMidLight, mainMid, mainDark, accentDeep];
        } else if (role === "ta") {
            colors = [mainLight, accentPale, mainMid, mainDark, accentDeep];
        }

        return {
            colors,
        };
    }

    if (mode === "div") {
        const hueA = h - features.paletteDivergeSpread / 2;
        const hueB = h + features.paletteDivergeSpread / 2;

        return {
            colors: [
                oklchToHex(0.36, 0.116 * PALETTE_CHROMA_PUSH, hueA),
                oklchToHex(0.53, 0.096 * PALETTE_CHROMA_PUSH, hueA + 8),
                oklchToHex(0.82, 0.025 * PALETTE_CHROMA_PUSH, h),
                oklchToHex(0.56, 0.096 * PALETTE_CHROMA_PUSH, hueB - 8),
                oklchToHex(0.38, 0.116 * PALETTE_CHROMA_PUSH, hueB),
            ],
        };
    }

    return {
        colors: [
            oklchToHex(0.36, 0.116 * PALETTE_CHROMA_PUSH, h - 80),
            oklchToHex(0.53, 0.096 * PALETTE_CHROMA_PUSH, h - 72),
            oklchToHex(0.82, 0.025 * PALETTE_CHROMA_PUSH, h),
            oklchToHex(0.56, 0.096 * PALETTE_CHROMA_PUSH, h + 72),
            oklchToHex(0.38, 0.116 * PALETTE_CHROMA_PUSH, h + 80),
        ],
    };
}

function paletteDarkBackground(palette) {
    const swatches = features.paletteMode === "div"
        ? [palette.colors[0], palette.colors[palette.colors.length - 1]]
        : palette.colors;
    const candidates = swatches
        .map((hex) => ({ hex, lab: hexToOklab(hex) }))
        .filter((entry) => entry.lab.l < 0.62);
    const source = candidates.length > 0
        ? candidates[features.backgroundIndex % candidates.length]
        : swatches
            .map((hex) => ({ hex, lab: hexToOklab(hex) }))
            .sort((a, b) => a.lab.l - b.lab.l)[0];
    const hue = oklabHue(source.lab);
    const sourceChroma = oklabChroma(source.lab);
    const lightness = features.paletteMode === "div" ? 0.32 : 0.29;
    const chromaFloor = features.paletteMode === "div" ? 0.12 : 0.095;
    const chroma = Math.min(0.18, Math.max(sourceChroma * 1.24, chromaFloor));

    return hexToRgb(oklchToHex(lightness, chroma, hue));
}

function paletteLightBackground(palette) {
    const lab = hexToOklab(palette.colors[features.backgroundIndex % palette.colors.length]);
    const lifted = {
        l: mix(lab.l, 0.93, 0.78),
        a: lab.a * 0.18,
        b: lab.b * 0.18,
    };

    return hexToRgb(oklabToHex(lifted));
}

function applyBackground(ctx, palette) {
    const mode = features.backgroundMode;

    if (mode === "black") {
        fillBackgroundGradient(ctx, { r: 4, g: 4, b: 4 });
        return;
    }

    if (mode === "light") {
        fillBackgroundGradient(ctx, paletteLightBackground(palette));
        return;
    }

    fillBackgroundGradient(ctx, paletteDarkBackground(palette));
}

function fillBackgroundGradient(ctx, rgb) {
    const lab = hexToOklab(
        "#" +
        rgb.r.toString(16).padStart(2, "0") +
        rgb.g.toString(16).padStart(2, "0") +
        rgb.b.toString(16).padStart(2, "0")
    );
    const shadow = oklabToRgbBytes({ l: lab.l * 0.88, a: lab.a, b: lab.b });
    const gradient = ctx.createLinearGradient(0, 0, 0, features.imageHeight);
    gradient.addColorStop(0, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    gradient.addColorStop(1, `rgb(${shadow.r}, ${shadow.g}, ${shadow.b})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, features.imageWidth, features.imageHeight);
}

function renderMatte(ctx) {
    ctx.fillStyle = features.matteColor;
    ctx.fillRect(0, 0, features.width, features.height);
}

function renderInnerBackground(ctx) {
    ctx.save();
    ctx.translate(features.matte, features.matte);
    applyBackground(ctx, generatedPalette(features.gradientBandPaletteMode));
    ctx.restore();
}

function sourceUsesGradientSlice() {
    return features.sourceTextureMode === "rs";
}

function bwSourceColors(backgroundPalette) {
    if (features.backgroundMode !== "black") {
        const backgroundRgb = paletteDarkBackground(backgroundPalette);
        const backgroundLab = hexToOklab(
            "#" +
            backgroundRgb.r.toString(16).padStart(2, "0") +
            backgroundRgb.g.toString(16).padStart(2, "0") +
            backgroundRgb.b.toString(16).padStart(2, "0")
        );
        const hueOffset = features.bwTemperature === "warm"
            ? -10
            : features.bwTemperature === "cool" ? 12 : 0;
        const hue = oklabHue(backgroundLab) + hueOffset;
        const chroma = Math.min(0.075, Math.max(0.026, oklabChroma(backgroundLab) * 0.62));

        return {
            dark: oklchToHex(0.16, chroma * 0.82, hue),
            light: oklchToHex(0.88, chroma * 0.55, hue),
        };
    }

    if (features.bwTemperature === "warm") {
        return {
            dark: "#090604",
            light: "#fff2df",
        };
    }

    if (features.bwTemperature === "cool") {
        return {
            dark: "#03070b",
            light: "#e9f2ff",
        };
    }

    return {
        dark: "#070706",
        light: "#f2f0ea",
    };
}

function createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = gw;
    canvas.height = gh;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const backgroundPalette = generatedPalette(features.gradientBandPaletteMode);
    const bwColors = bwSourceColors(backgroundPalette);

    if (features.sourceTextureMode === "rs") {
        if (!monoStripeLayout) {
            let y = 0;
            let useWhite = rng.random_dec() > 0.5;
            const stripeSize = features.stripeSize;

            monoStripeLayout = [];

            while (y < gh) {
                let stripe = (60 + rng.random_dec() * 220) * stripeSize;

                if (y + stripe > gh) {
                    stripe = gh - y;
                }

                monoStripeLayout.push({
                    y,
                    height: stripe,
                    isWhite: useWhite,
                });
                y += stripe;
                useWhite = !useWhite;
            }
        }

        const stripes = monoStripeLayout;
        const whiteStripeIndices = stripes
            .map((stripe, index) => ({ stripe, index }))
            .filter((entry) => entry.stripe.isWhite && entry.stripe.height > 0 && entry.stripe.y > 0)
            .map((entry) => entry.index);
        const epoch = Number.isFinite(liveState.epoch) ? liveState.epoch : 0;
        const hash = liveState.blockHash || renderInput.hash;
        const epochSeed = Math.abs(epoch + blockByte(hash, 29) + blockByte(hash, 30) * 256);
        let gradientStripeIndex = whiteStripeIndices.length > 0
            ? whiteStripeIndices[epochSeed % whiteStripeIndices.length]
            : 0;

        if (whiteStripeIndices.length > 1 && gradientStripeIndex === monoStripeGradientIndex) {
            const position = whiteStripeIndices.indexOf(gradientStripeIndex);
            gradientStripeIndex = whiteStripeIndices[(position + 1) % whiteStripeIndices.length];
        }

        monoStripeGradientIndex = gradientStripeIndex;
        const colorBandPalette = generatedPalette(features.gradientBandPaletteMode);

        for (let index = 0; index < stripes.length; index++) {
            const stripe = stripes[index];

            if (sourceUsesGradientSlice() && index === gradientStripeIndex) {
                const gradient = ctx.createLinearGradient(0, stripe.y, gw, stripe.y);
                addOklabStops(gradient, colorBandPalette.colors);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = stripe.isWhite ? bwColors.light : bwColors.dark;
            }

            ctx.fillRect(0, stripe.y, gw, stripe.height);
        }
    } else if (features.sourceTextureMode === "gs") {
        fillFourCornerOklabTexture(ctx, [bwColors.dark, bwColors.light, bwColors.light, bwColors.dark]);
    } else {
        fillFourCornerOklabTexture(ctx, backgroundPalette.colors);
    }

    sourcePixels = ctx.getImageData(0, 0, gw, gh).data;

    return canvas;
}

function measureNoiseStats() {
    const noiseStepX = features.noiseStepX;
    const noiseStepY = features.noiseStepY;
    const noiseZ = features.noiseZ;
    const baseNoiseXOffset = liveState.baseNoiseXOffset;
    const baseNoiseYOffset = liveState.baseNoiseYOffset;
    const harmonicNoiseXOffset = liveState.harmonicNoiseXOffset;
    const harmonicNoiseYOffset = liveState.harmonicNoiseYOffset;
    const harmonicNoiseZOffset = liveState.harmonicNoiseZOffset;
    const harmonicAmount = features.harmonicAmount;
    const harmonicScale = features.harmonicScale;
    const noiseOctaves = Math.max(1, Math.floor(features.noiseOctaves));
    const noiseFalloff = features.noiseFalloff;
    let sum = 0;
    let count = 0;

    for (let x = 0; x < renderWidth; x += 32) {
        const xNoise = x * noiseStepX;

        for (let y = 0; y < renderHeight; y += 32) {
            const yNoise = y * noiseStepY;
            const base = noise.fbm3(
                xNoise + baseNoiseXOffset,
                yNoise + baseNoiseYOffset,
                noiseZ,
                noiseOctaves,
                noiseFalloff
            );
            const harmonic = noise.fbm3(
                xNoise * harmonicScale + harmonicNoiseXOffset,
                yNoise * harmonicScale + harmonicNoiseYOffset,
                noiseZ + 9.73 + harmonicNoiseZOffset,
                noiseOctaves,
                noiseFalloff
            );

            sum += mix(base, harmonic, harmonicAmount);
            count++;
        }
    }

    return {
        mean: count === 0 ? 0.5 : sum / count,
    };
}

let setup = ({ canvas, ctx }) => {
    activeCtx = ctx;
    canvas.width = features.width;
    canvas.height = features.height;
    canvas.style.width = "100vw";
    canvas.style.height = "auto";
    canvas.style.maxHeight = "100vh";
    canvas.style.objectFit = "contain";

    noise = new NoiseField(features.noiseSeed);
    g = createTexture();
    renderWidth = gw;
    renderHeight = gh;
    renderY = 0;
    liveRowCursor = 0;
    nowTime = 0;
    initialized = false;
    completed = false;
    globalThis.__textureMelt.initialized = false;
    globalThis.__textureMelt.completed = false;
    resetDeterministicColumnMelt();
    resetLiveColumnMelt();
    noiseStats = measureNoiseStats();
    renderMatte(ctx);
    renderInnerBackground(ctx);
    initialized = true;
    updateLiveRuntime();

    const detail = {
        projectName: PROJECT_NAME,
        tokenSymbol: TOKEN_SYMBOL,
        renderInput,
        tokenData: renderInput,
        liveState,
        features: globalThis.$features,
        settings: features,
        renderMs: nowTime,
    };

    globalThis.dispatchEvent(new CustomEvent("runners-standing-still:initialized", { detail }));
};

let draw = ({ ctx, canvas, deltaTime }) => {
    if (completed) {
        return;
    }

    if (renderY === 0) {
        renderMatte(ctx);
        renderInnerBackground(ctx);
    }

    const noiseStepX = features.noiseStepX;
    const noiseStepY = features.noiseStepY;
    const noiseZ = features.noiseZ;
    const baseNoiseXOffset = liveState.baseNoiseXOffset;
    const baseNoiseYOffset = liveState.baseNoiseYOffset;
    const harmonicNoiseXOffset = liveState.harmonicNoiseXOffset;
    const harmonicNoiseYOffset = liveState.harmonicNoiseYOffset;
    const harmonicNoiseZOffset = liveState.harmonicNoiseZOffset;
    const harmonicAmount = features.harmonicAmount;
    const harmonicScale = features.harmonicScale;
    const meltStrength = features.meltStrength;
    const tilt = features.tilt;
    const verticalStretch = features.verticalStretch;
    const noiseBias = features.noiseBias;
    const noiseOctaves = Math.max(1, Math.floor(features.noiseOctaves));
    const noiseFalloff = features.noiseFalloff;
    const alpha = features.alpha / 255;
    const columnStep = Math.max(1, Math.floor(features.columnStep));
    const batchSize = Math.max(1, Math.floor(features.renderBatchSize));
    const pixelRowStride = renderWidth * 4;
    const endY = Math.min(renderY + batchSize, renderHeight);
    const totalTiltDistance = renderWidth * tilt;
    const yAnchor = (features.imageHeight / 2) + (totalTiltDistance / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(features.matte, features.matte, features.imageWidth, features.imageHeight);
    ctx.clip();
    ctx.translate(features.matte, features.matte + yAnchor);
    ctx.globalAlpha = alpha;

    while (renderY < endY) {
        const y = renderY;
        const yNoise = y * noiseStepY;

        for (let x = 0, columnIndex = 0; x < renderWidth; x += columnStep, columnIndex++) {
            const xNoise = x * noiseStepX;
            const xOffset = x * tilt;
            const xPixelOffset = x * 4;
            const baseNoise = noise.fbm3(
                xNoise + baseNoiseXOffset,
                yNoise + baseNoiseYOffset,
                noiseZ,
                noiseOctaves,
                noiseFalloff
            );
            const harmonicNoise = noise.fbm3(
                xNoise * harmonicScale + harmonicNoiseXOffset,
                yNoise * harmonicScale + harmonicNoiseYOffset,
                noiseZ + 9.73 + harmonicNoiseZOffset,
                noiseOctaves,
                noiseFalloff
            );
            const rawNoise = mix(baseNoise, harmonicNoise, harmonicAmount);
            const centeredNoise = rawNoise - noiseStats.mean + 0.5;
            const n = centeredNoise - noiseBias;
            const h = n * meltStrength;
            const px = y * pixelRowStride + xPixelOffset;
            const rectY = Math.round(deterministicColumnMelt[columnIndex] - xOffset + y * verticalStretch);

            const color = decomposedSourceColor(
                sourcePixels[px],
                sourcePixels[px + 1],
                sourcePixels[px + 2],
                x,
                y,
                liveState
            );

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x, rectY, columnStep, h);

            deterministicColumnMelt[columnIndex] += h;
        }

        renderY++;
    }

    ctx.restore();

    if (renderY >= renderHeight) {
        completed = true;
        globalThis.__textureMelt.completed = true;
        const detail = {
            projectName: PROJECT_NAME,
            tokenSymbol: TOKEN_SYMBOL,
            renderInput,
            tokenData: renderInput,
            liveState,
            features: globalThis.$features,
            settings: features,
            renderMs: nowTime,
        };

        globalThis.dispatchEvent(new CustomEvent("runners-standing-still:complete", { detail }));
        startLiveBlockLoop();
        return;
    }

    nowTime += deltaTime;
};

function run() {
    const canvas = document.querySelector("canvas") || document.body.appendChild(document.createElement("canvas"));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let lastTime = 0;
    let framePending = false;

    setup({ canvas, ctx });

    function scheduleFrame() {
        if (framePending) {
            return;
        }

        framePending = true;
        requestAnimationFrame(frame);
    }

    function frame(time) {
        framePending = false;
        const deltaTime = lastTime === 0 ? 0 : time - lastTime;

        lastTime = time;
        draw({ ctx, canvas, deltaTime });

        if (!completed) {
            scheduleFrame();
        }
    }

    scheduleFrame();
}

run();
