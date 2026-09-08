/**
 * WHAT:    The "Custom" scheme: two blank categories the researcher fills in, with
 *          the generic default prompt.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

export const CUSTOM: CodingScheme = {
  id: "custom",
  label: "Custom",
  description: "Define your own categories",
  categories: [
    { name: "", description: "" },
    { name: "", description: "" },
  ],
  defaultPrompt: (opts) => buildDefaultPrompt(opts),
};
