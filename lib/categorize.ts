import OpenAI from "openai";
import { z } from "zod";

import { DEFAULT_CATEGORIES, type CategoryRecord } from "@/lib/categories";

type CategorizationResult = {
  text: string;
  categorySlug: string;
  confidence: number;
  tags: string[];
  source: "rules" | "ai";
};

const aiSchema = z.object({
  entries: z
    .array(
      z.object({
        text: z.string().min(1),
        categorySlug: z.string(),
        confidence: z.number().min(0).max(1),
        tags: z.array(z.string()).max(5).default([])
      })
    )
    .min(1)
    .max(6)
});

function normalizeTags(text: string) {
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3))].slice(
    0,
    5
  );
}

function splitText(text: string) {
  const pieces = text
    .split(/\n+|;/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces : [text.trim()];
}

function getKeywords(category: CategoryRecord) {
  const defaults = DEFAULT_CATEGORIES.find((item) => item.slug === category.slug)?.keywords ?? [];
  const nameTokens = category.name.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const labelTokens = category.label.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return [...new Set([...defaults, ...nameTokens, ...labelTokens])];
}

function pickRuleCategory(text: string, categories: CategoryRecord[]) {
  const normalized = text.toLowerCase();
  let best: { slug: string; hits: number } | null = null;

  for (const category of categories) {
    const hits = getKeywords(category).filter((keyword) => normalized.includes(keyword)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { slug: category.slug, hits };
    }
  }

  return best?.slug ?? "uncategorized";
}

function normalizeCategorySlug(slug: string, categories: CategoryRecord[]) {
  return categories.some((item) => item.slug === slug) ? slug : "uncategorized";
}

function ruleCategorize(text: string, categories: CategoryRecord[]): CategorizationResult[] {
  return splitText(text).map((segment) => ({
    text: segment,
    categorySlug: pickRuleCategory(segment, categories),
    confidence: 0.72,
    tags: normalizeTags(segment),
    source: "rules"
  }));
}

export async function analyzeAndCategorize(text: string, categories: CategoryRecord[]): Promise<CategorizationResult[]> {
  const normalizedText = text.trim();
  if (!normalizedText) return [];

  const safeCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  if (!process.env.OPENAI_API_KEY) {
    return ruleCategorize(normalizedText, safeCategories);
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });

    const categoriesPrompt = safeCategories.map((category) => `${category.slug}: ${category.name}`).join(", ");

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You analyze personal notes. Split into multiple entries only when each part is a different intent.
Return JSON as {"entries":[{"text":"...","categorySlug":"...","confidence":0-1,"tags":["..."]}]}
Allowed categorySlug values: ${categoriesPrompt}.`
        },
        { role: "user", content: normalizedText }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = aiSchema.parse(JSON.parse(raw));

    return parsed.entries.map((entry) => ({
      text: entry.text.trim(),
      categorySlug: normalizeCategorySlug(entry.categorySlug, safeCategories),
      confidence: entry.confidence,
      tags: entry.tags.map((tag) => tag.toLowerCase()).slice(0, 5),
      source: "ai"
    }));
  } catch {
    return ruleCategorize(normalizedText, safeCategories);
  }
}

