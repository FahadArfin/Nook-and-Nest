"""Measured, portable PBR materials for the isolated sofa realism study.

The builder supplies UVMap coordinates in metres. These materials convert
them to native scan repeats; do not also call the builder's scale_uv().
Only new materials/images and rebuilt-* derivative files are created.
"""

import hashlib
import json
from pathlib import Path

import bpy
import numpy as np

WOOD = 'wood-honey-textured'
FABRIC = 'upholstery-textured'
THREAD = 'tailored-tone-on-tone-stitch'
BRASS = 'joinery-aged-brass'
WOOL_REPEAT_M = (.2700788548673393, .27570000290870667)
OAK_REPEAT_M = (1.8300000429153442, 1.8300000429153442)
MOSS = (.05126945674419403, .1119324266910553, .05448027700185776, 1)
SOURCE_ROOT = 'public/textures/realism/'
SOURCES = {
    'wool': {
        'url': 'https://polyhaven.com/a/poly_wool_herringbone',
        'license': 'CC0-1.0',
        'authors': 'colormass (photography); Rico Cilliers (processing)',
        'repeatM': WOOL_REPEAT_M,
        'baseColor': ('rebuilt-wool-albedo.jpg', 'fd889a46f617efd331e522e36b8ad2548e16e1cb018c001872f17537d7666af5'),
        'normal': ('rebuilt-wool-normal.png', 'f2e3d60088b7416425b6e81c3285507d5c3d9d630e7a28016012a1befd1c04b1'),
        'orm': ('rebuilt-wool-arm.png', '921fcbb8116778e2c727b36a390f0b3c67602d645978fae028d12ec13cecc4be'),
    },
    'oak': {
        'url': 'https://polyhaven.com/a/oak_veneer_01',
        'license': 'CC0-1.0',
        'authors': 'Jenelle van Heerden',
        'repeatM': OAK_REPEAT_M,
        'baseColor': ('material-oak-color.jpg', None),
        'normal': ('material-oak-normal.jpg', None),
        'orm': ('material-oak-orm.jpg', None),
    },
}


def _sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_manifest(root):
    """Return exact input provenance, failing before creation if a file differs."""
    root = Path(root).resolve()
    result = []
    for family, source in SOURCES.items():
        for kind in ('baseColor', 'normal', 'orm'):
            name, expected = source[kind]
            path = root / SOURCE_ROOT / name
            digest = _sha(path)
            if expected and digest != expected:
                raise ValueError('Changed material input: ' + str(path))
            result.append({'family': family, 'kind': kind, 'path': path.relative_to(root).as_posix(),
                           'sha256': digest, 'bytes': path.stat().st_size,
                           'source': source['url'], 'license': source['license'],
                           'authors': source['authors'], 'repeatM': list(source['repeatM'])})
    return result


def _load(root, name, noncolor):
    image = bpy.data.images.load(str(root / SOURCE_ROOT / name), check_existing=False)
    image.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    image['sofa_study_material'] = True
    image.pack()
    return image


def _pixels(image):
    pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape((-1, 4))


def _save_image(root, name, source, pixels, noncolor):
    """Save the actual export image, never overwrite downloaded scan inputs."""
    path = root / SOURCE_ROOT / name
    image = bpy.data.images.new(name, width=source.size[0], height=source.size[1], alpha=False)
    image.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    image.pixels.foreach_set(np.asarray(pixels, dtype=np.float32).ravel())
    image.update()
    # Keep original scans unchanged; the portable derivative is a compact
    # 1024-square tile. Metre-based Mapping retains the 2% physical aspect.
    if tuple(image.size) != (1024, 1024):
        image.scale(1024, 1024)
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    image.pack()
    image['sofa_study_material'] = True
    return image


def _neutral_wool(root, image):
    # Preserve the scanned yarn variation while leaving the moss factor
    # editable. Pixels from the sRGB input are scene-linear in Blender.
    pixels = _pixels(image)
    luminance = pixels[:, :3] @ np.array((.2126, .7152, .0722), dtype=np.float32)
    mean = max(float(luminance.mean()), 1e-6)
    # The first trial's .30 amplitude left only 7/255 image standard
    # deviation, which disappeared after minification in catalog views.
    reflectance = np.clip(.80 + .70 * (luminance / mean - 1), .35, .99)
    pixels[:, :3] = reflectance[:, None]
    pixels[:, 3] = 1
    return _save_image(root, 'rebuilt-wool-neutral.png', image, pixels, False)


def _dielectric_orm(root, family, image):
    pixels = _pixels(image)
    # Raising a floor alone left the wool median at .63 and the oak at .55;
    # their broad highlights read as rubber and varnish in the GLB render.
    original_roughness = pixels[:, 1].copy()
    pixels[:, 1] = (.80 + .16 * original_roughness if family == 'wool'
                    else .64 + .22 * original_roughness)
    pixels[:, 2] = 0  # Wool and finished oak are dielectric, regardless of scan B.
    pixels[:, 3] = 1
    return _save_image(root, 'rebuilt-' + family + '-orm.png', image, pixels, True)


def _compact_normal(root, image):
    # This is a numerical tangent-map resample, not a new painted texture.
    # Blender's normal-map shader normalizes sampled tangent directions.
    pixels = _pixels(image)
    pixels[:, 3] = 1
    return _save_image(root, 'rebuilt-wool-normal-compact.png', image, pixels, True)


def _restrained_oak(root, image):
    # Retain photographed grain and warm color, reducing the high-contrast
    # cathedral patches that dominated the first whole-sofa trial.
    pixels = _pixels(image)
    mean = pixels[:, :3].mean(axis=0)
    pixels[:, :3] = np.clip(mean + .80 * (pixels[:, :3] - mean), 0, 1)
    pixels[:, 3] = 1
    return _save_image(root, 'rebuilt-oak-albedo.png', image, pixels, False)


def _node_image(nodes, links, image, uv):
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    node.extension = 'REPEAT'
    links.new(uv.outputs['Vector'], node.inputs['Vector'])
    return node


def _material(key, rgba, roughness):
    material = bpy.data.materials.new('Realism study ' + key)
    material.use_nodes = True
    material['material_key'] = key
    material['sofa_study_material'] = True
    material.diffuse_color = rgba
    bs = material.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = rgba
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = 0
    # Do not reintroduce the earlier exporter white-sheen mismatch.
    if 'Sheen Weight' in bs.inputs:
        bs.inputs['Sheen Weight'].default_value = 0
    return material


def _textured(root, key, rgba, family, images, normal_strength=.18, use_orm=True):
    material = _material(key, rgba, .90 if key == THREAD else .65)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bs = nodes.get('Principled BSDF')
    if family == 'wool' and 'Specular IOR Level' in bs.inputs:
        # Native KHR_materials_specular export, rather than a render-only
        # shader tweak. This is kept separate from the independently saved tint.
        bs.inputs['Specular IOR Level'].default_value = .25
    uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'
    mapping = nodes.new('ShaderNodeMapping'); mapping.vector_type = 'POINT'
    repeat = SOURCES[family]['repeatM']
    mapping.inputs['Scale'].default_value = (1 / repeat[0], 1 / repeat[1], 1)
    links.new(uv.outputs['UV'], mapping.inputs['Vector'])
    base = _node_image(nodes, links, images['baseColor'], mapping)
    multiply = nodes.new('ShaderNodeMix')
    multiply.data_type = 'RGBA'; multiply.blend_type = 'MULTIPLY'
    next(s for s in multiply.inputs if s.identifier == 'Factor_Float').default_value = 1
    next(s for s in multiply.inputs if s.identifier == 'B_Color').default_value = rgba
    links.new(base.outputs['Color'], next(s for s in multiply.inputs if s.identifier == 'A_Color'))
    links.new(next(s for s in multiply.outputs if s.identifier == 'Result_Color'), bs.inputs['Base Color'])
    normal = _node_image(nodes, links, images['normal'], mapping)
    nm = nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'UVMap'
    nm.inputs['Strength'].default_value = normal_strength
    links.new(normal.outputs['Color'], nm.inputs['Color']); links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if use_orm:
        orm = _node_image(nodes, links, images['orm'], mapping)
        split = nodes.new('ShaderNodeSeparateColor'); links.new(orm.outputs['Color'], split.inputs[0])
        links.new(split.outputs['Green'], bs.inputs['Roughness']); links.new(split.outputs['Blue'], bs.inputs['Metallic'])
        # The complete official group is required by Blender's round-trip importer.
        from io_scene_gltf2.blender.com.material_helpers import create_settings_group
        group = create_settings_group('glTF Material Output')
        group['sofa_study_material'] = True
        output = nodes.new('ShaderNodeGroup'); output.node_tree = group
        links.new(split.outputs['Red'], output.inputs['Occlusion'])
    material['texture_source'] = SOURCES[family]['url']
    material['texture_license'] = 'CC0-1.0'
    material['texture_repeat_m'] = list(repeat)
    material['uv_units'] = 'metres; Mapping node converts to native texture repeats'
    material['surface_method'] = 'tiled-pbr'
    material['surface_maps'] = json.dumps({kind: Path(bpy.path.abspath(image.filepath)).resolve().relative_to(root).as_posix()
                                         for kind, image in images.items() if use_orm or kind != 'orm'})
    return material


def create_materials(root):
    """Return exactly four canonical material keys, ready for metre-based UVs."""
    root = Path(root).resolve()
    if not (root / 'package.json').is_file():
        raise ValueError('Expected Nook & Nest repository root')
    source_manifest(root)  # Validate every input before creating datablocks.
    maps = {}
    for family, source in SOURCES.items():
        images = {kind: _load(root, source[kind][0], kind != 'baseColor')
                  for kind in ('baseColor', 'normal', 'orm')}
        if family == 'wool':
            images['baseColor'] = _neutral_wool(root, images['baseColor'])
            images['normal'] = _compact_normal(root, images['normal'])
        else:
            images['baseColor'] = _restrained_oak(root, images['baseColor'])
        images['orm'] = _dielectric_orm(root, family, images['orm'])
        maps[family] = images
    materials = {
        WOOD: _textured(root, WOOD, (.61, .55, .46, 1), 'oak', maps['oak']),
        FABRIC: _textured(root, FABRIC, MOSS, 'wool', maps['wool'], normal_strength=.70),
        THREAD: _textured(root, THREAD, tuple(v * .92 for v in MOSS[:3]) + (1,),
                          'wool', maps['wool'], normal_strength=.12, use_orm=False),
        BRASS: _material(BRASS, (.28, .22, .10, 1), .56),
    }
    materials[BRASS].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .72
    return materials


def material_map_receipts(root, materials):
    """Describe exact files to compare against the GLB's embedded image bytes."""
    root = Path(root).resolve()
    records = []
    for key in (WOOD, FABRIC):
        material = materials[key]
        for kind, path_text in json.loads(material['surface_maps']).items():
            path = root / path_text
            records.append({'kind': kind, 'materialKey': key, 'path': path_text,
                            'sha256': _sha(path), 'bytes': path.stat().st_size,
                            'method': 'native tiled photographic PBR; measured metre UV',
                            'repeatM': list(material['texture_repeat_m'])})
    return records
