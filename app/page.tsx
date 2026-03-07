"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      {/* Top accent line */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-[0.07]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 blur-[120px]" />
      </div>

      {/* Diagonal decorative line */}
      <div className="pointer-events-none absolute top-32 right-0 w-px h-[400px] bg-gradient-to-b from-transparent via-amber-500/20 to-transparent rotate-[20deg] origin-top" />

      <div className="relative max-w-4xl mx-auto px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between py-8">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-500 to-rose-500" />
            <span className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              CCC
            </span>
          </div>
          <Link href="/coding" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
        </nav>

        {/* Hero */}
        <section className="pt-20 pb-24">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400 mb-6">
            Research Tool
          </p>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.08] mb-6 max-w-2xl">
            Couple{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Conversation
            </span>{" "}
            Coder
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg leading-relaxed mb-10">
            Turn word-level couple transcripts into coded behavioral data.
            Upload, run AI-powered analysis, and export publication-ready
            results in minutes, not hours.
          </p>

          <div className="flex items-center gap-4">
            <Link href="/coding" className={buttonVariants({ size: "lg", className: "px-8 text-base" })}>
              Get started
            </Link>
            <span className="text-xs text-muted-foreground">
              No account required
            </span>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Features */}
        <section className="py-20">
          <div className="grid sm:grid-cols-3 gap-12 sm:gap-8">
            <div className="group">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-mono font-bold">
                  1
                </div>
                <h3 className="font-semibold tracking-tight">Upload</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                Drop in a word-level JSON transcript. Speaker turns are
                automatically parsed and segmented from raw timing data.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-sm font-mono font-bold">
                  2
                </div>
                <h3 className="font-semibold tracking-tight">Code</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                Claude analyzes each speaking turn against your coding scheme.
                Watch results stream in with real-time progress tracking.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-mono font-bold">
                  3
                </div>
                <h3 className="font-semibold tracking-tight">Export</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                Download coded data as CSV. Configure visible columns, filter
                by speaker, and adjust thresholds to fit your study design.
              </p>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Bottom CTA */}
        <section className="py-20 text-center">
          <p className="text-sm text-muted-foreground mb-6">
            Built for relationship researchers. Powered by Claude.
          </p>
          <Link href="/coding" className={buttonVariants({ variant: "outline", size: "lg", className: "px-8" })}>
            Start coding transcripts
          </Link>
        </section>

        {/* Footer */}
        <footer className="pb-10 pt-4">
          <div className="h-px bg-border mb-6" />
          <p className="text-xs text-muted-foreground text-center">
            Couple Conversation Coder
          </p>
        </footer>
      </div>
    </div>
  );
}
