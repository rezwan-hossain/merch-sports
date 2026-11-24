// app/api/upload/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/require-admin";

// REQUIRED. Without this, Next may compile the route for the Edge runtime,
// where node:fs and sharp's native binary simply do not exist.
// export const runtime = "nodejs";

// Never cache or statically pre-render an upload endpoint.
// export const dynamic = "force-dynamic";

const CDN_ROOT = process.env.CDN_ROOT || "/var/www/cdn/images";
const PUBLIC_BASE =
  process.env.NEXT_PUBLIC_CDN_URL || "https://assets.merchcommunication.com";

// Formats sharp is allowed to accept. This is the real gate — not the
// browser's Content-Type header, which anyone can forge.
const ALLOWED_FORMATS = ["jpeg", "png", "webp", "avif", "gif"];

// Hard server-side ceiling. The client also checks, but a client check is a
// UX convenience, never a security control.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Longest edge after resize. 2000px covers retina full-width banners; anything
// larger is wasted bytes for a website.
const MAX_DIMENSION = 2000;

/**
 * Whitelist the folder name coming from the client.
 *
 * SECURITY: this is the single most important line in the file. Without it,
 * a request with folder = "../../../../etc/cron.d" would let an attacker write
 * files anywhere the node user can reach. Only letters, digits, dash and
 * underscore are permitted, max 32 chars, and it must start alphanumeric.
 */
function safeFolder(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "misc";
  return /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(raw) ? raw : "misc";
}

export async function POST(req: Request) {
  try {
    // ── 1. Authentication ────────────────────────────────────────────────
    // Admins only. Checked before reading the body, so strangers can't fill
    // the disk (or even make the server parse a big upload).
    const { error: authError } = await requireAdmin();
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Read the multipart body ───────────────────────────────────────
    const form = await req.formData();
    const file = form.get("file");

    // A missing field returns null; a text field returns a string.
    // Only a real upload gives us a File/Blob with .arrayBuffer().
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const folder = safeFolder(form.get("folder"));

    // ── 3. Validate that it really is an image ───────────────────────────
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // sharp reads the actual file header. A .exe renamed to .jpg throws here.
    const probe = await sharp(inputBuffer).metadata();

    if (!probe.format || !ALLOWED_FORMATS.includes(probe.format)) {
      return NextResponse.json(
        { error: "Unsupported image type" },
        { status: 400 },
      );
    }

    // ── 4. Process ───────────────────────────────────────────────────────
    // pages > 1 means an animated GIF or animated WebP.
    const isAnimated = (probe.pages ?? 1) > 1;

    // The { animated } option tells sharp to keep every frame.
    let pipeline = sharp(inputBuffer, { animated: isAnimated });

    // .rotate() with no argument applies the EXIF orientation tag, so photos
    // taken sideways on a phone come out upright. It also strips EXIF entirely
    // (including GPS coordinates — a real privacy leak on user photos).
    // Skip it for animated images: it flattens multi-frame files to one frame.
    if (!isAnimated) pipeline = pipeline.rotate();

    const out = await pipeline
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside", // preserve aspect ratio, fit within the box
        withoutEnlargement: true, // never upscale a small image
      })
      // quality 82 is the practical sweet spot — visually indistinguishable
      // from the original at typical web sizes, roughly 30% smaller than 90.
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    // ── 5. Build the destination path ────────────────────────────────────
    // Date-based subfolders keep any single directory small. Filesystems get
    // slow to list once a folder holds tens of thousands of entries.
    const now = new Date();
    const relDir = path.join(
      folder,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, "0"), // "08" not "8"
    );

    // 32 hex chars from crypto (not Math.random) — unguessable, so nobody can
    // enumerate your uploads, and collisions are effectively impossible.
    // Always .webp because that's what we just encoded, whatever came in.
    const filename = crypto.randomBytes(16).toString("hex") + ".webp";

    const relPath = path.join(relDir, filename);
    const absPath = path.join(CDN_ROOT, relPath);

    // ── 6. Write atomically ──────────────────────────────────────────────
    // recursive: true creates every missing parent folder, and does not throw
    // if they already exist.
    await fs.mkdir(path.dirname(absPath), { recursive: true });

    // Write to a temp name first, then rename. rename() is atomic on the same
    // filesystem, so nginx can never catch a half-written file and serve a
    // truncated image (which browsers cache as broken).
    const tmpPath = `${absPath}.tmp`;
    await fs.writeFile(tmpPath, out.data);
    await fs.rename(tmpPath, absPath);

    // ── 7. Respond ───────────────────────────────────────────────────────
    return NextResponse.json({
      path: relPath, // ← THIS is what goes in your DB
      url: `${PUBLIC_BASE}/${relPath}`, // convenience for immediate preview
      width: out.info.width,
      height: out.info.height,
      size: out.info.size,
    });
  } catch (err) {
    // Log the real error server-side for debugging...
    console.error("[upload] failed:", err);
    // ...but return a generic message. Internal paths and stack traces should
    // never reach the browser.
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    // Same admin check as POST — otherwise anyone could wipe the images.
    const { error: authError } = await requireAdmin();
    if (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: relPath } = await req.json();

    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json({ error: "No path" }, { status: 400 });
    }

    // SECURITY: path.resolve collapses any "../" segments. If the result no
    // longer sits inside CDN_ROOT, the request was trying to escape — reject.
    // The + path.sep check prevents a sibling folder like "/var/www/cdn/images-evil"
    // from passing a naive startsWith("/var/www/cdn/images").
    const absPath = path.resolve(CDN_ROOT, relPath);
    if (!absPath.startsWith(CDN_ROOT + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Swallow ENOENT: deleting an already-deleted file is not an error worth
    // surfacing to the user.
    await fs.unlink(absPath).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload] delete failed:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
