import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "/Users/nickhubben/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const root = path.resolve(import.meta.dirname, "..");
const projectDir = path.join(root, "projects/runners-standing-still");
const rendererPath = path.join(projectDir, "sketch.runners-standing-still.min.js");
const thumbsDir = path.join(projectDir, "thumbs");
const manifestPath = path.join(projectDir, "mint-thumbnails.json");
const sampleCount = Number(process.env.SAMPLE_COUNT || 12);

const rendererScript = await fs.readFile(rendererPath, "utf8");
await fs.mkdir(thumbsDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const thumbnails = [];

  for (let i = 1; i <= sampleCount; i++) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 700 },
      deviceScaleFactor: 1,
    });
    const hash = sampleHash(i);
    const fileName = `${String(i).padStart(4, "0")}.png`;
    const filePath = path.join(thumbsDir, fileName);

    try {
      await page.setContent(buildHtml({ hash, tokenId: String(i) }), { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          globalThis.__textureMelt?.completed === true ||
          globalThis.__runnersStandingStill?.completed === true,
        undefined,
        { timeout: 120000 },
      );
      await page.screenshot({ path: filePath, fullPage: false });
    } finally {
      await page.close();
    }

    thumbnails.push({
      tokenId: String(i),
      name: `Sample #${i}`,
      image: `./thumbs/${fileName}`,
      hash,
    });
    console.log(`wrote ${filePath}`);
  }

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: "static-feedback",
        totalSupply: sampleCount,
        thumbnails,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`manifest ${manifestPath}`);
} finally {
  await browser.close();
}

function sampleHash(index) {
  return `0x${createHash("sha256").update(`runners-standing-still-feedback-${index}`).digest("hex")}`;
}

function buildHtml(input) {
  const renderInputJson = JSON.stringify({
    contractAddress: "",
    chainId: "",
    minter: "",
    ...input,
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Runners Standing Still Sample</title><style>html,body{width:100%;height:100%;margin:0;background:#f5f5f2}body{display:grid;place-items:center;overflow:hidden}canvas{display:block;max-width:100vw;max-height:100vh}</style></head><body><canvas></canvas><script>window.renderInput=${renderInputJson};window.tokenData=window.renderInput;</script><script>${rendererScript}</script></body></html>`;
}
