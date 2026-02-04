export const CATEGORIES = [
  "grocery",
  "tasks",
  "reminders",
  "ideas",
  "work",
  "health",
  "finance",
  "uncategorized"
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

