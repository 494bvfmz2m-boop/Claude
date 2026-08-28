import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { UPLOADS_DIR, RENDERS_DIR } from "./paths";
import type { Clip, Media, Overlay, Project } from "./types";

const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const FPS = 30;

// ffmpeg's filtergraph parser treats \ ' : , ; [ ] as structural characters —
// each needs a literal backslash escape to appear literally in an option value.
// This is only used for the (fully-controlled, near-certainly-plain) file paths
// below, NOT for overlay text: see prepareOverlayTextFiles for why text goes
// through a file instead of an inline, escaped `text=` value.
function escapeFilterValue(value: string): string {
  return value.replace(/[\\':,;[\]]/g, (ch) => `\\${ch}`);
}

// Overlay text is written to a temp file and passed via drawtext's `textfile=`
// option instead of an inline, escaped `text=` value. Inline escaping was tried
// first and turned out to be a dead end: ffmpeg's drawtext has two independent
// parsing passes over the text (filtergraph-level backslash-unescaping, then its
// own %{...} expansion scan), and an escaped quote earlier in the string shifts
// the second pass's bookkeeping enough that an unrelated, later '%' gets flagged
// as "Stray %" and silently drops the whole overlay — reproduced directly against
// ffmpeg, not just suspected. `textfile=` + `expansion=none` sidesteps both passes
// entirely: the file's content needs no escaping at all, and expansion=none stops
// drawtext from re-scanning it for '%{...}' tokens.
async function prepareOverlayTextFiles(
  tempDir: string,
  overlays: Overlay[]
): Promise<string[]> {
  await fs.mkdir(tempDir, { recursive: true });
  const paths: string[] = [];
  for (let i = 0; i < overlays.length; i++) {
    const filePath = path.join(tempDir, `overlay-${i}.txt`);
    await fs.writeFile(filePath, overlays[i].text, "utf8");
    paths.push(filePath);
  }
  return paths;
}

function yExprForPosition(position: Overlay["position"]): string {
  switch (position) {
    case "top":
      return "h*0.08";
    case "center":
      return "(h-text_h)/2";
    case "bottom":
    default:
      return "h*0.85-text_h";
  }
}

function buildFfmpegArgs(
  project: Project,
  clips: Clip[],
  mediaById: Map<string, Media>,
  overlays: Overlay[],
  overlayTextFiles: string[],
  outputPath: string
): string[] {
  const w = project.resolution_w;
  const h = project.resolution_h;

  const args: string[] = ["-y"];
  const filterParts: string[] = [];

  clips.forEach((clip) => {
    const media = mediaById.get(clip.media_id);
    if (!media) throw new Error(`Media not found for clip ${clip.id}`);
    args.push("-i", path.join(UPLOADS_DIR, media.filename));
  });

  const vLabels: string[] = [];
  const aLabels: string[] = [];

  clips.forEach((clip, i) => {
    const media = mediaById.get(clip.media_id)!;
    const inPt = clip.in_point;
    const outPt = clip.out_point;
    const dur = Math.max(outPt - inPt, 0.05);

    const vLabel = `v${i}`;
    filterParts.push(
      `[${i}:v]trim=start=${inPt}:end=${outPt},setpts=PTS-STARTPTS,` +
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
        `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FPS}[${vLabel}]`
    );
    vLabels.push(vLabel);

    const aLabel = `a${i}`;
    if (media.has_audio) {
      filterParts.push(
        `[${i}:a]atrim=start=${inPt}:end=${outPt},asetpts=PTS-STARTPTS,` +
          `aresample=async=1:first_pts=0[${aLabel}]`
      );
    } else {
      filterParts.push(
        `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${dur}[${aLabel}]`
      );
    }
    aLabels.push(aLabel);
  });

  const n = clips.length;
  const concatInputs = vLabels.map((v, i) => `[${v}][${aLabels[i]}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=1[vcat][acat]`);

  let currentVideoLabel = "vcat";
  overlays.forEach((overlay, idx) => {
    const nextLabel = `vout${idx}`;
    const textFile = escapeFilterValue(overlayTextFiles[idx]);
    const y = yExprForPosition(overlay.position);
    filterParts.push(
      `[${currentVideoLabel}]drawtext=fontfile=${FONT_PATH}:textfile=${textFile}:expansion=none:` +
        `fontsize=${overlay.font_size}:fontcolor=${overlay.color}:` +
        `x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.4:boxborderw=10:` +
        `enable='between(t,${overlay.start_time},${overlay.end_time})'[${nextLabel}]`
    );
    currentVideoLabel = nextLabel;
  });

  const filterComplex = filterParts.join(";");

  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    `[${currentVideoLabel}]`,
    "-map",
    "[acat]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    outputPath
  );

  return args;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${stderr.slice(-4000)}`));
    });
  });
}

// Single-worker in-process queue: safe default for a small VPS with no GPU.
let processing = false;
const queue: string[] = [];

export function enqueueRenderJob(jobId: string) {
  queue.push(jobId);
  void processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift()!;
      await runJob(jobId);
    }
  } finally {
    processing = false;
  }
}

async function runJob(jobId: string) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM render_jobs WHERE id = ?").get(jobId) as
    | { id: string; project_id: string }
    | undefined;
  if (!job) return;

  const markUpdated = (fields: Record<string, unknown>) => {
    const keys = Object.keys(fields);
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE render_jobs SET ${setClause}, updated_at = ? WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      new Date().toISOString(),
      jobId
    );
  };

  try {
    markUpdated({ status: "processing" });

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(job.project_id) as
      | Project
      | undefined;
    if (!project) throw new Error("Project not found");

    const clips = db
      .prepare("SELECT * FROM clips WHERE project_id = ? ORDER BY position ASC")
      .all(job.project_id) as Clip[];
    if (clips.length === 0) throw new Error("Project has no clips to render");

    const mediaRows = db
      .prepare("SELECT * FROM media WHERE project_id = ?")
      .all(job.project_id) as Media[];
    const mediaById = new Map(mediaRows.map((m) => [m.id, m]));

    const overlays = db
      .prepare("SELECT * FROM overlays WHERE project_id = ? ORDER BY start_time ASC")
      .all(job.project_id) as Overlay[];

    const outputFilename = `${jobId}.mp4`;
    const outputPath = path.join(RENDERS_DIR, outputFilename);
    const tempDir = path.join(RENDERS_DIR, ".tmp", jobId);

    try {
      const overlayTextFiles = await prepareOverlayTextFiles(tempDir, overlays);
      const args = buildFfmpegArgs(
        project,
        clips,
        mediaById,
        overlays,
        overlayTextFiles,
        outputPath
      );
      await runFfmpeg(args);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    markUpdated({ status: "done", output_filename: outputFilename, error: null });
  } catch (err) {
    markUpdated({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function createRenderJob(projectId: string): string {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO render_jobs (id, project_id, status, created_at, updated_at) VALUES (?, ?, 'queued', ?, ?)`
  ).run(id, projectId, now, now);
  enqueueRenderJob(id);
  return id;
}
