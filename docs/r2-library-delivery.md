# Collection file storage

Sites manages the R2 resource declared as `LIBRARY` in the generated hosting manifest. The app reads it through its Worker; no external Cloudflare account or browser storage credential is required. Public collection routes retain their existing paths, so saved furniture IDs, thumbnails and relative GLB texture references remain compatible.

Official references:
- https://learn.chatgpt.com/docs/sites (Sites bindings and R2 storage)
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ (streaming objects, range reads and SHA-256 validation)

The build computes an allowlist from final optimized bytes. Each object uses `library/SHA256` as its key. GLBs retain lossless compression; textures retain full bytes. This changes storage and delivery, not geometry, picking, transforms or saved plans. Models, previews, textures and Toronto data are omitted only from the slim deployment archive. Local development and GitHub still keep all original assets.

Reads stream from R2 with explicit MIME types, ETags, single byte ranges and one-hour cache freshness. Uploads require a temporary server secret, match the current release allowlist and declared length, and pass R2 checksum validation. The public upload route has no delete, arbitrary key or listing operation. Removing the secret disables uploads. Private user references/projects are not exposed or moved.

## Migration and recovery

The bridge archive contains the same application and R2 handler plus packaged asset fallbacks. Keep it live until every manifest path downloads from R2 with the expected hash. The slim archive then removes those static copies. If upload fails, keep the bridge live and resume; do not delete the original files. Keep old immutable R2 objects so previous releases can be restored.

Sites serves existing static files before the Worker. During the bridge, verify R2 through `/api/library-assets/<original path>`, which always reaches the storage handler. After publishing the slim archive, run the uploader with `--public-only` (no token) to verify every original app URL now serves identical bytes from R2.

Sites also deduplicates saved versions by source commit. A bridge and slim archive cannot reuse the same snapshot SHA: prepare a second forward snapshot for the slim phase, even when the validated source tree is identical. Check the saved version's returned file count to ensure the slim archive was accepted.

Keep human-readable HTML pages (such as Toronto credits) in the application package. Sites adds platform markup to HTML responses, so those pages do not belong in the byte-verified R2 collection. Models, textures, previews and raw data retain strict SHA-256 verification.

Hosting source snapshots solve the separate large Git transfer problem. A snapshot is a forward commit on the existing Sites branch, containing the exact CI application source and explicit provenance, without linking the heavy GitHub ancestry. It neither resets Sites nor rewrites GitHub. The CI artifact is never rebuilt during publication. See release-workflow.md for the two recorded commit identities.

To reconstruct the full development checkout of a snapshot, clone the GitHub repository at `SOURCE_PROVENANCE.json.github_commit`; its external input hash inventory identifies the omitted source assets. Blender originals remain there. Sites snapshots are delivery records, not the sole backup.

Storage capacity is separate from browser memory, bandwidth and request limits. R2 does not make a large city model cheaper to render. Keep bounded geometry and lazy model loading.
