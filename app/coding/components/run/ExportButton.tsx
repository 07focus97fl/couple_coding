"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "./ExportDialog";
import { CodedUnit } from "@/lib/types";

interface ExportButtonProps {
  codedUnits: CodedUnit[];
}

export function ExportButton({ codedUnits }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Export CSV
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} codedUnits={codedUnits} />
    </>
  );
}
