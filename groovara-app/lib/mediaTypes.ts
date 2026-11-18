export type MediaType = "song" | "podcast_episode";

export function isMediaType(value: unknown): value is MediaType {
  return value === "song" || value === "podcast_episode";
}
