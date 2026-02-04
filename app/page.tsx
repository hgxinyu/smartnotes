"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Todo = {
  id: string;
  content: string;
  is_done: boolean;
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadTodos() {
    const response = await fetch("/api/todos");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load todos");
    setTodos(data.todos.slice(0, 8));
  }

  useEffect(() => {
    loadTodos().catch((err: Error) => setError(err.message));
  }, []);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 2_200_000) {
      setError("Image is too large. Please use a file under 2.2MB.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      if (dataUrl.length > 2_900_000) {
        throw new Error("Image is too large after encoding. Try a smaller image.");
      }

      setImageData(dataUrl);
      setImageName(file.name);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image");
      setImageData(null);
      setImageName(null);
    }
  }

  function clearImage() {
    setImageData(null);
    setImageName(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() && !imageData) return;

    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageData: imageData ?? undefined })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to add note");

      setText("");
      clearImage();
      setTodos((data.todos ?? []).slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page homePage">
      <section className="homeGrid">
        <article className="homeCard homeComposer">
          <div className="cardHeader">
            <h2>Quick Capture</h2>
            <span className="homeBadge">AI categorization</span>
          </div>
          <p>Drop a thought below and save. Your to-dos will be generated automatically.</p>
          <form className="stack" onSubmit={handleSubmit}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Example: Need eggs, schedule dentist, and email Alex the invoice."
            />
            <div className="homeUploadRow">
              <label className="homeUploadBtn">
                <input type="file" accept="image/*" onChange={handleImageChange} />
                Choose image
              </label>
              {imageName && <span className="homeUploadName">{imageName}</span>}
              {imageData && (
                <button type="button" className="homeUploadClear" onClick={clearImage}>
                  Remove image
                </button>
              )}
            </div>
            {imageData && (
              <Image
                src={imageData}
                alt="Selected upload preview"
                className="imagePreview"
                width={1200}
                height={800}
                unoptimized
              />
            )}
            <button disabled={isSaving}>{isSaving ? "Saving..." : "Save Note"}</button>
          </form>
        </article>

        <aside className="homeCard homeAside">
          <div className="cardHeader">
            <h2>Latest AI To-Dos</h2>
            <span className="homeCount">{todos.length}</span>
          </div>
          <div className="homeTodoList">
            {todos.map((todo) => (
              <div key={todo.id} className={`homeTodoItem ${todo.is_done ? "done" : ""}`}>
                <input type="checkbox" checked={todo.is_done} readOnly />
                <span>{todo.content}</span>
              </div>
            ))}
            {todos.length === 0 && <p className="muted">No todo items yet.</p>}
          </div>
          <div className="homeLinks">
            <Link href="/notes">See all notes</Link>
            <Link href="/categories">Manage categories</Link>
          </div>
        </aside>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
