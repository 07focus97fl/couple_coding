"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { scrollToSection } from "../../hooks/useScrollSpy";
import { SECTION_IDS } from "../../hooks/useCodingSession";
import s from "./StickyHeader.module.css";

const PILLS: { id: (typeof SECTION_IDS)[number] | string; n: string; label: string }[] = [
  { id: "s-upload", n: "01", label: "Upload" },
  { id: "s-model", n: "02", label: "Model" },
  { id: "s-scheme", n: "03", label: "Scheme" },
  { id: "s-run", n: "04", label: "Run" },
];

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function StickyHeader() {
  const ref = useRef<HTMLElement>(null);
  const {
    activeSectionId,
    apiKey,
    devSignedIn,
    setTweaksOpen,
  } = useSession();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.offsetHeight}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const keyLinked = apiKey !== "" || devSignedIn;

  return (
    <header ref={ref} className={s.header}>
      <div className={s.inner}>
        <Link href="/" className={s.brand}>
          <span className={s.monogram}>
            ccc<span className={s.monogramDot}>.</span>
          </span>
          <span className={s.wordmark}>Couple Conversation Coder</span>
        </Link>

        <nav className={s.nav}>
          {PILLS.map((p) => {
            const active = activeSectionId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => scrollToSection(p.id)}
                className={`${s.pill} ${active ? s.pillActive : ""}`}
              >
                <span className={`${s.pillDot} ${active ? s.pillDotActive : ""}`} />
                <span className={s.pillNumber}>{p.n}</span>
                <span className={s.pillLabel}>{p.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.right}>
          <span className={s.meta}>Marital Lab</span>
          <span className={s.metaDot}>·</span>
          <span className={s.meta}>Wave 3</span>
          <span className={s.metaDot}>·</span>
          <span className={s.keyChip}>
            <span
              className={`${s.keyDot} ${keyLinked ? s.keyDotOk : s.keyDotNone}`}
            />
            {keyLinked ? "Key linked" : "No key"}
          </span>
          <button
            type="button"
            onClick={() => setTweaksOpen(true)}
            className={s.tweaksBtn}
            aria-label="Tweaks"
          >
            <GearIcon />
            <span>Tweaks</span>
          </button>
          <div className={s.avatar} aria-hidden>
            MS
          </div>
        </div>
      </div>
    </header>
  );
}
