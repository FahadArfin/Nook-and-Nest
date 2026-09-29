# Listing video and floor-plan recognition providers

Video opens on the disconnected **My model server** option. See [Local model server](local-model-server.md) for the SGLang request adapters and future connection contract. No local model or cluster is installed. Seedance below remains a separate optional cloud path; neither fal nor hosted MiniMax inference is configured.

Verified against official documentation on September 28, 2026. Automated tests exercise request contracts and failure handling without spending provider credits. Real video quality and real-scan recognition accuracy still require an owner-approved evaluation with configured provider accounts.

## Seedance 2.0

The listing studio uses BytePlus ModelArk `dreamina-seedance-2-0-260128`, the official Seedance 2.0 model ID. Requests go only to `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`. The server uses the `ARK_API_KEY` secret and the existing Sites `DB` binding. Activate the model in the same BytePlus account as the key. Never put the key in a Vite variable, source file, browser form or saved listing. No automatic fallback switches providers or models.

The release build bundles `worker/listing-video.js` through `worker/projects.js` and copies the Drizzle migrations through the unchanged `scripts/build-project-server.mjs`. `drizzle/0004_listing_video.sql` adds the job and usage tables. Sites must apply the packaged migration before accepting submissions.

The app reports the integration as unavailable without a key or database. Configured availability indicates server setup; provider acceptance and account access are confirmed only by an explicitly requested generation. Unconfigured video does not prevent local photo management, slideshows or exports.

### Public app contract

- `GET /api/listing-video`: availability, sign-in state, exact provider/model and supported limits. It creates no task.
- `POST /api/listing-video`: authenticated, same-origin JSON with `requestId`, `images: [{dataUrl,label}]`, `prompt`, `duration`, `ratio`, `resolution` and `consent: true`. The user must first review the selected images and explicitly agree to external, paid generation.
- `POST /api/listing-video?validate=1`: validates a new reviewed request before the browser saves its pending marker. It creates no job and consumes no generation quota. Recovery retries keep their existing request rather than rerunning preflight.
- `GET /api/listing-video/{id}`: the signed-in owner's current job. Active jobs are polled at most once every 10 seconds per job, across worker instances.
- `DELETE /api/listing-video/{id}`: cancel a queued job or remove a finished job. The provider does not allow cancelling a running task. State is checked again before deletion, and a provider rejection never claims cancellation succeeded.

The response is `{id, requestId, status, createdAt, updatedAt, retryAfterSeconds, videoUrl?, error?}`. States are `submitting`, `submission_unknown`, `queued`, `running`, `succeeded`, `failed`, `cancelled`, `expired` and `deleted`. Provider job IDs are kept server-side; app IDs are random and every lookup also requires the authenticated owner. Client helpers are in `src/listingVideo.ts`.

Supported creation options are 1–9 images, 5/10/15 seconds, landscape 16:9, portrait 9:16 or square 1:1, and 720p/1080p. Images are local JPEG/PNG/WebP data URLs, at most 2 MB each and 25 MB for the entire streamed request. Dimensions are read from image bytes and must be 300–6,000 pixels per side, with aspect ratio 0.4–2.5. Arbitrary remote media URLs are rejected. Image labels are at most 100 characters and creative direction at most 2,000 characters.

These app limits deliberately fit within the provider's documented limits. Output requests retain the provider watermark and are silent. The prompt requests realistic materials and furniture while preserving visible architecture. A prompt is not a guarantee of geometric fidelity: the realtor must compare generated video against original photos before using it in marketing and retain a visible virtual-staging disclosure. Reference photos should show the property without people; Seedance's standard reference upload has restrictions on real human faces.

Each owner has a maximum of three new requests per UTC day and the entire site has a maximum of 20. Invalid input and ordinary retries do not create new provider tasks. Reservations and a unique `(owner_id, request_id)` index deduplicate simultaneous submissions; different content cannot reuse a request ID. Keep the same request ID when retrying an interrupted submission. The server reserves before contacting BytePlus, stores a one-way input fingerprint and never persists source images or prompts. Concurrent attempts may conservatively consume a quota slot even when deduplicated.

There is no automatic paid retry. A timeout, malformed acceptance response or provider 5xx becomes `submission_unknown`, because a paid task may already exist. Contact the site owner to inspect the provider account before deliberately submitting another job. Do not infer a refund from any failed/cancelled state. Provider errors are replaced with safe app messages, and a result is only `succeeded` when the response supplies an accepted HTTPS video URL.

BytePlus video URLs expire after 24 hours; download reviewed outputs promptly. Provider task records are retained for seven days. The app keeps small job metadata/tombstones so retries cannot accidentally create another paid job; deleting a record removes the video URL from app storage. Cancellation/removal cannot undo processing that already occurred at the provider.

Sources: [Seedance 2.0 tutorial](https://docs.byteplus.com/en/docs/ModelArk/seedance-2-0), [create task API](https://docs.byteplus.com/en/docs/ModelArk/create-video-generation-task-api), [video generation lifecycle](https://docs.byteplus.com/en/docs/modelark/video-generation-tutorial?redirect=1), [cancel/delete API](https://docs.byteplus.com/en/docs/modelark/cancel-or-delete-video-generation-tasks-api), [retention and status reference](https://docs.byteplus.com/en/docs/modelark/list-video-generation-tasks-api).

## GPT-6 Luna recognition

Online floor-plan recognition, opening review and room-region review now use `gpt-6-luna` via the OpenAI Responses API with `store: false`, medium reasoning and existing bounded output limits. Full recognition remains exactly two calls, supported by local wall evidence and detail crops. It never silently invokes Astra. Local wall-first extraction and manual correction remain available without uploading the drawing to a provider.

OpenAI's September 25, 2026 changelog confirms an image-encoding fix that improved GPT-6 Luna image understanding and recommends rerunning image evaluations. It does not establish this app's geometric accuracy. Recognition caches now use `luna-6-regions-v4`; older Luna/Astra analyses are not reused as fresh GPT-6 Luna results. Legacy model names from old tabs are accepted by the route but resolve only to GPT-6 Luna. The existing `OPENAI_API_KEY`, authenticated request rules, daily quotas, editable review and scale correction remain in place.

Sources: [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI API changelog](https://developers.openai.com/api/docs/changelog), [model migration guidance](https://developers.openai.com/api/docs/guides/latest-model).

## Verification

`tests/listing-video.test.ts` uses real in-memory SQLite with the shipped migration and mocked provider responses. It covers provider request shape, authentication, owner isolation, same-origin writes, image validation, byte limits, quotas, idempotency, polling, uncertain submissions, cancellation races, output-link validation and client-side response checks. The recognition tests preserve two-pass bounds, no-storage requests, no premium fallback and cached/manual correction behavior. These tests prove integration behavior, not generated media quality or real-scan accuracy.
