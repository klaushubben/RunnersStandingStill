import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "/Users/nickhubben/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const root = path.resolve(import.meta.dirname, "..");
const projectDir = path.join(root, "projects/runners-standing-still");
const configPath = path.join(projectDir, "runner-config.local.js");
const thumbsDir = path.join(projectDir, "thumbs");
const manifestPath = path.join(projectDir, "mint-thumbnails.json");

const selectors = {
  totalSupply: "0x18160ddd",
  tokenURI: "0xc87b56dd",
};

const config = await readConfig();
await fs.mkdir(thumbsDir, { recursive: true });

const totalSupply = Number(BigInt(await call(selectors.totalSupply)));
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 700 },
    deviceScaleFactor: 1,
  });

  const thumbnails = [];
  for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
    const tokenURI = decodeAbiString(await call(selectors.tokenURI + encodeUint(tokenId)));
    const metadata = JSON.parse(decodeDataUri(tokenURI));
    const fileName = `${String(tokenId).padStart(4, "0")}.png`;
    const filePath = path.join(thumbsDir, fileName);

    await page.goto(metadata.animation_url, { waitUntil: "load" });
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              resolve();
            }
          };
          window.addEventListener("runners-standing-still:complete", finish, { once: true });
          setTimeout(finish, 9000);
        }),
    );
    await page.screenshot({ path: filePath, fullPage: false });

    thumbnails.push({
      tokenId: String(tokenId),
      name: metadata.name || `RUNNER #${tokenId}`,
      image: `./thumbs/${fileName}`,
      scriptHash: metadata.attributes?.find((attribute) => attribute.trait_type === "Script Hash")?.value || "",
    });

    console.log(`wrote ${filePath}`);
  }

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rpcUrl: config.rpcUrl,
        tokenAddress: config.tokenAddress,
        totalSupply,
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

async function readConfig() {
  const source = await fs.readFile(configPath, "utf8");
  return {
    rpcUrl: readString(source, "rpcUrl"),
    tokenAddress: readString(source, "tokenAddress"),
  };
}

function readString(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  if (!match) throw new Error(`Missing ${key} in ${configPath}`);
  return match[1];
}

async function call(data) {
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_call",
      params: [{ to: config.tokenAddress, data }, "latest"],
    }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function decodeAbiString(hex) {
  const value = strip0x(hex);
  const offset = Number.parseInt(value.slice(0, 64), 16) * 2;
  const length = Number.parseInt(value.slice(offset, offset + 64), 16) * 2;
  const body = value.slice(offset + 64, offset + 64 + length);
  const bytes = body.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [];
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function decodeDataUri(uri) {
  const comma = uri.indexOf(",");
  const meta = uri.slice(0, comma);
  const data = uri.slice(comma + 1);

  if (meta.includes(";base64")) {
    return Buffer.from(data, "base64").toString("utf8");
  }

  return decodeURIComponent(data);
}

function strip0x(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}
