"use client";
/**
 * WHAT:    The sticky top bar with the wordmark; publishes its own height as the
 *          --header-h CSS variable for the rail and scroll-spy.
 * STEP:    Page chrome.
 * RUNS ON: client
 */

import Link from "next/link";
import { useEffect, useRef } from "react";
import s from "./StickyHeader.module.css";

export function StickyHeader() {
  const ref = useRef<HTMLElement>(null);

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

  return (
    <header ref={ref} className={s.header}>
      <div className={s.inner}>
        <Link href="/" className={s.brand}>
          <span className={s.monogram}>
            ccc<span className={s.monogramDot}>.</span>
          </span>
          <span className={s.wordmark}>Couple Conversation Coder</span>
        </Link>

        <div className={s.right}>
          <div className={s.avatar} aria-hidden>
            MS
          </div>
        </div>
      </div>
    </header>
  );
}
