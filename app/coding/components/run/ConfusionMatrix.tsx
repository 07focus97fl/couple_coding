"use client";
/**
 * WHAT:    Human-vs-model confusion table for CSV-origin conversations: one row
 *          per human code, one column per model code, counts in the cells, the
 *          diagonal (agreement) highlighted, and row totals.
 * STEP:    Run.
 * RUNS ON: client
 */

import type { Agreement } from "@/lib/results/agreement";
import type { CategoryDefinition } from "@/lib/types";
import s from "./ConfusionMatrix.module.css";

/** The scheme's codes in scheme order, then any other code that appeared. */
function codeOrder(agreement: Agreement, categories: CategoryDefinition[]): string[] {
  const order: string[] = [];
  const push = (c: string) => {
    if (c !== "" && !order.includes(c)) order.push(c);
  };
  for (const c of categories) push(c.name.trim());
  for (const [h, row] of Object.entries(agreement.confusion)) {
    push(h);
    for (const m of Object.keys(row)) push(m);
  }
  return order;
}

export function ConfusionMatrix({
  agreement,
  categories,
}: {
  agreement: Agreement;
  categories: CategoryDefinition[];
}) {
  if (agreement.n === 0) return null;
  const codes = codeOrder(agreement, categories);
  const rowTotal = (h: string) =>
    Object.values(agreement.confusion[h] ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className={s.wrap}>
      <div className={s.title}>
        Human code (rows) vs model code (columns) · {agreement.n} compared ·{" "}
        {agreement.pct.toFixed(1)}% agree
      </div>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.corner}>human \ model</th>
              {codes.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th className={s.total}>n</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((h) => (
              <tr key={h}>
                <th>{h}</th>
                {codes.map((m) => {
                  const v = agreement.confusion[h]?.[m] ?? 0;
                  return (
                    <td
                      key={m}
                      className={h === m ? s.diag : v > 0 ? s.off : ""}
                    >
                      {v > 0 ? v : ""}
                    </td>
                  );
                })}
                <td className={s.total}>{rowTotal(h) || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.note}>
        Turns with no human code and rows the model could not code are left out.
      </div>
    </div>
  );
}
