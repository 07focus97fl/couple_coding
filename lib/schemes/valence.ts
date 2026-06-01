import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "../prompt-defaults";

export const VALENCE: CodingScheme = {
  id: "valence",
  label: "Valence",
  description: "Positive vs. negative affect coding",
  comingSoon: true,
  categories: [
    {
      name: "positive",
      description:
        "The speaker expresses warmth, affection, agreement, humor, validation, or emotional support.",
    },
    {
      name: "negative",
      description:
        "The speaker expresses criticism, contempt, defensiveness, hostility, dismissiveness, or emotional withdrawal.",
    },
  ],
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
