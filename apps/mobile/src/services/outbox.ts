import { api, NetworkError, post } from "./api";
import { readJSON, writeJSON } from "./store";
import type { Project } from "../types";

// Samples recorded without signal wait here until the server is reachable.
export type Pending = {
  id: string;
  projectId: string;
  projectName: string;
  body: Record<string, unknown>;
  createdAt: string;
};

export const pending = () => readJSON<Pending[]>("outbox", []);
const save = (items: Pending[]) => writeJSON("outbox", items);

/** Posts a record, or keeps it on the device when offline. */
export async function saveRecord(project: Project, body: Record<string, unknown>) {
  try {
    await post(`/projects/${project.id}/records`, body);
    return { queued: false };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    save([
      ...pending(),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: project.id,
        projectName: project.name,
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    return { queued: true };
  }
}

let running = false;
/** Sends waiting records in order; stops at the first network failure. */
export async function flush() {
  if (running) return 0;
  running = true;
  let sent = 0;
  try {
  for (const item of pending()) {
    try {
      await post(`/projects/${item.projectId}/records`, item.body);
    } catch (e) {
      if (e instanceof NetworkError) break;
      // Rejected by the server (duplicate, deleted project): drop it rather than retry forever.
    }
    save(pending().filter((p) => p.id !== item.id));
    sent++;
  }
  } finally {
    running = false;
  }
  return sent;
}

/** Project list with an on-device copy for choosing a project offline. */
export async function projectsWithCache() {
  try {
    const list = await api<Project[]>("/projects");
    writeJSON("projects", list.map(({ id, name, location, created_at }) => ({ id, name, location, created_at })));
    return list;
  } catch (e) {
    if (e instanceof NetworkError) return readJSON<Project[]>("projects", []);
    throw e;
  }
}
