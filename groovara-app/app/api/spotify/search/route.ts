import { NextResponse } from "next/server";
import { isMediaType, type MediaType } from "@/lib/mediaTypes";

async function getAccessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

type SpotifyImage = { url: string };
type SpotifyArtist = { name: string };
type SpotifyAlbum = { name: string; images?: SpotifyImage[] };

type SpotifyTrack = {
  id: string;
  name: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  external_urls?: { spotify?: string };
  external_ids?: { isrc?: string };
};

type SpotifyEpisode = {
  id: string;
  name: string;
  images?: SpotifyImage[];
  external_urls?: { spotify?: string };
};

type SpotifyEpisodeDetail = SpotifyEpisode & {
  show?: {
    name?: string;
    publisher?: string;
    images?: SpotifyImage[];
  };
};

type SpotifySearchResponse = {
  tracks?: { items?: SpotifyTrack[] };
  episodes?: { items?: SpotifyEpisode[] };
};

type SpotifyEpisodeDetailsResponse = {
  episodes?: Array<SpotifyEpisodeDetail | null>;
};

async function loadEpisodeDetails(
  token: string,
  episodeIds: string[],
  market: string,
) {
  if (episodeIds.length === 0) {
    return new Map<string, SpotifyEpisodeDetail>();
  }

  const response = await fetch(
    "https://api.spotify.com/v1/episodes?" +
      new URLSearchParams({
        ids: episodeIds.join(","),
        market,
      }).toString(),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.warn(
      "Spotify episode detail lookup failed:",
      response.status,
      (await response.text()).slice(0, 300),
    );
    return new Map<string, SpotifyEpisodeDetail>();
  }

  const payload = (await response.json()) as SpotifyEpisodeDetailsResponse;
  return new Map(
    (payload.episodes ?? [])
      .filter((episode): episode is SpotifyEpisodeDetail => Boolean(episode?.id))
      .map((episode) => [episode.id, episode]),
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const requestedMediaType = searchParams.get("media_type");
  const mediaType: MediaType | null = isMediaType(requestedMediaType)
    ? requestedMediaType
    : null;

  if (!q) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const token = await getAccessToken();
    const market = (process.env.SPOTIFY_MARKET || "US").toUpperCase();

    const searchTypes =
      mediaType === "song"
        ? "track"
        : mediaType === "podcast_episode"
          ? "episode"
          : "track,episode";

    const r = await fetch(
      "https://api.spotify.com/v1/search?" +
        new URLSearchParams({
          q,
          type: searchTypes,
          market,
          limit: "10",
        }).toString(),
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `Spotify search failed: ${r.status} ${text}` },
        { status: 500 },
      );
    }

    const data = (await r.json()) as SpotifySearchResponse;
    const trackItems = data.tracks?.items ?? [];
    const episodeItems = data.episodes?.items ?? [];

    const episodeDetails = await loadEpisodeDetails(
      token,
      episodeItems.map((episode) => episode.id),
      market,
    );

    const songs = trackItems.map((track) => ({
      id: track.id,
      title: track.name,
      artist: (track.artists ?? []).map((artist) => artist.name).join(", "),
      album: track.album?.name ?? "",
      url: track.external_urls?.spotify ?? "",
      image:
        track.album?.images?.[2]?.url ??
        track.album?.images?.[1]?.url ??
        track.album?.images?.[0]?.url ??
        null,
      isrc: track.external_ids?.isrc ?? null,
      media_type: "song" as const,
    }));

    const podcastEpisodes = episodeItems.map((episode) => {
      const detail = episodeDetails.get(episode.id);
      const showName =
        detail?.show?.name?.trim() ||
        detail?.show?.publisher?.trim() ||
        "Podcast";

      return {
        id: episode.id,
        title: episode.name,
        artist: showName,
        album: showName,
        url: episode.external_urls?.spotify ?? "",
        image:
          episode.images?.[1]?.url ??
          episode.images?.[0]?.url ??
          detail?.show?.images?.[1]?.url ??
          detail?.show?.images?.[0]?.url ??
          null,
        isrc: null,
        media_type: "podcast_episode" as const,
      };
    });

    return NextResponse.json({
      tracks: [...songs, ...podcastEpisodes],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
