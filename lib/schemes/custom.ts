import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "../prompt-defaults";

export const CUSTOM: CodingScheme = {
  id: "custom",
  label: "Custom",
  description: "Define your own categories",
  categories: [
    { name: "", description: "" },
    { name: "", description: "" },
  ],
  defaultPrompt: (g) => buildDefaultPrompt(g),
};
