"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/analyticsServer";

type GoogleBetaState = {
  error: string;
  success: string;
};

function normalizeNext(rawNext: string): string {
  const trimmed = rawNext.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/hub";
  }

  return trimmed || "/hub";
}

export async function redeemGoogleBetaAction(
  _prevState: GoogleBetaState,
  formData: FormData
): Promise<GoogleBetaState> {
  const betaCode = String(
    formData.get("betaCode") || "",
  ).trim();
  const next = normalizeNext(
    String(formData.get("next") || "/hub"),
  );

  if (!betaCode) {
    return {
      error: "Please enter a beta code.",
      success: "",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Your Google session expired. Please sign in again.",
      success: "",
    };
  }

  const admin = createAdminClient();

  // If another request already completed redemption for this account, do not
  // ask for or consume another code.
  const {
    data: existingRedemption,
    error: existingError,
  } = await admin
    .from("beta_code_redemptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return {
      error: "Failed to verify beta access.",
      success: "",
    };
  }

  if (existingRedemption) {
    redirect(next);
  }

  const {
    data: codeRow,
    error: codeError,
  } = await admin
    .from("beta_codes")
    .select(
      "id, code, is_active, max_uses, used_count, expires_at",
    )
    .eq("code", betaCode)
    .maybeSingle();

  const usedCount = Number(codeRow?.used_count ?? 0);
  const maxUses = Number(codeRow?.max_uses ?? 0);

  if (
    codeError ||
    !codeRow ||
    !codeRow.is_active ||
    (codeRow.expires_at &&
      new Date(codeRow.expires_at) <= new Date()) ||
    usedCount >= maxUses
  ) {
    return {
      error: "That code didn’t work. Check it and try again.",
      success: "",
    };
  }

  const {
    data: redemption,
    error: redemptionError,
  } = await admin
    .from("beta_code_redemptions")
    .insert({
      code_id: codeRow.id,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (redemptionError || !redemption) {
    // A duplicate submission may have raced us. If this account now has a
    // redemption, treat that as success rather than consuming another code.
    const { data: racedRedemption } = await admin
      .from("beta_code_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (racedRedemption) {
      redirect(next);
    }

    console.error(
      "Google beta redemption insert failed:",
      redemptionError,
    );

    return {
      error: "Failed to unlock beta access. Please try again.",
      success: "",
    };
  }

  const nextUsedCount = usedCount + 1;

  // Make the usage increment conditional on the count we validated above.
  // This prevents two simultaneous claims from both consuming a one-use code.
  const {
    data: updatedCode,
    error: updateError,
  } = await admin
    .from("beta_codes")
    .update({
      used_count: nextUsedCount,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", codeRow.id)
    .eq("used_count", usedCount)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedCode) {
    console.error(
      "Google beta usage update failed:",
      updateError,
    );

    // Roll back the redemption so a failed usage update cannot accidentally
    // grant permanent access.
    await admin
      .from("beta_code_redemptions")
      .delete()
      .eq("id", redemption.id);

    return {
      error:
        "That code is no longer available. Please try another code.",
      success: "",
    };
  }

  await trackServerEvent(
    "beta_code_redeemed",
    user.id,
    {
      beta_code: codeRow.code,
      beta_code_id: codeRow.id,
      signup_method: "google",
      used_count: nextUsedCount,
      max_uses: maxUses,
    },
  );

  redirect(next);
}
