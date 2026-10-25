export const GROOVARA_MEDIA_BUCKET = "mixlist-media";

export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

const GROOVARA_UPLOAD_PREFIX = "groovara-upload://";

const EXTENSION_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/x-mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "video/mp4": "mp4",
  "audio/mp4": "mp4",
  "video/quicktime": "mov",
};

function getName(value: unknown): string {
  if (typeof value === "string") return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name?: unknown }).name === "string"
  ) {
    return (value as { name: string }).name;
  }

  return "";
}

function getMime(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type?: unknown }).type === "string"
  ) {
    return (value as { type: string }).type.trim().toLowerCase();
  }

  if (typeof value === "string" && value.includes("/")) {
    return value.trim().toLowerCase();
  }

  return "";
}

/**
 * Resolve the allowed file extension used for the private Storage object.
 * Accepts either a File/Blob-like object or a filename/MIME string so this
 * helper stays compatible with browser and server-side callers.
 */
export function getUploadExtension(value: unknown): string | null {
  const name = getName(value).trim();
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);

  if (match) {
    const extension = match[1];
    if (extension in EXTENSION_TO_MIME) return extension;
  }

  const mime = getMime(value);
  return MIME_TO_EXTENSION[mime] ?? null;
}

/**
 * Return a usable content type even when the browser omits File.type.
 */
export function getFallbackMimeType(value: unknown): string {
  const mime = getMime(value);

  if (mime) {
    return mime;
  }

  const extension = getUploadExtension(value);

  if (extension) {
    return EXTENSION_TO_MIME[extension];
  }

  return "application/octet-stream";
}

/**
 * Build the pseudo URL stored in Groovara rows for private uploaded media.
 */
export function buildUploadedMediaUrl(storagePath: string): string {
  const cleanPath = storagePath.trim().replace(/^\/+/, "");

  if (!cleanPath) {
    throw new Error("Invalid uploaded media storage path.");
  }

  return `${GROOVARA_UPLOAD_PREFIX}${cleanPath}`;
}

/**
 * Backwards-compatible alias used by newer call sites.
 */
export function makeUploadedMediaReference(storagePath: string): string {
  return buildUploadedMediaUrl(storagePath);
}

/**
 * Extract the Supabase Storage object path from a Groovara private-media URL.
 */
export function parseUploadedMediaPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed.startsWith(GROOVARA_UPLOAD_PREFIX)) {
    return null;
  }

  const path = trimmed.slice(GROOVARA_UPLOAD_PREFIX.length);

  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    return null;
  }

  const segments = path.split("/");

  if (
    segments.length < 3 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return null;
  }

  return path;
}
