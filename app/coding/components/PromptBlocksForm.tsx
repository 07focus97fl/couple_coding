"use client";

import {
  CategoryDefinition,
  CodingScheme,
  Granularity,
  PromptBlockKey,
  PromptBlocks,
  PromptBlockDirty,
} from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { CategoryEditor } from "./CategoryEditor";
import { ContextFramingEditor } from "./ContextFramingEditor";
import { GranularityToggle } from "./GranularityToggle";
import { OutputInstructionEditor } from "./OutputInstructionEditor";
import { RoleEditor } from "./RoleEditor";
import { RulesEditor } from "./RulesEditor";

interface PromptBlocksFormProps {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  scheme: CodingScheme | null;
  categories: CategoryDefinition[];
  onCategoriesChange: (cats: CategoryDefinition[]) => void;
  blocks: PromptBlocks;
  dirty: PromptBlockDirty;
  onBlockChange: (key: PromptBlockKey, value: string) => void;
  onBlockReset: (key: PromptBlockKey) => void;
  categoriesDirty: boolean;
  onCategoriesReset: () => void;
  disabled?: boolean;
}

export function PromptBlocksForm({
  granularity,
  onGranularityChange,
  scheme,
  categories,
  onCategoriesChange,
  blocks,
  dirty,
  onBlockChange,
  onBlockReset,
  categoriesDirty,
  onCategoriesReset,
  disabled,
}: PromptBlocksFormProps) {
  const rulesWarning =
    scheme?.authoredFor === "turn" && granularity === "utterance";

  return (
    <div style={{ opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <BlockCard
        label="GRANULARITY"
        title="How each turn is coded"
        description="Controls whether the model assigns one code per turn or segments each turn into multiple coded utterances."
        dirty={false}
        defaultOpen={true}
        collapsible={true}
      >
        <GranularityToggle value={granularity} onChange={onGranularityChange} />
      </BlockCard>

      <BlockCard
        label="ROLE"
        title="Who the model is pretending to be"
        description="The first line of the system prompt. Rarely needs editing."
        dirty={dirty.role}
        onReset={() => onBlockReset("role")}
        defaultOpen={false}
      >
        <RoleEditor
          value={blocks.role}
          onChange={(v) => onBlockChange("role", v)}
        />
      </BlockCard>

      <BlockCard
        label="TASK"
        title="Task framing for the chosen granularity"
        description="Tells the model what to do with each turn. Regenerates automatically when you flip granularity, unless you've edited it."
        dirty={dirty.granularity}
        onReset={() => onBlockReset("granularity")}
        defaultOpen={false}
      >
        <textarea
          value={blocks.granularity}
          onChange={(e) => onBlockChange("granularity", e.target.value)}
          rows={5}
          spellCheck={false}
          style={{
            width: "100%",
            border: "1.5px solid #e8e4de",
            borderRadius: 8,
            padding: "0.65rem 0.8rem",
            fontFamily: "var(--sans)",
            fontSize: "0.85rem",
            lineHeight: 1.55,
            background: "#fafaf7",
            resize: "vertical",
            minHeight: 80,
          }}
        />
      </BlockCard>

      <BlockCard
        label="CATEGORIES"
        title="The codes the model can choose from"
        description="Names + definitions. These become the tool's enum values and the bullet list in the system prompt."
        dirty={categoriesDirty}
        onReset={onCategoriesDirty(categoriesDirty, onCategoriesReset)}
        defaultOpen={true}
      >
        <CategoryEditor categories={categories} onChange={onCategoriesChange} />
      </BlockCard>

      <BlockCard
        label="RULES"
        title="Precedence, tie-breaking, and context rules"
        description="Free-form guidance the model applies on top of category definitions. Leave empty if the scheme doesn't need any."
        dirty={dirty.rules}
        onReset={() => onBlockReset("rules")}
        defaultOpen={false}
      >
        <RulesEditor
          value={blocks.rules}
          onChange={(v) => onBlockChange("rules", v)}
          showAuthoredForTurnWarning={rulesWarning}
        />
      </BlockCard>

      <BlockCard
        label="CONTEXT FRAMING"
        title="How to use prior turns"
        description="Tells the model what to do with the conversation context before the target turn."
        dirty={dirty.contextFraming}
        onReset={() => onBlockReset("contextFraming")}
        defaultOpen={false}
      >
        <ContextFramingEditor
          value={blocks.contextFraming}
          onChange={(v) => onBlockChange("contextFraming", v)}
        />
      </BlockCard>

      <BlockCard
        label="OUTPUT INSTRUCTION"
        title="How the tool output should be shaped"
        description="Tells the model how to format its code_exchange tool output. Rarely needs editing."
        dirty={dirty.outputInstruction}
        onReset={() => onBlockReset("outputInstruction")}
        defaultOpen={false}
      >
        <OutputInstructionEditor
          value={blocks.outputInstruction}
          onChange={(v) => onBlockChange("outputInstruction", v)}
        />
      </BlockCard>
    </div>
  );
}

function onCategoriesDirty(
  dirty: boolean,
  handler: () => void
): (() => void) | undefined {
  return dirty ? handler : undefined;
}
