"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  slug: string;
  name: string;
  label: string;
  color: string;
};

type Note = {
  id: string;
  text: string;
  text_html?: string | null;
  category_slug: string;
  category_name: string;
  category_label: string;
  category_color: string;
  created_at: string;
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/notes"), fetch("/api/categories")])
      .then(async ([notesRes, categoriesRes]) => {
        const notesData = await notesRes.json();
        const categoriesData = await categoriesRes.json();
        if (!notesRes.ok) throw new Error(notesData.error ?? "Failed to load notes");
        if (!categoriesRes.ok) throw new Error(categoriesData.error ?? "Failed to load categories");
        setNotes(notesData.notes);
        setCategories(categoriesData.categories);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const filteredNotes = useMemo(() => {
    return activeCategory === "all" ? notes : notes.filter((note) => note.category_slug === activeCategory);
  }, [notes, activeCategory]);

  return (
    <main className="page">
      <section className="panel">
        <h1>All Notes</h1>
        <p>Browse every note by category label and creation timestamp.</p>
        <div className="filters">
          <button type="button" className={`pill ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              className={`pill ${activeCategory === category.slug ? "active" : ""}`}
              style={{ borderColor: category.color }}
              onClick={() => setActiveCategory(category.slug)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="stack">
          {filteredNotes.map((note) => (
            <article key={note.id} className="noteCard">
              <div className="meta">
                <span>{note.category_label}</span>
                <span>{new Date(note.created_at).toLocaleString()}</span>
              </div>
              {note.text_html ? <div className="richPreview" dangerouslySetInnerHTML={{ __html: note.text_html }} /> : <p>{note.text}</p>}
            </article>
          ))}
          {filteredNotes.length === 0 && <p className="muted">No notes found.</p>}
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

