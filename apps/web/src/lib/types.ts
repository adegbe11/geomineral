export type Location = {
  lat: number;
  lng: number;
  name: string;
  country_code?: string;
};
export type User = { id: string; email: string; is_admin: boolean };
export type Evidence = {
  id: string;
  source_id: string;
  feature_id: string;
  evidence_type: string;
  description: string;
  commodity: string | null;
  direction: string;
  strength: string;
  observed_or_inferred: string;
  reliability: string;
  distance_m: number | null;
  raw_value: Record<string, unknown>;
  retrieved_at: string;
};
export type Source = {
  id: string;
  provider_name: string;
  provider_type: string;
  dataset_name: string;
  source_url: string;
  api_url: string;
  licence: string;
  resolution: string;
  notes: string;
  status: string;
  commercial_use_allowed: boolean;
};
export type Occurrence = {
  id: string;
  name: string;
  status: string;
  commodities: string[];
  distance_m: number;
  lat: number;
  lng: number;
  url: string;
};
export type Assessment = {
  commodity: string;
  prospectivity: string;
  evidence_quality: string;
  explanation: string;
  evidence_ids: string[];
  missing: string[];
  score?: number;
  site_count?: number;
  nearest_km?: number | null;
  producer_count?: number;
  host_rocks?: string[];
  papers?: { title: string; year: number | null; url: string; studied: boolean }[];
};
export type GeologyUnit = {
  name: string;
  lith: string;
  age: string;
  color: string;
  reference: string;
  top_ma?: number | null;
  bottom_ma?: number | null;
};
export type Analysis = {
  location: Location;
  radius_km: number;
  model_version: string;
  created_at: string;
  evidence_fingerprint: string;
  providers: {
    source: Source;
    status: string;
    message: string;
    retrieved_at: string;
    dataset_version: string;
  }[];
  evidence: Evidence[];
  assessments: Assessment[];
  occurrences: Occurrence[];
  geology_units?: GeologyUnit[];
  layers?: {
    faults?: { type: string; distance_km: number; paths: number[][][] }[];
    units?: { name: string; lith: string; age: string; color: string; here: boolean; rings: number[][][] }[];
  };
  structure?: { nearest_km: number | null; count: number; total_km: number };
  rating?: string;
  summary: string;
  coverage: { name: string; status: string; detail: string }[];
  evidence_quality: string;
  limitations: string[];
  next_steps: string[];
};
export type Run = {
  id: string;
  status: string;
  progress?: Record<string, string>;
  result?: Analysis;
  error?: string;
};
export type FieldRecord = {
  id: string;
  kind: "sample" | "observation";
  title: string;
  description: string;
  location: Location;
  created_at: string;
  rock_type?: string;
  method?: string;
  chain_of_custody?: string;
};
export type Project = {
  id: string;
  name: string;
  location: Location;
  created_at: string;
  visibility: string;
  analysis_id?: string;
  polygon?: number[][];
  area_m2?: number;
  record_count?: number;
  records?: FieldRecord[];
};
