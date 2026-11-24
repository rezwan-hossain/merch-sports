// scripts/migrate-supabase-images.mjs
//
// Moves images that are still stored on Supabase Storage to the VPS
// (CDN_ROOT, served by nginx at NEXT_PUBLIC_CDN_URL) and points the database
// at the new copies. This stops those images from using Supabase egress.
//
// Run it ON THE VPS, in the app folder, as the user PM2 runs as:
//
//   npm run migrate:images                        # dry run: only lists, downloads nothing
//   npm run migrate:images -- --apply             # move everything
//   npm run migrate:images -- --apply --only gallery   # just the gallery
//
// --only accepts: gallery, team, hero, event, organizer
//
// Safe to re-run: files are named from the old URL, so a second run reuses
// them, and rows already on the VPS are skipped. It NEVER deletes anything
// on Supabase. A row is only updated after the new public URL answers 200.

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const cwd = process.cwd();
loadEnvConfig(cwd, false, { info() {}, error() {} });

const CDN_ROOT = process.env.CDN_ROOT || "/var/www/cdn/images";
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_CDN_URL || "https://assets.merchcommunication.com").replace(/\/+$/, "");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// Every DB column that can hold an image URL, and the VPS folder it goes to.
const TARGETS = [
  { group: "gallery", model: "galleryImage", field: "src", folder: "gallery" },
  { group: "team", model: "teamMember", field: "image", folder: "profiles" },
  { group: "hero", model: "heroSection", field: "desktopImage", folder: "hero" },
  { group: "hero", model: "heroSection", field: "mobileImage", folder: "hero" },
  { group: "event", model: "event", field: "bannerImage", folder: "banners" },
  { group: "event", model: "event", field: "thumbImage", folder: "thumbnails" },
  { group: "organizer", model: "organizer", field: "logo", folder: "logos" },
];

const isSupabase = (url) => typeof url === "string" && url.includes(".supabase.co/storage/");
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  if (only && !TARGETS.some((t) => t.group === only)) {
    console.log(`Unknown --only "${only}". Use: ${[...new Set(TARGETS.map((t) => t.group))].join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = require(`${cwd}/lib/generated/prisma`);
  const db = new PrismaClient();
  let sharp;
  if (apply) sharp = require("sharp");

  console.log(apply ? "MIGRATING images Supabase → VPS" : "DRY RUN — nothing is downloaded or changed (add --apply)");
  console.log(`  save to : ${CDN_ROOT}`);
  console.log(`  serve as: ${PUBLIC_BASE}\n`);

  if (apply && !existsSync(CDN_ROOT)) {
    console.log(`❌ ${CDN_ROOT} doesn't exist. Run npm run check:uploads first.`);
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }

  let found = 0, moved = 0, failed = 0, bytesIn = 0, bytesOut = 0;

  try {
    for (const t of TARGETS) {
      if (only && t.group !== only) continue;

      const rows = await db[t.model].findMany({
        where: { [t.field]: { contains: ".supabase.co/storage/" } },
        select: { id: true, [t.field]: true },
      });
      // Several rows can share one image — move each URL once.
      const urls = [...new Set(rows.map((r) => r[t.field]).filter(isSupabase))];
      if (urls.length === 0) continue;

      console.log(`── ${t.model}.${t.field}: ${urls.length} image(s) on Supabase`);
      found += urls.length;

      for (const oldUrl of urls) {
        const short = oldUrl.split("/").slice(-2).join("/");
        if (!apply) {
          console.log(`   • ${short}`);
          continue;
        }

        try {
          // Name = hash of the old URL → re-running reuses the same file.
          const hash = createHash("sha256").update(oldUrl).digest("hex").slice(0, 32);
          const relPath = `${t.folder}/migrated/${hash}.webp`;
          const absPath = join(CDN_ROOT, relPath);
          const newUrl = `${PUBLIC_BASE}/${relPath}`;

          if (!existsSync(absPath)) {
            // 1. Download from Supabase (one last time).
            const res = await fetch(oldUrl, { signal: AbortSignal.timeout(60000) });
            if (!res.ok) throw new Error(`download ${res.status}`);
            const input = Buffer.from(await res.arrayBuffer());
            bytesIn += input.length;

            // 2. Same processing as /api/upload: rotate, max 2000px, webp.
            const output = await sharp(input)
              .rotate()
              .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
              .webp({ quality: 82 })
              .toBuffer();

            // 3. Save atomically (tmp + rename) so nginx never serves half a file.
            mkdirSync(dirname(absPath), { recursive: true });
            writeFileSync(`${absPath}.tmp`, output);
            renameSync(`${absPath}.tmp`, absPath);
          }
          bytesOut += statSync(absPath).size;

          // 4. Only touch the DB once the new URL really works.
          const check = await fetch(newUrl, { method: "HEAD", signal: AbortSignal.timeout(15000) });
          if (!check.ok) throw new Error(`new URL answers ${check.status} — check nginx (npm run check:uploads)`);

          // 5. Point every row that used this image at the VPS copy.
          const { count } = await db[t.model].updateMany({
            where: { [t.field]: oldUrl },
            data: { [t.field]: newUrl },
          });
          moved++;
          console.log(`   ✅ ${short} → ${relPath} (${count} row${count === 1 ? "" : "s"})`);
        } catch (e) {
          failed++;
          console.log(`   ❌ ${short}: ${e.message} (row left unchanged)`);
        }
      }
    }
  } finally {
    await db.$disconnect();
  }

  console.log("");
  if (found === 0) {
    console.log("✅ Nothing left on Supabase.");
  } else if (!apply) {
    console.log(`${found} image(s) still on Supabase. Run again with --apply to move them.`);
  } else {
    console.log(`Moved ${moved}, failed ${failed}. Downloaded ${mb(bytesIn)} → saved ${mb(bytesOut)} on the VPS.`);
    if (failed === 0) {
      console.log("Next: open the site + admin, check the pictures, then Supabase files can be made private/deleted.");
      console.log("Gallery/hero pages are cached — after this, re-save any item in admin or redeploy to refresh them.");
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
