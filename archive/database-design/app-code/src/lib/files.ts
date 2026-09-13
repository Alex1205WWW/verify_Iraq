import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * File storage. Everything is served back through /api/files/[key], which
 * checks the caller's role before returning bytes - uploads are never exposed
 * as static files, whichever backend holds them.
 *
 * Two backends behind the same functions:
 *   - Cloudflare Workers: the R2 bucket bound as UPLOADS. Workers have no
 *     persistent disk, so this is the only place a site photo survives.
 *   - Everywhere else: local disk under UPLOADS_DIR, or .data/uploads.
 *
 * No caller knows or cares which one is in use.
 */

const ROOT =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".data", "uploads");

/** The slice of the R2 binding this file uses. Avoids a types dependency. */
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

/**
 * The slice of a Workers KV binding this file uses.
 *
 * KV is the fallback for Cloudflare temporary preview accounts, which do not
 * offer R2. A KV value can be up to 25 MiB, comfortably above the 10 MB cap
 * enforced below. KV is eventually consistent, so R2 remains the right choice
 * for a permanent deployment.
 */
interface KVNamespace {
  put(key: string, value: ArrayBuffer | ArrayBufferView): Promise<void>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
}

function cloudflareEnv(): { UPLOADS?: R2Bucket; UPLOADS_KV?: KVNamespace } {
  try {
    const { env } = getCloudflareContext();
    return env as unknown as { UPLOADS?: R2Bucket; UPLOADS_KV?: KVNamespace };
  } catch {
    // Not inside Cloudflare. Use local disk.
    return {};
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

export async function saveBuffer(data: Buffer, mime: string): Promise<string> {
  const key = `${randomUUID()}.${extensionFor(mime)}`;

  const { UPLOADS, UPLOADS_KV } = cloudflareEnv();
  if (UPLOADS) {
    await UPLOADS.put(key, data, { httpMetadata: { contentType: mime } });
    return key;
  }
  if (UPLOADS_KV) {
    await UPLOADS_KV.put(key, data);
    return key;
  }

  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), data);
  return key;
}

/** Accepts the `data:image/jpeg;base64,...` string a canvas produces. */
export async function saveDataUrl(
  dataUrl: string,
): Promise<{ key: string; mime: string; size: number }> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Malformed image data.");
  const mime = match[1];
  if (!mime.startsWith("image/")) throw new Error("That is not an image.");
  const buf = Buffer.from(match[2], "base64");
  if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Image is over 10 MB.");
  const key = await saveBuffer(buf, mime);
  return { key, mime, size: buf.byteLength };
}

export async function saveUpload(
  file: File,
): Promise<{ key: string; mime: string; size: number; name: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("File is over 10 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const key = await saveBuffer(buf, mime);
  return { key, mime, size: buf.byteLength, name: file.name };
}

export async function readStored(key: string): Promise<Buffer> {
  // Keys are generated UUIDs; refuse anything that could climb the tree or
  // reach an arbitrary object. Checked before either backend is touched.
  if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,5}$/i.test(key)) {
    throw new Error("Bad file key.");
  }

  const { UPLOADS, UPLOADS_KV } = cloudflareEnv();
  if (UPLOADS) {
    const object = await UPLOADS.get(key);
    if (!object) throw new Error("File not found.");
    return Buffer.from(await object.arrayBuffer());
  }
  if (UPLOADS_KV) {
    const bytes = await UPLOADS_KV.get(key, "arrayBuffer");
    if (!bytes) throw new Error("File not found.");
    return Buffer.from(bytes);
  }

  return readFile(path.join(ROOT, key));
}

export function mimeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  const found = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext);
  return found ? found[0] : "application/octet-stream";
}
