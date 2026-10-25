import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeNext(rawNext: string | null): string {
  if (!rawNext) return "/hub";

  const trimmed = rawNext.trim();

  // Keep redirects inside Groovara.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/hub";
  }

  return trimmed;
}

export async function GET(request: NextRequest) {
  const next = normalizeNext(
    request.nextUrl.searchParams.get("next"),
  );
  const betaCode =
    request.nextUrl.searchParams.get("code")?.trim() ?? "";

  const callbackUrl = new URL(
    "/auth/callback",
    request.nextUrl.origin,
  );
  callbackUrl.searchParams.set("next", next);

  // If an invite link supplied a code, carry it through OAuth only as a
  // convenience so the post-auth gate can prefill it. It is not trusted or
  // redeemed until after Google authentication succeeds.
  if (betaCode) {
    callbackUrl.searchParams.set("beta_code", betaCode);
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

  if (error || !data.url) {
    console.error("Failed to start Google OAuth:", error);

    const loginUrl = new URL(
      "/login",
      request.nextUrl.origin,
    );
    loginUrl.searchParams.set(
      "error",
      error?.message ?? "google_oauth_start_failed",
    );
    loginUrl.searchParams.set("next", next);

    if (betaCode) {
      loginUrl.searchParams.set("code", betaCode);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
