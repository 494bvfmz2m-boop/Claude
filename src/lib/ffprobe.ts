import { spawn } from "node:child_process";

export type ProbeResult = {
  duration: number;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
};

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(0, 2000)}`));
    });
  });
}

export async function probeFile(filePath: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data = JSON.parse(stdout);
  const streams: Array<Record<string, unknown>> = data.streams || [];
  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");

  const durationStr =
    (data.format && data.format.duration) || (videoStream && videoStream.duration);
  const duration = durationStr ? parseFloat(String(durationStr)) : 0;

  if (!duration || Number.isNaN(duration)) {
    throw new Error("Could not determine media duration — is this a valid video file?");
  }

  return {
    duration,
    width: videoStream ? Number(videoStream.width) || null : null,
    height: videoStream ? Number(videoStream.height) || null : null,
    hasAudio: Boolean(audioStream),
  };
}
