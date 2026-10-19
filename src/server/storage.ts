import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Identify the real file type from magic bytes — never trust the browser's MIME type or file name. */
export function sniffImageType(buf: Buffer): "jpg" | "png" | "webp" | "avif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 12).toString("ascii") === "ftypavif") return "avif";
  return null; // SVG and everything else rejected (SVG can carry scripts)
}

export interface StoredImage {
  url: string;
  publicId: string;
}

/**
 * Store an image. Cloudinary (signed upload) when configured; otherwise a local-disk fallback for development
 * (public/uploads — not persistent on Vercel, so production requires Cloudinary).
 */
export async function storeImage(buf: Buffer, folder: "products" | "banners"): Promise<StoredImage> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Images must be 5 MB or smaller.");
  const type = sniffImageType(buf);
  if (!type) throw new AppError("VALIDATION", "Upload a JPG, PNG, WebP or AVIF image.");

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (cloud && key && secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const fullFolder = `ipay-ghana/${folder}`;
    const toSign = `folder=${fullFolder}&timestamp=${timestamp}${secret}`;
    const signature = createHash("sha1").update(toSign).digest("hex");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)]), `upload.${type}`);
    form.append("api_key", key);
    form.append("timestamp", timestamp);
    form.append("folder", fullFolder);
    form.append("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new AppError("PAYMENT_PROVIDER", "Image upload failed. Please try again.");
    const json = (await res.json()) as { secure_url: string; public_id: string };
    return { url: json.secure_url, publicId: json.public_id };
  }

  if (process.env.NODE_ENV === "production") throw new AppError("INVALID_STATE", "Image storage is not configured (set CLOUDINARY_* variables).");
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${type}`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
}
