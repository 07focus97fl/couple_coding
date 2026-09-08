/**
 * WHAT:    cn(): merges Tailwind class names. shadcn boilerplate used only by
 *          components/ui.
 * STEP:    UI kit.
 * RUNS ON: both
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
