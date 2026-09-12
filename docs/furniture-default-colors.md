# Sofa and bed defaults

New sofa and bed placements now start in individual moss, slate, charcoal, camel, terracotta or mulberry palettes instead of the former blanket white variant. The Cloud sofa uses moss, the Nest bed uses slate, and mirrored sectionals share the same palette. The matching Nook chair and Puff ottoman are included (37 pieces total).

`src/furnitureDefaultVariants.json` selects new-placement colors. Both the editor draft and direct placement already use `modernDefaultVariant`, and the example-plan helper now does too. Models outside this map retain their previous default, including apartment models whose authored materials already have colored bedding and upholstery.

`src/furnitureVariants.json` retains every existing swatch unchanged and adds six deeper muted swatches. Saved placements are never migrated or recolored; explicit white and individual material overrides remain valid through save/load and undo. No GLBs, source Blender scenes, dimensions, material identifiers or geometry changed.

The catalog renderer reads the same palette and applies the runtime material tint to its temporary Blender scene. It does not save over the editable model source. Original preview PNGs and lossless WebP previews are refreshed together.
