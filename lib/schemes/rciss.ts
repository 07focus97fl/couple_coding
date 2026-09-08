/**
 * WHAT:    The RCISS scheme (Rapid Couples Interaction Scoring System). Marked
 *          comingSoon: listed in the UI but not selectable; has no categories yet.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
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
