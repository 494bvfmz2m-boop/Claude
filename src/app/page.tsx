"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // A 401 here means the session cookie is present but no longer valid (e.g.
  // the account behind it was recreated after a redeploy) — bounce to login
  // instead of leaving the page stuck looking broken with no explanation.
  function redirectToLogin() {
    router.push("/login?next=%2F");
  }

  async function loadProjects() {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load projects");
      setProjects([]);
      return;
    }
    const data = await res.json();
    setProjects(data.projects);
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed to create project (server returned ${res.status})`);
        return;
      }
      router.push(`/projects/${data.project.id}`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its clips permanently?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) loadProjects();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700 }}>ClipForge</div>
        <button className="btn btn-small" onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <form
        onSubmit={handleCreate}
        className="card"
        style={{ padding: 16, display: "flex", gap: 8, marginBottom: 24 }}
      >
        <input
          placeholder="New project name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Creating…" : "New Project"}
        </button>
      </form>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {projects === null && <div style={{ color: "var(--text-dim)" }}>Loading…</div>}

      {projects !== null && projects.length === 0 && (
        <div style={{ color: "var(--text-dim)" }}>
          No projects yet — create one above to start editing.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {projects?.map((p) => (
          <div
            key={p.id}
            className="card"
            style={{
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <a
              href={`/projects/${p.id}`}
              style={{ textDecoration: "none", flex: 1, cursor: "pointer" }}
            >
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Updated {new Date(p.updated_at).toLocaleString()}
              </div>
            </a>
            <button className="btn btn-small btn-danger" onClick={() => handleDelete(p.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
