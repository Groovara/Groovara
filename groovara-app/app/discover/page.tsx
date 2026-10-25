import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import DiscoverClient, {
  type DiscoveryMixlist,
} from "./DiscoverClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discovery",
  description:
    "Browse public Mixlists selected by Groovara.",
};

type CandidateRow = {
  mixlist_id: string;
  is_legacy: boolean;
  approved_at: string | null;
};

type MixlistRow = {
  id: string;
  title: string | null;
  sender_name: string | null;
  show_sender: boolean | null;
  created_at: string;
  is_public: boolean | null;
};

type SongRow = {
  mixlist_id: string;
  title: string | null;
  artist: string | null;
};

export default async function DiscoverPage() {
  const admin = createAdminClient();

  const { data: candidates, error: candidateError } =
    await admin
      .from("discovery_candidates")
      .select("mixlist_id,is_legacy,approved_at")
      .eq("status", "approved");

  if (candidateError) {
    console.error(
      "Failed to load Discovery candidates:",
      candidateError,
    );
  }

  const candidateRows =
    (candidates ?? []) as CandidateRow[];
  const mixlistIds = candidateRows.map(
    (row) => row.mixlist_id,
  );

  let mixlists: MixlistRow[] = [];
  let songs: SongRow[] = [];

  if (mixlistIds.length > 0) {
    const [mixlistResult, songResult] =
      await Promise.all([
        admin
          .from("mixlists")
          .select(
            "id,title,sender_name,show_sender,created_at,is_public",
          )
          .in("id", mixlistIds)
          .eq("is_public", true),
        admin
          .from("mixlist_songs")
          .select("mixlist_id,title,artist")
          .in("mixlist_id", mixlistIds),
      ]);

    if (mixlistResult.error) {
      console.error(
        "Failed to load Discovery Mixlists:",
        mixlistResult.error,
      );
    } else {
      mixlists =
        (mixlistResult.data ?? []) as MixlistRow[];
    }

    if (songResult.error) {
      console.error(
        "Failed to load Discovery song metadata:",
        songResult.error,
      );
    } else {
      songs = (songResult.data ?? []) as SongRow[];
    }
  }

  const candidateByMixlist = new Map(
    candidateRows.map((row) => [
      row.mixlist_id,
      row,
    ]),
  );

  const songsByMixlist = new Map<
    string,
    SongRow[]
  >();

  for (const song of songs) {
    const existing =
      songsByMixlist.get(song.mixlist_id) ?? [];
    existing.push(song);
    songsByMixlist.set(
      song.mixlist_id,
      existing,
    );
  }

  const discoveryMixlists: DiscoveryMixlist[] =
    mixlists.map((mixlist) => {
      const candidate =
        candidateByMixlist.get(mixlist.id);
      const mixSongs =
        songsByMixlist.get(mixlist.id) ?? [];

      const searchablePieces = [
        mixlist.title ?? "",
        mixlist.show_sender
          ? mixlist.sender_name ?? ""
          : "",
        ...mixSongs.flatMap((song) => [
          song.title ?? "",
          song.artist ?? "",
        ]),
      ];

      return {
        id: mixlist.id,
        title:
          mixlist.title?.trim() || "Untitled Mixlist",
        senderName: mixlist.sender_name,
        showSender: Boolean(mixlist.show_sender),
        createdAt: mixlist.created_at,
        approvedAt:
          candidate?.approved_at ?? null,
        isLegacy:
          candidate?.is_legacy ?? false,
        songCount: mixSongs.length,
        searchText: searchablePieces
          .join(" ")
          .toLowerCase(),
      };
    });

  return (
    <main className="gv-paper-bg min-h-screen px-5 py-12 text-foreground sm:px-8 sm:py-16">
      <div className="gv-paper-content mx-auto w-full max-w-6xl">
        <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#58A6A1]">
            DISCOVERY
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-wide text-[#1F2860] dark:text-[#B4B8C0] sm:text-4xl">
            Mixlists made to be heard.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            A rotating shelf of public Mixlists selected by
            Groovara. Turn on Legacy to browse Mixlists that
            have rotated out of the current selection.
          </p>
        </header>

        <DiscoverClient mixlists={discoveryMixlists} />
      </div>
    </main>
  );
}
