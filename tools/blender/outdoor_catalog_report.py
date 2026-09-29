"""Reproduce the outdoor research inventory from the 48 selected original models.

This writes only this agent's source reference report and provenance files.
Research URLs were reviewed on 2026-09-29; it never downloads vendor imagery.
"""
import hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCES={
 'ikea':('IKEA SEGERON and outdoor buying guide','https://www.ikea.com/de/en/p/segeroen-table-outdoor-white-beige-10510807/','Powder-coated aluminium and steel, rubber isolation strips and a 2120 x 910 x 750 mm table. Original collection uses independent chairs and different-sized tables.'),
 'ikea-guide':('IKEA outdoor buying guide','https://www.ikea.com/au/en/files/pdf/e8/46/e846cb8d/outdoor-buying-guide-fy24.pdf','Broad comparison of rope, timber, folding, sling and small-balcony constructions; used to avoid making every patio seat another cushion box.'),
 'article':('Article Teaka outdoor dining chair','https://www.article.com/product/23924/teaka-outdoor-dining-chair-natural-teak','Teak structural frame and synthetic wicker seat/back, exposed timber character and olefin cushion. Published envelope approximately 495 x 737 x 889 mm; our models are original, not replicas.'),
 'westelm':('West Elm Telluride outdoor sofa','https://www.westelm.com/products/telluride-outdoor-sofa-h9584/pip-print.html','Wire-brushed wood and outdoor upholstery inform directional grain, restrained roughness and tailored pads. Published sofa widths range from 72 to 92 inches; no stock photos are embedded.'),
 'pb-table':('Pottery Barn Malibu extendable outdoor table','https://www.potterybarn.com/products/malibu-metal-rectangular-dining-table/pip-print.html','The 76–103 inch extension-table family establishes a separate extended dining silhouette. Our teak trestle construction and leaf layout are original.'),
 'crate':('Crate & Barrel Dune outdoor collection','https://www.crateandbarrel.com/outdoor-furniture/dune-outdoor-collection/1','Open metal frames and mesh sides demonstrate how a sofa can read light and airy while retaining box cushions and a legible load-bearing structure.'),
 'crate-general':('Crate & Barrel outdoor furniture catalog','https://www.crateandbarrel.com/outdoor-furniture/','Compared teak, wicker, metal, slab tables, planters and lighting rather than taking one matching set as the complete outdoor vocabulary.'),
 'costco':('Costco backyard furniture and shade catalog','https://www.costco.com/opt/backyard-furniture-and-shade','Survey includes sling/conversation seating, modular sets, pergolas, gazebos and shade sails. Used for category coverage, not for an exact branded envelope.'),
 'costco-guide':('Costco patio buying guide','https://www.costco.com/f/-/patio-buying-guide','Whole-yard scope includes dining, shade, cooking, heating, spas and accessories; our finite build list fills construction gaps beside the existing catalog.'),
 'lowes-chair':('Lowes hanging patio chair catalog','https://www.lowes.com/pl/patio-furniture/patio-chairs/hanging/4294415670-57270615','Hanging, zero-gravity, sling and woven categories establish distinct mechanics. New models keep a fixed displayed pose and do not claim working pivots.'),
 'egg':('Lowes hanging wicker egg chair','https://www.lowes.com/pd/Best-Selling-Home-Decor-Hanging-Egg-Outdoor-Wicker-Chair/1003261524','Product reference shows a suspended open basket, freestanding support and fitted cushion. The listed product is discontinued; this is construction inspiration, not an availability recommendation.'),
 'polywood':('POLYWOOD Nautical chaise lounge','https://www.polywood.com/collections/outdoor-chaise/products/nautical-chaise-nac2280','Marine-polymer slats and a poolside lounge category inspired a new contoured shell; the existing teak chaise is retained as a separate construction.'),
 'trex':('Trex Outdoor Furniture catalog','https://www.trexfurniture.com/collections/all','Conversation, bar, chaise and dining families checked for missing outdoor functions. Original stone conversation-table geometry is not a Trex replica.'),
 'yardistry':('Yardistry 12 x 14 gazebo dimension drawing','https://storage.yardistrystructures.com/Footer_Drawings/12x14_Yardistry_Gazebo_LAYOUT_DIMENSIONS.pdf','Published roof 4290 x 3680 mm, height about 3170 mm; outside posts approximately 3920 x 3310 mm. Modeled roof-envelope dimensions are retained independently of post spacing.'),
 'yardistry-manual':('Yardistry gazebo assembly manual','https://yardistrystructures.com/wp-content/uploads/2022/11/YM12941Z_12_x_14_Gazebo_with_Aluminum_Roof_Instruction_August_22_2019.pdf','Hip roof, paired beams, individual rafters, knee braces, metal cap details and bolted post assembly guide original construction.'),
 'backyard':('Backyard Discovery Sarasota louvered pergola','https://www.backyarddiscovery.com/collections/pergolas/products/12x10-sarasota-steel-louvered-pergola','Reference has steel posts, anchor plates, louver pivots, a wand and concealed gutter paths. The original 4000 x 3000 x 2500 mm model has a fixed open-louver pose.'),
 'umbrella':('Home Depot Hampton Bay cantilever umbrella','https://www.homedepot.com/p/336032655','11-foot octagonal olefin canopy, crank and off-center support. Original model includes a vented cap, radial rib system and ballast quarters; full footprint includes mast and canopy.'),
 'awning':('SunSetter motorized awning construction','https://www.sunsetter.com/c/awnings/sunsetter-motorized-awning/','Lateral elbow arms operate below a fabric roller and front tension bar. Published sizes cover 8–20 foot widths with varying projection; our 3600 x 2700 mm fixed-open pose is a design target.'),
 'awning-fabric':('SunSetter fabric and color library','https://www.sunsetter.com/cm/fabrics-and-colors/','Acrylic fabrics include solid and striped woven appearances. Our alternating sage/ivory panels, piping and original texture maps are newly authored.'),
 'intex':('Intex rectangular Ultra XTR replacement components','https://intexcorp.com/replacement-parts/above-ground-pools/ultra-xtr-frame/18ft-x-9ft-x-52in/2020/26355w/pool/','18 x 9 foot liner family has separate horizontal beams and splayed support members. Our 5950 x 3450 mm catalog envelope includes braces beyond the 5490 x 2740 mm basin.'),
 'intex-round':('Intex Ultra XTR round pool and filter set','https://intexcorp.com/above-ground-pools/ultra-xtr-frame-above-ground-pool-w-sand-filter-pump-18-x-52/','Round frame, separate liner, pump, sand filter, ladder and plumbing justify separately placeable poolside hardware. Our water planes remain below the lip and use no terrain cuts.'),
 'bestway':('Bestway 14 x 48 inch frame components','https://bestwayusa.com/products/14-x-48-pool-replacement-frame-1-of-2-1a56p0735223','Top rails and vertical legs are separately recognizable. Original model is 4500 mm across including feet, surrounding an approximately 4270 mm liner, height 1220 mm.'),
 'hotspring':('Hot Spring Beam spa','https://www.hotspring.com/shop/limelight/beam','Published 2030 x 2030 x 840 mm four-seat spa. Original shell uses four separate seat/headrest areas, visible jets, controls and water below the rim.'),
 'hotspring-dims':('Hot Spring spa dimensional references','https://www.hotspring.com/learning-center/hot-tubs-sizes-and-renderings','Manufacturer treats dimensions as layout references. The model is a static layout aid; no engineering, water capacity or installation performance is asserted.'),
 'frontgate':('Frontgate outdoor living design case study','https://www.frontgate.com/homeplusstyle/decorating/inspiration/design-with-frontgate-tanya-foster/','Teak poolside seating and separate towel accessories informed the valet category. The open storage valet is an original composite design with no vendor-matched dimensions.'),
 'formidra':('Formidra Dada Curve shower','https://formidradocceitalia.it/dada-curve/','Published height 2280 mm and base 324 x 140 mm. Original curved-column shower adds a complete projection envelope, mixer, foot tap and separate overhead outlet.'),
 'kamado':('Kamado Joe Classic II construction details','https://international.kamadojoe.com/products/classic-joe-ii','Ceramic dome, gasket band, rear hinge, rain-cap vent, ash slider and temperature dial; source lists width 1174 mm and height 1210 mm. Our original cart retains those proportions with a 770 mm depth.'),
 'weber':('Weber Searwood 600 specifications','https://www.weber.com/US/en/wood-pellet/searwood/searwood-600-wood-pellet-grill/1500120.html','Closed envelope about 978 x 584 x 1162 mm. Model separates barrel, side pellet hopper, controller, grease cup, handles, chimney and cart; no live electronics.'),
 'newage':('NewAge outdoor kitchen catalog','https://assets.newageproducts.com/products-catalog-pdf/Outdoor%20Product%20Catalog%20%28Compressed%29.pdf','32-inch modular bases and approximately 36-inch worktop height guide sink/prep proportions. Separate doors, louvered inserts, vent paths and adjustable feet are authored.'),
 'newage-suite':('NewAge stainless outdoor kitchen collection','https://newageproducts.com/outdoor-kitchen-cabinets-stainless-steel/','Compared sink cabinets, glass-door cooling, storage, bar units and prep surfaces. New pieces remain independent modules, with actual shelf/worktop planes rather than one combined kitchen mesh.'),
 'permasteel':('Permasteel 80-quart patio cooler','https://permasteel.life/coolers/patio-coolers/permasteel-80-quart-antique-patio-cooler-black/','Published 37.5 x 20.25 x 33.5 inches. Original teal cooler includes split lids, handles, drain, opener, cap catcher, shelf and casters at 950 x 515 x 860 mm.'),
 'vego':('Vego modular raised-bed and trellis systems','https://www.vegogarden.com/collections/classic-metal-raised-garden-beds/products/metal-frame-string-trellis','Modular metal bed construction and separate growing support informed corrugated panels with protected edges and visible joints. Planters are intentionally not pre-filled with heavy foliage.'),
 'vego-screen':('Vego modern privacy trellis','https://www.vegogarden.com/en-ca/products/vego-modern-privacy-trellis','Screen/bed combination shows vertical growing and privacy as a distinct outdoor function. New cedar screen uses a stable base and recessed narrow trough.'),
 'vego-obelisk':('Vego birdcage trellis','https://returns-app.vegogarden.com/product/birdcage-trellis-2-pack','Freestanding decorative climbing supports motivated an open tapered obelisk with graduated rings and a shaped finial.'),
 'keter':('Keter Store-It-Out Max','https://www.keter.com/en-gb/17199416.html','Published 1455 x 820 x 1250 mm external envelope. Door/lid seams, molded weatherboards and vents distinguish it from the existing long deck chest and full garden shed.'),
 'keter-catalog':('Keter 2025 outdoor catalog','https://keter-lifestyle.com/files/file/katalogi/EEN-KETER-Outdoor-catalogue-2025.pdf','Compared elevated growing, outdoor storage and entertaining functions. Original tiered cedar planter is a different construction from the existing potting bench.'),
 'forest':('Forest Garden small overlap log store','https://www.forestgarden.co.uk/product/small-overlap-log-store/','Reference uses a protected pitched roof, overlap side boards and a ventilated raised floor. Our wider, shorter empty log-store envelope is 1200 x 650 x 1700 mm.'),
 'forest-bench':('Forest Garden sleeper furniture catalog','https://www.forestgarden.co.uk/wp-content/uploads/2022/01/Forest-2022-Brochure-for-website_3.pdf','Separate planters and thick timber bench elements inspire a planter-ended bench, with a genuinely usable central sitting span and two recessed planting boxes.'),
 'heater':('Home Depot Hampton Bay standing heater','https://www.homedepot.com/p/318485576','Mushroom reflector, guarded cylindrical burner, mast, tank shroud and wheels define the recognizable heater silhouette; modeled off, with no simulated gas or heat.'),
 'pyramid':('Home Depot pyramid glass-tube heater','https://www.homedepot.com/p/321645147','Distinct tapered safety cage, transparent central column, lower fuel cabinet and small reflector. The decorative model is off and does not imitate a working flame.'),
 'festoon':('Home Depot Hampton Bay string-light pole','https://www.homedepot.com/p/328970430','Segmented steel poles, clips and overhead festoon spacing were researched; the new assembly adds deliberately visible weighted bases and a short nine-bulb span.'),
 'lantern':('Pottery Barn Caleb metal lantern','https://www.potterybarn.com/products/caleb-lantern-collection-SPAF-color-black-color/','Metal cage, clear glazed panels, cap and handle inspire a separate original bronze hurricane lantern with a modeled LED candle.'),
 'torch':('TIKI Urban metal torch','https://www.tikibrand.com/4-in-1-urban-metal-torch','Metal reservoir, long stake, wick collar and snuffer are separately modeled. Original torch is an unlit decorative item and does not implement fuel or fire.'),
 'haws':('Haws watering-can construction','https://haws.co.uk/','Long spout and removable rose distinguish the outdoor watering can. Original hollow can has separate handles, rolled edges and individual rose perforations.'),
}

GROUPS=[
 (['outdoor-rope-dining-chair'],['ikea','ikea-guide'],['woven-patio-chair']),
 (['outdoor-teak-sling-chair'],['article','ikea-guide'],['sling-patio-chair']),
 (['outdoor-woven-club-chair'],['article','crate-general'],['woven-patio-chair']),
 (['outdoor-aluminium-sofa'],['crate'],['patio-loveseat','patio-corner-sofa']),
 (['outdoor-teak-daybed'],['westelm','crate-general'],['patio-chaise']),
 (['outdoor-hanging-egg-chair'],['egg','lowes-chair'],[]),
 (['outdoor-zero-gravity-chair'],['lowes-chair','costco'],['sling-patio-chair']),
 (['outdoor-steel-bistro-chair'],['ikea-guide'],['patio-dining-chair']),
 (['outdoor-extendable-dining-table'],['pb-table'],['patio-dining-table']),
 (['outdoor-ceramic-dining-table'],['crate-general','ikea'],['patio-dining-table']),
 (['outdoor-folding-balcony-table'],['ikea-guide'],['patio-bistro-table']),
 (['outdoor-round-conversation-table'],['trex','crate-general'],['patio-bistro-table']),
 (['outdoor-louvered-pergola'],['backyard','costco'],[]),
 (['outdoor-timber-gazebo'],['yardistry','yardistry-manual'],['compact-garden-shed']),
 (['outdoor-retractable-awning'],['awning','awning-fabric'],['patio-parasol']),
 (['outdoor-cantilever-parasol'],['umbrella'],['patio-parasol']),
 (['outdoor-triangle-shade-sail'],['costco'],['patio-parasol']),
 (['pool-rectangular-frame'],['intex'],[]),
 (['pool-round-frame'],['bestway','intex-round'],[]),
 (['pool-timber-plunge'],['hotspring-dims','costco-guide'],[]),
 (['outdoor-square-hot-tub'],['hotspring','hotspring-dims'],[]),
 (['outdoor-pool-ladder'],['intex-round'],[]),
 (['outdoor-pool-lounger'],['polywood'],['patio-chaise']),
 (['outdoor-pool-towel-valet'],['frontgate'],['towel-ladder']),
 (['outdoor-solar-shower'],['formidra'],['shower-walk-in']),
 (['outdoor-kamado-grill'],['kamado'],['kettle-bbq','gas-bbq']),
 (['outdoor-pellet-smoker'],['weber'],['gas-bbq','griddle-cart']),
 (['outdoor-sink-cabinet'],['newage'],['garden-potting-bench']),
 (['outdoor-fridge-cabinet'],['newage-suite'],[]),
 (['outdoor-drawer-cabinet'],['newage'],[]),
 (['outdoor-bar-island'],['newage-suite'],['bar-cart']),
 (['outdoor-cooler-cart'],['permasteel'],['bar-cart']),
 (['outdoor-stainless-prep-table'],['newage-suite'],['garden-potting-bench']),
 (['outdoor-raised-garden-bed'],['vego'],['raised-flowerbed']),
 (['outdoor-vertical-planter'],['keter-catalog','vego'],['garden-potting-bench']),
 (['outdoor-trellis-screen'],['vego-screen'],[]),
 (['outdoor-bin-store'],['keter'],['weatherproof-deck-box','compact-garden-shed']),
 (['outdoor-log-store'],['forest'],['compact-garden-shed']),
 (['outdoor-planter-bench'],['forest-bench'],['garden-bench','raised-flowerbed']),
 (['outdoor-garden-obelisk'],['vego-obelisk'],[]),
 (['outdoor-patio-heater'],['heater'],[]),
 (['outdoor-pyramid-heater'],['pyramid'],[]),
 (['outdoor-string-light-poles'],['festoon'],['garden-path-bollard-light']),
 (['outdoor-caged-lantern'],['lantern'],[]),
 (['outdoor-citronella-torch'],['torch'],[]),
 (['outdoor-watering-can'],['haws'],[]),
 (['outdoor-pool-equipment'],['intex-round'],[]),
 (['outdoor-deck-step'],['hotspring-dims'],['deck-patio']),
]


def main():
    rows=json.loads((ROOT/'src/outdoorLivingExpansion.json').read_text())
    by_id={r[0]:r for r in rows};refs=[]
    review_path=ROOT/'assets-source/outdoor-living-review.json'
    reviewed={r['id']:r for r in json.loads(review_path.read_text())['items']} if review_path.exists() else {}
    def status_for(catalog_id):
        entry=reviewed.get(catalog_id);model=ROOT/'public/models/furniture'/f'{catalog_id}.glb'
        if entry and model.exists() and hashlib.sha256(model.read_bytes()).hexdigest()==entry['glbSha256']:
            return entry['status']
        return 'authored_geometry_pending_root_Blender_visual_review'
    for i,(ids,keys,compared) in enumerate(GROUPS,1):
        row=by_id[ids[0]]
        refs.append({'family':f'OUT-{i:03d}','catalogIds':ids,'referenceUrls':[SOURCES[k][1] for k in keys],
          'sourceKeys':keys,'accessedOn':'2026-09-29','evidence':row[7],
          'dimensionBasis':'Original design envelope informed by references; normalized actual full-mesh dimensions, not manufacturer-certified replica or installation clearance.',
          'dimensionsMm':{id:by_id[id][3:6] for id in ids},'existingIdsCompared':compared,
          'duplicateDecision':'Distinct construction or use; retain existing related models and IDs.',
          'assetUse':'Research only. No vendor photos, logos, textures, CAD or meshes embedded. Original editable Blender geometry; separately recorded licensed material maps.',
          'status':status_for(ids[0])})
    (ROOT/'assets-source/outdoor-collection-references.json').write_text(json.dumps(refs,indent=2)+'\n',encoding='utf-8')
    lines=['# Outdoor living catalog research and build report','',
      'Research date: 29 September 2026. This extension adds **48 independently placeable original models** across outdoor seating, dining, shelter, pools, spas, cooking, storage, gardening, heating and lighting. It surveys 44 primary catalog/product/manual references. Existing patio furniture, botanical assets, grills, garden shed, greenhouse, potting bench, deck chest and paving remain in the library.','',
      'The selected scope is a practical whole-yard collection: compact balcony and ordinary garden options sit alongside spacious dining, shade and poolside arrangements. Each listed item has an implemented original builder. Exported geometry and render acceptance are tracked separately; source authoring alone is not a release claim.','',
      '## Research decisions','',
      '- Seating must differ structurally: open rope, timber sling, woven shell, metal sofa, double daybed, suspended egg, elastic-laced recliner and folding steel bistro chair. Timber grain follows actual pieces; fabrics use rich muted color, subtle weave, boxed seams and piping.','- Dining provides extended teak, ceramic slab, compact folding and low circular stone constructions. Chairs and decorative objects stay independent.','- Shade includes louvered pergola, hip-roof timber gazebo, lateral-arm awning, offset parasol and catenary-edged sail. Post bases, elbows, braces, ribs and fabric edges remain modeled rather than texture-only.','- Above-ground pools, raised plunge pool and spa use open basins with water below the rim. Catalog width/depth includes projecting feet and braces. Ladder, filter/pump, shower, valet, lounger and access steps are separate objects.','- Outdoor kitchens use sink, fridge, drawers, bar island and trolley modules, plus ceramic kamado and pellet smoker. The sink bowl is recessed and the fridge glazing reveals actual wire shelves.','- Gardening adds corrugated raised beds, tiered troughs, privacy screening, bin and log storage, planter-ended seating and climbing support; planting remains optional.','- Heating and lighting retain recognizable enclosures, reflectors and guards. Heater/torch models are unlit; lamps have visual emission without adding an expensive live-light system.','',
      '## Items to build and review','',
      '| Family | Catalog ID | Original envelope W × D × H, mm | Construction |','| --- | --- | --- | --- |']
    for ref in refs:
        r=by_id[ref['catalogIds'][0]];lines.append(f"| {ref['family']} | `{r[0]}` | {' × '.join(map(str,r[3:6]))} | {r[7]} |")
    lines+=['','## Catalog and dimension evidence','',
      'Reference dimensions and catalog dimensions are deliberately distinguished below. Every new GLB is normalized to the declared complete physical envelope after construction. Product naming describes an original design, not a licensed replica. Prices, product availability and marketing performance claims are not part of model acceptance.','']
    for key,(title,url,evidence) in SOURCES.items():lines += [f'- **{key} — [{title}]({url}):** {evidence}']
    lines+=['','## Placement and performance contract','',
      'All pieces are placed on the lowest layer ground or supported paving, except the wall awning and two tabletop-capable accessories (lantern and watering can). The awning has a 2150 mm default bottom mount and fixed 2700 mm projection. Other mechanisms are fixed poses, including pergola blades, parasol, recliner, folding chair/table, extension table, cooler lids and grill lids.','',
      'The new furniture exposes conservative measured support planes only on genuine horizontal seats, shelves and tops. No water, roof or thin canopy is advertised as a support surface. Pools do not excavate ground, gazebos do not become room architecture and pool ladders/steps do not implement swimming or pedestrian simulation.','',
      'Original separately editable components are saved before browser mesh joining. Normal/base-color/roughness textures use the shared documented material pipeline; manufacturer images and logos are never reused. Front, rear and underside review must confirm construction, hollow interiors, normals, seams, base contact and silhouette. Runtime rendering, dimensions, stable IDs/material keys, actual support contacts and bounded mesh sizes must pass the root release checks.','',
      '## Current state','',
      f"48 catalog rows and 48 original model builders are complete. Source compilation and static dispatch parity passed. {sum(r['status']=='Blender_exported_and_three_view_reviewed' for r in refs)} final Blender exports have matching recorded three-view acceptance in `assets-source/outdoor-living-review.json`. The actual-binary verifier checks dimensions, original sources, textures, canonical keys and measured support contact/clearance. Browser acceptance and release remain the parent collection workflow's responsibility.",'']
    (ROOT/'docs/outdoor-collection-research.md').write_text('\n'.join(lines),encoding='utf-8')


if __name__=='__main__':main()
