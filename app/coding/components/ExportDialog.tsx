"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CodedTurn,
  ColumnKey,
  SpeakerFilter,
  ExportConfig,
  DEFAULT_EXPORT_CONFIG,
  COLUMN_DEFINITIONS,
} from "@/lib/types";
import { generateCsv, dimsFromUnits } from "@/lib/generate-csv";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codedTurns: CodedTurn[];
}

export function ExportDialog({ open, onOpenChange, codedTurns }: ExportDialogProps) {
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);

  const dims = dimsFromUnits(codedTurns);
  const isContinuous = !!dims;
  const hasTimeWindows = codedTurns.some((u) => u.kind === "time");
  const columnDefs = isContinuous
    ? COLUMN_DEFINITIONS.filter(
        (c) =>
          c.key !== "category" &&
          c.key !== "subcategory" &&
          c.key !== "alternativesConsidered",
      )
    : COLUMN_DEFINITIONS;

  const handleColumnToggle = (key: ColumnKey, checked: boolean) => {
    const visibleColumns = checked
      ? [...config.visibleColumns, key]
      : config.visibleColumns.filter((k) => k !== key);
    if (visibleColumns.length > 0) {
      setConfig({ ...config, visibleColumns });
    }
  };

  const handleSpeakerFilter = (value: SpeakerFilter) => {
    setConfig({ ...config, speakerFilter: value });
  };

  const handleExport = () => {
    const filtered =
      config.speakerFilter === "all"
        ? codedTurns
        : codedTurns.filter((t) => t.speaker === config.speakerFilter);

    const csv = generateCsv(filtered, config.visibleColumns, dims);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coded_turns.csv";
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Visible Columns */}
          <div className="space-y-3">
            <Label>Visible Columns</Label>
            <div className="grid grid-cols-2 gap-2">
              {columnDefs.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-col-${col.key}`}
                    checked={config.visibleColumns.includes(col.key)}
                    onCheckedChange={(checked) =>
                      handleColumnToggle(col.key, checked === true)
                    }
                  />
                  <Label htmlFor={`export-col-${col.key}`} className="text-sm font-normal">
                    {col.csvHeader}
                  </Label>
                </div>
              ))}
            </div>
            {isContinuous && (
              <p className="text-xs text-muted-foreground">
                Plus one <code>rating_*</code> column per rated behavior.
              </p>
            )}
          </div>

          {/* Speaker Filter — not meaningful for multi-speaker time windows */}
          {!hasTimeWindows && (
            <div className="space-y-2">
              <Label>Speaker Filter</Label>
              <Select
                value={config.speakerFilter}
                onValueChange={(v) => { if (v) handleSpeakerFilter(v as SpeakerFilter); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Speakers</SelectItem>
                  <SelectItem value="speaker_0">Speaker 0 only</SelectItem>
                  <SelectItem value="speaker_1">Speaker 1 only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={handleExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
