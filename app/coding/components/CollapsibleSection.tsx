"use client";

import { useState, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: ReactNode;
  action?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, action, defaultOpen, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center justify-between py-3">
        <button
          type="button"
          className="flex items-center gap-2 text-left font-semibold hover:opacity-70 transition-opacity"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          />
          {title}
        </button>
        {action}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
