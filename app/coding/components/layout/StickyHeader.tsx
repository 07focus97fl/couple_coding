"use client";

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
