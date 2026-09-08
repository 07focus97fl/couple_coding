import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

export const RCISS: CodingScheme = {
  id: "rciss",
  label: "RCISS",
  description: "Rapid Couples Interaction Scoring System",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
