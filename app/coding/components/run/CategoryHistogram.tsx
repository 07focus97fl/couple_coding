"use client";

import { useMemo } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { codeFor, FALLBACK_COLOR } from "@/lib/category-colors";
import type { CodedUnit } from "@/lib/types";
import s from "./CategoryHistogram.module.css";

export function CategoryHistogram({ units }: { units?: CodedUnit[] }) {
  const { categories, allCodedUnits, categoryColorMap, outputType, scale } =
    useSession();
  const data = units ?? allCodedUnits;
  const isContinuous = outputType === "continuous";

  const { counts, sum, cnt } = useMemo(() => {
    const counts = new Map<string, number>();
    const sum = new Map<string, number>();
    const cnt = new Map<string, number>();
    for (const u of data) {
      if (u.category !== undefined) {
        counts.set(u.category, (counts.get(u.category) ?? 0) + 1);
      }
      if (u.ratings) {
        for (const [dim, v] of Object.entries(u.ratings)) {
          sum.set(dim, (sum.get(dim) ?? 0) + v);
          cnt.set(dim, (cnt.get(dim) ?? 0) + 1);
        }
      }
    }
    return { counts, sum, cnt };
  }, [data]);

  if (categories.length === 0) return null;

  // Continuous: each bar is the mean rating for that dimension, normalized to scale.
  if (isContinuous) {
    const span = scale.max - scale.min || 1;
    return (
      <div className={s.wrap}>
        <div className={s.chart}>
          {categories.map((cat) => {
            const n = cnt.get(cat.name) ?? 0;
            const mean = n > 0 ? sum.get(cat.name)! / n : 0;
            const pct = n > 0 ? ((mean - scale.min) / span) * 100 : 0;
            const color = categoryColorMap[cat.name] ?? FALLBACK_COLOR;
            return (
              <div key={cat.name} className={s.col}>
                <div
                  className={s.barWrap}
                  title={`${cat.name}: mean ${mean.toFixed(2)} (n=${n})`}
                >
                  <div
                    className={s.bar}
                    style={{
                      height: `${Math.max(pct, n > 0 ? 6 : 2)}%`,
                      background: n > 0 ? color : `${color}20`,
                    }}
                  />
                  {n > 0 && <div className={s.count}>{mean.toFixed(1)}</div>}
                </div>
                <div className={s.label}>{codeFor(cat.name)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Categorical: count per category.
  const maxCount = Math.max(5, ...Array.from(counts.values()));
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
