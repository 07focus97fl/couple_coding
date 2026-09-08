/**
 * WHAT:    The registry of coding schemes, in the order the UI lists them. To add a
 *          scheme, create its file next to this one and add it to CODING_SCHEMES.
 * STEP:    Scheme.
 * RUNS ON: both (the whole registry, prompts included, ships to the browser)
 */
import { CodingScheme } from "../types";
import { VALENCE } from "./valence";
import { VTCS } from "./vtcs";
import { SPAFF } from "./spaff";
import { RCISS } from "./rciss";
import { CIRS } from "./cirs";
import { CUSTOM } from "./custom";

export const CODING_SCHEMES: CodingScheme[] = [
  VTCS,
  VALENCE,
  SPAFF,
  RCISS,
  CIRS,
  CUSTOM,
];
