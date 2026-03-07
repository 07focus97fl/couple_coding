"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { CodedTurn, ColumnKey, COLUMN_DEFINITIONS } from "@/lib/types";
import { ExportDialog } from "./ExportDialog";

interface ResultsTableProps {
  codedTurns: CodedTurn[];
}

const COLUMN_WIDTHS: Partial<Record<ColumnKey, string>> = {
  turnNumber: "w-16",
  speaker: "w-28",
  wordCount: "w-20 text-right",
  category: "w-32",
  rationale: "w-48",
  startTime: "w-24 text-right",
  endTime: "w-24 text-right",
};

function categoryVariant(category: string): "default" | "destructive" | "secondary" {
  const lower = category.toLowerCase();
  if (lower === "positive") return "default";
  if (lower === "negative") return "destructive";
  return "secondary";
}

function renderCell(turn: CodedTurn, key: ColumnKey) {
  switch (key) {
    case "turnNumber":
      return <span className="font-mono text-sm">{turn.turnNumber}</span>;
    case "speaker":
      return <span className="font-medium">{turn.speaker}</span>;
    case "text":
      return (
        <TooltipRoot>
          <TooltipTrigger className="max-w-md truncate text-sm text-left">
            {turn.text}
          </TooltipTrigger>
          <TooltipContent>{turn.text}</TooltipContent>
        </TooltipRoot>
      );
    case "wordCount":
      return <span className="font-mono text-sm">{turn.wordCount}</span>;
    case "category":
      return (
        <Badge variant={categoryVariant(turn.category)}>
          {turn.category}
        </Badge>
      );
    case "rationale":
      return (
        <TooltipRoot>
          <TooltipTrigger className="max-w-[12rem] truncate text-sm text-left">
            {turn.rationale}
          </TooltipTrigger>
          <TooltipContent>{turn.rationale}</TooltipContent>
        </TooltipRoot>
      );
    case "startTime":
      return <span className="font-mono text-sm">{turn.startTime.toFixed(2)}</span>;
    case "endTime":
      return <span className="font-mono text-sm">{turn.endTime.toFixed(2)}</span>;
  }
}

export function ResultsTable({ codedTurns }: ResultsTableProps) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Results{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({codedTurns.length} turns)
            </span>
          </h2>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            Export CSV
          </Button>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {COLUMN_DEFINITIONS.map((col) => (
                  <TableHead key={col.key} className={COLUMN_WIDTHS[col.key] || ""}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {codedTurns.map((turn) => (
                <TableRow key={turn.turnNumber}>
                  {COLUMN_DEFINITIONS.map((col) => (
                    <TableCell
                      key={col.key}
                      className={col.key === "text" ? "max-w-md truncate" : ""}
                    >
                      {renderCell(turn, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} codedTurns={codedTurns} />
      </div>
    </TooltipProvider>
  );
}
