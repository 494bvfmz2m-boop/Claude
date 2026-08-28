"use client";

import { useRef, useState } from "react";
import type { Media } from "@/lib/types";

type Props = {
  projectId: string;
  media: Media[];
  onUploaded: (media: Media) => void;
  onDelete: (mediaId: string) => void;
  onAddToTimeline: (mediaId: string) => void;
};

export default function MediaBin({ projectId, media, onUploaded, onDelete, onAddToTimeline }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/media`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      onUploaded(data.media);
    } catch {
      setError("Upload failed — connection error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Media</div>
        <button
          className="btn btn-small"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}

      {media.length === 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No clips uploaded yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {media.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-elevated-2)",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{m.original_name}</div>
              <div style={{ color: "var(--text-dim)" }}>{m.duration.toFixed(1)}s</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-small" onClick={() => onAddToTimeline(m.id)}>
                Add
              </button>
              <button className="btn btn-small btn-danger" onClick={() => onDelete(m.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
