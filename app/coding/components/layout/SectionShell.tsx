"use client";

import { ReactNode, useState } from "react";
import s from "./SectionShell.module.css";

export type SectionState = "idle" | "active" | "done";

interface SectionShellProps {
  id: string;
  number: string;
  label: string;
  title: string;
  description: string;
  cardTitle: string;
  cardMeta?: string;
  state?: SectionState;
  circleKind?: "default" | "accent";
  defaultOpen?: boolean;
  headAction?: ReactNode;
  children: ReactNode;
}

function CheckSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8l3.5 3.5L13 5"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronSvg({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={open ? s.chevronOpen : s.chevron}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SectionShell({
  id,
  number,
  label,
  title,
  description,
  cardTitle,
  cardMeta,
  state = "idle",
  circleKind = "default",
  defaultOpen = true,
  headAction,
  children,
}: SectionShellProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className={s.section}>
      <div className={s.eyebrow}>
        {number}
        <span className={s.eyebrowDot}> · </span>
        {label}
      </div>
      <h2 className={s.title}>{title}</h2>
      <p className={s.description}>{description}</p>
      <div className={s.card}>
        <div className={`${s.cardHead} ${!open ? s.cardHeadClosed : ""}`}>
          <div
            className={s.circle}
            data-state={state}
            data-kind={circleKind}
          >
            {state === "done" ? <CheckSvg /> : number.replace(/^0/, "")}
          </div>
          <div className={s.cardTitle}>{cardTitle}</div>
          {cardMeta && <div className={s.cardMeta}>{cardMeta}</div>}
          <div className={s.cardHeadRight}>
            {headAction}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={s.chevronBtn}
              aria-label={open ? "Collapse" : "Expand"}
            >
              <ChevronSvg open={open} />
            </button>
          </div>
        </div>
        {open && <div className={s.cardBody}>{children}</div>}
      </div>
    </section>
  );
}
