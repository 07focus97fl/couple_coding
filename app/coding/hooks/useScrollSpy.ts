"use client";

import { useEffect, useState } from "react";

function readHeaderHeight(): number {
  if (typeof document === "undefined") return 72;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--header-h")
    .trim();
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

export function useScrollSpy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const idsKey = ids.join(",");

  useEffect(() => {
    const headerH = readHeaderHeight();
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        rootMargin: `-${headerH + 8}px 0px -60% 0px`,
        threshold: 0,
      },
    );

    for (const id of idsKey.split(",")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [idsKey]);

  return active;
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
