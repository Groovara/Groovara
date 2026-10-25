import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    /^\/mixlists\/[^/]+\/?$/.test(pathname) ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api")
  );
}

function userHasGoogleIdentity(user: {
  app_metadata?: Record<string, unknown>;
}) {
  const provider = user.app_metadata?.provider;
  const providers = user.app_metadata?.providers;

  return (
    provider === "google" ||
    (Array.isArray(providers) &&
      providers.some((value) => value === "google"))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                options,
              ),
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set(
      "next",
      `${pathname}${search}`,
    );
    return NextResponse.redirect(url);
  }

  /*
   * Google OAuth now authenticates before the beta-code gate.
   * Until that Google account has a beta_code_redemptions row, it must not be
   * able to bypass /google by manually navigating to a protected Groovara page.
   *
   * Keep this check scoped to Google identities so existing password accounts
   * are not unexpectedly affected by this Google-specific flow change.
   */
  if (userHasGoogleIdentity(user)) {
    const admin = createAdminClient();

    const {
      data: redemption,
      error: redemptionError,
    } = await admin
      .from("beta_code_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (redemptionError || !redemption) {
      const gateUrl = request.nextUrl.clone();
      gateUrl.pathname = "/google";
      gateUrl.search = "";
      gateUrl.searchParams.set(
        "next",
        `${pathname}${search}`,
      );

      if (redemptionError) {
        gateUrl.searchParams.set(
          "error",
          "beta_status_check_failed",
        );
      }

      return NextResponse.redirect(gateUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/hub/:path*",
    "/tracklists/:path*",
    "/mixlists/:path*",
    "/settings/:path*",
  ],
};
