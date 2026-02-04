"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { CATEGORIES, type Category } from "@/lib/categories";

type Note = {
  id: string;
  text: string;
  category: Category;
  confidence: number;
  tags: string[];
  source: "rules" | "ai";
  created_at: string;
};

export default function HomePage() {
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadNotes() {
    const response = await fetch("/api/notes");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load notes");
    }
    setNotes(data.notes);
  }

  useEffect(() => {
    loadNotes().catch((err: Error) => setError(err.message));
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteInput.trim()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteInput })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create note");
      }

      setNoteInput("");
      setNotes((prev) => [data.note, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateCategory(id: string, category: Category) {
    setError(null);

    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to update category");
      return;
    }

    setNotes((prev) => prev.map((note) => (note.id === id ? data.note : note)));
  }

  const grouped = useMemo(() => {
    return notes.reduce<Record<string, Note[]>>((acc, note) => {
      if (!acc[note.category]) acc[note.category] = [];
      acc[note.category].push(note);
      return acc;
    }, {});
  }, [notes]);

  return (
    <main className="page">
      <section className="hero">
        <h1>SmartNotes</h1>
        <p>Write once. Auto-sort into the right list.</p>
      </section>

      <form className="inputCard" onSubmit={handleCreate}>
        <textarea
          placeholder="Type a thought... ex: we are missing eggs at home"
          value={noteInput}
          onChange={(event) => setNoteInput(event.target.value)}
          rows={4}
          maxLength={1000}
        />
        <button disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Add Note"}</button>
      </form>

      {error && <p className="error">{error}</p>}

      <section className="grid">
        {CATEGORIES.map((category) => (
          <article key={category} className="column">
            <h2>{category}</h2>
            <div className="stack">
              {(grouped[category] ?? []).map((note) => (
                <div key={note.id} className="noteCard">
                  <p>{note.text}</p>
                  <div className="meta">
                    <span>
                      {note.source} {Math.round(note.confidence * 100)}%
                    </span>
                    <select
                      value={note.category}
                      onChange={(event) => updateCategory(note.id, event.target.value as Category)}
                    >
                      {CATEGORIES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

