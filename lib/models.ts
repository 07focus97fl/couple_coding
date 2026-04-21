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
  { id: "openai", name: "OpenAI", accent: "#10a37f", comingSoon: true },
  { id: "google", name: "Google", accent: "#4285f4", comingSoon: true },
];

export const MODELS: ModelDef[] = [
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    desc: "1M context, highest accuracy on nuanced turns",
    provider: "anthropic",
    badge: "FLAGSHIP",
    latency: "slower",
    pricing: { inputPer1M: 15, outputPer1M: 75 },
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
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    desc: "Deepest reasoning — OpenAI's flagship",
    provider: "openai",
    badge: "FLAGSHIP",
    latency: "slower",
    pricing: { inputPer1M: 20, outputPer1M: 100 },
    comingSoon: true,
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    desc: "Balanced general-purpose model",
    provider: "openai",
    badge: null,
    latency: "fast",
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    comingSoon: true,
  },
  {
    id: "o4",
    name: "o4",
    desc: "Reasoning specialist for ambiguous turns",
    provider: "openai",
    badge: null,
    latency: "reason",
    pricing: { inputPer1M: 8, outputPer1M: 40 },
    comingSoon: true,
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    desc: "Long-context, multimodal flagship",
    provider: "google",
    badge: "FLAGSHIP",
    latency: "fast",
    pricing: { inputPer1M: 10, outputPer1M: 50 },
    comingSoon: true,
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    desc: "High-throughput, low-latency coding",
    provider: "google",
    badge: null,
    latency: "fast",
    pricing: { inputPer1M: 1.5, outputPer1M: 7.5 },
    comingSoon: true,
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
