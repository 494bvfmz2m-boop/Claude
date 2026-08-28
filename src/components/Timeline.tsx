"use client";

import { useState } from "react";
import type { Media } from "@/lib/types";
import type { PositionedClip } from "@/lib/timelineMath";
import { formatTime } from "@/lib/timelineMath";

type Props = {
  positioned: PositionedClip[];
  mediaById: Map<string, Media>;
  playhead: number;
  setPlayhead: (t: number) => void;
  onReorder: (orderedIds: string[]) => void;
  onTrim: (clipId: string, inPoint: number, outPoint: number) => void;
  onSplit: (clipId: string, atSeconds: number) => void;
  onDelete: (clipId: string) => void;
};

export default function Timeline({
  positioned,
  mediaById,
  playhead,
  setPlayhead,
  onReorder,
  onTrim,
  onSplit,
  onDelete,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const ids = positioned.map((p) => p.clip.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(targetIndex, 0, moved);
    onReorder(ids);
    setDragIndex(null);
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Timeline</div>

      {positioned.length === 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
          Nothing on the timeline yet — add a clip from Media above.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {positioned.map(({ clip, start, duration }, index) => {
          const media = mediaById.get(clip.media_id);
          const isActive = playhead >= start && playhead < start + duration;
          const relativePlayhead = playhead - start;
          const canSplitHere = isActive && relativePlayhead > 0.15 && relativePlayhead < duration - 0.15;

          return (
            <div
              key={clip.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onClick={() => setPlayhead(start)}
              style={{
                background: isActive ? "var(--bg-elevated-2)" : "var(--bg-elevated)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8,
                padding: 10,
                cursor: "grab",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  #{index + 1} {media?.original_name ?? "Unknown"}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn btn-small"
                    disabled={!canSplitHere}
                    title={canSplitHere ? "Split at playhead" : "Move playhead inside this clip to split"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSplit(clip.id, relativePlayhead);
                    }}
                  >
                    Split
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(clip.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--text-dim)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>Trim</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={media ? media.duration : undefined}
                  value={Number(clip.in_point.toFixed(2))}
                  onChange={(e) => onTrim(clip.id, parseFloat(e.target.value) || 0, clip.out_point)}
                  style={{ width: 64 }}
                />
                <span>to</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={media ? media.duration : undefined}
                  value={Number(clip.out_point.toFixed(2))}
                  onChange={(e) => onTrim(clip.id, clip.in_point, parseFloat(e.target.value) || 0)}
                  style={{ width: 64 }}
                />
                <span style={{ marginLeft: "auto" }}>
                  {formatTime(start)} – {formatTime(start + duration)} ({duration.toFixed(1)}s)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
