import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNext(rawNext: string | null): string {
  if (!rawNext) return "/hub";

  const trimmed = rawNext.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/hub";
  }

  return trimmed;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = normalizeNext(url.searchParams.get("next"));
  const betaCode =
    url.searchParams.get("beta_code")?.trim() ?? "";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=no_code", url.origin),
    );
  }

  // Default destination for a newly authenticated Google account is the
  // one-time beta gate. Supabase writes the OAuth session cookies onto this
  // response while exchanging the code below.
  const gateUrl = new URL("/google", url.origin);
  gateUrl.searchParams.set("next", next);

  if (betaCode) {
    gateUrl.searchParams.set("code", betaCode);
  }

  const response = NextResponse.redirect(gateUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback exchange failed:", error);

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=no_user", url.origin),
    );
  }

  const admin = createAdminClient();

  // Returning Google users who have already redeemed beta access never see
  // the code gate again.
  const {
    data: existingRedemption,
    error: redemptionLookupError,
  } = await admin
    .from("beta_code_redemptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (redemptionLookupError) {
    console.error(
      "Failed to check Google beta redemption:",
      redemptionLookupError,
    );

    gateUrl.searchParams.set(
      "error",
      "beta_status_check_failed",
    );
    response.headers.set("Location", gateUrl.toString());
    return response;
  }

  if (existingRedemption) {
    response.headers.set(
      "Location",
      new URL(next, url.origin).toString(),
    );
    return response;
  }

  // First-time Google users stay signed in and are sent to the one-time gate.
  return response;
}
