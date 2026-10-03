"""Restore the inspected clock's original smooth satin steel, without new maps."""
from pathlib import Path
import math,runpy

def restoration(baseline,source):
    pbr=baseline.get('pbrMetallicRoughness',{})
    if baseline.get('name')!='satin-steel' or any(k in baseline for k in ('normalTexture','occlusionTexture','emissiveTexture')) or any(k in pbr for k in ('baseColorTexture','metallicRoughnessTexture')):
        raise ValueError('Only the exact originally untextured clock steel may be restored')
    base=pbr.get('baseColorFactor',[1,1,1,1]);metal=pbr.get('metallicFactor',1);rough=pbr.get('roughnessFactor',1)
    pairs=[*zip(base,source['Base Color']),(metal,source['Metallic']),(rough,source['Roughness'])]
    if any(not math.isfinite(a) or not math.isfinite(b) or abs(a-b)>1e-6 for a,b in pairs) or any(abs(v)>1e-9 for v in source['Normal']):raise ValueError('Original satin-steel factors or geometric normal changed')
    return {'roughness':rough,'normal':'geometric shading normal','metallic':metal,'baseColor':base}

def apply(root,scene,item,keys,names,evidence):
    if item['id']!='rolex-desk-clock' or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Wrong reviewed clock surface')
    curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')));objects=curves['_objects'](scene,names)
    for spec in evidence['objects']:curves['_checked'](objects,spec,keys)
    materials={m for o in scene.objects if o.type=='MESH' for m in o.data.materials if m and keys.get(m.name)=='satin-steel'}
    if len(materials)!=1:raise ValueError('Original shared satin-steel material changed')
    mat=next(iter(materials));nodes=mat.node_tree.nodes if mat.use_nodes else []
    shaders=[n for n in nodes if n.type=='BSDF_PRINCIPLED']
    if len(shaders)!=1:raise ValueError('Expected the single original steel shader')
    bs=shaders[0];channels=('Base Color','Metallic','Roughness','Normal')
    if any(bs.inputs[k].is_linked for k in channels):raise ValueError('Originally plain clock steel now has an authored channel; do not replace it')
    values={k:list(bs.inputs[k].default_value) if hasattr(bs.inputs[k].default_value,'__len__') else bs.inputs[k].default_value for k in channels}
    target=restoration(next(m for m in item['baselineGltf']['materials'] if m['name']=='satin-steel'),values)
    geometry=nodes.new('ShaderNodeNewGeometry');geometry.label='Explicit original clock surface: geometric shading normal'
    roughness=nodes.new('ShaderNodeValue');roughness.label='Original baseline satin-steel roughness; no generated grain'
    roughness.outputs[0].default_value=target['roughness']
    mat.node_tree.links.new(geometry.outputs['Normal'],bs.inputs['Normal'])
    mat.node_tree.links.new(roughness.outputs[0],bs.inputs['Roughness'])
    # These are real authored channels. The existing material stage retains them,
    # and GLB reconciliation retains the exact original untextured steel factors.
    return [{'kind':'source-evidenced-material-restoration','materialKey':'satin-steel',
             'construction':'remove the newly generated coarse grain on this exact clock material and restore its original smooth satin-steel response',
             'restoredChannels':target,'omittedGeneratedMaps':['normal','orm'],
             'preserved':['all original geometry, dial, hands, marks and other material roles','original steel base RGBA, metallic and roughness factors'],
             'limitation':'surface restoration, not a new scan or added surface detail'}]
