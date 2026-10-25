"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./Logout";
import ThemeToggle from "./ThemeToggle";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

type MenuItem =
  | {
      type: "link";
      label: string;
      description?: string;
      href: string;
    }
  | { type: "divider" }
  | { type: "custom"; node: ReactNode };

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/hub") {
      return (
        pathname === "/hub" ||
        pathname === "/tracklists/new" ||
        pathname.startsWith("/tracklists/")
      );
    }

    if (href === "/settings") {
      return pathname === "/settings" || pathname.startsWith("/settings/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const items: MenuItem[] = [
    {
      type: "link",
      label: "My Studio",
      description: "Shape songs, notes, and pacing",
      href: "/hub",
    },
    {
      type: "link",
      label: "Discovery",
      description: "Browse Mixlists selected by Groovara",
      href: "/discover",
    },
    { type: "divider" },
    {
      type: "link",
      label: "About",
      description: "What is Groovara?",
      href: "/about",
    },
    {
      type: "link",
      label: "Guide",
      description: "Learn how to use Groovara",
      href: "/getting-started",
    },
    {
      type: "link",
      label: "Settings",
      description: "Tune your listening preferences",
      href: "/settings",
    },
    {
      type: "link",
      label: "Terms",
      description: "Read Groovara’s use terms",
      href: "/terms",
    },
    {
      type: "link",
      label: "Privacy",
      description: "How Groovara handles data",
      href: "/privacy",
    },
    {
      type: "link",
      label: "Feedback",
      description: "Let us know what you think",
      href: `/feedback?from=${encodeURIComponent(pathname)}`,
    },
    { type: "divider" },
    { type: "custom", node: <LogoutButton /> },
  ];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-[2147483646] isolate">
      <div className="gv-nav-surface flex h-24 items-center justify-between gap-3 px-3 sm:h-28 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="gv-nav-corner-rings" />

        <div ref={wrapRef} className="relative z-10 min-w-0">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="group flex min-w-0 select-none items-center gap-2 rounded-2xl px-1.5 py-1.5 text-left transition hover:bg-[#2A3170]/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58A6A1]/45 dark:hover:bg-white/[0.07]"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[24%] transition sm:h-16 sm:w-16">
              <Image
                src="/groovara-logo-light.png"
                alt="Groovara logo"
                fill
                sizes="64px"
                className="object-cover dark:hidden"
                priority
              />
              <Image
                src="/groovara-logo-dark.png"
                alt=""
                aria-hidden="true"
                fill
                sizes="64px"
                className="hidden object-cover dark:block"
                priority
              />
            </span>

            <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="gv-brand-mark truncate text-[17px] font-semibold tracking-[0.24em] text-[#1F2860] sm:text-[24px] sm:tracking-[0.30em] lg:text-[27px] dark:text-[#B4B8C0]">
                GROOVARA
              </span>

              {APP_VERSION ? (
                <span className="shrink-0 rounded-full border border-[#58A6A1] bg-transparent px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#2D7774] transition group-hover:bg-[#58A6A1]/10 sm:px-3 sm:py-1.5 sm:text-[10px] dark:text-[#86CBC7]">
                  {APP_VERSION}
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-[#58A6A1] bg-transparent px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#2D7774] transition group-hover:bg-[#58A6A1]/10 sm:px-3 sm:py-1.5 sm:text-[10px] dark:text-[#86CBC7]">
                  
                </span>
              )}
            </span>

            <span
              aria-hidden="true"
              className="ml-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#2A3170]/15 bg-[#F0E9DA]/35 text-[#1F2860] transition group-hover:border-[#58A6A1]/45 group-hover:bg-[#58A6A1]/8 dark:border-white/10 dark:bg-white/[0.035] dark:text-[#B4B8C0]"
            >
              <span className="flex h-4 w-5 flex-col justify-between">
                <span
                  className={`h-[2px] w-5 rounded-full bg-current transition-transform ${
                    open ? "translate-y-[7px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`h-[2px] w-5 rounded-full bg-current transition-opacity ${
                    open ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`h-[2px] w-5 rounded-full bg-current transition-transform ${
                    open ? "-translate-y-[7px] -rotate-45" : ""
                  }`}
                />
              </span>
            </span>
          </button>

          {open ? (
            <div
              role="menu"
              className="fixed left-0 top-24 z-[2147483647] max-h-[calc(100dvh-6rem)] w-[min(19rem,calc(100vw-0.75rem))] overflow-y-auto rounded-br-3xl border border-[#B4B8C0] bg-[#F0E9DA]/98 p-3 text-[#1A1A23] shadow-[0_18px_42px_rgba(64,47,31,0.22)] backdrop-blur-xl sm:top-28 sm:max-h-[calc(100dvh-7rem)] dark:border-white/10 dark:bg-[#1A1A23]/95 dark:text-white dark:shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
            >
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border-[11px] border-[#2A3170]/[0.08] dark:border-[#B4B8C0]/[0.07]" />
              <div className="pointer-events-none absolute -left-14 bottom-2 h-28 w-28 rounded-full border-[9px] border-[#2A3170]/[0.055] dark:border-[#B4B8C0]/[0.045]" />

              <div className="relative py-1">
                {items.map((it, idx) => {
                  if (it.type === "divider") {
                    return (
                      <div
                        key={`div-${idx}`}
                        className="my-2 border-t border-[#2A3170]/15 dark:border-white/10"
                      />
                    );
                  }

                  if (it.type === "custom") {
                    return (
                      <div
                        key={`custom-${idx}`}
                        className="rounded-2xl px-2 py-1 text-sm text-[#1A1A23] dark:text-white
                          [&_button]:w-full
                          [&_button]:rounded-2xl
                          [&_button]:bg-transparent
                          [&_button]:px-4
                          [&_button]:py-3
                          [&_button]:text-left
                          [&_button]:text-sm
                          [&_button]:font-semibold
                          [&_button]:text-[#1A1A23]
                          [&_button]:transition
                          [&_button]:hover:bg-[#2A3170]/12
                          [&_button]:hover:text-[#1F2860]
                          dark:[&_button]:text-white/85
                          dark:[&_button]:hover:bg-white/10
                          dark:[&_button]:hover:text-white"
                      >
                        {it.node}
                      </div>
                    );
                  }

                  const active = isActive(it.href);

                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`block rounded-2xl px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58A6A1]/40 ${
                        active
                          ? "bg-[#2A3170] text-[#F0E9DA] shadow-[0_10px_26px_rgba(42,49,112,0.24)] dark:bg-[#B4B8C0]/15 dark:text-[#B4B8C0] dark:shadow-[0_10px_26px_rgba(0,0,0,0.24)]"
                          : "text-[#1A1A23] hover:bg-[#2A3170]/12 hover:text-[#1F2860] dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
                      }`}
                    >
                      <span className="block text-sm font-semibold tracking-[0.02em]">
                        {it.label}
                      </span>

                      {it.description ? (
                        <span
                          className={`mt-0.5 block text-xs leading-snug ${
                            active
                              ? "text-[#F0E9DA]/80 dark:text-[#B4B8C0]/70"
                              : "text-[#4f473e] dark:text-white/45"
                          }`}
                        >
                          {it.description}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <nav
          aria-label="Primary account actions"
          className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2.5"
        >
          <Link
            href="/discover"
            aria-current={isActive("/discover") ? "page" : undefined}
            className={`inline-flex h-10 items-center justify-center rounded-xl border px-2.5 text-[9px] font-semibold tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58A6A1]/45 sm:h-11 sm:px-4 sm:text-[11px] sm:tracking-[0.14em] ${
              isActive("/discover")
                ? "border-[#58A6A1] bg-[#58A6A1]/14 text-[#2D7774] dark:text-[#86CBC7]"
                : "border-[#58A6A1]/70 bg-transparent text-[#2D7774] hover:-translate-y-0.5 hover:bg-[#58A6A1]/10 dark:text-[#86CBC7]"
            }`}
          >
            <span className="sm:hidden">DISCOVER</span>
            <span className="hidden sm:inline">DISCOVERY</span>
          </Link>

          <Link
            href="/hub"
            aria-current={isActive("/hub") ? "page" : undefined}
            className={`inline-flex h-10 items-center justify-center rounded-xl border px-2.5 text-[9px] font-semibold tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58A6A1]/45 sm:h-11 sm:px-4 sm:text-[11px] sm:tracking-[0.14em] ${
              isActive("/hub")
                ? "border-[#58A6A1] bg-[#58A6A1]/14 text-[#2D7774] dark:text-[#86CBC7]"
                : "border-[#58A6A1]/70 bg-transparent text-[#2D7774] hover:-translate-y-0.5 hover:bg-[#58A6A1]/10 dark:text-[#86CBC7]"
            }`}
          >
            <span className="sm:hidden">STUDIO</span>
            <span className="hidden sm:inline">MY STUDIO</span>
          </Link>

          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            aria-current={isActive("/settings") ? "page" : undefined}
            className={`hidden h-10 w-10 place-items-center rounded-xl border transition sm:grid focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58A6A1]/45 sm:h-11 sm:w-11 ${
              isActive("/settings")
                ? "border-[#58A6A1] bg-[#58A6A1]/12 text-[#2D7774] dark:text-[#86CBC7]"
                : "border-[#2A3170]/20 bg-[#F0E9DA]/65 text-[#1F2860] hover:border-[#58A6A1]/55 hover:bg-[#58A6A1]/8 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#B4B8C0]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.06 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9c.17.37.47.69.84.88.25.13.53.2.82.22H21v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
            </svg>
          </Link>

          <div className="flex h-10 items-center rounded-xl border border-[#2A3170]/20 bg-[#F0E9DA]/75 px-1 shadow-[0_8px_22px_rgba(64,47,31,0.10)] sm:h-11 sm:px-1.5 dark:border-white/10 dark:bg-white/[0.04]">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
