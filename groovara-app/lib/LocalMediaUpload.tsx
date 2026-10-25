"use client";

import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  buildUploadedMediaUrl,
  getFallbackMimeType,
  getUploadExtension,
  GROOVARA_MEDIA_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploadedMedia";

export type UploadedMediaRecord = {
  platform: "upload";
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  isrc: null;
};

type RegisterResult =
  | { ok: true }
  | { ok: false; message: string };

type LocalMediaUploadProps = {
  tracklistId: string;
  disabled?: boolean;
  onRegister: (record: UploadedMediaRecord) => Promise<RegisterResult>;
};

const ACCEPT =
  ".mp3,.wav,.mp4,.mov,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/vnd.wave,video/mp4,video/quicktime";

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LocalMediaUpload({
  tracklistId,
  disabled = false,
  onRegister,
}: LocalMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extension = useMemo(
    () => (file ? getUploadExtension(file.name) : null),
    [file],
  );

  const reset = () => {
    setFile(null);
    setTitle("");
    setArtist("");
    setAlbum("");
    setProgressLabel(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseFile = (nextFile: File | null) => {
    setError(null);
    setProgressLabel(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const ext = getUploadExtension(nextFile.name);
    if (!ext) {
      setFile(null);
      setError("Use an MP3, WAV, MP4, or MOV file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (nextFile.size <= 0) {
      setFile(null);
      setError("That file is empty.");
      return;
    }

    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("Uploads are currently limited to 250 MB per file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(nextFile);
    setTitle((current) => current.trim() || titleFromFilename(nextFile.name));
  };

  const upload = async () => {
    if (!file || !extension || uploading || disabled) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give the recording a title first.");
      return;
    }

    setUploading(true);
    setError(null);
    setProgressLabel("Preparing upload...");

    let objectPath: string | null = null;

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        throw new Error("You need to be signed in to upload media.");
      }

      objectPath = `${user.id}/${tracklistId}/${crypto.randomUUID()}.${extension}`;
      const contentType = file.type || getFallbackMimeType(extension);

      setProgressLabel(`Uploading ${formatFileSize(file.size)}...`);

      const { error: uploadError } = await supabase.storage
        .from(GROOVARA_MEDIA_BUCKET)
        .upload(objectPath, file, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "The file could not be uploaded.");
      }

      setProgressLabel("Adding recording to the tracklist...");

      const result = await onRegister({
        platform: "upload",
        track_id: objectPath,
        title: cleanTitle,
        artist: artist.trim() || "Uploaded recording",
        album: album.trim() || null,
        url: buildUploadedMediaUrl(objectPath),
        isrc: null,
      });

      if (!result.ok) {
        await supabase.storage.from(GROOVARA_MEDIA_BUCKET).remove([objectPath]);
        throw new Error(result.message);
      }

      reset();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "The upload could not be completed.";
      setError(message);
      setProgressLabel(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="gv-row mt-4 max-w-2xl rounded-3xl border border-[#BE3943]/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#BE3943] dark:text-[#F08B93]">
            YOUR OWN RECORDING
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            Upload audio or video
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Add a recording that is not on a music platform. MP3, WAV, MP4, and MOV are supported.
          </p>
        </div>

        <span className="rounded-full border border-[#58A6A1]/35 bg-[#58A6A1]/10 px-3 py-1 text-[10px] tracking-[0.16em] text-[#2D7774] dark:text-[#86CBC7]">
          UP TO 250 MB
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={disabled || uploading}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-border bg-card/70 px-3 py-3 text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-[#2A3170] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.12em] file:text-[#F0E9DA] hover:file:bg-[#1F2860] disabled:opacity-50"
        />

        {file ? (
          <div className="rounded-xl border border-[#58A6A1]/25 bg-[#58A6A1]/8 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{file.name}</span>
            <span> - {formatFileSize(file.size)}</span>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs tracking-[0.12em] text-muted-foreground">
            TITLE
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!file || disabled || uploading}
              placeholder="Recording title"
              className="mt-2 w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 disabled:opacity-45"
            />
          </label>

          <label className="text-xs tracking-[0.12em] text-muted-foreground">
            ARTIST / PERFORMER
            <input
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              disabled={!file || disabled || uploading}
              placeholder="Optional"
              className="mt-2 w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 disabled:opacity-45"
            />
          </label>
        </div>

        <label className="text-xs tracking-[0.12em] text-muted-foreground">
          ALBUM / EVENT / CONTEXT
          <input
            value={album}
            onChange={(event) => setAlbum(event.target.value)}
            disabled={!file || disabled || uploading}
            placeholder="Optional - e.g. Fuzzy's Tuesday Night, Oct. 20"
            className="mt-2 w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#58A6A1] focus:ring-2 focus:ring-[#58A6A1]/15 disabled:opacity-45"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-[#BE3943]/25 bg-[#BE3943]/10 px-4 py-3 text-sm text-[#9D2D36] dark:text-[#F4A2A8]">
          {error}
        </p>
      ) : null}

      {progressLabel ? (
        <p className="mt-4 text-xs tracking-[0.12em] text-muted-foreground">
          {progressLabel}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!file || disabled || uploading}
          className="rounded-full border border-[#BE3943] bg-[#BE3943] px-6 py-3 text-xs font-semibold tracking-[0.16em] text-[#F0E9DA] transition hover:-translate-y-0.5 hover:bg-[#A9323B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3943]/35 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {uploading ? "UPLOADING..." : "UPLOAD & ADD"}
        </button>

        {file ? (
          <button
            type="button"
            onClick={reset}
            disabled={uploading}
            className="rounded-full border border-border px-5 py-3 text-xs tracking-[0.14em] text-muted-foreground transition hover:border-[#58A6A1] hover:text-[#2D7774] disabled:opacity-45 dark:hover:text-[#86CBC7]"
          >
            CLEAR
          </button>
        ) : null}
      </div>
    </section>
  );
}
