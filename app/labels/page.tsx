"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Label = {
  id: string;
  name: string;
  color: string;
  note_count?: number;
  todo_count?: number;
};

type LabelNote = {
  id: string;
  text: string;
  text_html?: string | null;
  image_data?: string | null;
  created_at: string;
};

type LabelTodo = {
  id: string;
  content: string;
  is_done: boolean;
  created_at: string;
};

type LabelItems = {
  label: {
    id: string;
    name: string;
    color: string;
  };
  notes: LabelNote[];
  todos: LabelTodo[];
  summary: {
    noteCount: number;
    todoCount: number;
  };
};

type ApplySummary = {
  notesScanned: number;
  todosScanned: number;
  noteLinksAdded: number;
  todoLinksAdded: number;
};

function sortLabels(items: Label[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function LabelsPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#0ea5e9");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isApplyingAuto, setIsApplyingAuto] = useState(false);
  const [applySummary, setApplySummary] = useState<ApplySummary | null>(null);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<LabelItems | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLabels() {
    const response = await fetch("/api/labels");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load labels");
    setLabels(sortLabels(data.labels));
    return sortLabels(data.labels) as Label[];
  }

  async function loadLabelItems(labelId: string) {
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/labels/${labelId}/items`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load label items");
      setActiveItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setActiveItems(null);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadLabels()
      .then((loaded) => {
        if (loaded.length > 0) {
          setActiveLabelId((prev) => prev ?? loaded[0].id);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!activeLabelId) {
      setActiveItems(null);
      return;
    }
    loadLabelItems(activeLabelId);
  }, [activeLabelId]);

  const totalLinks = useMemo(
    () => labels.reduce((sum, label) => sum + (label.note_count ?? 0) + (label.todo_count ?? 0), 0),
    [labels]
  );
  const usedLabels = useMemo(
    () => labels.filter((label) => (label.note_count ?? 0) + (label.todo_count ?? 0) > 0).length,
    [labels]
  );

  async function createLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;

    setError(null);
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to create label");
      return;
    }

    setNewName("");
    setNewColor("#0ea5e9");
    const loaded = await loadLabels();
    setActiveLabelId(data.label?.id ?? loaded[0]?.id ?? null);
  }

  async function applyLabelsAutomatically() {
    setIsApplyingAuto(true);
    setError(null);
    setApplySummary(null);
    try {
      const response = await fetch("/api/labels/apply-auto", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to apply labels");

      setApplySummary(data.summary ?? null);
      const loaded = await loadLabels();
      if (activeLabelId) {
        await loadLabelItems(activeLabelId);
      } else if (loaded[0]) {
        setActiveLabelId(loaded[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsApplyingAuto(false);
    }
  }

  function updateLabelLocal(id: string, field: "name" | "color", value: string) {
    setLabels((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    setActiveItems((prev) => {
      if (!prev || prev.label.id !== id) return prev;
      return {
        ...prev,
        label: {
          ...prev.label,
          [field]: value
        }
      };
    });
  }

  async function saveLabel(label: Label) {
    setSavingId(label.id);
    setError(null);
    const response = await fetch(`/api/labels/${label.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: label.name, color: label.color })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to save label");
      setSavingId(null);
      return;
    }

    setLabels((prev) => sortLabels(prev.map((item) => (item.id === label.id ? { ...item, ...data.label } : item))));
    setActiveItems((prev) => {
      if (!prev || prev.label.id !== label.id) return prev;
      return { ...prev, label: data.label };
    });
    setSavingId(null);
  }

  async function deleteLabel(id: string) {
    setSavingId(id);
    setError(null);
    const response = await fetch(`/api/labels/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to delete label");
      setSavingId(null);
      return;
    }

    const remaining = labels.filter((item) => item.id !== id);
    setLabels(remaining);
    if (activeLabelId === id) {
      setActiveLabelId(remaining[0]?.id ?? null);
    }
    setSavingId(null);
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Labels Center</h1>
        <p>Pick a label to see every associated note and to-do in one place.</p>
        <div className="labelOverview">
          <article className="labelStatCard">
            <h3>Total labels</h3>
            <strong>{labels.length}</strong>
          </article>
          <article className="labelStatCard">
            <h3>Used labels</h3>
            <strong>{usedLabels}</strong>
          </article>
          <article className="labelStatCard">
            <h3>Total linked items</h3>
            <strong>{totalLinks}</strong>
          </article>
        </div>
        <div className="labelActions">
          <button type="button" onClick={applyLabelsAutomatically} disabled={isApplyingAuto}>
            {isApplyingAuto ? "Applying..." : "Apply Existing Labels Automatically"}
          </button>
          {applySummary && (
            <span className="muted">
              Scanned {applySummary.notesScanned} notes + {applySummary.todosScanned} todos, added {applySummary.noteLinksAdded} note links and{" "}
              {applySummary.todoLinksAdded} todo links using existing labels.
            </span>
          )}
        </div>
      </section>

      <section className="labelWorkspace">
        <article className="panel">
          <h2>Manage Labels</h2>
          <form className="labelCreateRow" onSubmit={createLabel}>
            <input placeholder="New label name" value={newName} onChange={(event) => setNewName(event.target.value)} />
            <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} />
            <button type="submit">Create</button>
          </form>
          <div className="labelRows">
            {labels.map((label) => (
              <div key={label.id} className={`labelRow ${activeLabelId === label.id ? "activeLabelRow" : ""}`}>
                <input value={label.name} onChange={(event) => updateLabelLocal(label.id, "name", event.target.value)} />
                <input type="color" value={label.color} onChange={(event) => updateLabelLocal(label.id, "color", event.target.value)} />
                <span className="muted">
                  Notes {label.note_count ?? 0}, Todos {label.todo_count ?? 0}
                </span>
                <button type="button" onClick={() => saveLabel(label)} disabled={savingId === label.id}>
                  {savingId === label.id ? "Saving..." : "Save"}
                </button>
                <button type="button" className="ghostBtn" onClick={() => setActiveLabelId(label.id)} disabled={savingId === label.id}>
                  Explore
                </button>
                <button type="button" className="dangerBtn" onClick={() => deleteLabel(label.id)} disabled={savingId === label.id}>
                  Delete
                </button>
              </div>
            ))}
            {labels.length === 0 && <p className="muted">No labels yet.</p>}
          </div>
        </article>

        <article className="panel">
          <h2>Associated Items</h2>
          {!activeLabelId && <p className="muted">Create a label first.</p>}
          {loadingItems && <p className="muted">Loading label items...</p>}
          {!loadingItems && activeItems && (
            <div className="labelExplorer">
              <div className="labelExplorerHead">
                <span className="labelChip" style={{ borderColor: activeItems.label.color, color: activeItems.label.color }}>
                  {activeItems.label.name}
                </span>
                <span className="muted">
                  {activeItems.summary.noteCount} notes, {activeItems.summary.todoCount} todos
                </span>
              </div>

              <div className="labelResultsGrid">
                <section>
                  <h3>Notes</h3>
                  <div className="stack">
                    {activeItems.notes.map((note) => (
                      <article key={note.id} className="noteCard">
                        <div className="meta">
                          <span>Note</span>
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        {note.text_html ? (
                          <div className="richPreview" dangerouslySetInnerHTML={{ __html: note.text_html }} />
                        ) : (
                          <p>{note.text}</p>
                        )}
                        {note.image_data && (
                          <Image src={note.image_data} alt="Note attachment" className="noteImage" width={1200} height={800} unoptimized />
                        )}
                      </article>
                    ))}
                    {activeItems.notes.length === 0 && <p className="muted">No notes with this label.</p>}
                  </div>
                </section>

                <section>
                  <h3>To-Dos</h3>
                  <div className="homeTodoList">
                    {activeItems.todos.map((todo) => (
                      <div key={todo.id} className={`homeTodoItem ${todo.is_done ? "done" : ""}`}>
                        <input type="checkbox" checked={todo.is_done} readOnly />
                        <div className="todoContentBlock">
                          <span>{todo.content}</span>
                          <span className="muted">{new Date(todo.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {activeItems.todos.length === 0 && <p className="muted">No to-dos with this label.</p>}
                  </div>
                </section>
              </div>
            </div>
          )}
        </article>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
