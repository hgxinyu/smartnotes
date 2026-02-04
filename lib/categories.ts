export type CategoryRecord = {
  slug: string;
  name: string;
  label: string;
  color: string;
};

export const DEFAULT_CATEGORIES: Array<CategoryRecord & { keywords: string[] }> = [
  { slug: "grocery", name: "Grocery", label: "Shopping", color: "#2d6a4f", keywords: ["milk", "eggs", "buy"] },
  { slug: "tasks", name: "Tasks", label: "To-do", color: "#1d4ed8", keywords: ["todo", "finish", "send"] },
  {
    slug: "reminders",
    name: "Reminders",
    label: "Remember",
    color: "#7c3aed",
    keywords: ["remember", "don't forget", "later"]
  },
  { slug: "ideas", name: "Ideas", label: "Inspiration", color: "#b45309", keywords: ["idea", "what if"] },
  { slug: "work", name: "Work", label: "Work", color: "#0f766e", keywords: ["meeting", "client", "deadline"] },
  { slug: "health", name: "Health", label: "Health", color: "#be123c", keywords: ["doctor", "exercise", "sleep"] },
  { slug: "finance", name: "Finance", label: "Money", color: "#4338ca", keywords: ["budget", "expense", "rent"] },
  {
    slug: "uncategorized",
    name: "Uncategorized",
    label: "General",
    color: "#475569",
    keywords: []
  }
];

export function slugifyCategoryName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
