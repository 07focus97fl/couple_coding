"use client";

import { useMemo } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { codeFor, FALLBACK_COLOR } from "@/lib/category-colors";
import s from "./CategoryHistogram.module.css";

export function CategoryHistogram() {
  const { categories, allCodedUnits, categoryColorMap } = useSession();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of allCodedUnits) {
      map.set(u.category, (map.get(u.category) ?? 0) + 1);
    }
    return map;
  }, [allCodedUnits]);

  if (categories.length === 0) return null;

  const maxCount = Math.max(
    5,
    ...Array.from(counts.values()),
  );

  return (
    <div className={s.wrap}>
      <div className={s.chart}>
        {categories.map((cat) => {
          const n = counts.get(cat.name) ?? 0;
          const pct = (n / maxCount) * 100;
          const color = categoryColorMap[cat.name] ?? FALLBACK_COLOR;
          return (
            <div key={cat.name} className={s.col}>
              <div className={s.barWrap} title={`${cat.name}: ${n}`}>
                <div
                  className={s.bar}
                  style={{
                    height: `${Math.max(pct, n > 0 ? 6 : 2)}%`,
                    background: n > 0 ? color : `${color}20`,
                  }}
                />
                {n > 0 && <div className={s.count}>{n}</div>}
              </div>
              <div className={s.label}>{codeFor(cat.name)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
