import { extractTodoItems } from "@/lib/todos";

type IntakeResult = {
  notes: string[];
  todos: string[];
};

const TODO_HINT =
  /^(buy|get|pick up|pickup|call|email|schedule|book|finish|submit|pay|send|review|fix|prepare|remember)\b|\b(need to|todo|to-do|don't forget|remind me|missing|out of)\b/i;

function splitSegments(text: string) {
  return text
    .split(/\n+|;/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export async function classifyIntake(text: string): Promise<IntakeResult> {
  const segments = splitSegments(text);
  if (segments.length === 0) {
    return { notes: [], todos: [] };
  }

  const notes: string[] = [];
  const todos: string[] = [];

  for (const segment of segments) {
    const extractedTodos = await extractTodoItems(segment);
    const likelyTodo = TODO_HINT.test(segment);

    if (likelyTodo || extractedTodos.length > 0) {
      if (extractedTodos.length > 0) {
        for (const item of extractedTodos) {
          const normalized = normalizeLine(item);
          if (normalized) todos.push(normalized);
        }
      } else {
        const normalized = normalizeLine(segment);
        if (normalized) todos.push(normalized);
      }
    } else {
      const normalized = normalizeLine(segment);
      if (normalized) notes.push(normalized);
    }
  }

  if (notes.length === 0 && todos.length === 0 && text.trim()) {
    notes.push(normalizeLine(text));
  }

  return {
    notes: [...new Set(notes)],
    todos: [...new Set(todos)]
  };
}

