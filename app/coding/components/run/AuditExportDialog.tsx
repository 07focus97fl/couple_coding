"use client";
/**
 * WHAT:    Modal for the audit export of CSV-origin conversations: one choice
 *          (include the full prompts and raw responses, or keep the file slim),
 *          a note on what the file holds, and the download button.
 * STEP:    Run.
 * RUNS ON: client
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSession } from "../../hooks/CodingSessionContext";

interface AuditExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditExportDialog({ open, onOpenChange }: AuditExportDialogProps) {
  const { exportAuditCsv, runConfig } = useSession();
  const [includeBulky, setIncludeBulky] = useState(true);

  const handleExport = () => {
    exportAuditCsv(includeBulky);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export audit CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
          <p className="text-muted-foreground">
            Your uploaded file, every column kept, with one row per coded unit
            and these columns appended: the model&apos;s code, subcategory,
            rationale and alternatives; an <code>agree</code> flag against the
            human code; the run id, model, scheme, mode, context and prompt
            flags; the model&apos;s prices, the run&apos;s call count and total
            cost; and for each row the exact tokens and cost of the API call
            that produced it.
            {runConfig ? (
              <>
                {" "}
                Run <code>{runConfig.runId}</code> · {runConfig.modelName || runConfig.modelId}.
              </>
            ) : null}
          </p>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="audit-include-bulky"
              checked={includeBulky}
              onCheckedChange={(checked) => setIncludeBulky(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="audit-include-bulky" className="font-normal">
                Include full prompts and raw responses
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds the final system prompt, the user message with its context
                turns, the tool schema and the raw provider response to every
                row. Needed to audit exactly what the model saw; makes the file
                large (tens of MB for a couple of thousand turns).
              </p>
            </div>
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={handleExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
