# Asset ownership

`asset-pipeline.json` records recipe inputs, generators and outputs. It is a navigation manifest, not an automatic rebuild order: multiple collection builders intentionally override selected base IDs. Read each selected-ID filter before exporting. Never run all builders blindly over accepted assets.

1. Edit original Blender sources or their authored builder, preserving IDs, dimensions and material keys.
2. Export only selected models. Review rendered silhouettes and metadata; preserve aquarium fidelity exactly.
3. Render previews and losslessly compress them. Regenerate material metadata after exports.
4. Run `npm run assets:verify`, model tests and the production build. Build optimization belongs in dist, never in editable originals.

`npm run assets:inventory` writes a sorted file/byte inventory to `.generated/asset-inventory.json`. It is disposable evidence, not a second source of truth. The verifier checks recipe references and unique IDs. It does not prove visual fidelity or that an old export matches its source; model regression tests and visual acceptance remain required.
