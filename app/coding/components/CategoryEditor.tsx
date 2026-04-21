"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryDefinition } from "@/lib/types";
import { X } from "lucide-react";

interface CategoryEditorProps {
  categories: CategoryDefinition[];
  onChange: (cats: CategoryDefinition[]) => void;
}

export function CategoryEditor({ categories, onChange }: CategoryEditorProps) {
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
