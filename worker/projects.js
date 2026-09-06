import {googleTiles} from './google-tiles.js';
import staticWorker from "./index.js";
import {createLibraryHandler} from './library-assets.js';
import libraryManifest from './library-manifest.js';
const libraryAssets=createLibraryHandler(libraryManifest);
import { recognitionApi } from './recognition.js';
import { validatePlan, MAX_PLAN_BYTES } from "../src/planValidation.ts";

const json = (body, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
} });
const dbFor = env => env.DB;
const fail = (error, status) => json({ error }, status);

async function api(request, env) {
  const url = new URL(request.url);
  // Identity is injected by Sites dispatch, never accepted from body/query parameters.
  const owner = request.headers.get("oai-authenticated-user-id");
  const db = dbFor(env);
  if (url.pathname === "/api/session" && request.method === "GET") return json({
    signedIn: !!owner, available: !!db, userId: owner || undefined, email: owner ? request.headers.get("oai-authenticated-user-email") : null,
  });
  if (!owner) return fail("Sign in to access your private projects.", 401);
  if (!db) return fail("Online saves are not enabled in this environment yet.", 503);
  if (["POST", "DELETE"].includes(request.method)) {
    if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("Use the project library on this site to save.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Send a JSON project.", 415);
  }
  if (url.pathname === "/api/projects" && request.method === "GET") {
    const { results } = await db.prepare(`SELECT project_id AS id, name, revision, saved_at AS savedAt
      FROM project_versions WHERE owner_id = ? GROUP BY project_id HAVING revision = MAX(revision)
      ORDER BY saved_at DESC LIMIT 100`).bind(owner).all();
    return json({ projects: results });
  }
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)(\/versions)?$/);
  if (!match) return fail("Not found.", 404);
  const id = decodeURIComponent(match[1]);
  if (!id.length || id.length > 160) return fail("Invalid project ID.", 400);
  if (request.method === "DELETE" && !match[2]) {
    const revision = Number(url.searchParams.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 1) return fail("Invalid version.", 400);
    const result = await db.prepare("DELETE FROM project_versions WHERE owner_id = ? AND project_id = ? AND (SELECT MAX(revision) FROM project_versions WHERE owner_id = ? AND project_id = ?) = ?").bind(owner,id,owner,id,revision).run();
    if (!result.meta.changes) return fail("Project changed or was already deleted. Refresh your library.",409);
    return json({deleted:true});
  }
  if (request.method === "GET") {
    if (match[2]) {
      const { results } = await db.prepare("SELECT revision, name, saved_at AS savedAt FROM project_versions WHERE owner_id = ? AND project_id = ? ORDER BY revision DESC LIMIT 20").bind(owner, id).all();
      return json({ versions: results });
    }
    const revision = url.searchParams.get("revision");
    if (revision !== null && (!/^\d+$/.test(revision) || Number(revision) < 1)) return fail("Invalid version.", 400);
    const row = revision
      ? await db.prepare("SELECT document, revision FROM project_versions WHERE owner_id = ? AND project_id = ? AND revision = ?").bind(owner, id, Number(revision)).first()
      : await db.prepare("SELECT document, revision FROM project_versions WHERE owner_id = ? AND project_id = ? ORDER BY revision DESC LIMIT 1").bind(owner, id).first();
    return row ? json({ plan: JSON.parse(row.document), revision: row.revision }) : fail("Project not found.", 404);
  }
  if (request.method !== "POST" || match[2]) return fail("Method not allowed.", 405);
  // Bound the stream itself; Content-Length is not trusted.
  const reader = request.body?.getReader(); if (!reader) return fail("Missing project.", 400);
  let bytes = 0; const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_PLAN_BYTES + 1000) { await reader.cancel(); return fail("Project exceeds the 1 MB online save limit. Export a backup instead.", 413); } chunks.push(value); }
  const body = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  let plan, expectedRevision;
  try { ({ plan, expectedRevision } = JSON.parse(new TextDecoder().decode(body))); validatePlan(plan); }
  catch { return fail("This project contains invalid or unsupported data.", 400); }
  if (plan.id !== id || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return fail("Invalid save version.", 400);
  const document = JSON.stringify(plan);
  if (new TextEncoder().encode(document).length > MAX_PLAN_BYTES) return fail("Project exceeds the 1 MB online save limit.", 413);
  if (!expectedRevision) {
    const row = await db.prepare("SELECT COUNT(DISTINCT project_id) AS count FROM project_versions WHERE owner_id = ?").bind(owner).first();
    if (row.count >= 100) return fail("Your library has reached 100 projects. Export a backup to keep another build.", 409);
  }
  const savedAt = new Date().toISOString(), revision = expectedRevision + 1;
  // Single atomic compare-and-insert: a stale tab cannot silently overwrite a newer build.
  const result = await db.prepare(`INSERT INTO project_versions (owner_id, project_id, revision, name, saved_at, document)
    SELECT ?, ?, ?, ?, ?, ? WHERE COALESCE((SELECT MAX(revision) FROM project_versions WHERE owner_id = ? AND project_id = ?), 0) = ?
    ON CONFLICT(owner_id, project_id, revision) DO NOTHING`).bind(owner, id, revision, plan.name, savedAt, document, owner, id, expectedRevision).run();
  if (!result.meta.changes) return fail("A newer version was saved elsewhere. Open it, or save your changes as a separate copy.", 409);
  await db.prepare("DELETE FROM project_versions WHERE owner_id = ? AND project_id = ? AND revision <= ?").bind(owner, id, revision - 20).run();
  return json({ revision, savedAt });
}

export default { async fetch(request, env) {
  const googleResponse=await googleTiles(request,env);
  if(googleResponse)return googleResponse;
  const libraryResponse=await libraryAssets(request,env);
  if(libraryResponse)return libraryResponse;
  const url=new URL(request.url),preview=url.pathname.match(/^\/api\/previews\/([a-z0-9-]+)\.webp$/);
  if(preview&&['GET','HEAD'].includes(request.method)){
    url.pathname='/models/previews/'+preview[1]+'.webp';
    const response=await env.ASSETS.fetch(new Request(url,request));
    if(![200,206,304].includes(response.status))return response;
    const image=new Response(response.body,response);image.headers.set('Content-Type','image/webp');image.headers.set('Cache-Control','public, max-age=3600');return image;
  }
  if (!url.pathname.startsWith('/api/'))return staticWorker.fetch(request,env);
  if(url.pathname==='/api/floor-plan/recognize') {
    try{return await recognitionApi(request,env);}catch{return fail('Image analysis is temporarily unavailable. Your home has not changed.',503);}
  }
  try { return await api(request, env); }
  catch { return fail("Online saves are temporarily unavailable. Your local build is unchanged.", 503); }
} };
