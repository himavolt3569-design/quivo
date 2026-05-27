import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Validated image uploader.
 *
 * Wraps Supabase Storage with size + MIME validation. Optional SaaS-moderator
 * call is gated behind `IMAGE_MODERATION_PROVIDER` env (currently a stub —
 * Phase 6+ can hook a real provider). Rejections are logged to security_events
 * via the same RPC the Phase 1 audit log uses.
 *
 * Returns the public URL on success or { error } otherwise.
 */

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const DEFAULT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export interface UploadImageInput {
  bucket: string;
  path: string;
  file: Blob;
  /** Optional override; falls back to DEFAULT_ALLOWED_MIME. */
  allowedMime?: Set<string>;
  /** Optional override; falls back to DEFAULT_MAX_BYTES. */
  maxBytes?: number;
  /** Tag for audit log so reviewers know which upload path the rejection came from. */
  source?: string;
  /** Bind the security_events row to a shop for forensic context. */
  shopId?: string | null;
}

export interface UploadImageResult {
  ok: boolean;
  publicUrl?: string;
  path?: string;
  error?: string;
}

async function logRejection(reason: string, source: string | undefined, shopId: string | null | undefined) {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_security_event", {
      p_event_type: "image_upload_rejected",
      p_metadata: { reason, source: source ?? null, shop_id: shopId ?? null },
      p_ip_hash: null,
    });
  } catch (err) {
    log.warn("logRejection: record_security_event failed", { err: err instanceof Error ? err.message : String(err) });
  }
}

export async function uploadValidatedImage(input: UploadImageInput): Promise<UploadImageResult> {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowed = input.allowedMime ?? DEFAULT_ALLOWED_MIME;

  const type = (input.file.type || "").toLowerCase();
  if (!allowed.has(type)) {
    await logRejection(`mime:${type || "unknown"}`, input.source, input.shopId);
    return { ok: false, error: `Unsupported image type${type ? ` (${type})` : ""}.` };
  }
  if (input.file.size > maxBytes) {
    await logRejection(`size:${input.file.size}`, input.source, input.shopId);
    return { ok: false, error: `Image is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` };
  }
  if (input.file.size <= 0) {
    return { ok: false, error: "Empty file." };
  }

  // Optional SaaS moderator hook. Off by default; activate by setting
  // IMAGE_MODERATION_PROVIDER + IMAGE_MODERATION_URL + IMAGE_MODERATION_KEY.
  const provider = process.env.IMAGE_MODERATION_PROVIDER;
  if (provider) {
    try {
      const buf = await input.file.arrayBuffer();
      const res = await fetch(process.env.IMAGE_MODERATION_URL ?? "", {
        method: "POST",
        headers: {
          "Content-Type": type,
          ...(process.env.IMAGE_MODERATION_KEY
            ? { Authorization: `Bearer ${process.env.IMAGE_MODERATION_KEY}` }
            : {}),
        },
        body: buf,
      });
      if (!res.ok) {
        await logRejection(`moderator:${provider}:${res.status}`, input.source, input.shopId);
        return { ok: false, error: "Image rejected by moderation." };
      }
    } catch (err) {
      log.warn("image moderator network error; allowing", {
        provider,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const admin = createAdminClient();
    const { error: uploadErr } = await admin.storage.from(input.bucket).upload(input.path, input.file, {
      cacheControl: "31536000",
      upsert: true,
      contentType: type,
    });
    if (uploadErr) {
      log.error("uploadValidatedImage: storage upload failed", {
        bucket: input.bucket,
        path: input.path,
        message: uploadErr.message,
      });
      return { ok: false, error: uploadErr.message };
    }
    const { data: pub } = admin.storage.from(input.bucket).getPublicUrl(input.path);
    return { ok: true, publicUrl: pub.publicUrl, path: input.path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
