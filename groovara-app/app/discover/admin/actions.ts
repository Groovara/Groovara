"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_BETA_CODE_EMAILS } from "@/lib/beta/allowedEmails";

async function requireDiscoveryAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email =
    user?.email?.trim().toLowerCase() ?? "";

  if (
    !user ||
    !email ||
    !ALLOWED_BETA_CODE_EMAILS.includes(email)
  ) {
    throw new Error("Unauthorized.");
  }

  return { user };
}

function candidateId(formData: FormData) {
  const value = String(
    formData.get("candidateId") || "",
  ).trim();

  if (!value) {
    throw new Error("Missing Discovery candidate id.");
  }

  return value;
}

async function updateCandidate(
  id: string,
  values: Record<string, unknown>,
) {
  const { user } = await requireDiscoveryAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("discovery_candidates")
    .update({
      ...values,
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      error.message ||
        "Failed to update Discovery candidate.",
    );
  }

  revalidatePath("/discover");
  revalidatePath("/discover/admin");
}

export async function approveDiscoveryCandidateAction(
  formData: FormData,
) {
  const id = candidateId(formData);

  await updateCandidate(id, {
    status: "approved",
    is_legacy: false,
    approved_at: new Date().toISOString(),
  });
}

export async function rejectDiscoveryCandidateAction(
  formData: FormData,
) {
  const id = candidateId(formData);

  await updateCandidate(id, {
    status: "rejected",
    is_legacy: false,
  });
}

export async function markDiscoveryLegacyAction(
  formData: FormData,
) {
  const id = candidateId(formData);

  await updateCandidate(id, {
    status: "approved",
    is_legacy: true,
  });
}

export async function restoreDiscoveryFeaturedAction(
  formData: FormData,
) {
  const id = candidateId(formData);

  await updateCandidate(id, {
    status: "approved",
    is_legacy: false,
  });
}
