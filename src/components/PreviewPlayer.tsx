"use client";

import { useEffect, useRef } from "react";
import type { Media, Overlay } from "@/lib/types";
import type { PositionedClip } from "@/lib/timelineMath";
import { findClipAtTime, formatTime } from "@/lib/timelineMath";

type Props = {
  positioned: PositionedClip[];
  totalDuration: number;
  mediaById: Map<string, Media>;
  overlays: Overlay[];
  playhead: number;
  setPlayhead: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
};

export default function PreviewPlayer({
  positioned,
  totalDuration,
  mediaById,
  overlays,
  playhead,
  setPlayhead,
  isPlaying,
  setIsPlaying,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeMediaIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const playheadRef = useRef(playhead);
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  const active = findClipAtTime(positioned, playhead);

  // Swap source + seek when the active clip changes (or on manual scrub).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    const media = mediaById.get(active.clip.media_id);
    if (!media) return;

    const wantedSrc = `/api/files/media/${media.filename}`;
    const sourceChanged = activeMediaIdRef.current !== active.clip.id;
    const targetTime = active.clip.in_point + (playhead - active.start);

    if (sourceChanged) {
      activeMediaIdRef.current = active.clip.id;
      if (!video.src.endsWith(wantedSrc)) video.src = wantedSrc;
      const onLoaded = () => {
        video.currentTime = targetTime;
        video.removeEventListener("loadedmetadata", onLoaded);
      };
      video.addEventListener("loadedmetadata", onLoaded);
    } else if (Math.abs(video.currentTime - targetTime) > 0.35) {
      video.currentTime = targetTime;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.clip.id]);

  // Manual scrub while not playing.
  useEffect(() => {
    if (isPlaying) return;
    const video = videoRef.current;
    if (!video || !active) return;
    const targetTime = active.clip.in_point + (playhead - active.start);
    if (Math.abs(video.currentTime - targetTime) > 0.05) {
      video.currentTime = targetTime;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
      lastFrameTimeRef.current = null;
      const tick = (t: number) => {
        if (lastFrameTimeRef.current === null) lastFrameTimeRef.current = t;
        const delta = (t - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = t;
        const next = playheadRef.current + delta;
        if (next >= totalDuration) {
          setPlayhead(totalDuration);
          setIsPlaying(false);
          return;
        }
        setPlayhead(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const activeOverlays = overlays.filter((o) => playhead >= o.start_time && playhead < o.end_time);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div
        style={{
          position: "relative",
          background: "#000",
          borderRadius: 8,
          overflow: "hidden",
          aspectRatio: "16 / 9",
        }}
      >
        {positioned.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              fontSize: 13,
            }}
          >
            Add a clip to the timeline to preview
          </div>
        ) : (
          <video
            ref={videoRef}
            muted={false}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}

        {activeOverlays.map((o) => (
          <div
            key={o.id}
            style={{
              position: "absolute",
              left: "5%",
              right: "5%",
              textAlign: "center",
              fontSize: Math.round(o.font_size / 2),
              color: o.color,
              fontWeight: 700,
              textShadow: "0 2px 6px rgba(0,0,0,0.8)",
              top: o.position === "top" ? "6%" : undefined,
              bottom: o.position === "bottom" ? "10%" : undefined,
              ...(o.position === "center"
                ? { top: "50%", transform: "translateY(-50%)" }
                : {}),
              pointerEvents: "none",
            }}
          >
            {o.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button
          className="btn btn-small"
          disabled={positioned.length === 0}
          onClick={() => {
            if (playhead >= totalDuration) setPlayhead(0);
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={totalDuration || 0}
          step={0.01}
          value={Math.min(playhead, totalDuration)}
          onChange={(e) => {
            setIsPlaying(false);
            setPlayhead(parseFloat(e.target.value));
          }}
          style={{ flex: 1 }}
        />
        <div style={{ fontSize: 12, color: "var(--text-dim)", minWidth: 90, textAlign: "right" }}>
          {formatTime(playhead)} / {formatTime(totalDuration)}
        </div>
      </div>
    </div>
  );
}
