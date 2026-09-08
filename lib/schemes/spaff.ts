/**
 * WHAT:    The SPAFF scheme (Specific Affect Coding System). Marked comingSoon:
 *          listed in the UI but not selectable; has no categories yet.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

export const SPAFF: CodingScheme = {
  id: "spaff",
  label: "SPAFF",
  description: "Specific Affect Coding System (Gottman)",
  categories: [],
  comingSoon: true,
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
