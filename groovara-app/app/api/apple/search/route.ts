import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { isMediaType, type MediaType } from "@/lib/mediaTypes";

export const runtime = "nodejs";

type AppleSongSearchResponse = {
  results?: {
    songs?: {
      data: Array<{
        id: string;
        attributes?: {
          name?: string;
          artistName?: string;
          albumName?: string;
          url?: string;
          artwork?: { url?: string; width?: number; height?: number };
          isrc?: string;
        };
      }>;
    };
  };
};

type ApplePodcastSearchResponse = {
  results?: Array<{
    kind?: string;
    trackId?: number | string;
    trackName?: string;
    artistName?: string;
    collectionName?: string;
    trackViewUrl?: string;
    artworkUrl600?: string;
    artworkUrl100?: string;
  }>;
};

async function getAppleDeveloperToken() {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKeyRaw = process.env.APPLE_MUSIC_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKeyRaw) {
    throw new Error("Missing Apple Music env vars (TEAM_ID, KEY_ID, PRIVATE_KEY).");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const alg = "ES256";
  const pkcs8 = await importPKCS8(privateKey, alg);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 30;

  return await new SignJWT({})
    .setProtectedHeader({ alg, kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(pkcs8);
}

async function searchSongs(q: string, storefront: string) {
  const token = await getAppleDeveloperToken();

  const url =
    `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}` +
    `/search?term=${encodeURIComponent(q)}&types=songs&limit=10`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Apple Music search failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as AppleSongSearchResponse;

  return (
    json.results?.songs?.data?.map((song) => {
      const attributes = song.attributes ?? {};
      const artworkTemplate = attributes.artwork?.url ?? null;
      const image = artworkTemplate
        ? artworkTemplate.replace("{w}", "200").replace("{h}", "200")
        : null;

      return {
        id: song.id,
        title: attributes.name ?? "Unknown Title",
        artist: attributes.artistName ?? "Unknown Artist",
        album: attributes.albumName ?? "",
        url: attributes.url ?? "",
        image,
        isrc: attributes.isrc ?? null,
        media_type: "song" as const,
      };
    }) ?? []
  );
}

async function searchPodcastEpisodes(q: string, country: string) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", q);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcastEpisode");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", "10");

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Apple Podcasts search failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as ApplePodcastSearchResponse;

  return (json.results ?? [])
    .filter(
      (episode) =>
        episode.kind === "podcast-episode" &&
        episode.trackId != null &&
        Boolean(episode.trackName) &&
        Boolean(episode.trackViewUrl),
    )
    .map((episode) => {
      const showName =
        episode.collectionName?.trim() ||
        episode.artistName?.trim() ||
        "Podcast";

      return {
        id: String(episode.trackId),
        title: episode.trackName ?? "Unknown Episode",
        artist: showName,
        album: showName,
        url: episode.trackViewUrl ?? "",
        image: episode.artworkUrl600 ?? episode.artworkUrl100 ?? null,
        isrc: null,
        media_type: "podcast_episode" as const,
      };
    });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const requestedMediaType = searchParams.get("media_type");
    const mediaType: MediaType | null = isMediaType(requestedMediaType)
      ? requestedMediaType
      : null;

    if (!q) return NextResponse.json({ tracks: [] });

    const storefront = (process.env.APPLE_MUSIC_STOREFRONT || "us").toLowerCase();
    const country = storefront.toUpperCase();

    const [songs, podcastEpisodes] = await Promise.all([
      mediaType === "podcast_episode"
        ? Promise.resolve([])
        : searchSongs(q, storefront),
      mediaType === "song"
        ? Promise.resolve([])
        : searchPodcastEpisodes(q, country),
    ]);

    return NextResponse.json({
      tracks: [...songs, ...podcastEpisodes],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Apple route error" },
      { status: 500 },
    );
  }
}
