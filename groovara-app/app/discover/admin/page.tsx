import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_BETA_CODE_EMAILS } from "@/lib/beta/allowedEmails";
import {
  approveDiscoveryCandidateAction,
  markDiscoveryLegacyAction,
  rejectDiscoveryCandidateAction,
  restoreDiscoveryFeaturedAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Candidate = {
  id: string;
  mixlist_id: string;
  status: "pending" | "approved" | "rejected";
  is_legacy: boolean;
  submitted_at: string;
  approved_at: string | null;
};

type Mixlist = {
  id: string;
  title: string | null;
  sender_name: string | null;
  created_at: string;
};

function ActionButton({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className="rounded-full border border-[#58A6A1]/60 bg-transparent px-4 py-2 text-[10px] font-semibold tracking-[0.13em] text-[#2D7774] transition hover:bg-[#58A6A1]/10 dark:text-[#86CBC7]"
    >
      {children}
    </button>
  );
}

export default async function DiscoveryAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/discover/admin");
  }

  const email =
    user.email?.trim().toLowerCase() ?? "";

  if (
    !email ||
    !ALLOWED_BETA_CODE_EMAILS.includes(email)
  ) {
    redirect("/discover");
  }

  const admin = createAdminClient();

  const { data: candidates, error } = await admin
    .from("discovery_candidates")
    .select(
      "id,mixlist_id,status,is_legacy,submitted_at,approved_at",
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message ||
        "Failed to load Discovery moderation queue.",
    );
  }

  const rows = (candidates ?? []) as Candidate[];
  const ids = rows.map((row) => row.mixlist_id);

  let mixlists: Mixlist[] = [];

  if (ids.length > 0) {
    const result = await admin
      .from("mixlists")
      .select("id,title,sender_name,created_at")
      .in("id", ids);

    if (result.error) {
      throw new Error(result.error.message);
    }

    mixlists = (result.data ?? []) as Mixlist[];
  }

  const mixlistById = new Map(
    mixlists.map((mixlist) => [
      mixlist.id,
      mixlist,
    ]),
  );

  const renderRows = (
    title: string,
    status: Candidate["status"],
  ) => {
    const statusRows = rows.filter(
      (row) => row.status === status,
    );

    return (
      <section className="rounded-3xl border border-[#2A3170]/15 bg-[#F0E9DA]/70 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#1F2860] dark:text-[#B4B8C0]">
            {title}
          </h2>
          <span className="text-[10px] tracking-[0.15em] text-muted-foreground">
            {statusRows.length}
          </span>
        </div>

        <div className="mt-4 border-t border-[#2A3170]/12 dark:border-white/[0.08]">
          {statusRows.length === 0 ? (
            <p className="py-7 text-sm text-muted-foreground">
              Nothing here.
            </p>
          ) : (
            statusRows.map((candidate) => {
              const mixlist =
                mixlistById.get(candidate.mixlist_id);

              return (
                <article
                  key={candidate.id}
                  className="border-b border-[#2A3170]/12 py-5 dark:border-white/[0.08]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/mixlists/${candidate.mixlist_id}`}
                          className="truncate text-lg font-medium text-foreground hover:text-[#2A3170] dark:hover:text-[#86CBC7]"
                        >
                          {mixlist?.title ||
                            "Untitled Mixlist"}
                        </Link>

                        {candidate.status ===
                          "approved" && (
                          <span className="rounded-full border border-[#B4B8C0]/55 px-2 py-0.5 text-[8px] tracking-[0.12em] text-muted-foreground">
                            {candidate.is_legacy
                              ? "LEGACY"
                              : "FEATURED"}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {mixlist?.sender_name
                          ? `From ${mixlist.sender_name} · `
                          : ""}
                        Submitted{" "}
                        {new Date(
                          candidate.submitted_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {candidate.status !==
                        "approved" ? (
                        <form
                          action={
                            approveDiscoveryCandidateAction
                          }
                        >
                          <input
                            type="hidden"
                            name="candidateId"
                            value={candidate.id}
                          />
                          <ActionButton>
                            APPROVE
                          </ActionButton>
                        </form>
                      ) : candidate.is_legacy ? (
                        <form
                          action={
                            restoreDiscoveryFeaturedAction
                          }
                        >
                          <input
                            type="hidden"
                            name="candidateId"
                            value={candidate.id}
                          />
                          <ActionButton>
                            RETURN TO ROTATION
                          </ActionButton>
                        </form>
                      ) : (
                        <form
                          action={
                            markDiscoveryLegacyAction
                          }
                        >
                          <input
                            type="hidden"
                            name="candidateId"
                            value={candidate.id}
                          />
                          <ActionButton>
                            MARK LEGACY
                          </ActionButton>
                        </form>
                      )}

                      {candidate.status !==
                        "rejected" && (
                        <form
                          action={
                            rejectDiscoveryCandidateAction
                          }
                        >
                          <input
                            type="hidden"
                            name="candidateId"
                            value={candidate.id}
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-[#B4B8C0]/65 bg-transparent px-4 py-2 text-[10px] font-semibold tracking-[0.13em] text-muted-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            REJECT
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    );
  };

  return (
    <main className="gv-paper-bg min-h-screen px-5 py-12 text-foreground sm:px-8 sm:py-16">
      <div className="gv-paper-content mx-auto w-full max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.22em] text-[#58A6A1]">
            DISCOVERY ADMIN
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-wide text-[#1F2860] dark:text-[#B4B8C0]">
            DJ booth
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Approve submissions, rotate featured Mixlists
            into Legacy, or bring old selections back.
          </p>
        </header>

        <div className="space-y-6">
          {renderRows("Pending candidates", "pending")}
          {renderRows("Catalog", "approved")}
          {renderRows("Rejected", "rejected")}
        </div>
      </div>
    </main>
  );
}
