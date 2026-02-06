"use client";

import { useEffect, useState } from "react";

type Todo = {
  id: string;
  content: string;
  is_done: boolean;
  created_at: string;
  labels: Label[];
};

type Label = {
  id: string;
  name: string;
  color: string;
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelByTodo, setSelectedLabelByTodo] = useState<Record<string, string>>({});
  const [newLabelByTodo, setNewLabelByTodo] = useState<Record<string, string>>({});
  const [openTagMenuTodoId, setOpenTagMenuTodoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTodos() {
    const response = await fetch("/api/todos");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load todos");
    setTodos(data.todos);
  }

  async function loadLabels() {
    const response = await fetch("/api/labels");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load labels");
    setLabels(data.labels ?? []);
  }

  useEffect(() => {
    Promise.all([loadTodos(), loadLabels()]).catch((err: Error) => setError(err.message));
  }, []);

  async function toggleTodo(todo: Todo) {
    const response = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !todo.is_done })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to update todo");
      return;
    }

    setTodos((prev) =>
      prev
        .map((item) => (item.id === todo.id ? data.todo : item))
        .sort((a, b) => Number(a.is_done) - Number(b.is_done) || Date.parse(b.created_at) - Date.parse(a.created_at))
    );
  }

  async function attachLabel(todoId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const response = await fetch(`/api/todos/${todoId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to add label");
      return false;
    }

    setTodos((prev) => prev.map((todo) => (todo.id === todoId ? { ...todo, labels: data.labels } : todo)));
    await loadLabels();
    return true;
  }

  async function removeLabel(todoId: string, labelId: string) {
    const response = await fetch(`/api/todos/${todoId}/labels?labelId=${encodeURIComponent(labelId)}`, {
      method: "DELETE"
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to remove label");
      return;
    }

    setTodos((prev) => prev.map((todo) => (todo.id === todoId ? { ...todo, labels: data.labels } : todo)));
  }

  async function addExistingLabel(todoId: string) {
    const name = selectedLabelByTodo[todoId] ?? "";
    const ok = await attachLabel(todoId, name);
    if (!ok) return;

    setSelectedLabelByTodo((prev) => ({ ...prev, [todoId]: "" }));
    setOpenTagMenuTodoId(null);
  }

  async function createAndAddLabel(todoId: string) {
    const name = newLabelByTodo[todoId] ?? "";
    const ok = await attachLabel(todoId, name);
    if (!ok) return;

    setNewLabelByTodo((prev) => ({ ...prev, [todoId]: "" }));
    setOpenTagMenuTodoId(null);
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>To-Do List</h1>
        <p>Automatically extracted actionable items.</p>
        <div className="homeTodoList">
          {todos.map((todo) => {
            const existingLabelOptions = labels.filter(
              (label) => !todo.labels?.some((todoLabel) => todoLabel.id === label.id)
            );

            return (
              <div key={todo.id} className={`homeTodoItem todoEditableItem ${todo.is_done ? "done" : ""}`}>
                <div className="todoEditableMain">
                  <input type="checkbox" checked={todo.is_done} onChange={() => toggleTodo(todo)} />
                  <div className="todoContentBlock">
                    <span>{todo.content}</span>
                    <div className="labelChips">
                      {todo.labels?.map((label) => (
                        <button
                          key={label.id}
                          type="button"
                          className="labelChip"
                          style={{ borderColor: label.color, color: label.color }}
                          onClick={() => removeLabel(todo.id, label.id)}
                          title="Remove label"
                        >
                          {label.name} x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="todoEditableActions">
                  <button
                    type="button"
                    className="ghostBtn tagActionBtn"
                    onClick={() => setOpenTagMenuTodoId((prev) => (prev === todo.id ? null : todo.id))}
                  >
                    {openTagMenuTodoId === todo.id ? "Close" : "Tag"}
                  </button>
                </div>

                {openTagMenuTodoId === todo.id && (
                  <div className="todoTagPanel">
                    <div className="todoTagRow">
                      <select
                        value={selectedLabelByTodo[todo.id] ?? ""}
                        onChange={(event) =>
                          setSelectedLabelByTodo((prev) => ({
                            ...prev,
                            [todo.id]: event.target.value
                          }))
                        }
                      >
                        <option value="">Select existing label</option>
                        {existingLabelOptions.map((label) => (
                          <option key={label.id} value={label.name}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addExistingLabel(todo.id)}
                        disabled={!(selectedLabelByTodo[todo.id] ?? "").trim()}
                      >
                        Add
                      </button>
                    </div>
                    <div className="todoTagRow">
                      <input
                        placeholder="Create new label"
                        value={newLabelByTodo[todo.id] ?? ""}
                        onChange={(event) =>
                          setNewLabelByTodo((prev) => ({
                            ...prev,
                            [todo.id]: event.target.value
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => createAndAddLabel(todo.id)}
                        disabled={!(newLabelByTodo[todo.id] ?? "").trim()}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {todos.length === 0 && <p className="muted">No todo items yet.</p>}
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
