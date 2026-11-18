"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const PARTNER_SLUG = "aop";
const DEFAULT_CURATORS = ["Rob", "Christian", "Patty"] as const;

type Platform = "spotify" | "apple" | "youtube";

type EpisodeRow = {
  id: string;
  title: string;
  published_on: string;
  duration_label: string;
  podcast_mixlist_id: string;
  is_featured: boolean;
  is_published: boolean;
};

type EpisodeMixlistRow = {
  episode_id: string;
  position: number;
  curator_label: string;
  mixlist_id: string;
};

type EpisodePlatformLinkRow = {
  episode_id: string;
  platform: Platform;
  url: string;
  external_id: string;
};

type ManagedEpisode = EpisodeRow & {
  mixlists: EpisodeMixlistRow[];
  platformLinks: EpisodePlatformLinkRow[];
};

type MemberMixlistInput = {
  curator: string;
  value: string;
};

type FormState = {
  title: string;
  publishedOn: string;
  durationLabel: string;
  podcastMixlist: string;
  featured: boolean;
  published: boolean;
  memberMixlists: MemberMixlistInput[];
  episodePlatforms: Record<Platform, string>;
};

function emptyForm(): FormState {
  return {
    title: "",
    publishedOn: new Date().toISOString().slice(0, 10),
    durationLabel: "",
    podcastMixlist: "",
    featured: false,
    published: true,
    memberMixlists: DEFAULT_CURATORS.map((curator) => ({ curator, value: "" })),
    episodePlatforms: {
      spotify: "",
      apple: "",
      youtube: "",
    },
  };
}

function extractMixlistId(value: string): string | null {
  const trimmed = value.trim();
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.exec(
    trimmed,
  );
  return uuid?.[0] ?? null;
}

function extractEpisodeExternalId(platform: Platform, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);

    if (platform === "spotify") {
      if (host !== "open.spotify.com") return null;
      const episodeIndex = parts.indexOf("episode");
      const id = episodeIndex >= 0 ? parts[episodeIndex + 1] : null;
      return id && /^[A-Za-z0-9]+$/.test(id) ? id : null;
    }

    if (platform === "apple") {
      if (host !== "podcasts.apple.com" && !host.endsWith(".podcasts.apple.com")) {
        return null;
      }

      const episodeId = url.searchParams.get("i");
      return episodeId && /^\d+$/.test(episodeId) ? episodeId : null;
    }

    const youtubeHost =
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host === "www.youtu.be";
    if (!youtubeHost) return null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parts[0] ?? null;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    const watchId = url.searchParams.get("v");
    if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

    for (const marker of ["shorts", "embed", "live"]) {
      const markerIndex = parts.indexOf(marker);
      const id = markerIndex >= 0 ? parts[markerIndex + 1] : null;
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
}

function platformLabel(platform: Platform) {
  switch (platform) {
    case "spotify":
      return "Spotify";
    case "apple":
      return "Apple Podcasts";
    case "youtube":
      return "YouTube";
  }
}

export function AopAdminDashboard({ userId: _userId }: { userId: string }) {
  const [episodes, setEpisodes] = useState<ManagedEpisode[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadEpisodes();
    // Authorization already happened server-side in page.tsx.
    // RLS remains the final database-level enforcement layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formTitle = editingId ? "Edit episode" : "Add episode";

  const featuredEpisode = useMemo(
    () => episodes.find((episode) => episode.is_featured),
    [episodes],
  );

  async function loadEpisodes() {
    const { data: episodeRows, error: episodeError } = await supabase
      .from("partner_episodes")
      .select(
        "id,title,published_on,duration_label,podcast_mixlist_id,is_featured,is_published",
      )
      .eq("partner_slug", PARTNER_SLUG)
      .order("is_featured", { ascending: false })
      .order("published_on", { ascending: false });

    if (episodeError) {
      setMessage(episodeError.message);
      return;
    }

    const base = (episodeRows ?? []) as EpisodeRow[];
    const ids = base.map((episode) => episode.id);
    let mixlistLinks: EpisodeMixlistRow[] = [];
    let platformLinks: EpisodePlatformLinkRow[] = [];

    if (ids.length > 0) {
      const [mixlistResult, platformResult] = await Promise.all([
        supabase
          .from("partner_episode_mixlists")
          .select("episode_id,position,curator_label,mixlist_id")
          .in("episode_id", ids)
          .order("position", { ascending: true }),
        supabase
          .from("partner_episode_platform_links")
          .select("episode_id,platform,url,external_id")
          .in("episode_id", ids),
      ]);

      if (mixlistResult.error) {
        setMessage(mixlistResult.error.message);
        return;
      }

      if (platformResult.error) {
        setMessage(platformResult.error.message);
        return;
      }

      mixlistLinks = (mixlistResult.data ?? []) as EpisodeMixlistRow[];
      platformLinks = (platformResult.data ?? []) as EpisodePlatformLinkRow[];
    }

    setEpisodes(
      base.map((episode) => ({
        ...episode,
        mixlists: mixlistLinks.filter((link) => link.episode_id === episode.id),
        platformLinks: platformLinks.filter((link) => link.episode_id === episode.id),
      })),
    );
  }

  function updateMember(index: number, key: "curator" | "value", value: string) {
    setForm((current) => ({
      ...current,
      memberMixlists: current.memberMixlists.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }

  function addMemberMixlist() {
    setForm((current) => ({
      ...current,
      memberMixlists: [...current.memberMixlists, { curator: "", value: "" }],
    }));
  }

  function removeMemberMixlist(index: number) {
    setForm((current) => ({
      ...current,
      memberMixlists: current.memberMixlists.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateEpisodePlatform(platform: Platform, value: string) {
    setForm((current) => ({
      ...current,
      episodePlatforms: {
        ...current.episodePlatforms,
        [platform]: value,
      },
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
  }

  function startEdit(episode: ManagedEpisode) {
    const sortedLinks = [...episode.mixlists].sort(
      (left, right) => left.position - right.position,
    );

    const platformUrl = (platform: Platform) =>
      episode.platformLinks.find((link) => link.platform === platform)?.url ?? "";

    setEditingId(episode.id);
    setForm({
      title: episode.title,
      publishedOn: episode.published_on,
      durationLabel: episode.duration_label,
      podcastMixlist: episode.podcast_mixlist_id,
      featured: episode.is_featured,
      published: episode.is_published,
      memberMixlists: sortedLinks.map((row) => ({
        curator: row.curator_label,
        value: row.mixlist_id,
      })),
      episodePlatforms: {
        spotify: platformUrl("spotify"),
        apple: platformUrl("apple"),
        youtube: platformUrl("youtube"),
      },
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEpisode(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const podcastMixlistId = extractMixlistId(form.podcastMixlist);

    const memberRows = form.memberMixlists
      .map((item) => ({
        curator_label: item.curator.trim(),
        mixlist_id: extractMixlistId(item.value),
        raw_value: item.value.trim(),
      }))
      .filter((row) => row.curator_label || row.raw_value)
      .map((row, index) => ({
        position: index + 1,
        curator_label: row.curator_label,
        mixlist_id: row.mixlist_id,
      }));

    const platformRows = (["spotify", "apple", "youtube"] as Platform[]).map(
      (platform) => ({
        platform,
        url: form.episodePlatforms[platform].trim(),
        external_id: extractEpisodeExternalId(
          platform,
          form.episodePlatforms[platform],
        ),
      }),
    );

    if (!form.title.trim()) {
      setMessage("Episode title is required.");
      return;
    }

    if (!form.publishedOn) {
      setMessage("Publish date is required.");
      return;
    }

    if (!form.durationLabel.trim()) {
      setMessage("Episode length is required.");
      return;
    }

    if (!podcastMixlistId) {
      setMessage("Enter a valid Groovara Mixlist URL or UUID for the podcast episode.");
      return;
    }

    if (memberRows.some((row) => !row.curator_label || row.mixlist_id === null)) {
      setMessage(
        "Each member Mixlist row needs both a name and a valid Groovara Mixlist URL or UUID.",
      );
      return;
    }

    const invalidPlatform = platformRows.find(
      (row) => !row.url || !row.external_id,
    );

    if (invalidPlatform) {
      setMessage(
        `Enter a valid ${platformLabel(invalidPlatform.platform)} episode URL. All three platform URLs are required so Groovara can guarantee exact episode conversion.`,
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("save_partner_episode", {
        p_episode_id: editingId,
        p_partner_slug: PARTNER_SLUG,
        p_title: form.title.trim(),
        p_published_on: form.publishedOn,
        p_duration_label: form.durationLabel.trim(),
        p_podcast_mixlist_id: podcastMixlistId,
        p_is_featured: form.featured,
        p_is_published: form.published,
        p_member_mixlists: memberRows.map((row) => ({
          position: row.position,
          curator_label: row.curator_label,
          mixlist_id: row.mixlist_id,
        })),
        p_platform_links: platformRows.map((row) => ({
          platform: row.platform,
          url: row.url,
          external_id: row.external_id,
        })),
      });

      if (error) {
        throw new Error(error.message || "Could not save episode.");
      }

      const wasEditing = Boolean(editingId);
      resetForm();
      await loadEpisodes();
      setMessage(wasEditing ? "Episode updated." : "Episode added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save episode.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEpisode(episode: ManagedEpisode) {
    if (busy) return;
    if (!window.confirm(`Delete “${episode.title}”?`)) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("partner_episodes")
      .delete()
      .eq("id", episode.id)
      .eq("partner_slug", PARTNER_SLUG);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === episode.id) resetForm();
    await loadEpisodes();
    setMessage("Episode deleted.");
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl pt-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#58A6A1]">
              PARTNER ADMIN · AOP
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-wide sm:text-4xl">
              Art of the Playlist
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add episodes, attach any number of member or guest Mixlists, and save the exact Spotify, Apple Podcasts, and YouTube episode URLs Groovara should use for conversion.
            </p>
          </div>

          <Link
            href="/mixlists/aop"
            className="inline-flex w-fit rounded-full border border-[#58A6A1] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#58A6A1]/10"
          >
            View public page
          </Link>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
          <form
            onSubmit={saveEpisode}
            className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">{formTitle}</h2>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-semibold text-muted-foreground underline underline-offset-4"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="mt-6 space-y-5">
              <Field label="EPISODE NAME">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  maxLength={160}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-[#58A6A1]"
                  placeholder="Fire Pit Playlists"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="PUBLISH DATE">
                  <input
                    type="date"
                    value={form.publishedOn}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        publishedOn: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-[#58A6A1]"
                  />
                </Field>

                <Field label="EPISODE LENGTH">
                  <input
                    value={form.durationLabel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        durationLabel: event.target.value,
                      }))
                    }
                    maxLength={40}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-[#58A6A1]"
                    placeholder="22 min"
                  />
                </Field>
              </div>

              <Field label="PODCAST EPISODE MIXLIST">
                <input
                  value={form.podcastMixlist}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      podcastMixlist: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-[#58A6A1]"
                  placeholder="Paste a Groovara Mixlist URL or UUID"
                />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The three public platform buttons all open this Mixlist. The exact episode URLs below control platform conversion inside it.
                </p>
              </Field>

              <div className="rounded-2xl border border-[#BE3943]/35 bg-[#BE3943]/5 p-4">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#BE3943]">
                  EXACT EPISODE LINKS
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  These are authoritative. If Groovara recognizes one of these podcast episodes, it will convert only to the other saved episode URLs and will not fuzzy-search for a similarly named song or video.
                </p>

                <div className="mt-4 space-y-3">
                  {(["spotify", "apple", "youtube"] as Platform[]).map((platform) => (
                    <Field key={platform} label={platformLabel(platform).toUpperCase()}>
                      <input
                        value={form.episodePlatforms[platform]}
                        onChange={(event) =>
                          updateEpisodePlatform(platform, event.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-[#58A6A1]"
                        placeholder={
                          platform === "spotify"
                            ? "https://open.spotify.com/episode/..."
                            : platform === "apple"
                              ? "https://podcasts.apple.com/...?...i=..."
                              : "https://www.youtube.com/watch?v=..."
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#58A6A1]/45 bg-[#58A6A1]/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-[#58A6A1]">
                      MEMBER / GUEST MIXLISTS
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add only the Mixlists that exist for this episode. Order here is the order shown publicly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMemberMixlist}
                    className="shrink-0 rounded-full border border-[#58A6A1] px-3 py-1.5 text-xs font-bold"
                  >
                    + Add Mixlist
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {form.memberMixlists.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      No music Mixlists attached. Add one when a member or guest has a Mixlist for this episode.
                    </p>
                  ) : null}

                  {form.memberMixlists.map((item, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-xl border border-border/70 bg-background/45 p-3 sm:grid-cols-[0.35fr_1fr_auto] sm:items-center"
                    >
                      <input
                        value={item.curator}
                        onChange={(event) =>
                          updateMember(index, "curator", event.target.value)
                        }
                        className="rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-[#58A6A1]"
                        aria-label={`Member or guest ${index + 1} name`}
                        placeholder="Name"
                      />
                      <input
                        value={item.value}
                        onChange={(event) =>
                          updateMember(index, "value", event.target.value)
                        }
                        className="rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-[#58A6A1]"
                        aria-label={`${item.curator || `Mixlist ${index + 1}`} URL`}
                        placeholder="Groovara Mixlist URL or UUID"
                      />
                      <button
                        type="button"
                        onClick={() => removeMemberMixlist(index)}
                        className="rounded-full border border-[#BE3943]/60 px-3 py-2 text-xs font-bold text-[#BE3943]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        featured: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#2A3170]"
                  />
                  Featured episode
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        published: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#2A3170]"
                  />
                  Visible on public page
                </label>
              </div>
            </div>

            {message ? (
              <p className="mt-5 rounded-xl border border-border bg-background/70 p-3 text-sm">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-full bg-[#2A3170] px-6 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-[#1F2860] disabled:opacity-50"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Add episode"}
            </button>
          </form>

          <section className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#58A6A1]">
                EPISODES
              </p>
              <h2 className="mt-2 text-2xl font-bold">{episodes.length} total</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {featuredEpisode
                  ? `Featured: ${featuredEpisode.title}`
                  : "No featured episode selected."}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {episodes.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No episodes have been added yet.
                </p>
              ) : (
                episodes.map((episode) => (
                  <article
                    key={episode.id}
                    className="rounded-2xl border border-border bg-background/55 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {episode.is_featured ? (
                            <span className="rounded-full bg-[#BE3943]/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#BE3943]">
                              FEATURED
                            </span>
                          ) : null}
                          {!episode.is_published ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold tracking-wider text-muted-foreground">
                              HIDDEN
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 font-bold">{episode.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {episode.published_on} · {episode.duration_label} · {episode.mixlists.length} music Mixlist{episode.mixlists.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(episode)}
                        className="rounded-full border border-[#58A6A1] px-4 py-2 text-xs font-bold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEpisode(episode)}
                        disabled={busy}
                        className="rounded-full border border-[#BE3943]/60 px-4 py-2 text-xs font-bold text-[#BE3943] disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
