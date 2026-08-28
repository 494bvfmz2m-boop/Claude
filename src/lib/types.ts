export type Project = {
  id: string;
  owner_id: string;
  name: string;
  resolution_w: number;
  resolution_h: number;
  created_at: string;
  updated_at: string;
};

export type Media = {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  duration: number;
  width: number | null;
  height: number | null;
  has_audio: number;
  created_at: string;
};

export type Clip = {
  id: string;
  project_id: string;
  media_id: string;
  position: number;
  in_point: number;
  out_point: number;
};

export type Overlay = {
  id: string;
  project_id: string;
  text: string;
  start_time: number;
  end_time: number;
  position: "top" | "center" | "bottom";
  font_size: number;
  color: string;
};

export type RenderJob = {
  id: string;
  project_id: string;
  status: "queued" | "processing" | "done" | "error";
  output_filename: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectBundle = {
  project: Project;
  media: Media[];
  clips: Clip[];
  overlays: Overlay[];
};
