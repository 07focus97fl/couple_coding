import { CodingScheme } from "../types";
import { VALENCE } from "./valence";
import { VTCS } from "./vtcs";
import { SPAFF } from "./spaff";
import { RCISS } from "./rciss";
import { CIRS } from "./cirs";
import { CUSTOM } from "./custom";

export const CODING_SCHEMES: CodingScheme[] = [
  VALENCE,
  VTCS,
  SPAFF,
  RCISS,
  CIRS,
  CUSTOM,
];

export { VALENCE, VTCS, SPAFF, RCISS, CIRS, CUSTOM };
