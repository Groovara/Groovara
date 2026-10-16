import type { UiTrackTheme } from "./types";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function tokenWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function pickWords(seed: number, title: string, artist: string): string[] {
  const tokens = [...new Set([...tokenWords(title), ...tokenWords(artist)])];
  const fallback = [
    "echo",
    "pulse",
    "memory",
    "night",
    "sound",
    "motion",
    "signal",
    "horizon",
  ];

  if (tokens.length === 0) return fallback;

  const chosen: string[] = [];
  let n = seed;
  for (let i = 0; i < Math.min(8, tokens.length); i++) {
    n = (n * 1664525 + 1013904223) >>> 0;
    chosen.push(tokens[n % tokens.length]);
  }

  return [...new Set(chosen)].slice(0, 8);
}

export function createTheme(seed: string, title: string, artist: string): UiTrackTheme {
  const h = hashSeed(seed);
  const intensity = 0.35 + ((h % 50) / 100);

  // Keep the player atmospheric, but make Plum the dominant brand accent.
  // Blue-Green and Brick appear occasionally; Sage is deliberately rare.
  const scenePalettes = [
    { accent: "#2A3170", glow: "#58A6A1" },
    { accent: "#2A3170", glow: "#B4B8C0" },
    { accent: "#2A3170", glow: "#58A6A1" },
    { accent: "#58A6A1", glow: "#2A3170" },
    { accent: "#2A3170", glow: "#58A6A1" },
    { accent: "#BE3943", glow: "#2A3170" },
  ] as const;

  const palette = scenePalettes[h % scenePalettes.length];

  return {
    backgroundColor: h % 3 === 0 ? "#1A1A23" : "#1A1A23",
    textColor: "#F0E9DA",
    accentColor: palette.accent,
    glowColor: palette.glow,
    words: pickWords(h, title, artist),
    intensity,
  };
}
