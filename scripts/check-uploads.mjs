// scripts/check-uploads.mjs
//
// Dry-run checklist for the VPS image upload pipeline:
//
//   admin form (ImageVpsUpload) → POST /api/upload (admin only)
//     → sharp → webp → CDN_ROOT/<folder>/… → nginx → https://assets…/<folder>/…
//     → next/image optimizer (/_next/image) → the page
//
// Run it ON THE VPS, in the app folder, as the same user PM2 runs the app as:
//
//   npm run check:uploads
//   npm run check:uploads -- --skip-live   # only the local disk/sharp checks
//
// Dry: it touches no database and no real image. It writes ONE tiny test file
// to CDN_ROOT/_healthcheck/ (so it can prove disk → nginx → CDN works) and
// deletes it again at the end, even if a check fails. No secrets are printed.

import { createRequire } from "node:module";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const cwd = process.cwd();
loadEnvConfig(cwd, false, { info() {}, error() {} });
const env = process.env;
const skipLive = process.argv.includes("--skip-live");

// ── Same values the upload route uses (app/api/upload/route.ts) ──────────────
const CDN_ROOT = env.CDN_ROOT || "/var/www/cdn/images";
const PUBLIC_BASE = (env.NEXT_PUBLIC_CDN_URL || "https://assets.merchcommunication.com").replace(/\/+$/, "");
const SITE_URL = (env.NEXT_PUBLIC_SITE_URL || "https://www.merchcommunication.com").replace(/\/+$/, "");
const MAX_BYTES = 10 * 1024 * 1024;
const SAFE_FOLDER = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
// Folders sent by forms that use ImageVpsUpload (today: EventForm → banners,
// thumbnails). gallery/profiles/hero are listed for when those forms switch over.
const FORM_FOLDERS = ["banners", "thumbnails", "gallery", "profiles", "hero"];

let problems = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg, fix) => {
  problems++;
  console.log(`  ❌ ${msg}`);
  if (fix) console.log(`     → ${fix}`);
};
const warn = (msg, fix) => {
  console.log(`  ⚠️  ${msg}`);
  if (fix) console.log(`     → ${fix}`);
};
const section = (title) =>
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function get(url, init = {}) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), ...init });
}
function netText(err) {
  const code = err?.cause?.code || err?.name || "";
  return [err?.message, code && `(${code})`].filter(Boolean).join(" ");
}

// The test file — created in step 4, removed in the finally block.
const testDir = join(CDN_ROOT, "_healthcheck");
const testName = `${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
const testFile = join(testDir, testName);
const testUrl = `${PUBLIC_BASE}/_healthcheck/${testName}`;
let createdDir = false;
let wroteFile = false;

async function main() {
  console.log("VPS image upload checklist (dry run)");
  console.log(`  app folder : ${cwd}`);
  console.log(`  running as : ${userInfo().username} (uid ${process.getuid?.()})`);

  // ── 1. Config ──────────────────────────────────────────────────────────────
  section("1. Config (.env)");
  if (env.CDN_ROOT) ok(`CDN_ROOT = ${CDN_ROOT}`);
  else warn(`CDN_ROOT not set — the route uses the default ${CDN_ROOT}`);
  if (env.NEXT_PUBLIC_CDN_URL) ok(`NEXT_PUBLIC_CDN_URL = ${PUBLIC_BASE}`);
  else warn(`NEXT_PUBLIC_CDN_URL not set — the route uses the default ${PUBLIC_BASE}`);
  if (!PUBLIC_BASE.startsWith("https://"))
    bad("Public image URL isn't https", "Use https:// — the site is https and browsers block mixed content.");
  ok(`Site URL used for live checks = ${SITE_URL}`);

  // next/image refuses hosts that aren't in remotePatterns.
  try {
    const cdnHost = new URL(PUBLIC_BASE).hostname;
    const nextConfig = readFileSync(join(cwd, "next.config.ts"), "utf8");
    if (nextConfig.includes(`"${cdnHost}"`)) ok(`next.config.ts remotePatterns includes ${cdnHost}`);
    else bad(`next.config.ts remotePatterns is missing ${cdnHost}`, "Add it under images.remotePatterns, rebuild.");
    if (/minimumCacheTTL/.test(nextConfig)) ok("next.config.ts sets images.minimumCacheTTL (optimizer cache)");
    else warn("images.minimumCacheTTL not set — optimized images get re-fetched often");
  } catch (e) {
    warn(`Couldn't read next.config.ts: ${e.message}`);
  }

  // ── 2. Folder names ────────────────────────────────────────────────────────
  section("2. Upload folder names");
  const rejected = FORM_FOLDERS.filter((f) => !SAFE_FOLDER.test(f));
  if (rejected.length === 0) ok(`All form folders pass the route's name check: ${FORM_FOLDERS.join(", ")}`);
  else bad(`Route would reject: ${rejected.join(", ")}`, "Rename the folder prop or widen safeFolder() in app/api/upload/route.ts.");

  // ── 3. Disk ────────────────────────────────────────────────────────────────
  section("3. Disk (CDN_ROOT)");
  if (!existsSync(CDN_ROOT)) {
    bad(`${CDN_ROOT} does not exist`, `sudo mkdir -p ${CDN_ROOT} && sudo chown -R ${userInfo().username}: ${CDN_ROOT}`);
    return; // nothing below can work
  }
  const st = statSync(CDN_ROOT);
  if (!st.isDirectory()) {
    bad(`${CDN_ROOT} is not a folder`);
    return;
  }
  ok(`${CDN_ROOT} exists (owner uid ${st.uid}, mode ${(st.mode & 0o777).toString(8)})`);

  try {
    accessSync(CDN_ROOT, constants.W_OK);
    ok("Writable by this user");
  } catch {
    bad(`Not writable by ${userInfo().username}`, `sudo chown -R ${userInfo().username}: ${CDN_ROOT}  (must be the user PM2 runs as)`);
  }
  // nginx runs as another user (www-data) and needs to read + enter folders.
  if ((st.mode & 0o005) === 0o005) ok("Others can read/enter it (nginx can serve files)");
  else bad("Others can't read/enter it — nginx will answer 403", `sudo chmod o+rx ${CDN_ROOT}`);

  for (const f of FORM_FOLDERS) {
    const p = join(CDN_ROOT, f);
    if (!existsSync(p)) continue; // the route creates it on first upload
    try {
      accessSync(p, constants.W_OK);
    } catch {
      bad(`${p} exists but isn't writable`, `sudo chown -R ${userInfo().username}: ${p}`);
    }
  }

  try {
    const fs = statfsSync(CDN_ROOT);
    const free = fs.bavail * fs.bsize;
    if (free < 500 * 1024 * 1024) bad(`Only ${mb(free)} free disk`, "Free up space — uploads fail when the disk is full.");
    else ok(`${mb(free)} free disk`);
  } catch {
    warn("Couldn't read free disk space (run: df -h)");
  }

  // ── 4. sharp ───────────────────────────────────────────────────────────────
  section("4. Image processing (sharp)");
  let sharp;
  try {
    sharp = require("sharp");
    ok(`sharp loads (libvips ${sharp.versions?.vips ?? "?"})`);
  } catch (e) {
    bad(`sharp doesn't load: ${e.message}`, "Run npm ci on the VPS (sharp has a native part built per OS), then pm2 restart.");
    return;
  }
  let webp;
  try {
    // Same steps as the route: rotate → resize → webp.
    webp = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#c6ff00" } })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    ok(`Encodes WebP (${webp.length} bytes test image)`);
  } catch (e) {
    bad(`WebP encode failed: ${e.message}`, "Reinstall sharp: npm ci");
    return;
  }

  // ── 5. Write the test file (like the route: tmp file + rename) ─────────────
  section("5. Write + rename (atomic save)");
  try {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
      createdDir = true;
    }
    const tmp = `${testFile}.tmp`;
    writeFileSync(tmp, webp);
    wroteFile = true;
    renameSync(tmp, testFile);
    ok(`Saved ${testFile}`);
  } catch (e) {
    bad(`Couldn't save: ${e.message}`, "Fix ownership/permissions of CDN_ROOT (see step 3).");
    return;
  }

  if (skipLive) {
    warn("--skip-live: skipping nginx / CDN / live route checks");
    return;
  }

  // ── 6. nginx / CDN serves it ───────────────────────────────────────────────
  section("6. Public URL (nginx → CDN)");
  try {
    const res = await get(testUrl);
    const type = res.headers.get("content-type") || "";
    const body = Buffer.from(await res.arrayBuffer());
    if (res.status === 200 && body.length === webp.length) {
      ok(`${testUrl} → 200, ${body.length} bytes`);
      if (type.includes("image/webp")) ok("Content-Type: image/webp");
      else warn(`Content-Type is "${type}"`, "Add `include mime.types;` (webp) to the nginx config.");
      const cc = res.headers.get("cache-control");
      if (cc) ok(`Cache-Control: ${cc}`);
      else warn("No Cache-Control header", "Add `expires 30d;` (or 1y) to the assets server block.");
    } else if (res.status === 404) {
      bad(`${testUrl} → 404`, `nginx root for ${new URL(PUBLIC_BASE).hostname} must be ${CDN_ROOT} (check: sudo nginx -T | grep -A5 assets).`);
    } else if (res.status === 403) {
      bad(`${testUrl} → 403`, `nginx can't read the file: sudo chmod -R o+rX ${CDN_ROOT}`);
    } else {
      bad(`${testUrl} → ${res.status} (${body.length} bytes, expected ${webp.length})`);
    }
  } catch (e) {
    bad(`Can't reach ${PUBLIC_BASE}: ${netText(e)}`, "Check DNS for the assets domain, nginx is running, and the TLS certificate.");
  }

  // ── 7. Next image optimizer can fetch it ───────────────────────────────────
  section("7. next/image optimizer");
  try {
    const u = `${SITE_URL}/_next/image?url=${encodeURIComponent(testUrl)}&w=64&q=75`;
    const res = await get(u, { headers: { accept: "image/webp,image/*" } });
    await res.arrayBuffer();
    if (res.status === 200) ok("/_next/image → 200 (the app can load CDN images)");
    else if (res.status === 400) bad("/_next/image → 400", "CDN host missing from images.remotePatterns in the deployed build — rebuild.");
    else bad(`/_next/image → ${res.status}`, "The app couldn't fetch the CDN URL from the server itself (check the VPS can resolve its own assets domain).");
  } catch (e) {
    bad(`Can't reach ${SITE_URL}: ${netText(e)}`);
  }

  // ── 8. Live upload route is admin-only ─────────────────────────────────────
  section("8. /api/upload (live, not logged in)");
  const route = `${SITE_URL}/api/upload`;
  try {
    const fd = new FormData();
    // Not a real image: even if the guard were missing, nothing gets saved.
    fd.append("file", new Blob([Buffer.from("not-an-image")], { type: "image/webp" }), "check.webp");
    fd.append("folder", "healthcheck");
    const res = await get(route, { method: "POST", body: fd });
    await res.arrayBuffer();
    if (res.status === 401) ok("POST without login → 401 (auth guard is deployed)");
    else if (res.status === 404) bad("POST → 404", "The upload route isn't deployed — pull, npm run build, pm2 restart.");
    else bad(`POST without login → ${res.status} — expected 401`, "Anyone may be able to upload! Deploy the requireAdmin() check in app/api/upload/route.ts.");

    const del = await get(route, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: `_healthcheck/${testName}` }), // our own test file
    });
    await del.arrayBuffer();
    if (del.status === 401) ok("DELETE without login → 401");
    else bad(`DELETE without login → ${del.status} — expected 401`, "Deploy the requireAdmin() check for DELETE.");
  } catch (e) {
    bad(`Can't reach ${route}: ${netText(e)}`);
  }

  // nginx's client_max_body_size must allow the route's 10 MB limit. A big
  // unauthenticated POST should get the app's 401, not nginx's 413.
  try {
    const big = new FormData();
    big.append("file", new Blob([Buffer.alloc(8 * 1024 * 1024)], { type: "image/jpeg" }), "big.jpg");
    const res = await get(route, { method: "POST", body: big });
    await res.arrayBuffer();
    if (res.status === 413)
      bad("8 MB upload → 413 from nginx", `Set \`client_max_body_size ${Math.ceil(MAX_BYTES / 1024 / 1024) + 2}M;\` in the site's nginx server block, then sudo nginx -t && sudo systemctl reload nginx.`);
    else if (res.status === 401) ok("8 MB upload reaches the app (nginx body limit is big enough)");
    else warn(`8 MB upload → ${res.status}`);
  } catch (e) {
    warn(`Big-upload test failed to send: ${netText(e)}`);
  }
}

try {
  await main();
} catch (e) {
  bad(`Unexpected error: ${e?.stack || e}`);
} finally {
  // ── Cleanup: leave nothing behind ──────────────────────────────────────────
  section("Cleanup");
  try {
    if (wroteFile) {
      rmSync(testFile, { force: true });
      rmSync(`${testFile}.tmp`, { force: true });
    }
    if (createdDir) rmdirSync(testDir); // only if we made it and it's empty
    ok(wroteFile ? "Test file removed" : "Nothing to clean up");
  } catch (e) {
    warn(`Cleanup: ${e.message}`, `Remove by hand: rm -rf ${testDir}`);
  }

  console.log(problems === 0 ? "\n✅ Image upload pipeline looks good.\n" : `\n❌ ${problems} problem(s) — fix the → items above.\n`);
  process.exitCode = problems === 0 ? 0 : 1;
}
