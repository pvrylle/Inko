// Build optimized WebP sprite-sheet grids + atlas JSON for both mascots.
//
// Source assets:
//   - OCTOPUS (main / "Inko"): public/mascots/OCTOPUS/sprites/<State>/
//       Numbered PNG pages are sliced with their adjacent JSON atlas when one
//       exists, or a verified per-folder layout for legacy exports without JSON.
//       The standalone Research PDF strip is also included. Connected near-white
//       page backgrounds are removed while enclosed white details are preserved.
//       public/mascots/OCTOPUS/tentaio_happy is a MAKKO portrait sheet that is
//       already transparent — packed without flood-fill as key "happy".
//   - MR CLAWS (secondary): public/mascots/MR Claws/MR claws/tentaio_*/
//       One packed sheet `<name>.png` + a MAKKO atlas JSON with per-frame
//       coordinates (the JSON's `image` says .webp but the real file is .png).
//   Videos, GIFs, and static pose PNGs are never packed — MP4 quality is too
//   soft for UI, so only the PNG sprite sheets / MAKKO atlases are used.
//
// Output: public/mascots/generated/<character>/<key>.webp + <key>.json,
//         and public/mascots/generated/manifest.json.
// Every animation is normalized to a uniform grid so the runtime has one path.

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MASCOTS = path.join(ROOT, "public", "mascots");
const OUT = path.join(MASCOTS, "generated");
const FPS = 24; // duration 42ms per frame across all source atlases

// Target frame sizes per character (keep each character's native aspect ratio).
const OCTO_FRAME = { w: 512, h: 288 };   // source frames are 1920x1080 (16:9)
const OCTO_HAPPY_FRAME = { w: 196, h: 256 }; // MAKKO portrait (already transparent)
const CLAW_FRAME = { w: 256, h: 181 };   // source frames are 256x181 (native)

// Verified layouts for legacy Inko exports that do not include an atlas JSON.
// A 1px gutter separates cells in the numbered 4096x4096 pages.
// These layouts win over any JSON in the folder: "Conversation Loop" ships a
// mismatched atlas that describes 1920x1080 cells on 1280x720 pages.
const LEGACY_OCTOPUS_LAYOUTS = {
  "Conversation Loop": { cols: 3, rows: 5, w: 1280, h: 720, gapX: 1, gapY: 1 },
  "Ideal Sleeping state": { cols: 2, rows: 3, w: 1920, h: 1080, gapX: 1, gapY: 1 },
  "INKO PDF": { cols: 3, rows: 5, w: 1280, h: 720, gapX: 1, gapY: 1 },
  reading: { cols: 4, rows: 7, w: 960, h: 540, gapX: 1, gapY: 1 },
  "sleeping keme": { cols: 4, rows: 7, w: 960, h: 540, gapX: 1, gapY: 1 },
};

function layoutFrames({ cols, rows, w, h, gapX = 0, gapY = 0 }) {
  return Array.from({ length: cols * rows }, (_, index) => ({
    x: (index % cols) * (w + gapX),
    y: Math.floor(index / cols) * (h + gapY),
    w,
    h,
  }));
}

/**
 * Make only the near-white region connected to a frame edge transparent.
 * Flood filling (rather than global color-keying) preserves enclosed white
 * details such as Inko's eyes, shine marks, glasses and curl opening.
 */
async function removeConnectedLightBackground(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isLightBackground = (pixel) => {
    const offset = pixel * channels;
    if (data[offset + 3] === 0) return true;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isLightBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    data[pixel * channels + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function prepareOctopusFrame(source, rect) {
  const pipeline = sharp(source)
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize(OCTO_FRAME.w, OCTO_FRAME.h, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  return removeConnectedLightBackground(pipeline);
}

/** True when a PNG buffer has enough opaque pixels to be a real animation frame. */
async function isOpaqueEnough(pngBuffer, minOpaquePct = 5) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const step = Math.max(1, Math.floor((width * height) / 40_000));
  let opaque = 0;
  let samples = 0;
  for (let i = 0; i < width * height; i += step) {
    samples += 1;
    if (data[i * channels + 3] > 16) opaque += 1;
  }
  return (100 * opaque) / samples >= minOpaquePct;
}

/** Drop near-empty buffers so blank cells never enter the loop count. */
async function filterOpaqueFrames(buffers) {
  const kept = [];
  for (const buffer of buffers) {
    if (await isOpaqueEnough(buffer)) kept.push(buffer);
  }
  return kept;
}

/** Write a tight static logo webp from the first non-empty frame buffer. */
async function exportLogo(frameBuffer, character) {
  const outDir = path.join(OUT, character);
  await mkdir(outDir, { recursive: true });
  const { data, info } = await sharp(frameBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] <= 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) {
    await writeFile(path.join(outDir, "logo.webp"), await sharp(frameBuffer).webp({ quality: 90 }).toBuffer());
    return;
  }
  const pad = 4;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2);
  const logo = await sharp(frameBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: 128, height: 128, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
  await writeFile(path.join(outDir, "logo.webp"), logo);
  console.log(`  ${character}/logo.webp`);
}

/** Index range holding the middle `keep` share of a histogram's mass. */
function massRange(hist, keep) {
  const total = hist.reduce((sum, value) => sum + value, 0);
  const cut = (total * (1 - keep)) / 2;
  let start = 0;
  let acc = 0;
  while (start < hist.length - 1 && acc + hist[start] <= cut) acc += hist[start++];
  let end = hist.length - 1;
  acc = 0;
  while (end > start && acc + hist[end] <= cut) acc += hist[end--];
  return [start, end];
}

/**
 * Re-frame every clip so the character fills the same share of the frame.
 * Source exports place the mascot at different scales and offsets, so the
 * union of the opaque area across all frames is centered and scaled to fit.
 */
async function normalizeFrames(buffers, frame) {
  const decoded = [];
  const cols = new Float64Array(frame.w);
  const rows = new Float64Array(frame.h);
  for (const buffer of buffers) {
    const { data, info } = await sharp(buffer)
      .resize(frame.w, frame.h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    decoded.push({ data, info });
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] > 60) {
          cols[x] += 1;
          rows[y] += 1;
        }
      }
    }
  }

  const [x0, x1] = massRange(Array.from(cols), 0.995);
  const [y0, y1] = massRange(Array.from(rows), 0.995);
  const pad = 4;
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  const boxW = Math.min(frame.w - left, x1 - x0 + 1 + pad * 2);
  const boxH = Math.min(frame.h - top, y1 - y0 + 1 + pad * 2);
  const scale = Math.min((frame.h * 0.92) / boxH, (frame.w * 0.96) / boxW);
  const outW = Math.max(1, Math.round(boxW * scale));
  const outH = Math.max(1, Math.round(boxH * scale));
  const offsetX = Math.round((frame.w - outW) / 2);
  const offsetY = Math.round((frame.h - outH) / 2);

  const normalized = [];
  for (const { data, info } of decoded) {
    const character = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left, top, width: boxW, height: boxH })
      .resize(outW, outH, { fit: "fill" })
      .png()
      .toBuffer();
    normalized.push(
      await sharp({ create: { width: frame.w, height: frame.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: character, left: offsetX, top: offsetY }])
        .png()
        .toBuffer(),
    );
  }
  return normalized;
}

/** Natural sort so spritesheet_2 < spritesheet_10. */
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Pick a near-square grid for n frames. */
function gridFor(n) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

/** Composite already-sized frame buffers into one WebP grid + return atlas meta. */
async function packGrid(frameBuffers, frame, character, key) {
  const count = frameBuffers.length;
  const { cols, rows } = gridFor(count);
  const sheet = sharp({
    create: {
      width: cols * frame.w,
      height: rows * frame.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const composites = frameBuffers.map((input, i) => ({
    input,
    left: (i % cols) * frame.w,
    top: Math.floor(i / cols) * frame.h,
  }));
  const buffer = await sheet.composite(composites).webp({ quality: 82, effort: 5 }).toBuffer();

  const outDir = path.join(OUT, character);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${key}.webp`), buffer);

  const atlas = {
    url: `/mascots/generated/${character}/${key}.webp`,
    frameWidth: frame.w,
    frameHeight: frame.h,
    cols,
    rows,
    count,
    fps: FPS,
  };
  await writeFile(path.join(outDir, `${key}.json`), JSON.stringify(atlas, null, 2));
  const kb = (buffer.length / 1024).toFixed(0);
  console.log(`  ${character}/${key}: ${count} frames -> ${cols}x${rows} grid, ${kb}KB`);
  return { key, ...atlas };
}

async function buildOctopus() {
  const base = path.join(MASCOTS, "OCTOPUS", "sprites");
  const entries = await readdir(base, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(base, entry.name);
    const files = await readdir(dir);
    const jsonFile = files.find((f) => f.toLowerCase().endsWith(".json"));
    const sheets = files.filter((f) => /^spritesheet_\d+\.png$/i.test(f)).sort(naturalSort);
    let pagePaths = sheets.map((sheet) => path.join(dir, sheet));
    let rects = [];

    if (LEGACY_OCTOPUS_LAYOUTS[entry.name]) {
      rects = layoutFrames(LEGACY_OCTOPUS_LAYOUTS[entry.name]);
    } else if (jsonFile) {
      const atlas = JSON.parse(await readFile(path.join(dir, jsonFile), "utf8"));
      if (Array.isArray(atlas.frames)) rects = atlas.frames.map((item) => item.frame);
    } else if (entry.name === "Tentaio" && files.includes("Research PDF.png")) {
      // Legacy Figma export: one 2721x32768 strip, exactly 3x64 cells.
      pagePaths = [path.join(dir, "Research PDF.png")];
      rects = layoutFrames({ cols: 3, rows: 64, w: 907, h: 512 });
    }

    if (pagePaths.length === 0 || rects.length === 0) {
      console.warn(`  (skip unknown layout) ${entry.name}`);
      continue;
    }

    const buffers = [];
    for (const sheetPath of pagePaths) {
      const metadata = await sharp(sheetPath).metadata();
      for (const rect of rects) {
        // Ignore atlas cells outside a page rather than producing a corrupt
        // frame if a source export's last page is smaller.
        if (rect.x + rect.w > (metadata.width ?? 0) || rect.y + rect.h > (metadata.height ?? 0)) continue;
        buffers.push(await prepareOctopusFrame(sheetPath, rect));
      }
    }
    const opaque = await filterOpaqueFrames(buffers);
    if (opaque.length === 0) continue;
    const key = entry.name === "Tentaio" ? "research-pdf-standalone" : slugify(entry.name);
    if (key === "idle-state") await exportLogo(opaque[0], "octopus");
    results.push(await packGrid(await normalizeFrames(opaque, OCTO_FRAME), OCTO_FRAME, "octopus", key));
  }

  // Native-transparent MAKKO portrait (celebrate / happy mood). Same packing
  // path as Mr Claws — keep existing alpha, do not flood-fill the white sheet.
  const happy = await buildOctopusHappy();
  if (happy) results.push(happy);

  return results;
}

/** Pack OCTOPUS/tentaio_happy as a portrait atlas with existing transparency. */
async function buildOctopusHappy() {
  const dir = path.join(MASCOTS, "OCTOPUS", "tentaio_happy");
  if (!existsSync(dir)) {
    console.warn("  (skip missing) tentaio_happy");
    return null;
  }
  const files = await readdir(dir);
  const jsonFile = files.find((f) => f.toLowerCase().endsWith(".json"));
  const pngFile = files.find((f) => f.toLowerCase().endsWith(".png"));
  if (!jsonFile || !pngFile) {
    console.warn("  (skip incomplete) tentaio_happy");
    return null;
  }

  const atlas = JSON.parse(await readFile(path.join(dir, jsonFile), "utf8"));
  const frameEntries = Object.entries(atlas.frames).sort((a, b) => naturalSort(a[0], b[0]));
  const sheetPath = path.join(dir, pngFile);
  const buffers = [];
  for (const [, meta] of frameEntries) {
    const { x, y, w, h } = meta.frame;
    const frame = await sharp(sheetPath)
      .extract({ left: x, top: y, width: w, height: h })
      .resize(OCTO_HAPPY_FRAME.w, OCTO_HAPPY_FRAME.h, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    buffers.push(frame);
  }
  const opaque = await filterOpaqueFrames(buffers);
  if (opaque.length === 0) return null;
  return packGrid(await normalizeFrames(opaque, OCTO_FRAME), OCTO_FRAME, "octopus", "happy");
}

/** Normalize an MR Claws folder name to a stable key, dropping " 2"/"2"/" (1)" dupes. */
function clawKey(folderName) {
  return folderName
    .replace(/^tentaio_/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")   // "talking_debate (1)" -> "talking_debate"
    .replace(/\s*\d+\s*$/, "")        // "question 2" -> "question"
    .replace(/(\D)\d+$/, "$1")        // "research2" -> "research"
    .trim();
}

async function buildMrClaws() {
  const base = path.join(MASCOTS, "MR Claws", "MR claws");
  const entries = await readdir(base, { withFileTypes: true });
  const results = [];
  const seen = new Set();
  for (const entry of entries.sort((a, b) => naturalSort(a.name, b.name))) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(base, entry.name);
    const files = await readdir(dir);
    const jsonFile = files.find((f) => f.toLowerCase().endsWith(".json"));
    const pngFile = files.find((f) => f.toLowerCase().endsWith(".png"));
    if (!jsonFile || !pngFile) continue;

    const key = slugify(clawKey(entry.name));
    if (seen.has(key)) {
      console.log(`  (skip duplicate) ${entry.name} -> ${key}`);
      continue;
    }
    seen.add(key);

    const atlas = JSON.parse(await readFile(path.join(dir, jsonFile), "utf8"));
    // MAKKO format: frames is an object keyed by frame filename.
    const frameEntries = Object.entries(atlas.frames).sort((a, b) => naturalSort(a[0], b[0]));
    const sheetPath = path.join(dir, pngFile);
    const buffers = [];
    for (const [, meta] of frameEntries) {
      const { x, y, w, h } = meta.frame;
      const frame = await sharp(sheetPath)
        .extract({ left: x, top: y, width: w, height: h })
        .resize(CLAW_FRAME.w, CLAW_FRAME.h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      buffers.push(frame);
    }
    const opaque = await filterOpaqueFrames(buffers);
    if (opaque.length === 0) continue;
    if (key === "question") await exportLogo(opaque[0], "mrclaws");
    results.push(await packGrid(await normalizeFrames(opaque, CLAW_FRAME), CLAW_FRAME, "mrclaws", key));
  }
  return results;
}

async function main() {
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  console.log("Building octopus (main) sprites…");
  const octopus = await buildOctopus();
  console.log("Building MR Claws sprites…");
  const mrclaws = await buildMrClaws();

  const manifest = {
    fps: FPS,
    characters: {
      octopus: Object.fromEntries(octopus.map((a) => [a.key, a])),
      mrclaws: Object.fromEntries(mrclaws.map((a) => [a.key, a])),
    },
  };
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. octopus keys: ${octopus.map((a) => a.key).join(", ")}`);
  console.log(`mrclaws keys: ${mrclaws.map((a) => a.key).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
