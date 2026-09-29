"""Convert reviewed outdoor source PNGs into pixel-identical catalog WebP files."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    rows = json.loads((ROOT / 'src/outdoorLivingExpansion.json').read_text())
    results = []
    for row in rows:
        catalog_id = row[0]
        source = ROOT / 'assets-source/previews' / f'{catalog_id}.png'
        destination = ROOT / 'public/models/previews' / f'{catalog_id}.webp'
        with Image.open(source) as image:
            original = image.convert('RGBA')
            original.save(destination, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        with Image.open(destination) as image:
            assert image.size == original.size and image.convert('RGBA').tobytes() == original.tobytes(), catalog_id
        results.append({'id': catalog_id, 'pngBytes': source.stat().st_size,
                        'webpBytes': destination.stat().st_size, 'pixelIdentical': True})
    print(json.dumps({'models': len(results), 'pngBytes': sum(r['pngBytes'] for r in results),
                      'webpBytes': sum(r['webpBytes'] for r in results), 'results': results}, indent=2))


if __name__ == '__main__':
    main()
