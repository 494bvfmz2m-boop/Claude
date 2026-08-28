"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Clip, Media, Overlay, ProjectBundle } from "@/lib/types";
import { layoutClips } from "@/lib/timelineMath";
import MediaBin from "./MediaBin";
import Timeline from "./Timeline";
import OverlayPanel from "./OverlayPanel";
import PreviewPlayer from "./PreviewPlayer";
import ExportPanel from "./ExportPanel";

export default function Editor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setBundle(data);
  }

  const mediaById = useMemo(() => {
    const map = new Map<string, Media>();
    bundle?.media.forEach((m) => map.set(m.id, m));
    return map;
  }, [bundle]);

  const { positioned, totalDuration } = useMemo(
    () => layoutClips(bundle?.clips ?? []),
    [bundle?.clips]
  );

  useEffect(() => {
    if (playhead > totalDuration) setPlayhead(totalDuration);
  }, [totalDuration, playhead]);

  async function refreshClips() {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) setBundle(await res.json());
  }

  async function runAction<T>(fn: () => Promise<Response>): Promise<T | null> {
    setActionError(null);
    const res = await fn();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error || "Something went wrong");
      return null;
    }
    return data as T;
  }

  function handleUploaded(media: Media) {
    setBundle((b) => (b ? { ...b, media: [...b.media, media] } : b));
  }

  async function handleDeleteMedia(mediaId: string) {
    const ok = await runAction(() =>
      fetch(`/api/projects/${projectId}/media/${mediaId}`, { method: "DELETE" })
    );
    if (ok) setBundle((b) => (b ? { ...b, media: b.media.filter((m) => m.id !== mediaId) } : b));
  }

  async function handleAddToTimeline(mediaId: string) {
    const result = await runAction<{ clip: Clip }>(() =>
      fetch(`/api/projects/${projectId}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })
    );
    if (result) setBundle((b) => (b ? { ...b, clips: [...b.clips, result.clip] } : b));
  }

  async function handleReorder(orderedIds: string[]) {
    const posMap = new Map(orderedIds.map((id, idx) => [id, idx]));
    setBundle((b) =>
      b
        ? {
            ...b,
            clips: [...b.clips].sort((a, c) => (posMap.get(a.id) ?? 0) - (posMap.get(c.id) ?? 0)),
          }
        : b
    );
    await runAction(() =>
      fetch(`/api/projects/${projectId}/clips/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      })
    );
    refreshClips();
  }

  async function handleTrim(clipId: string, inPoint: number, outPoint: number) {
    const result = await runAction<{ clip: Clip }>(() =>
      fetch(`/api/projects/${projectId}/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inPoint, outPoint }),
      })
    );
    if (result) {
      setBundle((b) =>
        b ? { ...b, clips: b.clips.map((c) => (c.id === clipId ? result.clip : c)) } : b
      );
    }
  }

  async function handleSplit(clipId: string, atSeconds: number) {
    const result = await runAction<{ clips: Clip[] }>(() =>
      fetch(`/api/projects/${projectId}/clips/${clipId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atSeconds }),
      })
    );
    if (result) setBundle((b) => (b ? { ...b, clips: result.clips } : b));
  }

  async function handleDeleteClip(clipId: string) {
    const ok = await runAction(() =>
      fetch(`/api/projects/${projectId}/clips/${clipId}`, { method: "DELETE" })
    );
    if (ok) refreshClips();
  }

  async function handleCreateOverlay(data: Omit<Overlay, "id" | "project_id">) {
    const result = await runAction<{ overlay: Overlay }>(() =>
      fetch(`/api/projects/${projectId}/overlays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          startTime: data.start_time,
          endTime: data.end_time,
          position: data.position,
          fontSize: data.font_size,
          color: data.color,
        }),
      })
    );
    if (result) setBundle((b) => (b ? { ...b, overlays: [...b.overlays, result.overlay] } : b));
  }

  async function handleDeleteOverlay(overlayId: string) {
    const ok = await runAction(() =>
      fetch(`/api/projects/${projectId}/overlays/${overlayId}`, { method: "DELETE" })
    );
    if (ok) setBundle((b) => (b ? { ...b, overlays: b.overlays.filter((o) => o.id !== overlayId) } : b));
  }

  if (notFound) {
    return (
      <div style={{ padding: 40 }}>
        <div>Project not found.</div>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/")}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!bundle) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-small" onClick={() => router.push("/")}>
          ← Projects
        </button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{bundle.project.name}</div>
      </div>

      {actionError && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {actionError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PreviewPlayer
            positioned={positioned}
            totalDuration={totalDuration}
            mediaById={mediaById}
            overlays={bundle.overlays}
            playhead={playhead}
            setPlayhead={setPlayhead}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
          <Timeline
            positioned={positioned}
            mediaById={mediaById}
            playhead={playhead}
            setPlayhead={setPlayhead}
            onReorder={handleReorder}
            onTrim={handleTrim}
            onSplit={handleSplit}
            onDelete={handleDeleteClip}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MediaBin
            projectId={projectId}
            media={bundle.media}
            onUploaded={handleUploaded}
            onDelete={handleDeleteMedia}
            onAddToTimeline={handleAddToTimeline}
          />
          <OverlayPanel
            overlays={bundle.overlays}
            totalDuration={totalDuration}
            playhead={playhead}
            onCreate={handleCreateOverlay}
            onDelete={handleDeleteOverlay}
          />
          <ExportPanel projectId={projectId} hasClips={bundle.clips.length > 0} />
        </div>
      </div>
    </div>
  );
}
