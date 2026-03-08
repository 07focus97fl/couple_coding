"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "./ExportDialog";
import { CodedTurn } from "@/lib/types";

interface ExportButtonProps {
  codedTurns: CodedTurn[];
}

export function ExportButton({ codedTurns }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Export CSV
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} codedTurns={codedTurns} />
    </>
  );
}
