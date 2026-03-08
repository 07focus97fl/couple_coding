"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CODING_SCHEMES } from "@/lib/coding-schemes";

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
            Open Tool
          </Link>
        </nav>

        {/* Hero */}
        <section className="pt-20 pb-24">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400 mb-6">
            For Relationships Researchers
          </p>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.08] mb-6 max-w-2xl">
            Couple{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Conversation
            </span>{" "}
            Coder
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg leading-relaxed mb-10">
            Automate behavioral coding of dyadic conversation transcripts.
            Apply validated coding schemes — or define your own — and get
            category assignments with transparent rationale for every speaking
            turn.
          </p>

          <div className="flex items-center gap-4 mb-8">
            <Link href="/coding" className={buttonVariants({ size: "lg", className: "px-8 text-base" })}>
              Get started
            </Link>
            <span className="text-xs text-muted-foreground">
              Bring your own Anthropic API key
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Valence</Badge>
            <Badge variant="secondary">SPAFF — coming soon</Badge>
            <Badge variant="secondary">RCISS — coming soon</Badge>
            <Badge variant="secondary">CIRS — coming soon</Badge>
            <Badge variant="default">Custom</Badge>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Problem Statement */}
        <section className="py-20 max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground leading-relaxed mb-4">
            Manual behavioral coding is the gold standard in relationships
            research, but it&apos;s slow, expensive, and hard to scale. A
            trained coder might spend 3&ndash;5x real-time on a single
            conversation.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            CCC gives you LLM-based coding with a written rationale for every
            decision, so you can audit, compare, and validate against human
            coders.
          </p>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* How It Works */}
        <section className="py-20">
          <h2 className="text-2xl font-bold tracking-tight mb-10 text-center">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-mono font-bold">
                    1
                  </div>
                  <CardTitle>Upload Transcript</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Drop in a word-level JSON transcript (e.g., from AssemblyAI or
                  Rev). Speaker turns are automatically parsed from raw
                  word-level timing data — no manual segmentation needed.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-sm font-mono font-bold">
                    2
                  </div>
                  <CardTitle>Configure Coding Scheme</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Select a validated scheme (Valence, SPAFF, RCISS, CIRS) or
                  define your own categories. Every category has an editable name
                  and description that becomes part of the AI prompt — you
                  control exactly what each code means.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-mono font-bold">
                    3
                  </div>
                  <CardTitle>Code with Conversational Context</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Each turn is coded individually with a configurable context
                  window of up to 20 prior turns. The model accounts for
                  conversational dynamics — a response that sounds neutral in
                  isolation might be dismissive given what came before.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gradient-to-br from-amber-500/10 to-rose-500/10 text-orange-600 dark:text-orange-400 text-sm font-mono font-bold">
                    4
                  </div>
                  <CardTitle>Export with Rationale</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Download coded data as CSV with column control and speaker
                  filtering. Every turn includes the assigned category AND a
                  written rationale — making results auditable and comparable to
                  human coding notes.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Coding Schemes */}
        <section className="py-20">
          <h2 className="text-2xl font-bold tracking-tight mb-10 text-center">
            Coding Schemes
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CODING_SCHEMES.filter((s) => s.id !== "custom").map((scheme) => (
              <Card key={scheme.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{scheme.label}</CardTitle>
                    <Badge variant={scheme.comingSoon ? "secondary" : "default"}>
                      {scheme.comingSoon ? "Coming Soon" : "Available"}
                    </Badge>
                  </div>
                  <CardDescription>{scheme.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Custom</CardTitle>
                  <Badge variant="default">Available</Badge>
                </div>
                <CardDescription>
                  Define your own categories with names and descriptions. Each
                  category definition becomes part of the AI prompt, giving you
                  full control over what gets coded and how.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Technical Details */}
        <section className="py-20">
          <h2 className="text-2xl font-bold tracking-tight mb-10 text-center">
            Technical Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-10">
            <div>
              <h3 className="font-semibold tracking-tight mb-4">
                How coding works
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <li>Uses Claude (Anthropic) with multiple model options</li>
                <li>
                  Structured tool-use calls constrain output to valid category
                  names
                </li>
                <li>Configurable context window (0&ndash;20 prior turns)</li>
                <li>
                  Rationale generated alongside each category assignment
                </li>
                <li>Results stream in real-time</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold tracking-tight mb-4">
                For your methods section
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <li>
                  Input: Word-level JSON with speaker IDs and timestamps
                </li>
                <li>
                  Turn segmentation: Automatic, based on speaker ID changes
                </li>
                <li>
                  Output: CSV with turn number, speaker, text, word count,
                  start/end time, category, rationale
                </li>
                <li>
                  All category definitions are included in the prompt (fully
                  reportable)
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Bottom CTA */}
        <section className="py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Start Coding in Minutes, Not Days
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            Upload a transcript, pick a scheme, and get coded data with
            rationale. Bring your own Anthropic API key.
          </p>
          <Link href="/coding" className={buttonVariants({ size: "lg", className: "px-8 text-base" })}>
            Open the Coder
          </Link>
          <p className="text-xs text-muted-foreground mt-4">
            Powered by Claude (Anthropic)
          </p>
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
