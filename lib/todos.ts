import OpenAI from "openai";

function cleanupTodo(text: string) {
  return text
    .trim()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
}

function heuristicTodo(text: string) {
  const normalized = text.toLowerCase().trim();

  const needMatch = normalized.match(/\b(need|missing|out of)\s+(.+)/);
  if (needMatch?.[2]) {
    return `Buy ${needMatch[2].replace(/^some\s+/, "")}`;
  }

  const buyMatch = normalized.match(/\b(buy|get|pick up)\s+(.+)/);
  if (buyMatch?.[2]) {
    return `Buy ${buyMatch[2]}`;
  }

  const taskMatch = normalized.match(/\b(call|email|schedule|finish|submit|book)\s+(.+)/);
  if (taskMatch?.[0]) {
    return taskMatch[0];
  }

  return null;
}

export async function extractTodoItems(text: string): Promise<string[]> {
  const heuristic = heuristicTodo(text);
  if (!process.env.OPENAI_API_KEY) {
    return heuristic ? [cleanupTodo(heuristic)] : [];
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract actionable todo items from a note. Return JSON: {"todos":["..."]}. Use concise verb-first tasks. If none, return empty list.'
        },
        { role: "user", content: text }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? '{"todos":[]}';
    const parsed = JSON.parse(raw) as { todos?: string[] };
    const todos = (parsed.todos ?? []).map(cleanupTodo).filter(Boolean).slice(0, 5);

    if (todos.length > 0) {
      return todos;
    }
    return heuristic ? [cleanupTodo(heuristic)] : [];
  } catch {
    return heuristic ? [cleanupTodo(heuristic)] : [];
  }
}

