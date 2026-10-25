"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type DiscoveryMixlist = {
  id: string;
  title: string;
  senderName: string | null;
  showSender: boolean;
  createdAt: string;
  approvedAt: string | null;
  isLegacy: boolean;
  songCount: number;
  searchText: string;
};

type SortMode = "newest" | "oldest" | "az" | "za";

function sortDate(mixlist: DiscoveryMixlist) {
  const raw = mixlist.approvedAt || mixlist.createdAt;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DiscoverClient({
  mixlists,
}: {
  mixlists: DiscoveryMixlist[];
}) {
  const [query, setQuery] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const visibleMixlists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = mixlists.filter((mixlist) => {
      if (!showLegacy && mixlist.isLegacy) return false;

      if (!normalizedQuery) return true;

      return mixlist.searchText.includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      if (sortMode === "newest") return sortDate(b) - sortDate(a);
      if (sortMode === "oldest") return sortDate(a) - sortDate(b);

      const titleA = a.title.toLocaleLowerCase();
      const titleB = b.title.toLocaleLowerCase();

      if (sortMode === "az") {
        return titleA.localeCompare(titleB);
      }

      return titleB.localeCompare(titleA);
    });
  }, [mixlists, query, showLegacy, sortMode]);

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-[#2A3170]/15 bg-[#F0E9DA]/70 p-4 shadow-[0_18px_45px_rgba(42,49,112,0.07)] backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <label htmlFor="discovery-search" className="sr-only">
            Search Discovery
          </label>

          <input
            id="discovery-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Mixlists, artists, or songs…"
            className="min-w-0 flex-1 rounded-2xl border border-[#2A3170]/18 bg-[#F0E9DA]/85 px-4 py-3 text-sm text-[#1A1A23] outline-none transition placeholder:text-[#6b635b]/65 focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 dark:border-white/10 dark:bg-black/15 dark:text-white dark:placeholder:text-white/35"
          />

          <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#58A6A1]/45 bg-[#58A6A1]/7 px-3 py-3 text-[10px] font-semibold tracking-[0.15em] text-[#2D7774] sm:px-4 sm:text-xs dark:text-[#86CBC7]">
            <input
              type="checkbox"
              checked={showLegacy}
              onChange={(event) => setShowLegacy(event.target.checked)}
              className="h-4 w-4 accent-[#58A6A1]"
            />
            LEGACY
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <p className="text-[10px] tracking-[0.16em] text-[#6b635b] dark:text-white/40">
            {visibleMixlists.length} MIXLIST
            {visibleMixlists.length === 1 ? "" : "S"}
          </p>

          <label className="flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] text-[#6b635b] dark:text-white/45">
            SORT
            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as SortMode)
              }
              className="rounded-xl border border-[#2A3170]/18 bg-[#F0E9DA]/85 px-3 py-2 text-xs tracking-normal text-[#1A1A23] outline-none focus:border-[#58A6A1] dark:border-white/10 dark:bg-[#1A1A23] dark:text-white"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 border-t border-[#2A3170]/12 dark:border-white/[0.08]">
        {visibleMixlists.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#6b635b] dark:text-white/45">
              No Mixlists match this view.
            </p>
          </div>
        ) : (
          visibleMixlists.map((mixlist) => (
            <article
              key={mixlist.id}
              className="group flex items-center justify-between gap-5 border-b border-[#2A3170]/12 py-5 dark:border-white/[0.08]"
            >
              <Link
                href={`/mixlists/${mixlist.id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-medium text-[#292521] transition group-hover:text-[#2A3170] dark:text-white/90 dark:group-hover:text-[#86CBC7] sm:text-2xl">
                    {mixlist.title}
                  </h2>

                  {mixlist.isLegacy ? (
                    <span className="rounded-full border border-[#B4B8C0]/60 px-2 py-0.5 text-[8px] font-semibold tracking-[0.14em] text-[#6b635b] dark:text-white/45">
                      LEGACY
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#58A6A1]/55 bg-[#58A6A1]/8 px-2 py-0.5 text-[8px] font-semibold tracking-[0.14em] text-[#2D7774] dark:text-[#86CBC7]">
                      FEATURED
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs tracking-[0.02em] text-[#6b635b] dark:text-white/45">
                  {mixlist.songCount} song
                  {mixlist.songCount === 1 ? "" : "s"}
                  {mixlist.showSender && mixlist.senderName
                    ? ` · From ${mixlist.senderName}`
                    : ""}
                </p>
              </Link>

              <span
                aria-hidden="true"
                className="shrink-0 text-lg text-[#58A6A1] transition group-hover:translate-x-1"
              >
                →
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
