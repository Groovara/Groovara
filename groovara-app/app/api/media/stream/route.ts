import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  GROOVARA_MEDIA_BUCKET,
  parseUploadedMediaPath,
} from "@/lib/uploadedMedia";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path");
  const mediaPath = parseUploadedMediaPath(
    rawPath ? `groovara-upload://${rawPath}` : null,
  );

  if (!mediaPath || mediaPath !== rawPath) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: refs, error: refsError } = await admin
    .from("mixlist_songs")
    .select("mixlist_id")
    .eq("platform", "upload")
    .eq("track_id", mediaPath);

  if (refsError) {
    console.error("Uploaded media reference lookup failed", refsError);
    return NextResponse.json({ error: "Unable to verify media." }, { status: 500 });
  }

  const mixlistIds = [
    ...new Set((refs ?? []).map((row) => row.mixlist_id).filter(Boolean)),
  ];

  let allowed = false;

  if (mixlistIds.length > 0) {
    const { data: publicMixlists } = await admin
      .from("mixlists")
      .select("id")
      .in("id", mixlistIds)
      .eq("is_public", true)
      .limit(1);

    allowed = (publicMixlists?.length ?? 0) > 0;
  }

  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      allowed = mediaPath.startsWith(`${user.id}/`);
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(GROOVARA_MEDIA_BUCKET)
    .createSignedUrl(mediaPath, 60 * 15);

  if (error || !data?.signedUrl) {
    console.error("Uploaded media signing failed", error);
    return NextResponse.json({ error: "Unable to play media." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
