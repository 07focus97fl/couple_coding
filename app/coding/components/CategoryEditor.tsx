"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryDefinition } from "@/lib/types";
import { X } from "lucide-react";

interface CategoryEditorProps {
  categories: CategoryDefinition[];
  onChange: (cats: CategoryDefinition[]) => void;
  rules?: string;
  onRulesChange?: (rules: string) => void;
}

export function CategoryEditor({ categories, onChange, rules, onRulesChange }: CategoryEditorProps) {
  function updateCategory(index: number, field: keyof CategoryDefinition, value: string) {
    const updated = categories.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    onChange(updated);
  }

  function removeCategory(index: number) {
    onChange(categories.filter((_, i) => i !== index));
  }

  function addCategory() {
    onChange([...categories, { name: "", description: "" }]);
  }

  return (
    <div className="space-y-3">
      {onRulesChange !== undefined && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Coding rules (optional)
          </label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="E.g., precedence hierarchy, context rules, edge cases..."
            value={rules ?? ""}
            onChange={(e) => onRulesChange(e.target.value)}
          />
        </div>
      )}
      <label className="text-sm font-medium text-muted-foreground">
        Categories
      </label>
      {categories.map((cat, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 space-y-1.5">
            <Input
              placeholder="Category name"
              value={cat.name}
              onChange={(e) => updateCategory(i, "name", e.target.value)}
            />
            <Input
              placeholder="Description / definition"
              value={cat.description}
              onChange={(e) => updateCategory(i, "description", e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            disabled={categories.length <= 2}
            onClick={() => removeCategory(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addCategory}>
        Add Category
      </Button>
    </div>
  );
}
