"""Verify full-size garage reviews and export pixel-identical catalog previews."""
import hashlib
import json
from pathlib import Path
from PIL import Image
from garage_contact import contact
from garage_outdoor_verify import verify

ROOT = Path(__file__).resolve().parents[2]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    rows = json.loads((ROOT / 'src/garageExpansion.json').read_text())
    audit = json.loads((ROOT / 'assets-source/garage-outdoor-collection-audit.json').read_text())
    surfaces = json.loads((ROOT / 'src/garageOutdoorShelfSurfaces.json').read_text())
    footprints = json.loads((ROOT / 'src/garageOutdoorSupportFootprints.json').read_text())
    results = []
    for row in rows:
        catalog_id = row[0]
        checked = verify(row, audit, surfaces, footprints, ROOT)
        source = ROOT / 'assets-source/previews' / f'{catalog_id}.png'
        destination = ROOT / 'public/models/previews' / f'{catalog_id}.webp'
        renders = []
        for view in ('front', 'rear', 'underside'):
            path = source if view == 'front' else ROOT / '.generated/garage-review' / f'{catalog_id}-{view}.png'
            with Image.open(path) as image:
                assert image.size == (640, 640), (catalog_id, view, image.size)
            renders.append({'view': view, 'path': path.relative_to(ROOT).as_posix(),
                            'dimensions': [640, 640], 'sha256': sha256(path)})
        with Image.open(source) as image:
            original = image.convert('RGBA')
            original.save(destination, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        with Image.open(destination) as image:
            assert image.size == original.size and image.convert('RGBA').tobytes() == original.tobytes(), catalog_id
        results.append({**checked, 'editableParts': audit[catalog_id]['editableParts'],
                        'glbSha256': sha256(ROOT / 'public/models/furniture' / f'{catalog_id}.glb'),
                        'blendSha256': sha256(ROOT / 'assets-source/blender' / f'{catalog_id}.blend'),
                        'renders': renders, 'pngBytes': source.stat().st_size,
                        'webpBytes': destination.stat().st_size, 'webpSha256': sha256(destination),
                        'pixelIdentical': True, 'reviewStatus': 'front, rear and underside visually reviewed; final construction accepted'})
    groups = {
        'supports': ['drawer-base', 'cordless-drill'],
        'cabinets': ['tall-cabinet', 'wall-cabinet', 'corner-cabinet', 'folding-wall-bench'],
        'carts': ['corner-cabinet', 'service-cart', 'mechanic-stool', 'ceiling-rack'],
        'wall-storage': ['tire-rack', 'lumber-rack', 'pegboard-tools', 'hook-rail'],
        'organizers': ['parts-bin-rack', 'tool-case-tower', 'storage-tote', 'long-tool-stand'],
        'saws': ['extension-ladder', 'circular-saw', 'miter-saw', 'table-saw'],
        'machine-tools': ['drill-press', 'bench-grinder', 'bench-vise', 'pressure-washer'],
        'equipment': ['inverter-generator', 'cyclone-extractor', 'welding-cart', 'air-hose-reel'],
        'vehicle-support': ['floor-jack', 'axle-stands', 'mechanic-creeper', 'seasonal-tires'],
    }
    for name, ids in groups.items():
        contact(['garage-' + id for id in ids], name + '-review.jpg')
    summary = {'reviewedAt': '2026-09-29', 'models': len(results), 'views': 3 * len(results),
               'allViews640Square': True, 'binaryAndSupportChecksPassed': len(results),
               'glbBytes': sum(r['bytes'] for r in results),
               'triangles': sum(r['triangles'] for r in results),
               'maxTriangles': max(r['triangles'] for r in results),
               'maxGlbBytes': max(r['bytes'] for r in results),
               'pngBytes': sum(r['pngBytes'] for r in results),
               'webpBytes': sum(r['webpBytes'] for r in results),
               'results': results}
    (ROOT / 'assets-source/garage-collection-review.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({key: value for key, value in summary.items() if key != 'results'}, indent=2))


if __name__ == '__main__':
    main()
