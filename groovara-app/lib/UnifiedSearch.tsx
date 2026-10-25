"use client";

import { useEffect, useState } from "react";
import LocalMediaUpload, {
  type UploadedMediaRecord,
} from "@/lib/LocalMediaUpload";

type SearchPlatform = "spotify" | "apple" | "youtube";
type PlatformKey = SearchPlatform | "upload";

export type UnifiedSearchResult = {
  platform: SearchPlatform;
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  image: string | null;
  isrc?: string | null;
};

type RegisterResult =
  | { ok: true }
  | { ok: false; message: string };

type UnifiedSearchProps = {
  onAdd: (result: UnifiedSearchResult) => void | Promise<void>;
  disabled?: boolean;
  uploadTracklistId?: string;
  onRegisterUpload?: (
    record: UploadedMediaRecord,
  ) => Promise<RegisterResult>;
};

type SearchApiTrack = {
  id?: string;
  track_id?: string;
  video_id?: string;
  title?: string;
  name?: string;
  artist?: string;
  channel_title?: string;
  album?: string | null;
  url?: string;
  youtube_url?: string;
  image?: string | null;
  thumbnail_url?: string | null;
  isrc?: string | null;
};

type SearchApiResponse = {
  tracks?: SearchApiTrack[];
  results?: SearchApiTrack[];
  items?: SearchApiTrack[];
  error?: string;
};

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube",
  upload: "Upload",
};

function getEndpoint(platform: SearchPlatform) {
  if (platform === "spotify") return "/api/spotify/search";
  if (platform === "apple") return "/api/apple/search";
  return "/api/youtube/search";
}

function normalizeTrack(
  platform: SearchPlatform,
  raw: SearchApiTrack,
): UnifiedSearchResult | null {
  const trackId = raw.id ?? raw.track_id ?? raw.video_id ?? "";
  const title = raw.title ?? raw.name ?? "";
  const artist = raw.artist ?? raw.channel_title ?? "";
  const url = raw.url ?? raw.youtube_url ?? "";

  if (!trackId || !title || !artist || !url) return null;

  return {
    platform,
    track_id: trackId,
    title,
    artist,
    album: raw.album ?? null,
    url,
    image: raw.image ?? raw.thumbnail_url ?? null,
    isrc: raw.isrc ?? null,
  };
}

export default function UnifiedSearch({
  onAdd,
  disabled = false,
  uploadTracklistId,
  onRegisterUpload,
}: UnifiedSearchProps) {
  const [platform, setPlatform] = useState<PlatformKey>("spotify");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUpload = Boolean(uploadTracklistId && onRegisterUpload);

  useEffect(() => {
    if (platform === "upload") {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${getEndpoint(platform)}?q=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
          },
        );

        const data = (await response.json()) as SearchApiResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Search failed.");
        }

        const rawTracks = data.tracks ?? data.results ?? data.items ?? [];
        const normalized = rawTracks
          .map((track) => normalizeTrack(platform, track))
          .filter(
            (track): track is UnifiedSearchResult => track !== null,
          );

        setResults(normalized);
      } catch (caught) {
        if (controller.signal.aborted) return;

        setResults([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "Search failed. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [platform, query]);

  const add = async (result: UnifiedSearchResult) => {
    if (disabled || addingId) return;

    setAddingId(`${result.platform}:${result.track_id}`);

    try {
      await onAdd(result);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block sm:w-48">
          <span className="block text-xs tracking-[0.18em] text-muted-foreground">
            SOURCE
          </span>

          <select
            value={platform}
            onChange={(event) => {
              const next = event.target.value as PlatformKey;
              setPlatform(next);
              setError(null);
              setResults([]);
            }}
            disabled={disabled}
            className="mt-2 w-full rounded-xl border border-[#2A3170]/30 bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none transition hover:border-[#2A3170]/55 focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
          >
            <option value="spotify">{PLATFORM_LABELS.spotify}</option>
            <option value="apple">{PLATFORM_LABELS.apple}</option>
            <option value="youtube">{PLATFORM_LABELS.youtube}</option>
            {canUpload ? (
              <option value="upload">{PLATFORM_LABELS.upload}</option>
            ) : null}
          </select>
        </label>

        {platform !== "upload" ? (
          <label className="block min-w-0 flex-1">
            <span className="block text-xs tracking-[0.18em] text-muted-foreground">
              SEARCH
            </span>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={disabled}
              placeholder={`Search ${PLATFORM_LABELS[platform]}...`}
              className="mt-2 w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        ) : null}
      </div>

      {platform === "upload" ? (
        uploadTracklistId && onRegisterUpload ? (
          <LocalMediaUpload
            tracklistId={uploadTracklistId}
            disabled={disabled}
            onRegister={onRegisterUpload}
          />
        ) : (
          <p className="rounded-xl border border-[#BE3943]/25 bg-[#BE3943]/10 px-4 py-3 text-sm text-[#9D2D36] dark:text-[#F4A2A8]">
            Uploads are not available in this view.
          </p>
        )
      ) : (
        <>
          {loading ? (
            <p className="text-xs tracking-[0.14em] text-muted-foreground">
              SEARCHING...
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-[#BE3943]/25 bg-[#BE3943]/10 px-4 py-3 text-sm text-[#9D2D36] dark:text-[#F4A2A8]">
              {error}
            </p>
          ) : null}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No results found.
            </p>
          ) : null}

          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => {
                const resultKey = `${result.platform}:${result.track_id}`;
                const adding = addingId === resultKey;

                return (
                  <div
                    key={resultKey}
                    className="gv-row flex items-center gap-3 rounded-2xl p-3"
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt=""
                        className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg border border-border bg-card/60 text-[9px] tracking-[0.12em] text-muted-foreground">
                        {PLATFORM_LABELS[result.platform].toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {result.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {result.artist}
                        {result.album ? ` • ${result.album}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void add(result)}
                      disabled={disabled || Boolean(addingId)}
                      className="flex-shrink-0 rounded-full border border-[#BE3943] bg-[#BE3943] px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-[#F0E9DA] transition hover:-translate-y-0.5 hover:bg-[#A9323B] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {adding ? "ADDING..." : "ADD"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
