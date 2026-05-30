"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import s from "./StickyHeader.module.css";

function LogOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function StickyHeader() {
  const ref = useRef<HTMLElement>(null);
  const { devSignedIn, handleDevSignOut } = useSession();

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
          {devSignedIn && (
            <button
              type="button"
              onClick={handleDevSignOut}
              className={s.signOutBtn}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOutIcon />
            </button>
          )}
          <div className={s.avatar} aria-hidden>
            MS
          </div>
        </div>
      </div>
    </header>
  );
}
