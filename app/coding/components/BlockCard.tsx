"use client";

import { ReactNode, useState } from "react";
import s from "./prompt-blocks.module.css";

interface BlockCardProps {
  label: string;
  title: string;
  description?: string;
  dirty: boolean;
  onReset?: () => void;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
}

export function BlockCard({
  label,
  title,
  description,
  dirty,
  onReset,
  defaultOpen = true,
  collapsible = true,
  children,
}: BlockCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const headerBody = (
    <div className={s.cardHeaderRow}>
      <div className={s.cardHeader}>
        {collapsible && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${s.cardChevron} ${open ? s.cardChevronOpen : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        <span className={s.cardLabel}>{label}</span>
        <span className={s.cardTitle}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span className={`${s.chip} ${dirty ? s.chipEdited : s.chipDefault}`}>
          {dirty ? "edited" : "default"}
        </span>
        {dirty && onReset && (
          <button
            type="button"
            className={s.resetLink}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={s.card}>
      {collapsible ? (
        <div onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer" }}>
          {headerBody}
        </div>
      ) : (
        headerBody
      )}
      {description && <div className={s.cardDesc}>{description}</div>}
      {(!collapsible || open) && <div className={s.cardBody}>{children}</div>}
    </div>
  );
}
