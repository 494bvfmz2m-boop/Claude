"use client";

import { useState } from "react";
import type { Overlay } from "@/lib/types";
import { formatTime } from "@/lib/timelineMath";

type Props = {
  overlays: Overlay[];
  totalDuration: number;
  playhead: number;
  onCreate: (data: Omit<Overlay, "id" | "project_id">) => void;
  onDelete: (overlayId: string) => void;
};

export default function OverlayPanel({ overlays, totalDuration, playhead, onCreate, onDelete }: Props) {
  const [text, setText] = useState("");
  const [duration, setDuration] = useState(3);
  const [position, setPosition] = useState<Overlay["position"]>("bottom");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#ffffff");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    if (!text.trim()) {
      setError("Enter some text first");
      return;
    }
    const startTime = playhead;
    const endTime = Math.min(playhead + duration, totalDuration || playhead + duration);
    if (endTime <= startTime) {
      setError("Not enough room on the timeline at the current playhead");
      return;
    }
    onCreate({ text: text.trim(), start_time: startTime, end_time: endTime, position, font_size: fontSize, color });
    setText("");
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Text overlays</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <input placeholder="Overlay text…" value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Duration (s)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
              style={{ width: 60, marginLeft: 6 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Position
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Overlay["position"])}
              style={{ marginLeft: 6 }}
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Size
            <input
              type="number"
              min={12}
              max={120}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 48)}
              style={{ width: 50, marginLeft: 6 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ marginLeft: 6, padding: 0, width: 32, height: 24 }}
            />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Will appear at {formatTime(playhead)} for {duration}s
        </div>
        {error && <div className="error-banner">{error}</div>}
        <button className="btn btn-primary btn-small" onClick={handleAdd} style={{ alignSelf: "flex-start" }}>
          + Add overlay at playhead
        </button>
      </div>

      {overlays.length === 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No overlays yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {overlays.map((o) => (
          <div
            key={o.id}
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
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 500 }}>&ldquo;{o.text}&rdquo;</span>{" "}
              <span style={{ color: "var(--text-dim)" }}>
                {formatTime(o.start_time)}–{formatTime(o.end_time)} · {o.position}
              </span>
            </div>
            <button className="btn btn-small btn-danger" onClick={() => onDelete(o.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
