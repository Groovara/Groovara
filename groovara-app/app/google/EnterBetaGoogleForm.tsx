"use client";

import { useActionState } from "react";
import Link from "next/link";
import { redeemGoogleBetaAction } from "./actions";

const initialState = {
  error: "",
  success: "",
};

type EnterBetaGoogleFormProps = {
  next: string;
  codeFromUrl: string;
  initialError?: string;
};

export default function EnterBetaGoogleForm({
  next,
  codeFromUrl,
  initialError = "",
}: EnterBetaGoogleFormProps) {
  const [state, formAction, pending] = useActionState(
    redeemGoogleBetaAction,
    initialState
  );

  const visibleError = state.error || initialError;

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-light tracking-wide">
            Unlock Groovara
          </h1>
          <p className="text-sm text-muted-foreground">
            Your Google account is connected. Enter a beta access code once to
            unlock this account.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Beta Code
            </label>
            <input
              name="betaCode"
              type="text"
              required
              defaultValue={codeFromUrl}
              placeholder="Enter your code"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none"
            />
          </div>

          {visibleError ? (
            <p className="text-sm text-red-400">
              {visibleError}
            </p>
          ) : null}

          {state.success ? (
            <p className="text-sm text-green-400">
              {state.success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "UNLOCKING..." : "UNLOCK ACCESS"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          You only need to redeem a code once for this account.
        </p>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/beta"
            className="text-purple-300 hover:text-purple-200"
          >
            Back to early access
          </Link>
        </p>
      </div>
    </main>
  );
}
