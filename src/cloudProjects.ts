import type { PlanDocumentV1 } from "./types";
import { validatePlan } from "./planValidation";
export interface CloudSession { signedIn: boolean; available: boolean; userId?: string; email?: string }
export interface ProjectSummary { id: string; name: string; revision: number; savedAt: string }
export interface ProjectVersion { revision: number; name: string; savedAt: string }
export class CloudError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...(body === undefined ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new CloudError("Online saves are available on the published site, not this local preview.", 503);
  const data = await response.json(); if (!response.ok) throw new CloudError(data.error || "Could not reach your online library.", response.status); return data;
}
export const cloudSession = () => request<CloudSession>("/api/session");
export const cloudProjects = () => request<{ projects: ProjectSummary[] }>("/api/projects");
export const cloudVersions = (id: string) => request<{ versions: ProjectVersion[] }>(`/api/projects/${encodeURIComponent(id)}/versions`);
export async function openCloudProject(id: string, revision?: number) {
  const data = await request<{ plan: PlanDocumentV1; revision: number }>(`/api/projects/${encodeURIComponent(id)}${revision === undefined ? "" : `?revision=${revision}`}`);
  validatePlan(data.plan); return data;
}
export const saveCloudProject = (plan: PlanDocumentV1, expectedRevision: number) => request<{ revision: number; savedAt: string }>(`/api/projects/${encodeURIComponent(plan.id)}`, { plan, expectedRevision });

export const deleteCloudProject = (id:string, revision:number) => request<{deleted:boolean}>(`/api/projects/${encodeURIComponent(id)}?revision=${revision}`,{},"DELETE");
