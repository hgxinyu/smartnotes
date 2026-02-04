"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = {
  slug: string;
  name: string;
  label: string;
  color: string;
};

function sortCategories(list: Category[]) {
  return [...list].sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#475569");
  const [error, setError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error ?? "Failed to load categories");
        setCategories(sortCategories(data.categories));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  function updateLocal(slug: string, field: keyof Category, value: string) {
    setCategories((prev) => prev.map((item) => (item.slug === slug ? { ...item, [field]: value } : item)));
  }

  async function saveCategory(category: Category) {
    if (category.slug === "uncategorized") return;
    setSavingSlug(category.slug);
    setError(null);
    try {
      const response = await fetch(`/api/categories/${category.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: category.name, label: category.label, color: category.color })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save category");
      setCategories((prev) => sortCategories(prev.map((item) => (item.slug === category.slug ? data.category : item))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSavingSlug(null);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim() || !newLabel.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, label: newLabel, color: newColor })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create category");
      setCategories((prev) => sortCategories([...prev, data.category]));
      setNewName("");
      setNewLabel("");
      setNewColor("#475569");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Manage Categories</h1>
        <p>Update category names, labels, and colors from one place.</p>
        <form className="categoryCreate" onSubmit={createCategory}>
          <input placeholder="Category name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <input placeholder="Label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
          <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} />
          <button disabled={isCreating}>{isCreating ? "Adding..." : "Add Category"}</button>
        </form>
        <div className="categoryRows">
          {categories.map((category) => (
            <div key={category.slug} className="categoryRow">
              <input
                value={category.name}
                disabled={category.slug === "uncategorized"}
                onChange={(event) => updateLocal(category.slug, "name", event.target.value)}
              />
              <input
                value={category.label}
                disabled={category.slug === "uncategorized"}
                onChange={(event) => updateLocal(category.slug, "label", event.target.value)}
              />
              <input
                type="color"
                value={category.color}
                disabled={category.slug === "uncategorized"}
                onChange={(event) => updateLocal(category.slug, "color", event.target.value)}
              />
              <button
                type="button"
                disabled={category.slug === "uncategorized" || savingSlug === category.slug}
                onClick={() => saveCategory(category)}
              >
                {savingSlug === category.slug ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

