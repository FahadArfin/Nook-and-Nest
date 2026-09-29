# Connect a future local video server

Nook & Nest includes an optional **My model server** connection. It starts disconnected and installs no model, driver, GPU runtime or server. No endpoint is contacted until **Check server** is pressed; generating requires a selected image and explicit approval. Connection checks list models and do not run inference. There is no automatic fallback to fal, a paid provider or the hosted Nook & Nest backend.

This is a browser client for an independently operated server. Automated tests verify its request and recovery behavior against mocked responses; they do not establish live model compatibility, architectural fidelity, generation speed or hardware readiness. No live H3 generation or RX 7900 XTX validation was performed for this feature.

## Connection and browser access

Enter the server base address, such as `https://models.example/v1` or `http://localhost:30010/v1`. The client also accepts an address without `/v1`. Cluster addresses require HTTPS; HTTP is accepted only for localhost, 127.0.0.1 or IPv6 loopback. Localhost means the computer running the browser. A server on another computer needs a reachable HTTPS address and a certificate trusted by that browser.

The server must allow the website's origin, currently `https://nook-and-nest.fwad101.chatgpt.site`, through CORS. Allow GET, POST and OPTIONS, with Authorization and Content-Type request headers. Cookies are omitted. Browsers may also require local-network permission; this is separate from CORS. Browser policy, networking and TLS configuration can still block a connection. See [MDN CORS guidance](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CORS), [MDN mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content) and [Chrome local-network access](https://developer.chrome.com/blog/local-network-access).

The optional bearer token stays in panel memory and is sent only to the selected server. The client saves the connection settings and a minimal job recovery record in browser storage, excluding the token, submitted photo and prompt. Use a server you control or trust: the destination receives the approved image and direction and applies its own retention and processing policies. Redirects are rejected, including download redirects.

## Implemented native API

The current contract follows [SGLang's video routes](https://github.com/sgl-project/sglang/blob/main/python/sglang/multimodal_gen/runtime/entrypoints/openai/video_api.py) and [model discovery](https://github.com/sgl-project/sglang/blob/main/python/sglang/multimodal_gen/runtime/entrypoints/openai/common_api.py):

| Request | Purpose |
| --- | --- |
| GET `/v1/models` | Read model IDs from `data[].id`; does not prove that a model supports the selected workflow. |
| POST `/v1/videos` | Submit one generation request; response must contain `id` and a supported `status`. |
| GET `/v1/videos/{id}` | Manually refresh that job; its returned ID must match. |
| GET `/v1/videos/{id}/content` | Fetch MP4 bytes using the same token, then preview/save a browser blob. |

Supported states are `queued`, `in_progress`, `completed` and `failed`, with optional numeric progress from 0 to 100. JSON is limited to 1 MiB and video to 128 MiB. External result URLs are ignored. A deployment that only returns a cloud storage URL needs its operator to provide the native content route or download the result separately.

**Standard image to video** sends multipart fields `model`, `prompt`, `seconds`, and an uploaded `input_reference` file. Resolution and other inference settings use the server's defaults. Compatibility and supported durations depend on the installed model.

**MiniMax H3 · SGLang** uses the official first-frame FL2VA workflow with this JSON payload (the actual selected image is a PNG, JPEG or WebP data URL):

```json
{
  "model": "<model ID returned by this server>",
  "prompt": "<reviewed direction>",
  "enhance_prompt": false,
  "seconds": 5,
  "task": "fl2va",
  "conditions": [{"type": "image", "uri": "data:image/png;base64,...", "role": "keyframe", "frame_index": 0}],
  "target": {"short_edge": 768, "aspect_ratio": "auto", "duration_seconds": 5},
  "num_outputs_per_prompt": 1,
  "num_inference_steps": 50,
  "flow_shift": 12,
  "audio_flow_shift": 3
}
```

The UI offers 5, 10 or 15 seconds. This profile expects SGLang's FL2VA checkpoint configuration and base sampling schedule. It does not configure a model deployment. Custom Turbo checkpoints may need another schedule. See the [SGLang H3 recipe](https://github.com/sgl-project/sglang/blob/main/docs/cookbook/diffusion/MiniMax/MiniMax-H3.mdx). [vLLM-Omni H3](https://github.com/vllm-project/vllm-omni/blob/main/recipes/MiniMaxAI/MiniMax-H3.md) uses different model-specific request fields, and [ComfyUI](https://docs.comfy.org/development/comfyui-server/comms_routes) uses workflow graphs. These are not interchangeable H3 profiles in this connector.

## Interrupted requests and shared tabs

A browser database transaction reserves one active request per home before POST. Another tab cannot reserve that home simultaneously. If the response is lost, no automatic retry occurs: the server may already be processing. Inspect its job list, enter the server job ID and use **Check job status** to recover. Keep an accepted ID if storage later fails.

Clearing a local record only forgets it after the explicit UI acknowledgement or a terminal status. It does **not** cancel server processing. The current SGLang DELETE route removes its job record without implementing reliable inference abort, so this connector does not expose cancellation or issue DELETE. Job status checks and result loading are manual.

## Hardware and output limits

MiniMax's [open-model announcement](https://www.minimax.io/news/minimax-h3-open-source) and [H3 guide](https://design.minimax.io/h3) describe the model release. Local H3 output is a generated concept, not a measured scan or a guarantee that rooms and fixtures remain unchanged. Review architecture and label staging/AI changes before using a result in a listing.

SGLang documents a 24 GB RTX 4090 offload configuration, so 24 GB VRAM alone does not establish impossibility. That is not evidence for an RX 7900 XTX: its AMD recipes target Instinct hardware, and this project has not validated the user's GPU, ROCm support, system memory requirements or performance. The connector remains usable later when a compatible local or cluster server is ready; no hardware setup is included here.
