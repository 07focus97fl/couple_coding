"use client";

import { CODING_SCHEMES, CategoryDefinition } from "@/lib/types";
import { CategoryEditor } from "./CategoryEditor";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CodingSchemeSelectorProps {
  schemeId: string | null;
  onSchemeChange: (id: string) => void;
  categories: CategoryDefinition[];
  onCategoriesChange: (cats: CategoryDefinition[]) => void;
}

export function CodingSchemeSelector({
  schemeId,
  onSchemeChange,
  categories,
  onCategoriesChange,
}: CodingSchemeSelectorProps) {
  const activeScheme = CODING_SCHEMES.find((s) => s.id === schemeId);

  return (
    <div className="space-y-4">
      <Select
        value={schemeId ?? ""}
        onValueChange={(v) => {
          if (v) onSchemeChange(v);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a coding scheme..." />
        </SelectTrigger>
        <SelectContent>
          {CODING_SCHEMES.map((scheme) => (
            <SelectItem
              key={scheme.id}
              value={scheme.id}
              disabled={!!scheme.comingSoon}
            >
              <span className="flex items-center gap-2">
                {scheme.label}
                {scheme.comingSoon && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Coming soon
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show editable categories for any non-coming-soon scheme */}
      {activeScheme && !activeScheme.comingSoon && (
        <CategoryEditor categories={categories} onChange={onCategoriesChange} />
      )}
    </div>
  );
}
