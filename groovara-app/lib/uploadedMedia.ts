export const GROOVARA_MEDIA_BUCKET = "mixlist-media";

const GROOVARA_UPLOAD_PREFIX = "groovara-upload://";

/**
 * Returns the private Supabase Storage object path encoded in a Groovara
 * uploaded-media reference, or null when the value is not a safe reference.
 *
 * Example:
 *   groovara-upload://<user-id>/<tracklist-id>/<file-id>.mp3
 * becomes:
 *   <user-id>/<tracklist-id>/<file-id>.mp3
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

export function makeUploadedMediaReference(storagePath: string): string {
  const cleanPath = storagePath.trim().replace(/^\/+/, "");

  if (!cleanPath || !parseUploadedMediaPath(`${GROOVARA_UPLOAD_PREFIX}${cleanPath}`)) {
    throw new Error("Invalid uploaded media storage path.");
  }

  return `${GROOVARA_UPLOAD_PREFIX}${cleanPath}`;
}
