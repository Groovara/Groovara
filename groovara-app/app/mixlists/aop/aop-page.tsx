"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Platform = "spotify" | "apple" | "youtube";

type EpisodeMixlistRow = {
  episode_id: string;
  position: number;
  curator_label: string;
  mixlist_id: string;
};

type EpisodeRow = {
  id: string;
  title: string;
  published_on: string;
  duration_label: string;
  podcast_mixlist_id: string;
  is_featured: boolean;
};

type EpisodeMixlist = EpisodeMixlistRow & {
  title: string;
};

type Episode = EpisodeRow & {
  mixlists: EpisodeMixlist[];
};

const PARTNER_SLUG = "aop";

function mixlistHref(mixlistId: string, platform?: Platform) {
  if (!platform) return `/mixlists/${mixlistId}`;
  return `/mixlists/${mixlistId}?platform=${platform}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const safeDate = new Date(year, Math.max(0, month - 1), day || 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(safeDate);
}

export function AopPartnerPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: episodeRows, error: episodeError } = await supabase
        .from("partner_episodes")
        .select(
          "id,title,published_on,duration_label,podcast_mixlist_id,is_featured",
        )
        .eq("partner_slug", PARTNER_SLUG)
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("published_on", { ascending: false });

      if (!active) return;

      if (episodeError) {
        setError(episodeError.message);
        setLoading(false);
        return;
      }

      const baseEpisodes = (episodeRows ?? []) as EpisodeRow[];
      const episodeIds = baseEpisodes.map((episode) => episode.id);

      let links: EpisodeMixlistRow[] = [];
      if (episodeIds.length > 0) {
        const { data: linkRows, error: linkError } = await supabase
          .from("partner_episode_mixlists")
          .select("episode_id,position,curator_label,mixlist_id")
          .in("episode_id", episodeIds)
          .order("position", { ascending: true });

        if (!active) return;

        if (linkError) {
          setError(linkError.message);
          setLoading(false);
          return;
        }

        links = (linkRows ?? []) as EpisodeMixlistRow[];
      }

      const mixlistIds = Array.from(
        new Set(links.map((link) => link.mixlist_id)),
      );
      const titleByMixlistId = new Map<string, string>();

      if (mixlistIds.length > 0) {
        const { data: mixlistRows } = await supabase
          .from("mixlists")
          .select("id,title")
          .in("id", mixlistIds);

        for (const row of mixlistRows ?? []) {
          titleByMixlistId.set(
            String(row.id),
            String(row.title || "Untitled Mixlist"),
          );
        }
      }

      const hydrated = baseEpisodes.map((episode) => ({
        ...episode,
        mixlists: links
          .filter((link) => link.episode_id === episode.id)
          .map((link) => ({
            ...link,
            title:
              titleByMixlistId.get(link.mixlist_id) ??
              `${link.curator_label}'s Mixlist`,
          })),
      }));

      setEpisodes(hydrated);

      const featured = hydrated.find((episode) => episode.is_featured);
      setOpenIds(featured ? new Set([featured.id]) : new Set());
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const featuredEpisode = useMemo(
    () => episodes.find((episode) => episode.is_featured) ?? null,
    [episodes],
  );

  const olderEpisodes = useMemo(
    () => episodes.filter((episode) => episode.id !== featuredEpisode?.id),
    [episodes, featuredEpisode?.id],
  );

  function toggleEpisode(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#F0E9DA] px-4 pb-20 text-[#2A3170] dark:bg-[#14141D] dark:text-[#F0E9DA] sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl pt-8 sm:pt-10">
        <header className="border-b border-[#B4B8C0]/70 pb-5 dark:border-[#B4B8C0]/25">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-sm border border-[#58A6A1]/45 bg-[#FBF8F0] text-center shadow-sm dark:bg-[#1A1A23] sm:h-20 sm:w-20">
              <span className="text-[0.65rem] font-bold tracking-[0.14em] text-[#58A6A1]">
                ART OF
              </span>
              <span className="text-xs font-black leading-none text-[#2A3170] dark:text-[#F0E9DA] sm:text-sm">
                PLAYLIST
              </span>
              <span className="mt-1 text-[0.5rem] tracking-[0.22em] text-[#BE3943]">
                PODCAST
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-black tracking-[0.07em] text-[#2A3170] dark:text-[#F0E9DA] sm:text-5xl">
                THE ART OF THE PLAYLIST
              </h1>
              <p className="mt-1 text-sm font-medium tracking-wide text-[#2A3170]/85 dark:text-[#B4B8C0] sm:text-base">
                Episodes and Mixlists
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-sm text-[#2A3170]/70 dark:text-[#B4B8C0]">
            Loading episodes…
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-[#BE3943]/35 bg-[#BE3943]/10 p-5 text-sm text-[#8B2831] dark:text-[#FF9EA4]">
            Could not load Art of the Playlist: {error}
          </div>
        ) : null}

        {!loading && !error && episodes.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#58A6A1]/45 bg-[#FBF8F0] p-8 text-center dark:bg-[#1A1A23]">
            <p className="font-semibold">No AOP episodes have been published yet.</p>
            <p className="mt-2 text-sm text-[#2A3170]/65 dark:text-[#B4B8C0]">
              Authorized AOP accounts can add the first one from /admin/aop.
            </p>
          </div>
        ) : null}

        {featuredEpisode ? (
          <section className="mt-6">
            <EpisodeAccordion
              episode={featuredEpisode}
              featured
              open={openIds.has(featuredEpisode.id)}
              onToggle={() => toggleEpisode(featuredEpisode.id)}
            />
          </section>
        ) : null}

        {olderEpisodes.length > 0 ? (
          <section className="mt-5">
            <h2 className="border-b border-[#B4B8C0]/70 pb-2 text-xl font-black tracking-wide dark:border-[#B4B8C0]/25 sm:text-2xl">
              More episodes
            </h2>

            <div className="divide-y divide-[#B4B8C0]/70 dark:divide-[#B4B8C0]/25">
              {olderEpisodes.map((episode) => (
                <EpisodeAccordion
                  key={episode.id}
                  episode={episode}
                  open={openIds.has(episode.id)}
                  onToggle={() => toggleEpisode(episode.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function EpisodeAccordion({
  episode,
  featured = false,
  open,
  onToggle,
}: {
  episode: Episode;
  featured?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={
        featured
          ? "overflow-hidden rounded-2xl border border-transparent"
          : "py-1"
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={
          featured
            ? "flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left"
            : "flex w-full items-center justify-between gap-4 py-3 text-left"
        }
      >
        <span>
          {featured ? (
            <span className="block text-xs font-black tracking-[0.08em] text-[#BE3943] dark:text-[#E56A73]">
              FEATURED EPISODE
            </span>
          ) : null}
          <span
            className={
              featured
                ? "mt-1 block text-2xl font-black tracking-wide sm:text-3xl"
                : "block text-base font-bold sm:text-lg"
            }
          >
            {episode.title}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`text-2xl font-bold transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>

      {open ? (
        <div className="mb-4 grid gap-5 rounded-2xl bg-[#FBF8F0] p-5 shadow-sm dark:bg-[#1A1A23] sm:p-6 lg:grid-cols-[1.05fr_1fr] lg:gap-7">
          <div>
            <h3 className="mb-3 text-xl font-black tracking-wide sm:text-2xl">
              Explore the music
            </h3>

            <div className="space-y-2">
              {episode.mixlists.length > 0 ? (
                episode.mixlists.map((mixlist) => (
                  <Link
                    key={`${episode.id}-${mixlist.position}`}
                    href={mixlistHref(mixlist.mixlist_id)}
                    className="group flex min-h-14 items-center justify-between gap-4 rounded-lg border border-[#58A6A1] bg-[#DCE9E4] px-4 py-3 transition hover:bg-[#CFE2DC] dark:bg-[#203331] dark:hover:bg-[#29413E]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black sm:text-lg">
                        {mixlist.title}
                      </p>
                      <p className="text-xs text-[#2A3170]/65 dark:text-[#B4B8C0]">
                        {mixlist.curator_label}
                      </p>
                    </div>
                    <span className="text-2xl font-bold transition group-hover:translate-x-1">
                      ›
                    </span>
                  </Link>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[#58A6A1]/60 px-4 py-5 text-sm text-[#2A3170]/65 dark:text-[#B4B8C0]">
                  Mixlists for this episode are coming soon.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[#BE3943]/60 pt-5 dark:border-[#BE3943]/70 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-1">
            <h3 className="text-2xl font-black tracking-wide sm:text-3xl">
              {episode.title}
            </h3>

            <p className="mt-2 text-sm font-medium tracking-wide text-[#2A3170]/80 dark:text-[#B4B8C0] sm:text-base">
              {formatDate(episode.published_on)}
              <span aria-hidden="true" className="px-2">
                ·
              </span>
              {episode.duration_label}
            </p>

            <h4 className="mt-7 text-lg font-black sm:text-xl">
              Listen or watch the episode
            </h4>

            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <PlatformButton
                mixlistId={episode.podcast_mixlist_id}
                platform="spotify"
                label="Spotify"
              />
              <PlatformButton
                mixlistId={episode.podcast_mixlist_id}
                platform="apple"
                label="Apple Podcasts"
              />
              <PlatformButton
                mixlistId={episode.podcast_mixlist_id}
                platform="youtube"
                label="YouTube"
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PlatformButton({
  mixlistId,
  platform,
  label,
}: {
  mixlistId: string;
  platform: Platform;
  label: string;
}) {
  return (
    <Link
      href={mixlistHref(mixlistId, platform)}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#58A6A1] bg-[#FBF8F0] px-4 py-2 text-center text-sm font-black transition hover:bg-[#DCE9E4] dark:bg-[#1A1A23] dark:hover:bg-[#203331]"
    >
      {label}
    </Link>
  );
}
