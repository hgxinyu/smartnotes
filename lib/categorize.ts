import OpenAI from "openai";
import { z } from "zod";

import type { Category } from "@/lib/categories";
import { CATEGORIES, isCategory } from "@/lib/categories";

type CategorizationResult = {
  category: Category;
  confidence: number;
  tags: string[];
  source: "rules" | "ai";
};

const KEYWORDS: Record<Category, string[]> = {
  grocery: ["grocery", "milk", "eggs", "bread", "buy", "store", "supermarket"],
  tasks: ["todo", "to-do", "finish", "complete", "send", "call", "submit"],
  reminders: ["remember", "remind", "dont forget", "don't forget", "later", "tomorrow"],
  ideas: ["idea", "brainstorm", "what if", "startup", "project idea"],
  work: ["meeting", "client", "roadmap", "deadline", "sprint", "jira"],
  health: ["doctor", "workout", "exercise", "sleep", "medicine", "vitamin"],
  finance: ["budget", "invoice", "pay", "expense", "rent", "subscription"],
  uncategorized: []
};

const aiSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).max(5).default([])
});

function normalizeTags(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3);
}

function rulesCategory(text: string): CategorizationResult | null {
  const normalized = text.toLowerCase();

  for (const category of CATEGORIES) {
    const hits = KEYWORDS[category].filter((keyword) => normalized.includes(keyword));
    if (hits.length > 0) {
      return {
        category,
        confidence: 0.9,
        tags: [...new Set([...hits.slice(0, 2), ...normalizeTags(text)])].slice(0, 5),
        source: "rules"
      };
    }
  }

  return null;
}

export async function categorizeNote(text: string): Promise<CategorizationResult> {
  const ruleResult = rulesCategory(text);
  if (ruleResult) {
    return ruleResult;
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      category: "uncategorized",
      confidence: 0.25,
      tags: normalizeTags(text),
      source: "rules"
    };
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
            "You classify personal notes. Return JSON: {category, confidence, tags}. Categories: grocery,tasks,reminders,ideas,work,health,finance,uncategorized."
        },
        { role: "user", content: text }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = aiSchema.parse(JSON.parse(raw));

    return {
      category: isCategory(parsed.category) ? parsed.category : "uncategorized",
      confidence: parsed.confidence,
      tags: parsed.tags.map((tag) => tag.toLowerCase()).slice(0, 5),
      source: "ai"
    };
  } catch {
    return {
      category: "uncategorized",
      confidence: 0.3,
      tags: normalizeTags(text),
      source: "rules"
    };
  }
}
