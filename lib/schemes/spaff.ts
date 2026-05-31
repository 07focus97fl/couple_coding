import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "../prompt-defaults";

export const SPAFF: CodingScheme = {
  id: "SPAFF",
  label: "SPAFF",
  description: "Specific Affect Coding System (Gottman)",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
