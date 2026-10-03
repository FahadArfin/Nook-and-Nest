"""Catalog material upgrades with exact, reviewable compatibility contracts.

The plan generator and texture generator run without Blender. Only
``apply_materials`` imports bpy. Alpha, emission and artwork are preserved.
Ordinary albedo, normal and roughness images can change only together through
the separate, hash-bound licensed scan plan. Unknown roles fail closed.
"""
import argparse
import hashlib
import json
import math
import runpy
from pathlib import Path
import struct
import zlib

PLAN = 'assets-source/catalog-realism/material-plan.json'
PROVENANCE = 'assets-source/catalog-realism/material-provenance.json'
LIBRARY = 'assets-source/catalog-realism/materials'
UV_NAME = 'RealismUV'
PAPER_FACE_ATTRIBUTE = 'catalog_paper_faces'
PAPER_UV_DENSITY = 12.0
AQUARIUMS = {'desktop-aquarium', 'planted-aquarium', 'reef-aquarium'}

# These are restrained authored starting points, not measured universal values.
# repeatM is the physical extent of one image tile on a nominal catalog model.
PROFILES = {
    'fabric': dict(repeatM=[.271, .271], roughness=[.88, .96], normalStrength=.16),
    'canvas': dict(repeatM=[.32, .32], roughness=[.84, .94], normalStrength=.16),
    'wood': dict(repeatM=[1.83, 1.83], roughness=[.50, .65], normalStrength=.14),
    'endgrain': dict(repeatM=[.12, .12], roughness=[.54, .68], normalStrength=.08),
    'rattan': dict(repeatM=[.06, .06], roughness=[.72, .84], normalStrength=.10),
    'metal': dict(repeatM=[.10, .10], roughness=[.27, .37], normalStrength=.055),
    'powdercoat': dict(repeatM=[.08, .08], roughness=[.53, .63], normalStrength=.07),
    'ceramic': dict(repeatM=[.08, .08], roughness=[.20, .28], normalStrength=.025),
    'stone': dict(repeatM=[.16, .16], roughness=[.62, .76], normalStrength=.10),
    'bark': dict(repeatM=[.12, .30], roughness=[.86, .96], normalStrength=.15),
    'rubber': dict(repeatM=[.06, .06], roughness=[.78, .90], normalStrength=.06),
    'polymer': dict(repeatM=[.07, .07], roughness=[.38, .48], normalStrength=.035),
    'paint': dict(repeatM=[.08, .08], roughness=[.48, .58], normalStrength=.035),
    'leaf': dict(repeatM=[.04, .04], roughness=[.48, .60], normalStrength=.025),
    'petal': dict(repeatM=[.025, .025], roughness=[.66, .76], normalStrength=.02),
    'paper': dict(repeatM=[.06, .06], roughness=[.82, .94], normalStrength=.035),
    'clay': dict(repeatM=[.10, .10], roughness=[.66, .80], normalStrength=.07),
    'soil': dict(repeatM=[.08, .08], roughness=[.90, .98], normalStrength=.12),
}

# Exact semantic keys from the authored builders, never substring matching.
GROUPS = {
    'wood': '''wood-honey-textured|wood-dark|oiled-maple|maple-lamella|walnut|walnut-case|honey-oak|honey-oak.001|garage-oiled-maple-wood|garage-maple-lamella-wood|outdoor-teak-grain|outdoor-teak-grain-light|outdoor-cedar-grain|warm-teak-infill|variant-surface-wood|handrail''',
    'endgrain': 'end-grain|outdoor-teak-endgrain',
    'fabric': '''linen-textured|upholstery-textured|entry-sage-upholstery|entry-terracotta-textile|entry-slate-upholstery|entry-floor-chair-plum|household-slate-fabric|linen|cotton|bluecloth|claycloth|natural-linen|indigo-cloth|sage-upholstery|soft-grey-chenille|modern-tailored-welting|tailored-tone-on-tone-stitch|seam|stitched-warm-edge|mustard-cloth|play-yard-soft-mesh''',
    'canvas': 'canvas-cream|canvas-piping|outdoor-slate-canvas|outdoor-ivory-canvas|outdoor-sage-canvas|outdoor-clay-canvas',
    'rattan': 'natural-rattan|entry-natural-rattan|entry-rattan-shadow|entry-screen-reed|woven-flax-rope|outdoor-rope-fiber',
    'metal': '''brushed-steel|brushed-stainless-steel|brushed-stainless-steel.001|modern-brushed-aluminum|brushed-nickel-hardware|satin-steel|satin-stainless-fixings|polished-chrome-trim|household-champagne-brass|champagne-brass|joinery-aged-brass|aged-brass-fitting|antique-brass|warm-brass|aged-bronze|aged-bronze-frame|outdoor-brushed-bronze|garage-satin-machined-steel|garage-machined-brass|weathered-fasteners|door-hardware|Rims - satin alloy''',
    'powdercoat': '''powder-coated-charcoal|graphite-metal|graphite-hardware|graphite-iron-frame|cast-iron|cast-iron-grates|garage-graphite-cast-metal|garage-oxide-red-powdercoat|garage-putty-powdercoat|garage-slate-powdercoat|outdoor-graphite-powdercoat|outdoor-forest-powdercoat|variant-surface-metal|warm-ivory-rack|stair-structure|tv-feet''',
    'ceramic': '''warm-ceramic|warm-porcelain|porcelain-white|modern-porcelain-detail|ceramic-fitting-detail|fixture-warm-porcelain|slate-blue-glaze|glazed-sage-tile|terracotta-glaze|ceramic-tiles|outdoor-kamado-ceramic|figurine-porcelain-skin''',
    'stone': '''ivory-marble|honed-travertine|warm-veined-marble|warm-limestone|outdoor-honed-basalt|outdoor-limestone|garage-abrasive-stone|refractory_baking_stone|firebrick-ochre|mortar|tile-grout|grout|paving-joints|paving-stone|variant-surface-concrete''',
    'bark': 'bark-umber',
    'rubber': 'rubber-gaskets|matte-rubber|garage-fine-rubber|recessed-rubber-gaskets|backing-and-foot-pads|Tires - dark rubber',
    'polymer': '''garage-graphite-moulded-polymer|garage-ivory-utility-polymer|garage-blue-hose-polymer|garage-ochre-tool-polymer|garage-olive-polymer|fixture-ivory-acrylic|outdoor-spa-acrylic|outdoor-pool-liner|matte-graphite|drone-light-grey|circuit-board-olive|ruby-control-knobs|figurine-layered-hair|Body - silver grey ABS|Axle pins - tan|Chassis - graphite|Livery - electric blue''',
    'paint': '''black-enamel|black-enamel.001|sage-enamel|jade-enamel|graphite-enamel|warm-lacquer|lacquered-cabinet-panels|household-storm-sage-enamel|household-garage-slate-enamel|variant-surface-enamel|outdoor-cooler-teal|cabinet-body|door-frame|door-panel-trim|stair-risers''',
    'leaf': '''maple-ochre|maple-russet|maple-gold|foliage-main|foliage-shadow|foliage-new-growth|leaf-green|leaf-light|fresh-leaf-tips|garden-leaves|blue_fescue_glaucous_leaf|household-botanical-deep-green|household-botanical-young-green|household-botanical-veins|household-botanical-golden-bands|household-snake-muted-mottling''',
    'petal': 'petal-blush|lavender-florets|echinacea_rose_petals|household-orchid-ivory-petals|household-orchid-blush-petals|household-orchid-raspberry-lip|household-peace-lily-spathe|household-peace-lily-spadix',
    'paper': 'household-warm-paper|ivory-pages',
    'clay': 'terracotta',
    'soil': 'household-potting-soil|outdoor-potting-soil',
}
EXACT_PROFILES = {key: profile for profile, names in GROUPS.items() for key in names.split('|')}
# Generic palette keys are resolved by exact model IDs after inspecting their
# builders. They do not become timber merely because a model has wooden parts.
VARIANT_MODELS = {
    'ceramic': '''alcove-bathtub|bath-shower-combo|clawfoot-bathtub|corner-shower|decorative-bowl|one-piece-toilet|oval-freestanding-tub|pedestal-sink|two-piece-toilet|vessel-sink|walk-in-shower|wall-hung-sink|wall-hung-toilet|ceramic-oval-dining-table''',
    'polymer': '''adventurer-figurine|brick-roadster|desktop-monitor|keyboard-mouse|laptop|mecha-figurine|mini-pc|pc-tower|pedestal-fan|tower-fan|wide-monitor''',
    'stone': 'marble-plinth-side-table|round-marble-dining-table|travertine-coffee-table',
    'fabric': 'daybed|low-kids-bunk|storage-bunk|twin-full-bunk|pleated-table-lamp',
    'paper': 'wrapped-presents',
    'powdercoat': 'c-side-table|chrome-cantilever-side-table|steel-tray-coffee-table|tray-side-table',
    'paint': '''atelier-espresso|atelier-stand-mixer|bath-medicine-cabinet|bath-mirror-halo|bath-mirror-pill|bath-mirror-rounded|breakfast-counter-table|breakfast-square-table|breakfast-tulip-table|coffee-table|compact-computer-desk|corner-desk|cube-display-shelf|curved-executive-desk|desk|dining-table|dishwasher|display-bookcase|double-bath-vanity|drum-coffee-table|dryer|dual-motor-desk|electric-kettle|floating-bath-vanity|four-slot-toaster|gaming-desk|glass-coffee-table|glass-dining-table|glass-studio-desk|gooseneck-pro-kettle|high-chair|high-performance-blender|kids-round-play-table|lacquer-block-table|ladder-display-shelf|lift-coffee-table|nesting-tables|oval-coffee-table|pedestal-computer-desk|pedestal-dining-table|pedestal-nightstand|pill-coffee-table|precision-burr-grinder|precision-food-processor|pressure-rice-cooker|range-oven|refrigerator|ribbed-pedestal-side-table|rice-cooker|rotary-waffle-maker|round-table|secretary-desk|side-table|single-bath-vanity|slow-press-juicer|stacked-laundry|standing-desk|toy-organizer|trestle-desk|wall-shelf|washer|waterfall-table|white-steel-desk|window-arched|window-awning|window-bay|window-casement|window-picture|window-sash''',
}
PAIR_PROFILES = {(model, 'variant-surface'): profile for profile, models in VARIANT_MODELS.items() for model in models.split('|')}
for model in 'chimney-hood|countertop-microwave|dome-pendant|espresso-machine|filter-coffee-maker|glass-air-fryer|linear-pendant|microwave-hood|stand-mixer|two-slot-toaster|under-cabinet-hood'.split('|'):
    PAIR_PROFILES[model, 'variant-surface.001'] = 'paint'
for model, suffix in [('breakfast-nook-table', '.001'), ('breakfast-nook-chair', '.002')]:
    PAIR_PROFILES[model, 'natural-oak' + suffix] = 'wood'
    PAIR_PROFILES[model, 'backing-and-foot-pads' + suffix] = 'rubber'
    PAIR_PROFILES[model, 'variant-surface' + suffix] = 'paint'
for model in 'low-kids-bunk|storage-bunk|twin-full-bunk|model-sailboat'.split('|'):
    PAIR_PROFILES[model, 'warm-cream'] = 'fabric'
for model in ['brick-roadster', 'mecha-figurine']:
    PAIR_PROFILES[model, 'warm-cream'] = 'polymer'
PAIR_PROFILES['mecha-figurine', 'accent-clay'] = 'polymer'
for model in 'books-stacked|books-upright|bookshelf|wrapped-presents'.split('|'):
    PAIR_PROFILES[model, 'dusty-rose'] = 'paper'
for model in ['pet-bed', 'scallop-rug', 'stripe-runner']:
    PAIR_PROFILES[model, 'dusty-rose'] = 'fabric'
PAIR_PROFILES['bud-vase-trio', 'dusty-rose'] = 'ceramic'
PAIR_PROFILES['whiteboard', 'dusty-rose'] = 'polymer'
for model in ['blind-roller', 'curtain-blackout-pair', 'curtain-linen-pair', 'linen-flush-light']:
    PAIR_PROFILES[model, 'ivory-detail'] = 'fabric'
for model in ['blind-venetian', 'citrus-press', 'countertop-blender', 'food-processor', 'induction-hob', 'toaster-oven', 'tripod-floor-lamp']:
    PAIR_PROFILES[model, 'ivory-detail'] = 'paint'
for model in ['manga-deluxe-stack', 'manga-garden-row', 'manga-pilot-row']:
    PAIR_PROFILES[model, 'cobalt-blue'] = 'paper'
PAIR_PROFILES['apartment-lamp-ceramic', 'cobalt-blue'] = 'ceramic'
for model in ['bambu-ams2', 'brick-ford-gt', 'brick-mclaren-mcl39', 'brick-perseverance', 'mini-network-rack', 'ring-doorbell', 'technics-turntable', 'toilet-japan-smart', 'toilet-neorest-wall', 'unifi-cloud-gateway', 'unifi-g4-doorbell', 'unifi-g6-instant']:
    PAIR_PROFILES[model, 'cobalt-blue'] = 'polymer'
for model in ['bambu-ams2', 'brick-mclaren-mcl39', 'cordless-vacuum', 'dji-mini-5-pro', 'technics-turntable']:
    PAIR_PROFILES[model, 'papaya-orange'] = 'polymer'
PAIR_PROFILES['kitchen-pendant-dome', 'papaya-orange'] = 'paint'
for model in ['laptop', 'pedestal-fan', 'tower-fan']:
    PAIR_PROFILES[model, 'warm-ivory'] = 'polymer'
for key in ['collectible-racing-red', 'collectible-enamel-accent', 'crimson']:
    EXACT_PROFILES[key] = 'polymer'
# modern_models keeps legacy color-slot names while constructing molded product
# housings. Its named parts establish these roles; the old key is not evidence
# of timber. Speaker cabinets explicitly described as wood retain wood profiles.
for model in '''smart-pet-feeder|dual-pet-feeder|pet-water-fountain|rotating-cat-litter-box|compact-speaker|soundbar|brick-ocean-liner|brick-sailing-ship|brick-space-cruiser|sonos-arc-ultra|sonos-beam-ultra|sonos-beam-gen2|sonos-ray|sonos-era-100|sonos-era-100-sl|sonos-era-300|sonos-five|sonos-move-2|sonos-roam-2|sonos-play|sonos-sub-4|sonos-sub-mini|sonos-amp|sonos-port|sonos-ace|sonos-ace-ultra|sonos-architectural-wall|sonos-architectural-ceiling|sonos-architectural-outdoor|sonos-era-100-pro|sonos-amp-multi|sonos-ceiling-8'''.split('|'):
    for key in ['wood-honey-textured', 'wood-dark']:
        PAIR_PROFILES[model, key] = 'polymer'
PAIR_PROFILES['adventurer-figurine', 'wood-dark'] = 'polymer'  # molded satchel
for model in ['open-metal-upper', 'steel-prep-island']:
    PAIR_PROFILES[model, 'wood-honey-textured'] = 'powdercoat'
for model in ['pill-coffee-table', 'ceramic-oval-dining-table']:
    PAIR_PROFILES[model, 'wood-honey-textured'] = 'ceramic'
PAIR_PROFILES['blind-venetian', 'ivory-detail'] = 'fabric'  # woven lift tape
PAIR_PROFILES['tripod-floor-lamp', 'ivory-detail'] = 'fabric'  # bound shade hem
PAIR_PROTECTED = {(model, 'ivory-detail'): 'etched or calibrated marks; preserve legibility' for model in ['countertop-blender', 'food-processor', 'induction-hob', 'toaster-oven']}
BED_CLOTH_MODELS = frozenset({'canopy-bed', 'channel-upholstered-bed', 'floating-platform-bed',
                            'low-platform-bed', 'metal-canopy-bed', 'queen-bed', 'single-bed',
                            'storage-lift-bed', 'storage-platform-bed', 'wingback-bed'})
for model in BED_CLOTH_MODELS:
    # Source inventory confirms this key occurs only on mattress and pillows.
    PAIR_PROFILES[model, 'modern-porcelain-detail'] = 'fabric'
PROTECTED_KEYS = {
    **{k: 'original artwork or map; preserve image and UV coordinates' for k in (
        'artwork-abstract', 'artwork-coast', 'artwork-botanical', 'artwork-landscape',
        'original-anime-artwork', 'original-anime-landscape-art', 'original-printed-art',
        'original-studio-art', 'original-apartment-classic', 'original-apartment-photo',
        'original-apartment-portrait', 'original-cultural-rug-pattern', 'NASA Earth Observatory globe')},
    **{k: 'optical, luminous, screen, marking or shadow role' for k in (
        'display-markings', 'display-markings.001', 'live-clock-display', 'quiet-blue-display',
        'cool-blue-display', 'television-screen', 'screen-midnight', 'nixie-orange-glow',
        'muted-status-light', 'warm-light', 'warm-led-strip', 'warm-diffuser', 'ivory-light-diffuser',
        'household-warm-opal-diffuser', 'opal-light-diffuser', 'outdoor-warm-led',
        'holiday-light-red', 'holiday-light-blue', 'holiday-light-yellow', 'golden-flame',
        'clear-glass', 'smoked-glass', 'modern-smoked-glass', 'smoked-door-glass',
        'clear-appliance-vessel', 'clear-inset-glass', 'clear-laminated-glass', 'clear-balcony-glass',
        'black-ceramic-glass', 'cabinet-glass', 'bathroom-shower-glass', 'window-glazing',
        'door-frosted-glass', 'tinted-appliance-glazing', 'garage-smoked-translucent-glass',
        'garage-clear-storage-polymer', 'garage-static-status-lens', 'fountain-water', 'outdoor-water',
        'bathroom-mirror', 'smoky-mirror', 'silvered-mirror', 'shower-glass',
        'Headlights - pale clear blue', 'Rear lenses - ruby', 'Indicators - amber',
        'recess-shadow-detail', 'bathroom-drain-shadow', 'modern-recess-charcoal', 'recesses',
        'ink-detail', 'ink-details', 'hot-water-marker', 'household-fine-insect-screen',
        'charcoal-details', 'pulls-and-controls')},
    **{k: 'runtime-selected finish; adding fixed normals would conflict with user finish' for k in (
        'countertop-surface', 'surface-stone', 'door-surface', 'door-surface.001', 'door-surface.002')},
}


def classify(model_id, key, material):
    """Resolve exact pair to an authored profile, or explicitly protect/defer it."""
    def result(profile=None, reason=None, status='classified', evidence='exact authored material key'):
        return dict(profile=profile, protectedReason=reason,
                    status='protected' if reason else status, roleEvidence=evidence)
    if model_id in AQUARIUMS:
        return result(reason='aquarium fidelity is frozen, including glass, fish, plants and frame')
    if (model_id, key) in PAIR_PROTECTED:
        return result(reason=PAIR_PROTECTED[model_id, key])
    if key in PROTECTED_KEYS:
        return result(reason=PROTECTED_KEYS[key])
    pbr = material.get('pbrMetallicRoughness', {})
    if material.get('alphaMode', 'OPAQUE') != 'OPAQUE' or pbr.get('baseColorFactor', [1, 1, 1, 1])[3] < 1:
        return result(reason='existing transparency contract')
    if material.get('emissiveTexture') or any(material.get('emissiveFactor', [])):
        return result(reason='existing emission contract')
    if any(k in material.get('extensions', {}) for k in ('KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_unlit')):
        return result(reason='existing optical or unlit material extension')
    if model_id in BED_CLOTH_MODELS and key == 'modern-porcelain-detail':
        return result('fabric', evidence='Source inventory confirms this exact key occurs only on mattress, gusseted_pillow and gusseted_pillow.001 in this model.')
    if (model_id, key) in PAIR_PROFILES:
        return result(PAIR_PROFILES[model_id, key], evidence='explicit model and key role from authored collection builders')
    rug = model_id in {'braided-rug', 'checker-rug', 'jute-rug', 'kilim-rug', 'arch-color-rug', 'diamond-wool-rug', 'wide-check-rug', 'bath-ribbed-rug', 'low-pile-carpet'}
    if rug and key in {'wood-dark', 'wood-honey-textured', 'terracotta', 'warm-cream', 'accent-clay', 'variant-surface', 'mustard-cloth'}:
        return result('fabric', evidence='explicit rug model and woven-part key exception')
    # Authored coneflowers deliberately duplicate petal materials. Keep each
    # original suffix as the placement key, with a bounded known alias list.
    if model_id == 'coneflower-drift' and key in {'echinacea_rose_petals.%03d' % n for n in range(1, 32)}:
        return result('petal', evidence='explicit coneflower petal material variants')
    if key in EXACT_PROFILES:
        return result(EXACT_PROFILES[key])
    return result(status='unclassified', evidence='no reviewed role rule; never guessed from a substring')


def material_record(model_id, material):
    key = material['name']
    classification = classify(model_id, key, material)
    base = material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
    adjustments = []
    sheen = material.get('extensions', {}).get('KHR_materials_sheen', {}).get('sheenColorFactor')
    if classification['profile'] in {'fabric', 'canvas'} and sheen:
        desired = [min(float(sheen[i]), float(base[i]) * .16) for i in range(3)]
        if desired != sheen:
            adjustments.append({'property': 'extensions.KHR_materials_sheen.sheenColorFactor',
                                'value': desired, 'reason': 'Reduce whitening cloth sheen; preserve original base RGBA and retain tinted fiber response.'})
    return {'materialKey': key, **classification, 'surfaceAdjustments': adjustments, 'baseline': {
        'baseColorFactor': material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1]),
        'alphaMode': material.get('alphaMode', 'OPAQUE'),
        'emissiveFactor': material.get('emissiveFactor', [0, 0, 0]),
        'hasBaseColorTexture': bool(material.get('pbrMetallicRoughness', {}).get('baseColorTexture')),
        'hasNormalTexture': bool(material.get('normalTexture')),
        'hasRoughnessTexture': bool(material.get('pbrMetallicRoughness', {}).get('metallicRoughnessTexture')),
    }}


def _protected_motion_keys(document):
    """New UV channels cannot be added to restored moving/shared subtrees."""
    result = set()
    nodes = document.get('nodes', [])
    def visit(index, inherited=False, path=frozenset()):
        if index in path:
            raise ValueError('Cycle in catalog node graph')
        node = nodes[index]
        extras = node.get('extras', {})
        protected = inherited or any(extras.get(k) for k in ('motion_role', 'shared_geometry', 'linked_bough'))
        if protected and 'mesh' in node:
            for primitive in document['meshes'][node['mesh']]['primitives']:
                if 'material' in primitive:
                    result.add(document['materials'][primitive['material']]['name'])
        for child in node.get('children', []):
            visit(child, protected, path | {index})
    children = {child for node in nodes for child in node.get('children', [])}
    for index in set(range(len(nodes))) - children:
        visit(index)
    return result


def build_plan(root):
    root = Path(root).resolve()
    models, unknown = {}, []
    for path in sorted((root / 'public/models/furniture').glob('*.glb')):
        if path.stem.startswith('backdrop-'):
            continue
        data = path.read_bytes()
        document = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
        records = [material_record(path.stem, m) for m in document.get('materials', [])]
        motion_keys = _protected_motion_keys(document)
        for record in records:
            if record['materialKey'] in motion_keys:
                record.update(profile=None, status='protected', protectedReason='material used by preserved motion/shared subtree; cannot add RealismUV', surfaceAdjustments=[])
        unknown.extend({'modelId': path.stem, 'materialKey': r['materialKey']} for r in records if r['status'] == 'unclassified')
        models[path.stem] = {'baselineGlbSha256': hashlib.sha256(data).hexdigest(), 'materials': records}
    return {'version': 1, 'colorPolicy': 'Preserve original base RGBA and albedo graph exactly; add no new color map.',
            'uvPolicy': 'RealismUV is metric and separate from existing UV layers; only new maps use it.',
            'profiles': PROFILES, 'models': models, 'unclassified': unknown}


def project_metres(co, normal, scale=(1, 1, 1), longitudinal=False, longest_axis=2):
    """Part-local metric projection; rotation never changes the grain direction."""
    axes = [axis for axis in range(3) if axis != max(range(3), key=lambda axis: abs(normal[axis]))]
    if longitudinal and longest_axis in axes:
        axes = [next(axis for axis in axes if axis != longest_axis), longest_axis]
    return tuple(float(co[axis]) * abs(float(scale[axis])) for axis in axes)


def face_uv_density(mesh, face_index):
    """Only books.py's explicit page-block faces receive finer surface detail."""
    attribute = mesh.attributes.get(PAPER_FACE_ATTRIBUTE)
    if attribute is None:
        return 1.0
    if attribute.domain != 'FACE' or attribute.data_type != 'BOOLEAN':
        raise ValueError('Book paper surface requires its BOOLEAN/FACE attribute')
    return PAPER_UV_DENSITY if attribute.data[face_index].value else 1.0


def _png(width, height, pixels):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    raw = b''.join(b'\0' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def _generated_maps(profile, resolution=256):
    """Original periodic microstructure; no painted dirt, tint or baked lighting."""
    normal, orm = bytearray(), bytearray()
    lo, hi = PROFILES[profile]['roughness']
    for y in range(resolution):
        v = y / resolution * math.tau
        for x in range(resolution):
            u = x / resolution * math.tau
            micro = (math.sin(u * 31 + math.sin(v * 7)) + math.sin(v * 37 + math.sin(u * 11))) * .5
            if profile in {'fabric', 'canvas', 'rattan'}:
                dx, dy = math.cos(u * 48) * .28, math.cos(v * 48) * .28
            elif profile in {'wood', 'bark'}:
                dx, dy = math.cos(u * 53 + math.sin(v * 3)) * .22, math.cos(v * 7) * .035
            elif profile == 'endgrain':
                dx, dy = math.cos(u * 13 + math.sin(v * 5)) * .16, math.cos(v * 13 + math.sin(u * 5)) * .16
            elif profile == 'metal':
                dx, dy = math.cos(u * 91 + math.sin(v * 3)) * .10, math.cos(v * 7) * .015
            else:
                dx, dy = math.cos(u * 31 + math.sin(v * 7)) * .14, math.cos(v * 37 + math.sin(u * 11)) * .14
            length = math.sqrt(dx * dx + dy * dy + 1)
            normal.extend(round(255 * (.5 + .5 * value / length)) for value in (dx, dy, 1))
            roughness = lo + (hi - lo) * (.5 + .5 * micro)
            # White AO and metal channels do not add fake cavity shadows or
            # change the original material's metallic factor.
            orm.extend((255, round(roughness * 255), 255))
    return {'normal': _png(resolution, resolution, normal), 'orm': _png(resolution, resolution, orm)}


def pack_scanned_roughness(encoded, interval):
    """Pack matched scan grain without resampling, tint, AO or metal changes."""
    from io import BytesIO
    from PIL import Image
    lo, hi = interval
    if not 0 <= lo <= hi <= 1:
        raise ValueError('Roughness calibration must remain in the unit interval')
    with Image.open(BytesIO(encoded)) as image:
        gray = image.convert('L')
        # A single point transform keeps the scan's complete spatial structure.
        # White AO/B preserve the original material AO and metallic multiplier.
        green = gray.point([round(255*lo + (hi-lo)*value) for value in range(256)])
        white = Image.new('L', gray.size, 255)
        packed = Image.merge('RGB', (white, green, white))
        return _png(packed.width, packed.height, packed.tobytes())


def create_library(root):
    """Generate shared lossless files; safe outside Blender and idempotent.

    Scanned normals are reused byte-for-byte. Their matching roughness scans
    retain full resolution and grain alignment in lossless calibrated ORM.
    No new base-color maps are introduced.
    """
    root = Path(root).resolve()
    destination = root / LIBRARY
    destination.mkdir(parents=True, exist_ok=True)
    result = {}
    scans = {'fabric': ('material-linen', 'https://polyhaven.com/a/rough_linen'),
             'canvas': ('material-canvas', 'https://ambientcg.com/a/Fabric036'),
             'wood': ('material-oak', 'https://polyhaven.com/a/oak_veneer_01')}
    for profile in PROFILES:
        result[profile] = {}
        for kind, data in _generated_maps(profile).items():
            path = destination / (profile + '-' + kind + '.png')
            source = 'Original Nook & Nest periodic microstructure'
            license_ = 'project-original'
            evidence = {}
            scan = scans.get(profile)
            normal_file = root / 'public/textures/realism' / (scan[0]+'-normal.jpg') if scan else None
            roughness_file = root / 'public/textures/realism' / (scan[0]+'-roughness.jpg') if scan else None
            if kind == 'normal' and normal_file and normal_file.is_file():
                original = normal_file
                path = original
                data = original.read_bytes()
                source, license_ = scan[1], 'CC0-1.0'
            elif kind == 'orm' and normal_file and normal_file.is_file() and roughness_file.is_file():
                raw = roughness_file.read_bytes()
                data = pack_scanned_roughness(raw, PROFILES[profile]['roughness'])
                source, license_ = scan[1], 'CC0-1.0'
                evidence = {'input': {'path': roughness_file.relative_to(root).as_posix(),
                            'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)},
                            'derivation': {'R': 255, 'B': 255, 'G': 'linear calibration of matching source roughness; no resize or rotation',
                                           'roughnessRange': list(PROFILES[profile]['roughness'])}}
            if path != normal_file and (not path.exists() or path.read_bytes() != data):
                path.write_bytes(data)
            result[profile][kind] = {'path': path.relative_to(root).as_posix(),
                'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                'colorSpace': 'Non-Color', 'source': source, 'license': license_, **evidence}
    return result


def provenance(root, library):
    root = Path(root)
    return {'version': 1, 'description': 'Lossless original microstructure and byte-identical licensed normals with matching full-resolution scan roughness packed into calibrated neutral ORM. No base-color replacements.',
            'calibration': 'Profile repeats and strengths are authored calibrations; only scan repeats inherited from realism-materials.json are provider-derived where documented.',
            'retainedProvenance': ['assets-source/realism-materials.json', 'assets-source/realism-texture-provenance.json'],
            'references': ['https://polyhaven.com/license', 'https://docs.ambientcg.com/license/',
                           'https://docs.blender.org/manual/en/5.3/addons/scene_gltf2.html'],
            'maps': library}


def validate_scan_request(entry, replacement, require_existing=True):
    """The scan exception is limited to named ordinary, opaque surfaces."""
    baseline_slots = {'baseColor': 'hasBaseColorTexture', 'normal': 'hasNormalTexture', 'orm': 'hasRoughnessTexture'}
    kind = replacement.get('kind')
    if (entry['materialKey'] != replacement.get('materialKey') or kind not in baseline_slots
            or entry['profile'] not in {'wood', 'fabric', 'canvas'} or entry.get('protectedReason')
            or replacement.get('profile') != entry['profile']
            or (require_existing and not entry['baseline'][baseline_slots[kind]])):
        raise ValueError('Scan replacement is outside its reviewed ordinary material role')
    repeat = replacement.get('repeatM', [])
    if len(repeat) != 2 or any(not isinstance(x, (int, float)) or not math.isfinite(x) or x <= 0 for x in repeat):
        raise ValueError('Scan replacement requires a finite physical repeat scale')
    if replacement.get('texCoord') != 1:
        raise ValueError('Scan replacement must use the separate RealismUV channel')
    for field in ('source', 'provenance'):
        value = replacement.get(field, {})
        if not value.get('path') or len(value.get('sha256', '')) != 64:
            raise ValueError('Scan replacement requires hash-bound source and provenance')


def validate_scan_bundle(entry, bundle, baseline):
    if not entry['baseline']['hasBaseColorTexture'] or bundle.get('materialKey') != entry['materialKey']:
        raise ValueError('Coordinated scans require an explicit existing ordinary albedo')
    maps = bundle.get('maps', [])
    if len(maps) != 3 or {m.get('kind') for m in maps} != {'baseColor', 'normal', 'orm'}:
        raise ValueError('Coordinated scan must bind baseColor, normal and ORM together')
    if baseline.get('pbrMetallicRoughness', {}).get('metallicFactor', 1) != 0:
        raise ValueError('Coordinated ORM scan is limited to an existing dielectric surface')
    strength = bundle.get('normalStrength')
    if not isinstance(strength, (int, float)) or not math.isfinite(strength) or not 0 <= strength <= 2:
        raise ValueError('Scan requires a finite calibrated normal strength')
    if baseline.get('normalTexture') and abs(strength - baseline['normalTexture'].get('scale', 1)) > 1e-7:
        raise ValueError('Existing normal scale must remain unchanged')
    if bundle.get('grainAxis', 'v') not in {'u', 'v'}:
        raise ValueError('Scan grain axis must be calibrated U or V')
    if bundle.get('roughnessFactor') != baseline.get('pbrMetallicRoughness', {}).get('roughnessFactor', 1):
        raise ValueError('Existing roughness factor must remain unchanged')
    common = {key: bundle[key] for key in ('materialKey', 'profile', 'family', 'repeatM')}
    for asset in maps:
        if any(asset.get(key, value) != value for key, value in common.items()):
            raise ValueError('Coordinated scan maps must use one family and physical repeat')
        validate_scan_request(entry, {**common, **asset}, require_existing=False)
    replacements = bundle.get('replacements', [])
    existing = {kind for kind, slot in [('baseColor', 'hasBaseColorTexture'),
                                      ('normal', 'hasNormalTexture'), ('orm', 'hasRoughnessTexture')]
                if entry['baseline'][slot]}
    if len(replacements) != len(existing) or {r.get('kind') for r in replacements} != existing:
        raise ValueError('Every existing scan channel requires its explicit replacement')
    by_kind = {asset['kind']: {**common, **asset} for asset in maps}
    for replacement in replacements:
        validate_scan_request(entry, replacement)
        if len(replacement.get('oldSha256', '')) != 64 or any(
                replacement.get(key) != value for key, value in by_kind[replacement['kind']].items()):
            raise ValueError('Scan replacement must bind the same licensed map and original hash')


def _baseline_materials(root, model_id, item):
    if isinstance(item, dict) and item.get('baselineGltf'):
        document = item['baselineGltf']
    else:
        data = (root / 'public/models/furniture' / (model_id + '.glb')).read_bytes()
        document = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
    return {m['name']: m for m in document['materials']}


def _verified_scan_file(root, asset):
    path = (root / asset['path']).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Scan source must remain inside its catalog worktree')
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != asset['sha256'] or len(data) != asset.get('bytes', len(data)):
        raise ValueError('Changed scan source or provenance: ' + asset['path'])
    return path


def apply_materials(root, scene, item, material_key_map):
    """Apply only the frozen explicit plan; return material/map receipts.

    ``material_key_map`` maps currently loaded Blender names to exact original
    names, including meaningful dot-number suffixes. It is supplied by the
    isolated library loader, never reconstructed by stripping suffixes here.
    """
    import bpy
    root = Path(root).resolve()
    model_id = item if isinstance(item, str) else item.get('id', item.get('catalogId'))
    plan = json.loads((root / PLAN).read_text(encoding='utf-8'))
    if model_id not in plan['models']:
        raise ValueError('Catalog model absent from reviewed material plan: ' + str(model_id))
    entries = {r['materialKey']: r for r in plan['models'][model_id]['materials']}
    scan_module = root / 'tools/blender/catalog_realism/scans.py'
    scans = runpy.run_path(str(scan_module))['scan_materials_for'](root, model_id) if scan_module.exists() else {}
    baseline_materials = _baseline_materials(root, model_id, item)
    for key, bundle in scans.items():
        if key not in entries:
            raise ValueError('Unknown scan material key: ' + key)
        validate_scan_bundle(entries[key], bundle, baseline_materials[key])
        for asset in bundle['maps']:
            _verified_scan_file(root, asset['source'])
            _verified_scan_file(root, asset['provenance'])
    library_path = root / PROVENANCE
    library = json.loads(library_path.read_text(encoding='utf-8'))['maps'] if library_path.exists() else create_library(root)
    meshes = [obj for obj in scene.objects if obj.type == 'MESH']
    materials = {m for obj in meshes for m in obj.data.materials if m}
    # Reject unknown names before changing any shader or mesh.
    for mat in materials:
        if mat.name not in material_key_map or material_key_map[mat.name] not in entries:
            raise ValueError('Missing exact source material key: ' + mat.name)
        if entries[material_key_map[mat.name]]['status'] == 'unclassified':
            raise ValueError('Unclassified material role: ' + model_id + '/' + material_key_map[mat.name])
    changed, records = {}, []
    for mat in sorted(materials, key=lambda material: material_key_map[material.name]):
        key = material_key_map[mat.name]
        entry = entries[key]
        record = {'materialKey': key, 'profile': entry['profile'], 'protectedReason': entry['protectedReason'], 'maps': [],
                  'surfaceAdjustments': entry.get('surfaceAdjustments', [])}
        records.append(record)
        if not entry['profile']:
            continue
        if not mat.use_nodes:
            record['protectedReason'] = 'non-node material; root source needs explicit conversion'
            continue
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shaders = [n for n in nodes if n.type == 'BSDF_PRINCIPLED']
        if len(shaders) != 1:
            record['protectedReason'] = 'multiple or absent Principled shaders; preserve authored graph'
            continue
        bs = shaders[0]
        for adjustment in record['surfaceAdjustments']:
            if adjustment['property'] == 'extensions.KHR_materials_sheen.sheenColorFactor':
                if 'Sheen Weight' in bs.inputs and not bs.inputs['Sheen Weight'].is_linked:
                    bs.inputs['Sheen Weight'].default_value = .16
                if 'Sheen Tint' in bs.inputs and not bs.inputs['Sheen Tint'].is_linked:
                    tint = bs.inputs['Sheen Tint']
                    if hasattr(tint.default_value, '__len__'):
                        values = [value / .16 for value in adjustment['value']]
                        tint.default_value = (*values, 1) if len(tint.default_value) == 4 else values
        profile = entry['profile']
        params = PROFILES[profile]
        scan = scans.get(key)
        # Existing inputs are retained unless a complete scan family explicitly
        # replaces the ordinary surface, including source-only procedural bump.
        kinds = [kind for kind, socket, baseline_key in [('normal', 'Normal', 'hasNormalTexture'), ('orm', 'Roughness', 'hasRoughnessTexture')]
                 if not scan and not bs.inputs[socket].is_linked and not entry['baseline'][baseline_key]]
        if not kinds and not scan:
            # Channel retention does not protect the whole material: the
            # reviewed cloth sheen adjustment can still apply independently.
            record['retainedChannels'] = ['normal', 'roughness']
            record['retainedChannelReason'] = 'existing normal and roughness graphs retained at full quality'
            continue
        uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = UV_NAME
        uv.label = 'Nook metric part coordinates; original artwork UV is untouched'
        mapping = nodes.new('ShaderNodeMapping'); mapping.vector_type = 'POINT'
        mapping.inputs['Scale'].default_value = (1 / params['repeatM'][0], 1 / params['repeatM'][1], 1)
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        if scan:
            scan_mapping = nodes.new('ShaderNodeMapping'); scan_mapping.vector_type = 'POINT'
            scan_mapping.label = 'Reviewed CC0 scan physical repeat in metres'
            scan_mapping.inputs['Scale'].default_value = (1 / scan['repeatM'][0], 1 / scan['repeatM'][1], 1)
            if profile == 'wood' and scan.get('grainAxis', 'v') == 'u':
                scan_mapping.inputs['Rotation'].default_value[2] = math.pi / 2
            links.new(uv.outputs['UV'], scan_mapping.inputs['Vector'])
            pbr = baseline_materials[key].get('pbrMetallicRoughness', {})
            for source_map in scan['maps']:
                kind = source_map['kind']
                scan_image = bpy.data.images.load(str(_verified_scan_file(root, source_map['source'])), check_existing=False)
                scan_image.colorspace_settings.name = 'sRGB' if kind == 'baseColor' else 'Non-Color'
                if not scan_image.packed_file:
                    scan_image.pack()
                texture = nodes.new('ShaderNodeTexImage'); texture.image = scan_image; texture.extension = 'REPEAT'
                texture.label = 'Explicit licensed coordinated scan; prior nodes retained for editing'
                links.new(scan_mapping.outputs['Vector'], texture.inputs['Vector'])
                socket = {'baseColor': 'Base Color', 'normal': 'Normal', 'orm': 'Roughness'}[kind]
                for old_link in list(bs.inputs[socket].links):
                    links.remove(old_link)
                if kind == 'baseColor':
                    base_factor = entry['baseline']['baseColorFactor']
                    tint = nodes.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'
                    tint.inputs[0].default_value = 1; tint.inputs[2].default_value = base_factor
                    links.new(texture.outputs['Color'], tint.inputs[1])
                    bs.inputs['Base Color'].default_value = base_factor
                    links.new(tint.outputs['Color'], bs.inputs['Base Color'])
                elif kind == 'normal':
                    normal = nodes.new('ShaderNodeNormalMap'); normal.uv_map = UV_NAME
                    normal.inputs['Strength'].default_value = scan['normalStrength']
                    links.new(texture.outputs['Color'], normal.inputs['Color'])
                    links.new(normal.outputs['Normal'], bs.inputs['Normal'])
                else:
                    split = nodes.new('ShaderNodeSeparateColor')
                    links.new(texture.outputs['Color'], split.inputs[0])
                    factor = nodes.new('ShaderNodeMath'); factor.operation = 'MULTIPLY'
                    factor.inputs[1].default_value = pbr.get('roughnessFactor', 1)
                    links.new(split.outputs['Green'], factor.inputs[0])
                    links.new(factor.outputs[0], bs.inputs['Roughness'])
                    # The plan allows only existing dielectric materials; the
                    # original metallic factor stays zero, independent of B.
                    for old_link in list(bs.inputs['Metallic'].links):
                        links.remove(old_link)
                    bs.inputs['Metallic'].default_value = pbr.get('metallicFactor', 1)
                record['maps'].append({'materialKey': key, 'kind': kind, **source_map['source'],
                                       'uvLayer': UV_NAME, 'scanSource': source_map})
            record['textureReplacements'] = scan['replacements']
            record['scanFamily'] = scan['family']
        for kind in kinds:
            asset = library[profile][kind]
            if asset.get('input'):
                _verified_scan_file(root, asset['input'])
            path = root / asset['path']
            if hashlib.sha256(path.read_bytes()).hexdigest() != asset['sha256']:
                raise ValueError('Changed calibrated material image: ' + str(path))
            # An unrelated open scene may use an image with the same filepath.
            # This import owns its image data and cleanup reclaims only that data.
            image = bpy.data.images.load(str(path), check_existing=False)
            image.colorspace_settings.name = 'Non-Color'
            if not image.packed_file:
                image.pack()
            texture = nodes.new('ShaderNodeTexImage'); texture.image = image; texture.extension = 'REPEAT'
            links.new(mapping.outputs['Vector'], texture.inputs['Vector'])
            if kind == 'normal':
                normal = nodes.new('ShaderNodeNormalMap'); normal.uv_map = UV_NAME
                normal.inputs['Strength'].default_value = params['normalStrength']
                links.new(texture.outputs['Color'], normal.inputs['Color'])
                links.new(normal.outputs['Normal'], bs.inputs['Normal'])
            else:
                split = nodes.new('ShaderNodeSeparateColor')
                links.new(texture.outputs['Color'], split.inputs[0])
                links.new(split.outputs['Green'], bs.inputs['Roughness'])
                # Metallic is intentionally unconnected: preserve its factor.
                # AO is intentionally unbound: white AO conveys no new detail.
            record['maps'].append({'materialKey': key, 'kind': kind, **asset, 'uvLayer': UV_NAME})
        changed[mat] = profile
        mat['catalog_realism_profile'] = profile
        mat['catalog_realism_color_policy'] = ('original base RGBA preserved; explicit licensed ordinary albedo replacement'
                                               if scan else 'original base RGBA and albedo graph preserved')
    for obj in meshes:
        if not any(mat in changed for mat in obj.data.materials):
            continue
        mesh = obj.data
        if mesh.users > 1:
            obj.data = mesh.copy(); mesh = obj.data
        prior_active = mesh.uv_layers.active_index
        original_uvs = [(layer, layer.active_render) for layer in mesh.uv_layers]
        # Ensure the new UV never steals TEXCOORD_0 from existing artwork.
        if not mesh.uv_layers:
            mesh.uv_layers.new(name='UVMap')
        uv_layer = mesh.uv_layers.get(UV_NAME) or mesh.uv_layers.new(name=UV_NAME)
        scale = tuple(obj.matrix_world.to_scale())
        spans = [max(v.co[axis] for v in mesh.vertices) - min(v.co[axis] for v in mesh.vertices) for axis in range(3)] if mesh.vertices else [0, 0, 0]
        longest = max(range(3), key=lambda axis: spans[axis] * abs(scale[axis]))
        for face in mesh.polygons:
            if face.material_index >= len(mesh.materials) or mesh.materials[face.material_index] not in changed:
                continue
            profile = changed[mesh.materials[face.material_index]]
            density = face_uv_density(mesh, face.index)
            for loop_index in face.loop_indices:
                co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                metric_uv = project_metres(co, face.normal, scale, profile in {'wood', 'bark', 'metal'}, longest)
                uv_layer.data[loop_index].uv = tuple(value * density for value in metric_uv)
        mesh.uv_layers.active_index = prior_active
        for layer, active_render in original_uvs:
            layer.active_render = active_render
        mesh.update()
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--library', action='store_true')
    args = parser.parse_args()
    if args.plan:
        plan = build_plan(args.root)
        path = args.root / PLAN; path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(plan, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'models': len(plan['models']), 'unclassified': plan['unclassified']}))
    if args.library:
        maps = create_library(args.root)
        (args.root / PROVENANCE).write_text(json.dumps(provenance(args.root, maps), indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'profiles': len(maps), 'mapFiles': sum(len(v) for v in maps.values())}))
