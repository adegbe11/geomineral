// Shared API contracts; native screens own their presentation and navigation.
export type {
  Location,
  User,
  Analysis,
  Run,
  Source,
  Assessment,
  Occurrence,
  GeologyUnit,
  Target,
} from "../../web/src/lib/types";
export type Tab = "Home" | "Explore" | "Scan" | "Projects" | "Profile";
import type {
  Project as SharedProject,
  FieldRecord as SharedRecord,
} from "../../web/src/lib/types";
export type FieldRecord = SharedRecord & { photos?: string[]; audio?: string | null };
export type Project = Omit<SharedProject, "records"> & {
  records?: FieldRecord[];
};
export type ScanResult = {
  candidate: string;
  candidates?: string[];
  observations: string;
  next_check: string;
};
