import OpenAI from "openai";

const FALLBACK_KEYWORDS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Shopping", pattern: /\b(buy|shopping|grocery|milk|eggs|store|market)\b/i },
  { label: "Work", pattern: /\b(meeting|client|project|deadline|roadmap|invoice|team)\b/i },
  { label: "Health", pattern: /\b(doctor|dentist|workout|sleep|medicine|health)\b/i },
  { label: "Family", pattern: /\b(mom|dad|family|kids|home)\b/i },
  { label: "Finance", pattern: /\b(budget|rent|expense|payment|bank|tax)\b/i },
  { label: "Urgent", pattern: /\b(urgent|asap|today|immediately|important)\b/i },
  { label: "Follow-Up", pattern: /\b(follow up|remind|check in|call back)\b/i }
];

const COLOR_PALETTE = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeLabelName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9\s\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  return cleaned ? toTitleCase(cleaned) : "";
}

export function pickLabelColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function fallbackLabelsForText(text: string, existingLabels: string[]) {
  const found: string[] = [];
  const normalized = text.toLowerCase();

  for (const existing of existingLabels) {
    if (normalized.includes(existing.toLowerCase())) {
      found.push(existing);
    }
  }

  for (const rule of FALLBACK_KEYWORDS) {
    if (rule.pattern.test(text)) found.push(rule.label);
  }

  return [...new Set(found.map(normalizeLabelName).filter(Boolean))].slice(0, 3);
}

export async function suggestLabelsForText(text: string, existingLabels: string[]): Promise<string[]> {
  const fallback = fallbackLabelsForText(text, existingLabels);
  if (!process.env.OPENAI_API_KEY) return fallback;

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
            'Return labels for text in JSON: {"labels":["..."]}. Max 3 labels, 1-2 words each, concise. Prefer existing labels when relevant.'
        },
        {
          role: "user",
          content: `Existing labels: ${existingLabels.join(", ") || "none"}\nText: ${text}`
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? '{"labels":[]}';
    const parsed = JSON.parse(raw) as { labels?: string[] };
    const aiLabels = (parsed.labels ?? []).map(normalizeLabelName).filter(Boolean).slice(0, 3);

    return [...new Set([...aiLabels, ...fallback])].slice(0, 3);
  } catch {
    return fallback;
  }
}

