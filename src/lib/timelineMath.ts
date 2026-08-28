import type { Clip } from "./types";

export type PositionedClip = {
  clip: Clip;
  start: number;
  duration: number;
};

export function layoutClips(clips: Clip[]): { positioned: PositionedClip[]; totalDuration: number } {
  let cursor = 0;
  const positioned: PositionedClip[] = clips.map((clip) => {
    const duration = clip.out_point - clip.in_point;
    const entry = { clip, start: cursor, duration };
    cursor += duration;
    return entry;
  });
  return { positioned, totalDuration: cursor };
}

export function findClipAtTime(
  positioned: PositionedClip[],
  time: number
): PositionedClip | null {
  for (const p of positioned) {
    if (time >= p.start && time < p.start + p.duration) return p;
  }
  return positioned.length > 0 ? positioned[positioned.length - 1] : null;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
