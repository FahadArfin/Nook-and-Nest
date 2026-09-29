# Optional local still-render adapter

Listing Studio can export a portable job or explicitly submit to a user-configured compatible server. No server is installed or configured by this feature. The existing video connector remains separate.

## Still protocol required on an explicitly chosen server

This is a new adapter contract, not a claim that ComfyUI, MiniMax/H3, a video API, or a particular GPU already supports it. Portable packages can be processed by a separate compatible tool. Model binaries, Blender/GLB assets and an engine are **not** embedded; that tool must resolve these catalog ids to the correct authored assets and implement the requested plan/camera semantics. Fixed-geometry engines must preserve measured geometry; generative styling must remain labeled a concept. Current asset versions are an integration dependency, not a guarantee from the request hash alone.

The chosen base URL is normalized by existing `localVideoEndpoint`: HTTPS, or HTTP loopback only, ending in `/v1`. Embedded credentials, queries/fragments and known hosted inference provider hosts are rejected. All requests go directly from the browser to the explicitly chosen origin, with `credentials: 'omit'`, `redirect: 'error'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`; no proxy or arbitrary server-side fetching is added. CORS and applicable browser local-network permission must succeed. No insecure fallback exists. Optional `Authorization: Bearer ...` is held in component memory only, cleared on address change and never included in request JSON, queue storage, package or application logs. Raw remote error messages are not persisted.

All JSON responses must declare an application JSON content type. Requests time out after 45 seconds locally; timeout/abort is not server cancellation. A maximum of 100 KB applies to capability/status responses and 12 MiB to result responses. No remote image URL is accepted or fetched.

### Capability check (explicit, read-only)

`GET /v1/nook/still-render/capabilities`

```json
{
  "schema": "nook-still-render/1",
  "idempotency": "request-id",
  "cancelByRequestId": true,
  "resultType": "inline-image",
  "models": [{"id":"my-local-engine","name":"My renderer","modes":["fixed-geometry"],"qualities":["preview","final"]}]
}
```

The returned capability is locally bound to that normalized endpoint. The UI explains that responding proves protocol/CORS access only, not GPU compatibility, installed models, quality or successful rendering. It requires a fresh explicit submission choice afterward.

### Start, recover and cancel

- `POST /v1/nook/still-render/jobs` with `{model, request}`. A local `submitting` reservation is committed **before** this POST. If storage fails, no POST occurs. The server must atomically bind `requestId` to the exact `payloadHash`, return the existing job for the same identity, and reject a mismatched reused identity. Persist the mapping across server restarts, including uncertain/terminal jobs; never create a second job for retries of that id.
- `GET /v1/nook/still-render/requests/:requestId` returns status for the exact id/hash. The browser never retries POST automatically, even after unmount/reload, transport errors or an ambiguous response. Status is checked only on a user action.
- `DELETE /v1/nook/still-render/requests/:requestId` attempts cancellation by stable request id even when the browser never received a server job id. The server must not return `cancelled` until computation is stopped or prevented. The browser stores `cancel-unknown` before sending this request and preserves it after uncertainty.
- A missing/unreachable server or an unconfirmed 404 is not proof that a previous POST never ran. The UI keeps the reservation for explicit recovery instead of offering another POST or silently deleting it. This can require operator investigation; no cost-safe automatic recovery is claimed.

All three operations return:

```json
{"schema":"nook-still-job/1","id":"server-job-id","requestId":"same-request-id","payloadHash":"same-64-character-lowercase-hex","status":"running","progress":25}
```

Status is one of `queued`, `running`, `completed`, `failed`, `cancelled`; progress is optional 0–100. Failed/cancelled must be truthful terminal server states. A result is fetched separately from `GET /v1/nook/still-render/requests/:requestId/result` only after matching completed status. Server-side authentication, authorized use, resource limits and worker lifecycle remain that separately configured adapter's responsibility; this pack does not install or expose a server.

### Portable requests and results

`StillRequest` JSON is exactly:

```ts
{
  schema: 'nook-still-render/1', requestId, createdAt,
  plan: sanitizedPublicVisualPlan,
  shot: {id, name, camera, referenceImage?, referenceProvenance?},
  settings: {quality: 'preview'|'final', mode: 'fixed-geometry'|'generative-styling', width, height},
  payloadHash
}
```

Compute `payloadHash` over the UTF-8 encoding of `canonicalStill(payloadWithoutPayloadHash)`: recursively lexicographically sort object keys, omit `undefined` object properties, preserve array order, JSON-encode keys and primitive values; lowercase hexadecimal SHA-256. Do not use whitespace-formatted JSON bytes as the hash input. The request hash covers the sanitized scene, camera, selected image, settings, identity and date; it is distinct from the local original-plan fingerprint.

Preview is 960×540; final is 3840×2160. A separate compatible tool returns a JSON file, or the result route above returns:

```ts
{
  schema:'nook-still-result/1', requestId, payloadHash,
  image:'data:image/png;base64,...',
  kind:'render', // 'concept' is required for generative-styling requests
  engine:'Engine label', runtimeMs?:1234
}
```

PNG/JPEG/WebP data URLs only, at most 8 MiB of data-URL text, at most 4096 on either side and 16 million header pixels; output dimensions must equal the request. Inputs have type/signature/header and serialized byte bounds before display or listing normalization. This does not assert decoder completeness or visual correctness: an engine label, hash match or image header cannot prove fidelity, so the user must compare the result before acceptance. JSON import is size-checked before parsing and rejects unknown schema fields, external image URLs and mismatched identities/hashes/modes/dimensions.

The queue caps all projects together at 12 records and 96 MiB serialized data; per-request/result file limit is 12 MiB. IndexedDB/quota errors are visible; no false saved/submitted state is reported. Export marks a job as potentially running externally, disabling server start/removal until the user explicitly confirms it is not running, or confirms external cancellation. Terminal failure/cancellation permits a **new**, unsubmitted retry; unconfirmed states do not. Removing the browser record never promises to cancel remote work.

