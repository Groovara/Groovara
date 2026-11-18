import type { MediaType } from "@/lib/mediaTypes";

export type UiTrackTheme = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  glowColor: string;
  words: string[];
  intensity: number;
};

export type UiTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  image?: string | null;
  trackId?: string | null;
  url: string | null;
  platform: "youtube" | "spotify" | "apple" | "other";
  mediaType: MediaType;
  durationMs: number;
  notes?: string | null;
  theme: UiTrackTheme;
};
