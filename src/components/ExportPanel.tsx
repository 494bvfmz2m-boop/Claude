"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderJob } from "@/lib/types";

type Props = {
  projectId: string;
  hasClips: boolean;
};

export default function ExportPanel({ projectId, hasClips }: Props) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollJob(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/render-jobs/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);
      if (data.job.status === "done" || data.job.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }

  async function handleExport() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/render`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to start export");
      return;
    }
    setJob(data.job);
    pollJob(data.job.id);
  }

  const isBusy = job?.status === "queued" || job?.status === "processing";

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Export</div>

      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}

      <button className="btn btn-primary" disabled={!hasClips || isBusy} onClick={handleExport}>
        {isBusy ? "Rendering…" : "Export video"}
      </button>

      {job && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {job.status === "queued" && <div style={{ color: "var(--text-dim)" }}>Queued…</div>}
          {job.status === "processing" && (
            <div style={{ color: "var(--text-dim)" }}>Rendering with ffmpeg — this can take a while.</div>
          )}
          {job.status === "error" && (
            <div className="error-banner" style={{ marginTop: 6 }}>
              {job.error || "Render failed"}
            </div>
          )}
          {job.status === "done" && job.output_filename && (
            <a
              className="btn btn-small"
              style={{ display: "inline-block", marginTop: 4, textDecoration: "none" }}
              href={`/api/files/renders/${job.output_filename}`}
              download
            >
              ⬇ Download MP4
            </a>
          )}
        </div>
      )}
    </div>
  );
}
