"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Note = {
  id: string;
  text: string;
  text_html?: string | null;
  image_data?: string | null;
  created_at: string;
  labels: Label[];
};

type Label = {
  id: string;
  name: string;
  color: string;
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newLabelByNote, setNewLabelByNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load notes");
        setNotes(data.notes);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function addLabel(noteId: string) {
    const name = (newLabelByNote[noteId] ?? "").trim();
    if (!name) return;

    const response = await fetch(`/api/notes/${noteId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to add label");
      return;
    }

    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, labels: data.labels } : note)));
    setNewLabelByNote((prev) => ({ ...prev, [noteId]: "" }));
  }

  async function removeLabel(noteId: string, labelId: string) {
    const response = await fetch(`/api/notes/${noteId}/labels?labelId=${encodeURIComponent(labelId)}`, {
      method: "DELETE"
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to remove label");
      return;
    }

    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, labels: data.labels } : note)));
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>All Notes</h1>
        <p>All note records, including image notes.</p>
        <div className="stack">
          {notes.map((note) => (
            <article key={note.id} className="noteCard">
              <div className="meta">
                <span>Note</span>
                <span>{new Date(note.created_at).toLocaleString()}</span>
              </div>
              {note.text_html ? <div className="richPreview" dangerouslySetInnerHTML={{ __html: note.text_html }} /> : <p>{note.text}</p>}
              {note.image_data && (
                <Image src={note.image_data} alt="Note attachment" className="noteImage" width={1200} height={800} unoptimized />
              )}
              <div className="labelChips">
                {note.labels?.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="labelChip"
                    style={{ borderColor: label.color, color: label.color }}
                    onClick={() => removeLabel(note.id, label.id)}
                    title="Remove label"
                  >
                    {label.name} x
                  </button>
                ))}
              </div>
              <div className="labelAddRow">
                <input
                  placeholder="Add label"
                  value={newLabelByNote[note.id] ?? ""}
                  onChange={(event) => setNewLabelByNote((prev) => ({ ...prev, [note.id]: event.target.value }))}
                />
                <button type="button" onClick={() => addLabel(note.id)}>
                  Add
                </button>
              </div>
            </article>
          ))}
          {notes.length === 0 && <p className="muted">No notes yet.</p>}
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
