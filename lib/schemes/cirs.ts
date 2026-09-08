import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

export const CIRS: CodingScheme = {
  id: "CIRS",
  label: "CIRS",
  description: "Couples Interaction Rating System",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
