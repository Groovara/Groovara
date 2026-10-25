import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import EnterBetaGoogleForm from "./EnterBetaGoogleForm";

function normalizeNext(rawNext: string | undefined): string {
  if (!rawNext) return "/hub";

  const trimmed = rawNext.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/hub";
  }

  return trimmed;
}

export default async function EnterBetaGooglePage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    code?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const next = normalizeNext(params?.next);
  const code = params?.code?.trim() ?? "";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The code gate is post-auth. If the session disappeared, restart from login
  // instead of accepting a beta code without a known user.
  if (!user) {
    const loginParams = new URLSearchParams();
    loginParams.set("next", next);

    if (code) {
      loginParams.set("code", code);
    }

    redirect(`/login?${loginParams.toString()}`);
  }

  const admin = createAdminClient();

  const {
    data: existingRedemption,
    error: redemptionError,
  } = await admin
    .from("beta_code_redemptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!redemptionError && existingRedemption) {
    redirect(next);
  }

  const initialError =
    params?.error === "beta_status_check_failed"
      ? "We couldn’t verify your existing beta access. You can retry your code below."
      : "";

  return (
    <EnterBetaGoogleForm
      next={next}
      codeFromUrl={code}
      initialError={initialError}
    />
  );
}
