"""Create hash-bound, six-model contact sheets; never grant visual approval."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import runpy
import uuid
from PIL import Image, ImageDraw, ImageFont, ImageOps

VIEWS = ('front', 'rear', 'detail', 'underside', 'clay')
SHEET_DIRECTORY = 'assets-source/catalog-realism/contact-sheets'
verify_configuration_binding = runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/review.py'))['verify_configuration_binding']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical_hash(value):
    return digest(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode())


def inside(root, name):
    require(isinstance(name, str) and name and '\\' not in name and not Path(name).is_absolute() and '..' not in Path(name).parts, 'Invalid repository-relative path')
    target = (root/name).resolve()
    require(target != root and target.is_relative_to(root), 'Path escapes selected repository')
    return target


def record(root, name):
    file = inside(root, name)
    require(file.is_file() and 0 < file.stat().st_size <= 256*1024*1024, 'Missing or oversized file: '+name)
    raw = file.read_bytes()
    return {'path': name, 'sha256': digest(raw), 'bytes': len(raw)}


def verify(root, value):
    actual = record(root, value['path'])
    require(actual['sha256'] == value.get('sha256') and ('bytes' not in value or actual['bytes'] == value['bytes']), 'File hash or bytes changed: '+value['path'])
    return actual


def current_model(root, item):
    receipt_record = record(root, item['outputs']['receipt'])
    receipt = json.loads(inside(root, receipt_record['path']).read_text(encoding='utf8'))
    require(receipt.get('catalogId') == item['id'] and receipt.get('inputContractSha256') == item['contractSha256'] and receipt.get('state') in ('processed', 'reviewed'), 'Current processed receipt required: '+item['id'])
    binding = receipt.get('renderBinding', {})
    inputs = binding.get('inputs', [])
    require(inputs and len({entry['path'] for entry in inputs}) == len(inputs), 'Unique bound render inputs required')
    input_hash = canonical_hash(inputs)
    require(binding.get('beforeSha256') == input_hash == binding.get('afterSha256'), 'Stale render input binding')
    verify_configuration_binding(binding)
    for entry in [*receipt.get('inputs', []), *inputs, *receipt['outputs'].values()]:
        verify(root, entry)
    for output in receipt['outputs'].values():
        require(any(entry['path'] == output['path'] and entry['sha256'] == output['sha256'] for entry in inputs), 'Render does not bind the current model output')
    renders = receipt.get('renders', [])
    require(len(renders) == 5 and {entry.get('view') for entry in renders} == set(VIEWS), 'All five current review views are required: '+item['id'])
    ordered = []
    for view in VIEWS:
        entry = next(entry for entry in renders if entry['view'] == view)
        verify(root, entry)
        require(entry.get('glbSha256') == receipt['outputs']['glb']['sha256'] and entry.get('inputSetSha256') == input_hash and entry.get('renderConfigSha256') == binding['configurationSha256'], 'Render is stale for current candidate: '+item['id']+'/'+view)
        ordered.append(entry)
    return {'id': item['id'], 'name': item.get('name', item['id']), 'category': item.get('category'), 'receipt': receipt_record,
            'glb': receipt['outputs']['glb'], 'renderConfigSha256': binding['configurationSha256'], 'renders': ordered}


def make_sheets(root, ids=None, category=None, name=None, all_models=False):
    root = Path(root).resolve()
    manifest_name = 'assets-source/catalog-realism/catalog.json'
    manifest_record = record(root, manifest_name)
    manifest = json.loads(inside(root, manifest_name).read_text(encoding='utf8'))
    require(manifest.get('scope') == 'beta-only' and manifest.get('version') == 1, 'Frozen Beta catalog required')
    for entry in manifest.get('sourceInputs', []):
        verify(root, entry)
    lookup = {item['id']: item for item in manifest['items']}
    require(len(lookup) == len(manifest['items']), 'Duplicate catalog IDs')
    require(sum((bool(ids), bool(category), bool(all_models))) == 1, 'Choose positional IDs, --category, or --all')
    selected = list(ids or [item['id'] for item in manifest['items'] if all_models or item.get('category') == category])
    require(selected and len(set(selected)) == len(selected) and all(key in lookup for key in selected), 'Unknown, duplicate or empty model selection')
    name = name or 'group-'+uuid.uuid4().hex[:12]
    require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}', name), 'Sheet name must be a short plain filename')
    # Validate the entire selection before creating any sheet. Failed models do
    # not disappear silently from the requested ID order.
    models = [current_model(root, lookup[key]) for key in selected]
    font = ImageFont.load_default(size=18)
    small = ImageFont.load_default(size=16)
    outputs = []
    for offset in range(0, len(models), 6):
        batch = models[offset:offset+6]
        stem = f'{SHEET_DIRECTORY}/{name}-{offset//6+1:02d}'
        destination, manifest_file = inside(root, stem+'.png'), inside(root, stem+'.json')
        require(not destination.exists() and not manifest_file.exists(), 'Contact sheet name already exists; choose a new batch name')
        canvas = Image.new('RGB', (1600, 40+270*len(batch)), '#f0eeeb')
        draw = ImageDraw.Draw(canvas)
        for column, view in enumerate(VIEWS):
            draw.text((column*320+12, 10), view.upper(), fill='#292724', font=font)
        for row, model in enumerate(batch):
            y = 40+row*270
            draw.rectangle((0, y, 1600, y+30), fill='#e4e0d9')
            draw.text((12, y+5), f"{offset+row+1:03d}  {model['id']}  |  {model['name']}", fill='#242321', font=small)
            for column, entry in enumerate(model['renders']):
                verify(root, entry)
                with Image.open(inside(root, entry['path'])) as original:
                    require(original.width*original.height <= 32*1024*1024, 'Review image exceeds pixel bound')
                    image = original.convert('RGBA')
                    image = ImageOps.contain(image, (320, 240), Image.Resampling.LANCZOS)
                    canvas.paste(image, (column*320+(320-image.width)//2, y+30+(240-image.height)//2), image)
        for model in batch:
            verify(root, model['receipt'])
            current_model(root, lookup[model['id']])
        verify(root, manifest_record)
        destination.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(destination, format='PNG', optimize=True)
        evidence = {'version': 1, 'scope': 'beta-only', 'state': 'awaiting-explicit-review', 'createdAt': datetime.now(timezone.utc).isoformat(),
                    'sourceManifest': manifest_record, 'helper': record(root, Path(__file__).resolve().relative_to(root).as_posix()) if Path(__file__).resolve().is_relative_to(root) else {'sha256': digest(Path(__file__).read_bytes())},
                    'idOrder': [model['id'] for model in batch], 'viewOrder': list(VIEWS), 'cellSize': [320, 240],
                    'image': record(root, stem+'.png'), 'models': batch,
                    'limitation': 'A contact sheet is inspection evidence only; open full-size source views for uncertain detail. No approval has been recorded.'}
        with manifest_file.open('x', encoding='utf8', newline='\n') as output:
            json.dump(evidence, output, indent=2)
            output.write('\n')
        outputs.append({'image': stem+'.png', 'manifest': stem+'.json', 'ids': evidence['idOrder']})
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ids', nargs='*')
    parser.add_argument('--category')
    parser.add_argument('--all', action='store_true', dest='all_models')
    parser.add_argument('--name')
    parser.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()
    try:
        print(json.dumps(make_sheets(args.root, args.ids, args.category, args.name, args.all_models), indent=2))
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, 'Contact sheets: '+str(error)+'\n')
