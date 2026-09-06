# Luxury kitchen collection and Skyline registration

Adds 16 independent kitchen catalog entries and the accepted Skyline GT-R brick model under Decor / Collectibles. Existing catalog IDs, saved placements and material defaults are preserved.

The kitchen collection includes 36-inch gas and 48-inch dual-oven ranges, 30-inch induction and radiant-electric ranges; single, double and compact steam wall ovens; 30/36-inch induction cooktops and a five-burner gas cooktop; glass-door professional, French-door and white column refrigerators; and workstation, double-basin and fluted fireclay sink cabinets.

## Design research

Original modeled construction is informed by these product families and published dimensions:

- [Wolf ranges](https://www.subzero-wolf.com/cooking/ranges): stainless housings, tactile controls, cast grates and separate griddle configurations.
- [Wolf 30-inch induction range](https://ca.subzero-wolf.com/en/wolf/ranges/induction-range/30-inch-professional-induction-range): 759 x 749 x 927 mm overall envelope.
- [Wolf M-series double oven specification](https://www.subzero-wolf.com/products/assets/wolf/m-series-ovens/qr-sheets/do30/do3050tm-quick-reference-guide-st.pdf): 759 x 584 x 1292 mm, paired cavities and flush fascia.
- [Wolf gas cooktop specification](https://www.subzero-wolf.com/products/assets/wolf/gas-cooktops/qr-sheets/cg36/quick-reference-guide-cg365p.pdf): 914 x 533 x 102 mm, independent five-burner counter appliance.
- [Wolf induction cooktop specification](https://www.subzero-wolf.com/products/assets/wolf/induction-cooktops/qr-sheets/ci36560c-fi.pdf): black ceramic cooking surface and low-profile installation.
- [Sub-Zero refrigeration](https://www.subzero-wolf.com/refrigeration/discover-sub-zero) and [PRO48 specification](https://www.subzero-wolf.com/qrExport/prog-refrigeration-qr-sheet-pro48-st.pdf): separate cold-storage drawers, crown louvers, glass shelves, tubular handles and column silhouettes.
- [Kohler Synthos specification](https://techcomm.kohler.com/techcomm/pdf/K-37907-PAP_spec_US-CA_Kohler_en.pdf): wide stainless workstation basin, bottom rack, drain and preparation accessories.
- [Latoscana reversible fireclay sink](https://www.annieandoak.com/products/lfs3318w-fireclay-single-basin-reversible-farmhouse-sink): white apron-front construction and fluted face.

These are original planning models, not manufacturer CAD. Catalog sizes describe complete modeled envelopes, including handles, and sink stations include cabinets and faucets. The single wall oven and compact steam model are family-inspired variants. Installation clearances and cutouts are not simulated.

## Editable construction and placement

`tools/blender/build_luxury_kitchen.py` preserves separate named mesh pieces in every Blender source, then batches meshes by material in the GLB export. Oven frames, racks, glass, handles and control marks are modeled; burner caps, ports and grates are separate authored pieces. Sink tops use open stone borders around genuine recessed basins. Stainless steel, enamel, glass, porcelain and cabinet colors remain independently editable. Sink worktop finishes use the existing finish controls.

Cooktops and the car use existing reversible surface placement. Wall ovens use wall placement at initial heights of 750, 250 and 1150 mm for single, double and steam models. Sink stations deliberately do not advertise a continuous tabletop support across their open bowls.

All 17 previews were rendered and reviewed. Review corrections closed refrigerator roofs, filled sink cabinet fascias and removed center burners underneath the wide range griddle. The Skyline keeps its accepted original source in `assets-source/skyline-brick-study` as well as its dimensioned catalog source.

## Verification

The collection regression suite checks real GLB dimensions, ground origins, bounded geometry, Babylon imports, counter placement, independent material round-trips, undo, wall mounting and sink finish support. Kitchen models stay below 60,000 triangles; the Skyline contains 74,336 triangles. Production uses the existing lossless mesh optimization and R2 asset pipeline. Full application, asset, hosting and release checks are required before merge and publication.
