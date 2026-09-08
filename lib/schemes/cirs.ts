/**
 * WHAT:    The CIRS scheme. Marked comingSoon: listed in the UI but not selectable;
 *          has no categories yet.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

export const CIRS: CodingScheme = {
  id: "cirs",
  label: "CIRS",
  description: "Couples Interaction Rating System",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
