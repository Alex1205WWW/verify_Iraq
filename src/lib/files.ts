import "server-only";
import { randomUUID } from "node:crypto";

/**
 * File storage for the demo: uploads are held in this server process's
 * memory, alongside the virtual data, and disappear with it on a restart or a
 * demo reset. Nothing is written to disk or to a bucket.
 *
 * Everything is still served back through /api/files/[key], which checks the
 * caller's relationship to the task before returning bytes — uploads are never
 * exposed as static files.
 */

type StoredFile = { data: Buffer; mime: string };

// A demo can be left open for days. Past this, the oldest uploads are dropped
// so the server cannot run out of memory.
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

const globalForFiles = globalThis as unknown as { demoFiles?: Map<string, StoredFile> };

function files(): Map<string, StoredFile> {
  globalForFiles.demoFiles ??= new Map();
  return globalForFiles.demoFiles;
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
  const store = files();
  store.set(key, { data, mime });

  let total = 0;
  for (const f of store.values()) total += f.data.byteLength;
  // Maps iterate in insertion order, so this walks from the oldest upload.
  for (const [k, f] of store) {
    if (total <= MAX_TOTAL_BYTES || k === key) break;
    store.delete(k);
    total -= f.data.byteLength;
  }
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
  // Keys are generated UUIDs; refuse anything else before looking.
  if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,5}$/i.test(key)) {
    throw new Error("Bad file key.");
  }
  const found = files().get(key);
  if (!found) throw new Error("File not found.");
  return found.data;
}

export function mimeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  const found = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext);
  return found ? found[0] : "application/octet-stream";
}

/** Drops every upload. Used by the demo reset. */
export function clearStoredFiles(): void {
  files().clear();
}
