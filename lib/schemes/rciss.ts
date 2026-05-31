import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "../prompt-defaults";

export const RCISS: CodingScheme = {
  id: "RCISS",
  label: "RCISS",
  description: "Rapid Couples Interaction Scoring System",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
