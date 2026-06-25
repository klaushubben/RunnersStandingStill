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
    globalThis.contractTokenData ||
    globalThis.tokenData ||
    getPreviewRenderInput()
);

globalThis.renderInput = renderInput;
globalThis.tokenData = renderInput;

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

    grad(hash, x, y) {
        switch (hash & 3) {
            case 0:
                return x + y;
            case 1:
                return -x + y;
            case 2:
                return x - y;
            default:
                return -x - y;
        }
    }

    grad3(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;

        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    perlin(x, y) {
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = this.fade(xf);
        const v = this.fade(yf);

        const aa = this.perm[this.perm[xi] + yi];
        const ab = this.perm[this.perm[xi] + yi + 1];
        const ba = this.perm[this.perm[xi + 1] + yi];
        const bb = this.perm[this.perm[xi + 1] + yi + 1];

        const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
        const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);

        return this.lerp(x1, x2, v) * 0.5 + 0.5;
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

    sampleBase(type, x, y) {
        if (type === "domain-warped-perlin") {
            const warpScale = 0.72;
            const warpAmount = 0.42;
            const warpX = this.perlin(x * warpScale + 37.2, y * warpScale - 11.8) - 0.5;
            const warpY = this.perlin(x * warpScale - 19.6, y * warpScale + 53.4) - 0.5;

            return this.perlin(x + warpX * warpAmount, y + warpY * warpAmount);
        }

        return this.perlin(x, y);
    }

    sampleBase3(type, x, y, z) {
        if (type === "domain-warped-perlin") {
            const warpScale = 0.72;
            const warpAmount = 0.42;
            const warpX = this.perlin3(x * warpScale + 37.2, y * warpScale - 11.8, z + 3.1) - 0.5;
            const warpY = this.perlin3(x * warpScale - 19.6, y * warpScale + 53.4, z - 7.3) - 0.5;

            return this.perlin3(x + warpX * warpAmount, y + warpY * warpAmount, z);
        }

        return this.perlin3(x, y, z);
    }

    fbm(type, x, y, octaves, falloff) {
        let sum = 0;
        let amp = 0.5;
        let totalAmp = 0;
        let freq = 1;

        for (let i = 0; i < octaves; i++) {
            sum += this.sampleBase(type, x * freq, y * freq) * amp;
            totalAmp += amp;
            amp *= falloff;
            freq *= 2;
        }

        return totalAmp === 0 ? 0 : sum / totalAmp;
    }

    fbm3(type, x, y, z, octaves, falloff) {
        let sum = 0;
        let amp = 0.5;
        let totalAmp = 0;
        let freq = 1;

        for (let i = 0; i < octaves; i++) {
            sum += this.sampleBase3(type, x * freq, y * freq, z) * amp;
            totalAmp += amp;
            amp *= falloff;
            freq *= 2;
        }

        return totalAmp === 0 ? 0 : sum / totalAmp;
    }
}

const palettes = [
    {
        name: "Glacier",
        colors: ["#c5d5ea", "#759eb8", "#7392b7", "#b3c5d7", "#d8e1e9"],
    },
    {
        name: "Ember",
        colors: ["#ea8c55", "#c75146", "#ad2e24", "#81171b", "#540804"],
    },
    {
        name: "Violet",
        colors: ["#efd9ce", "#dec0f1", "#b79ced", "#957fef", "#7161ef"],
    },
    {
        name: "Graphite",
        colors: ["#3f3f3f", "#555555", "#888888", "#bbbbbb"],
    },
];

const rng = new Random();

function pickFeatures(random) {
    const paletteMode = random.random_choice(["diverging", "split-complement"]);
    const paletteRelationship = random.random_choice([
        "near-complement",
        "split-complement",
        "wide-split",
        "warm-analog",
        "soft-triadic",
    ]);
    const splitRole = random.random_choice(["undertone", "middle-flash", "deep-accent", "two-accent"]);
    const splitAccentDirection = random.random_choice([-1, 1]);
    const splitAngle = random.random_num(18, 54);
    const textureCornerLayout = random.random_choice(["normal", "flip-x", "flip-y", "rotate"]);
    const backgroundMode = random.weighted_choice([
        { value: "palette-dark", weight: 3.4 },
        { value: "palette-light", weight: 1 },
        { value: "warm-paper", weight: 1 },
        { value: "cool-paper", weight: 1 },
    ]);
    const sourceMode = random.random_choice(["gradient", "stripes"]);
    const meltStrength = random.random_num(4, 7);
    const verticalStretch = random.random_num(0.3, 0.8);
    const targetDrift = random.random_num(-0.16, 0.24);
    const neutralNoiseBias = 0.5 + verticalStretch / meltStrength;
    const noiseBias = 0.5 + (verticalStretch - targetDrift) / meltStrength;
    const effectiveSlope = verticalStretch + meltStrength * (0.5 - noiseBias);
    const harmonicAmount = random.random_dec() < 0.08
        ? random.random_num(0, 0.08)
        : random.random_num(0.16, 0.4);
    const noiseStepY = random.random_dec() < 0.15
        ? random.random_num(0.0009, 0.00135)
        : random.random_num(0.00135, 0.003);

    return {
        paletteIndex: 0,
        paletteName: paletteMode === "diverging" ? "Diverging" : "Split Complement",
        backgroundIndex: random.random_int(0, 4),
        paletteMode,
        backgroundMode,
        paletteBaseHue: random.weighted_choice([
            { value: random.random_num(4, 72), weight: 4.5 },
            { value: random.random_num(330, 360), weight: 1.65 },
            { value: random.random_num(286, 330), weight: 1.25 },
            { value: random.random_num(190, 286), weight: 0.85 },
            { value: random.random_num(68, 150), weight: 0.28 },
            { value: random.random_num(150, 190), weight: 0.15 },
        ]),
        paletteAccentOffset: random.random_num(-18, 18),
        paletteDivergeSpread: random.random_num(128, 172),
        backgroundHueOffset: random.random_choice([120, 180, 240]),
        paletteRelationship,
        splitHueFamily: "any",
        splitAccentStrength: 1,
        splitAccentDirection,
        splitAngle,
        splitRole,
        textureCornerLayout,
        scale: "canonical",
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
        neutralNoiseBias,
        noiseBiasDelta: noiseBias - neutralNoiseBias,
        targetDrift,
        effectiveSlope,
        meltStrength,
        tilt: random.random_num(0.08, 0.3),
        verticalStretch,
        alpha: random.random_int(50, 120),
        noiseOctaves: 2,
        noiseFalloff: 0.05,
        columnStep: 2,
        sourceMode,
        thinWhiteLines: false,
        showTextureMap: false,
        gradientDirection: "vertical",
        renderBatchSize: 8,
    };
}

const features = pickFeatures(rng);

globalThis.$features = {
    Palette: features.paletteName,
    "Palette Mode": features.paletteMode,
    "Background Mode": features.backgroundMode,
    Scale: features.scale,
    Format: `${features.width}x${features.height}`,
    "Noise Type": features.noiseType,
    "Gradient Direction": features.gradientDirection,
    "Source Mode": features.sourceMode,
    "Palette Relationship": features.paletteMode === "split-complement" ? features.paletteRelationship : "None",
    "Split Role": features.paletteMode === "split-complement" ? features.splitRole : "None",
    "Split Accent Direction": features.paletteMode === "split-complement" && features.splitAccentDirection < 0 ? "Counter" : "Clockwise",
    "Texture Corner Layout": features.textureCornerLayout,
};

console.log(`Deterministic render settings
projectName: ${PROJECT_NAME}
tokenSymbol: ${TOKEN_SYMBOL}
hash: ${renderInput.hash}
tokenId: ${renderInput.tokenId}
contractAddress: ${renderInput.contractAddress || "None"}
chainId: ${renderInput.chainId || "None"}
minter: ${renderInput.minter || "None"}
paletteMode: ${features.paletteMode}
backgroundMode: ${features.backgroundMode}
sourceMode: ${features.sourceMode}
paletteRelationship: ${features.paletteMode === "split-complement" ? features.paletteRelationship : "None"}
splitRole: ${features.paletteMode === "split-complement" ? features.splitRole : "None"}
splitAccentDirection: ${features.paletteMode === "split-complement" ? features.splitAccentDirection : "None"}
splitAngle: ${features.paletteMode === "split-complement" ? features.splitAngle.toFixed(3) : "None"}
textureCornerLayout: ${features.textureCornerLayout}
paletteBaseHue: ${features.paletteBaseHue.toFixed(3)}
paletteAccentOffset: ${features.paletteAccentOffset.toFixed(3)}
paletteDivergeSpread: ${features.paletteDivergeSpread.toFixed(3)}
backgroundHueOffset: ${features.backgroundHueOffset}
noiseSeed: ${features.noiseSeed}
noiseStepX: ${features.noiseStepX.toFixed(7)}
noiseStepY: ${features.noiseStepY.toFixed(7)}
noiseZ: ${features.noiseZ.toFixed(3)}
noiseBias: ${features.noiseBias.toFixed(4)}
neutralNoiseBias: ${features.neutralNoiseBias.toFixed(4)}
noiseBiasDelta: ${features.noiseBiasDelta.toFixed(4)}
targetDrift: ${features.targetDrift.toFixed(4)}
effectiveSlope: ${features.effectiveSlope.toFixed(4)}
meltStrength: ${features.meltStrength.toFixed(3)}
tilt: ${features.tilt.toFixed(3)}
verticalStretch: ${features.verticalStretch.toFixed(3)}
harmonicAmount: ${features.harmonicAmount.toFixed(3)}
harmonicScale: ${features.harmonicScale.toFixed(3)}
alpha: ${features.alpha}`);

globalThis.__textureMelt = {
    completed: false,
    projectName: PROJECT_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    renderInput,
    tokenData: renderInput,
    features: globalThis.$features,
    settings: features,
};
globalThis.__generativeRender = globalThis.__textureMelt;
globalThis.__runnersStandingStill = globalThis.__textureMelt;

let gw = features.textureWidth;
let gh = features.textureHeight;
let g;
let renderX = 0;
let renderWidth = 0;
let renderHeight = 0;
let nowTime = 0;
let completed = false;

let sourcePixels;
let noise;
let noiseStats;

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

function hueFromRanges(seedHue, ranges) {
    const unit = wrapHue(seedHue) / 360;
    const range = ranges[Math.floor(unit * ranges.length) % ranges.length];
    const local = (unit * ranges.length) % 1;
    return mix(range[0], range[1], local);
}

function guidedSplitHue(seedHue) {
    const family = features.splitHueFamily;

    if (family === "warm") {
        return hueFromRanges(seedHue, [[8, 62], [330, 360], [0, 24]]);
    }

    if (family === "earth") {
        return hueFromRanges(seedHue, [[20, 48], [58, 96], [338, 18]]);
    }

    if (family === "cool") {
        return hueFromRanges(seedHue, [[170, 215], [220, 270], [275, 315]]);
    }

    if (family === "acid") {
        return hueFromRanges(seedHue, [[68, 105], [112, 154], [292, 326]]);
    }

    return seedHue;
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

    if (features.paletteRelationship === "near-complement") {
        return mainHue + 180 + side * angle * 0.3 + offset;
    }

    if (features.paletteRelationship === "wide-split") {
        return mainHue + 180 + side * (angle + 18) + offset;
    }

    if (features.paletteRelationship === "warm-analog") {
        return warmAnalogHue(mainHue, angle) + offset * 0.45;
    }

    if (features.paletteRelationship === "soft-triadic") {
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

function oklchToRgbRaw(l, c, h) {
    const radians = wrapHue(h) * Math.PI / 180;
    const a = Math.cos(radians) * c;
    const b = Math.sin(radians) * c;
    const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
    const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
    const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;
    const l3 = lPrime * lPrime * lPrime;
    const m3 = mPrime * mPrime * mPrime;
    const s3 = sPrime * sPrime * sPrime;

    return {
        r: linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
        g: linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
        b: linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
    };
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
    const lPrime = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const mPrime = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const sPrime = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
    const l3 = lPrime * lPrime * lPrime;
    const m3 = mPrime * mPrime * mPrime;
    const s3 = sPrime * sPrime * sPrime;
    const rgb = {
        r: linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
        g: linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
        b: linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
    };
    const toHex = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0");

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function oklabToRgbBytes(lab) {
    const lPrime = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const mPrime = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const sPrime = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
    const l3 = lPrime * lPrime * lPrime;
    const m3 = mPrime * mPrime * mPrime;
    const s3 = sPrime * sPrime * sPrime;

    return {
        r: Math.round(clamp01(linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)) * 255),
        g: Math.round(clamp01(linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)) * 255),
        b: Math.round(clamp01(linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)) * 255),
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

    if (features.textureCornerLayout === "flip-x") {
        return [base[1], base[0], base[3], base[2]];
    }

    if (features.textureCornerLayout === "flip-y") {
        return [base[2], base[3], base[0], base[1]];
    }

    if (features.textureCornerLayout === "rotate") {
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

function generatedPalette() {
    const mode = features.paletteMode;
    const h = features.paletteBaseHue;

    if (mode === "split-complement") {
        const mainHue = guidedSplitHue(h);
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

        if (role === "middle-flash") {
            colors = [mainLight, mainMidLight, accentMid, mainMid, mainDark];
        } else if (role === "deep-accent") {
            colors = [mainLight, mainMidLight, mainMid, mainDark, accentDeep];
        } else if (role === "two-accent") {
            colors = [mainLight, accentPale, mainMid, mainDark, accentDeep];
        }

        return {
            name: "Split Complement",
            colors,
        };
    }

    if (mode === "diverging") {
        const hueA = h - features.paletteDivergeSpread / 2;
        const hueB = h + features.paletteDivergeSpread / 2;

        return {
            name: "Diverging",
            colors: [
                oklchToHex(0.36, 0.116 * PALETTE_CHROMA_PUSH, hueA),
                oklchToHex(0.53, 0.096 * PALETTE_CHROMA_PUSH, hueA + 8),
                oklchToHex(0.82, 0.025 * PALETTE_CHROMA_PUSH, h),
                oklchToHex(0.56, 0.096 * PALETTE_CHROMA_PUSH, hueB - 8),
                oklchToHex(0.38, 0.116 * PALETTE_CHROMA_PUSH, hueB),
            ],
        };
    }

    return palettes[features.paletteIndex];
}

function paletteDarkBackground(palette) {
    const swatches = features.paletteMode === "diverging"
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
    const lightness = features.paletteMode === "diverging" ? 0.32 : 0.29;
    const chromaFloor = features.paletteMode === "diverging" ? 0.12 : 0.095;
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

function paletteCompanionBackground() {
    const mode = features.paletteMode;
    const baseHue = mode === "split-complement"
        ? guidedSplitHue(features.paletteBaseHue)
        : features.paletteBaseHue;
    const companionHue = baseHue + features.backgroundHueOffset + features.paletteAccentOffset * 0.5;

    return hexToRgb(oklchToHex(0.88, 0.030, companionHue));
}

function backgroundRandom(seed) {
    let state = seed >>> 0;

    return function () {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function applyBackground(ctx, palette) {
    const mode = features.backgroundMode;

    if (mode === "palette-light" || mode === "palette-companion") {
        const rgb = mode === "palette-light"
            ? paletteLightBackground(palette)
            : paletteCompanionBackground();

        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.fillRect(0, 0, features.imageWidth, features.imageHeight);
        return;
    }

    if (mode !== "palette-dark") {
        const paper = mode === "cool-paper"
            ? { r: 232, g: 235, b: 232 }
            : { r: 237, g: 233, b: 224 };

        ctx.fillStyle = `rgb(${paper.r}, ${paper.g}, ${paper.b})`;
        ctx.fillRect(0, 0, features.imageWidth, features.imageHeight);

        if (mode === "painterly-paper") {
            const rand = backgroundRandom(features.noiseSeed ^ 0xBADC0DE);

            for (let i = 0; i < 140; i++) {
                const x = rand() * features.imageWidth;
                const y = rand() * features.imageHeight;
                const radiusX = 180 + rand() * 720;
                const radiusY = 80 + rand() * 360;
                const light = rand() > 0.48 ? 255 : 205;
                const alpha = 0.018 + rand() * 0.034;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate((rand() - 0.5) * 0.5);
                ctx.fillStyle = `rgba(${light}, ${light}, ${light}, ${alpha})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        return;
    }

    const rgb = paletteDarkBackground(palette);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillRect(0, 0, features.imageWidth, features.imageHeight);
}

function renderMatte(ctx) {
    ctx.fillStyle = features.matteColor;
    ctx.fillRect(0, 0, features.width, features.height);
}

function renderInnerBackground(ctx) {
    ctx.save();
    ctx.translate(features.matte, features.matte);
    applyBackground(ctx, generatedPalette());
    ctx.restore();
}

function createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = gw;
    canvas.height = gh;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const palette = generatedPalette();

    if (features.sourceMode === "stripes") {
        let y = 0;
        let stripe = 0;
        let colorIndex = 0;

        while (y < gh) {
            const gradient = ctx.createLinearGradient(0, 0, gw, 0);
            const startColor = palette.colors[colorIndex];

            colorIndex = rng.random_int(0, palette.colors.length - 1);
            addOklabStops(gradient, [startColor, palette.colors[colorIndex]]);

            stripe = 100 + rng.random_dec() * 160;
            if (y + stripe > gh) {
                stripe = gh - y;
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(0, y, gw, stripe);
            y += stripe;
        }
    } else {
        fillFourCornerOklabTexture(ctx, palette.colors);
    }

    if (features.thinWhiteLines) {
        ctx.fillStyle = "rgb(255, 255, 255)";

        for (let i = 0; i < 10; i++) {
            const y = (i + 1) * (gh / 10);
            ctx.fillRect(0, y, gw, 1);
        }
    }

    sourcePixels = ctx.getImageData(0, 0, gw, gh).data;

    return canvas;
}

function measureNoiseStats() {
    const noiseType = features.noiseType;
    const noiseStepX = features.noiseStepX;
    const noiseStepY = features.noiseStepY;
    const noiseZ = features.noiseZ;
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
            const base = noise.fbm3(noiseType, xNoise, yNoise, noiseZ, noiseOctaves, noiseFalloff);
            const harmonic = noise.fbm3(
                noiseType,
                xNoise * harmonicScale,
                yNoise * harmonicScale,
                noiseZ + 9.73,
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
    renderX = 0;
    nowTime = 0;
    completed = false;
    noiseStats = measureNoiseStats();
    renderMatte(ctx);
    renderInnerBackground(ctx);
};

let draw = ({ ctx, canvas, deltaTime }) => {
    if (completed) {
        return;
    }

    if (renderX === 0) {
        renderMatte(ctx);
        renderInnerBackground(ctx);
    }

    const noiseType = features.noiseType;
    const noiseStepX = features.noiseStepX;
    const noiseStepY = features.noiseStepY;
    const noiseZ = features.noiseZ;
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
    const endX = Math.min(renderX + batchSize, renderWidth);
    const totalTiltDistance = renderWidth * tilt;
    const yAnchor = (features.imageHeight / 2) + (totalTiltDistance / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(features.matte, features.matte, features.imageWidth, features.imageHeight);
    ctx.clip();
    ctx.translate(features.matte, features.matte + yAnchor);
    ctx.globalAlpha = alpha;

    while (renderX < endX) {
        let ny = 0;
        const xNoise = renderX * noiseStepX;
        const xOffset = renderX * tilt;
        const xPixelOffset = renderX * 4;

        for (let y = 0; y < renderHeight; y++) {
            const yNoise = y * noiseStepY;
            const baseNoise = noise.fbm3(noiseType, xNoise, yNoise, noiseZ, noiseOctaves, noiseFalloff);
            const harmonicNoise = noise.fbm3(
                noiseType,
                xNoise * harmonicScale,
                yNoise * harmonicScale,
                noiseZ + 9.73,
                noiseOctaves,
                noiseFalloff
            );
            const rawNoise = mix(baseNoise, harmonicNoise, harmonicAmount);
            const centeredNoise = rawNoise - noiseStats.mean + 0.5;
            const n = centeredNoise - noiseBias;
            const h = n * meltStrength;
            const px = y * pixelRowStride + xPixelOffset;
            const rectY = Math.round(ny - xOffset + y * verticalStretch);

            ctx.fillStyle = `rgb(${sourcePixels[px]}, ${sourcePixels[px + 1]}, ${sourcePixels[px + 2]})`;
            ctx.fillRect(renderX, rectY, columnStep, h);

            ny += h;
        }

        renderX += columnStep;
    }

    ctx.restore();

    if (renderX >= renderWidth) {
        completed = true;
        globalThis.__textureMelt.completed = true;
        globalThis.__generativeRender.completed = true;
        console.log({
            renderInput,
            tokenData: renderInput,
            features: globalThis.$features,
            renderMs: nowTime,
        });
        const detail = {
            projectName: PROJECT_NAME,
            tokenSymbol: TOKEN_SYMBOL,
            renderInput,
            tokenData: renderInput,
            features: globalThis.$features,
            settings: features,
            renderMs: nowTime,
        };

        globalThis.dispatchEvent(new CustomEvent("runners-standing-still:complete", { detail }));
        globalThis.dispatchEvent(new CustomEvent("generative-render:complete", { detail }));
        globalThis.dispatchEvent(new CustomEvent("texturemelt:complete", { detail }));
        return;
    }

    nowTime += deltaTime;
};

function run() {
    const canvas = document.querySelector("canvas") || document.body.appendChild(document.createElement("canvas"));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let lastTime = 0;

    setup({ canvas, ctx });

    function frame(time) {
        const deltaTime = lastTime === 0 ? 0 : time - lastTime;

        lastTime = time;
        draw({ ctx, canvas, deltaTime });

        if (!completed) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}

run();
