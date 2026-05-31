export type ProviderId = "anthropic" | "openai" | "google";

export type ModelBadge = "FLAGSHIP" | "RECOMMENDED" | "FASTEST";

export type LatencyTier = "fastest" | "fast" | "balanced" | "slower" | "reason";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export interface ModelDef {
  id: string;
  name: string;
  desc: string;
  provider: ProviderId;
  badge: ModelBadge | null;
  latency: LatencyTier;
  pricing: ModelPricing | null;
  comingSoon: boolean;
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
// Pricing is USD per 1M tokens, verified 2026-05-31.
export const MODELS: ModelDef[] = [
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    desc: "Newest flagship — 1M context, deepest reasoning",
    provider: "anthropic",
    badge: "FLAGSHIP",
    latency: "slower",
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    comingSoon: false,
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    desc: "1M context, very strong on nuanced turns",
    provider: "anthropic",
    badge: null,
    latency: "slower",
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    comingSoon: false,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    desc: "Fast & capable — ideal for most coding tasks",
    provider: "anthropic",
    badge: "RECOMMENDED",
    latency: "fast",
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    comingSoon: false,
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    desc: "Best for simple binary schemes",
    provider: "anthropic",
    badge: "FASTEST",
    latency: "fastest",
    pricing: { inputPer1M: 1, outputPer1M: 5 },
    comingSoon: false,
  },
  {
    id: "gpt-5.5-pro",
    name: "GPT-5.5 Pro",
    desc: "OpenAI's deepest-reasoning flagship",
    provider: "openai",
    badge: "FLAGSHIP",
    latency: "slower",
    pricing: { inputPer1M: 30, outputPer1M: 180 },
    comingSoon: false,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    desc: "Balanced general-purpose model",
    provider: "openai",
    badge: null,
    latency: "fast",
    pricing: { inputPer1M: 5, outputPer1M: 30 },
    comingSoon: false,
  },
  {
    id: "o3",
    name: "o3",
    desc: "Reasoning specialist for ambiguous turns",
    provider: "openai",
    badge: null,
    latency: "reason",
    pricing: { inputPer1M: 2, outputPer1M: 8 },
    comingSoon: false,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    desc: "Google's long-context flagship (preview)",
    provider: "google",
    badge: "FLAGSHIP",
    latency: "balanced",
    pricing: { inputPer1M: 2, outputPer1M: 12 },
    comingSoon: false,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    desc: "High-throughput, low-latency coding",
    provider: "google",
    badge: null,
    latency: "fast",
    pricing: { inputPer1M: 1.5, outputPer1M: 9 },
    comingSoon: false,
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getProvider(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function modelsByProvider(providerId: ProviderId): ModelDef[] {
  return MODELS.filter((m) => m.provider === providerId);
}

export function formatLatency(tier: LatencyTier): string {
  switch (tier) {
    case "fastest": return "Fastest";
    case "fast": return "Fast";
    case "balanced": return "Balanced";
    case "slower": return "Slower";
    case "reason": return "Reason";
  }
}
