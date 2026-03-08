import { CodingScheme } from "./types";

export const CODING_SCHEMES: CodingScheme[] = [
  {
    id: "valence",
    label: "Valence",
    description: "Positive vs. negative affect coding",
    categories: [
      { name: "positive", description: "The speaker expresses warmth, affection, agreement, humor, validation, or emotional support." },
      { name: "negative", description: "The speaker expresses criticism, contempt, defensiveness, hostility, dismissiveness, or emotional withdrawal." },
    ],
  },
  {
    id: "SPAFF",
    label: "SPAFF",
    description: "Specific Affect Coding System (Gottman)",
    categories: [],
    comingSoon: true,
  },
  {
    id: "RCISS",
    label: "RCISS",
    description: "Rapid Couples Interaction Scoring System",
    categories: [],
    comingSoon: true,
  },
  {
    id: "CIRS",
    label: "CIRS",
    description: "Couples Interaction Rating System",
    categories: [],
    comingSoon: true,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Define your own categories",
    categories: [
      { name: "", description: "" },
      { name: "", description: "" },
    ],
  },
];
