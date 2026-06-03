export type ProviderId = "anthropic" | "openai" | "google";

// Reasoning effort levels (OpenAI GPT-5.x). "none" favors latency; higher levels
// spend more thinking tokens (billed as output). Matches OpenAI's reasoning_effort.
export type ReasoningLevel = "none" | "low" | "medium" | "high";
export const REASONING_LEVELS: ReasoningLevel[] = ["none", "low", "medium", "high"];
export const DEFAULT_REASONING_LEVEL: ReasoningLevel = "medium";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  /** Optional discounted rate for cache-read (cached prompt) tokens; falls back to inputPer1M. */
  cacheReadPer1M?: number;
  /** Optional rate for cache-write tokens (Anthropic cache creation); falls back to inputPer1M. */
  cacheWritePer1M?: number;
}

export interface ModelDef {
  id: string;
  name: string;
  provider: ProviderId;
  pricing: ModelPricing | null;
  comingSoon: boolean;
  // True when the model exposes a selectable reasoning effort (OpenAI GPT-5.x).
  reasoning?: boolean;
}

export interface ProviderDef {
  id: ProviderId;
  name: string;
  accent: string;
  comingSoon: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  { id: "anthropic", name: "Anthropic", accent: "#c45d3e", comingSoon: false },
  { id: "openai", name: "OpenAI", accent: "#10a37f", comingSoon: false },
  { id: "google", name: "Google", accent: "#4285f4", comingSoon: false },
];

// Model catalog — the single source of truth for which models the app offers and
// sends to providers. IDs and pricing move fast (OpenAI/Google ship ~weekly), so
// re-verify against each provider's docs when adding/updating entries. Every
// non-`comingSoon` model MUST have a provider adapter wired in lib/llm.
// Pricing is USD per 1M tokens (input / output), re-verified 2026-06-01 against
// each provider's published rates.
export const MODELS: ModelDef[] = [
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    pricing: { inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
    comingSoon: false,
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "anthropic",
    pricing: { inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
    comingSoon: false,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    pricing: { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
    comingSoon: false,
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    pricing: { inputPer1M: 1, outputPer1M: 5, cacheReadPer1M: 0.1, cacheWritePer1M: 1.25 },
    comingSoon: false,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "openai",
    pricing: { inputPer1M: 5, outputPer1M: 30 },
    comingSoon: false,
    reasoning: true,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    pricing: { inputPer1M: 2.5, outputPer1M: 15 },
    comingSoon: false,
    reasoning: true,
  },
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4-mini",
    provider: "openai",
    pricing: { inputPer1M: 0.75, outputPer1M: 4.5 },
    comingSoon: false,
    reasoning: true,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    pricing: { inputPer1M: 2, outputPer1M: 8 },
    comingSoon: false,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    pricing: { inputPer1M: 2, outputPer1M: 12 },
    comingSoon: false,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    pricing: { inputPer1M: 1.5, outputPer1M: 9 },
    comingSoon: false,
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    pricing: { inputPer1M: 0.5, outputPer1M: 3 },
    comingSoon: false,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite",
    provider: "google",
    pricing: { inputPer1M: 0.25, outputPer1M: 1.5 },
    comingSoon: false,
  },
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getProvider(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function modelsByProvider(providerId: ProviderId): ModelDef[] {
  return MODELS.filter((m) => m.provider === providerId);
}

// The model a provider's dropdown previews when it isn't the active one — just the
// first usable model listed for that provider (no ranking or recommendation implied).
export function defaultModelForProvider(providerId: ProviderId): ModelDef | undefined {
  return modelsByProvider(providerId).find((m) => !m.comingSoon);
}

// Formats a per-1M-token rate for display, always two decimals (e.g. "$3.00", "$1.50").
export function formatPrice(perMillion: number): string {
  return `$${perMillion.toFixed(2)}`;
}
