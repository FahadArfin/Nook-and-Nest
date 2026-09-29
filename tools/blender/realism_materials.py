"""Physical textile and longitudinal timber maps for the new authored collection."""
import bpy, hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def family_for(name):
 name=re.sub(r'\.\d+$','',name.lower())
 if name=='outdoor-limestone':return 'limestone'
 if name=='outdoor-honed-basalt':return 'basalt'
 if name=='outdoor-kamado-ceramic':return 'ceramic'
 if any(w in name for w in ['canvas','fabric','upholstery','rope-fiber']):return 'canvas'
 if any(w in name for w in ['teak']):return 'teak'
 if 'walnut' in name:return 'walnut'
 if any(w in name for w in ['wood','maple','cedar','timber','lamella','endgrain']):return 'oak'
 return None

def image_node(mat,path,linear):
 im=bpy.data.images.load(str(ROOT/path),check_existing=True)
 im.colorspace_settings.name='Non-Color' if linear else 'sRGB'
 if not im.packed_file:im.pack()
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;node.extension='REPEAT'
 return node

def apply(objects,grain_coordinates=None):
 records=json.loads((ROOT/'assets-source/realism-materials.json').read_text())['materials']
 scans=json.loads((ROOT/'assets-source/realism-scans.json').read_text())['scans']
 for family,scan,repeat,strength in [('limestone','honed-limestone',1.8,.24),('basalt','honed-basalt',1.2,.12),('ceramic','honed-ceramic',.6,.08)]:
  record=scans[scan]
  records[family]={**record,'baseColor':record['color'],'repeatM':repeat,'normalStrength':strength}
 used={m for o in objects for m in o.data.materials if m}
 for mat in used:
  family=family_for(mat.name)
  if not family:continue
  record=records[family];mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
  bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
  color=tuple(bs.inputs['Base Color'].default_value)
  if family in {'oak','teak','walnut','limestone'}:color=(.84,.84,.84,1)
  for key in ['Base Color','Normal','Roughness','Metallic']:
   for link in list(bs.inputs[key].links):links.remove(link)
  if family=='ceramic':
   # Glazed ceramic has a solid pigment; retain only fine surface microstructure.
   bs.inputs['Base Color'].default_value=color
  else:
   base=image_node(mat,record['baseColor'],False)
   mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY'
   next(i for i in mix.inputs if i.identifier=='Factor_Float').default_value=1
   a=next(i for i in mix.inputs if i.identifier=='A_Color');b=next(i for i in mix.inputs if i.identifier=='B_Color')
   b.default_value=color;links.new(base.outputs['Color'],a)
   links.new(next(o for o in mix.outputs if o.identifier=='Result_Color'),bs.inputs['Base Color'])
  normal=image_node(mat,record['normal'],True);n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=record['normalStrength']
  links.new(normal.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bs.inputs['Normal'])
  packed=image_node(mat,record['orm'],True);sep=nodes.new('ShaderNodeSeparateColor')
  links.new(packed.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness']);links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
  mat['realism_family']=family;mat['realism_source']=record['source'];mat['realism_license']='CC0-1.0'
 for obj in objects:
  mesh=obj.data;mesh.update()
  if not mesh.uv_layers:mesh.uv_layers.new(name='UVMap')
  uv=mesh.uv_layers.active.data
  # Local board coordinates survive rotation and normalization in the driver.
  grain=(grain_coordinates or {}).get(obj.name,[v.co for v in mesh.vertices])
  lo=[min(v[i] for v in grain) for i in range(3)];hi=[max(v[i] for v in grain) for i in range(3)]
  longest=max(range(3),key=lambda i:hi[i]-lo[i]);phase=int(hashlib.sha256(obj.name.encode()).hexdigest()[:5],16)/0xfffff
  for face in mesh.polygons:
   mat=mesh.materials[face.material_index];family=mat.get('realism_family') if mat else None
   if not family:continue
   record=records[family];wood=family in {'oak','walnut','teak'}
   normal=face.normal
   if wood:
    a,b,c=[grain[i] for i in face.vertices[:3]];normal=(b-a).cross(c-a)
   normal_axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=normal_axis]
   along=longest if longest in axes else axes[1];across=next(i for i in axes if i!=along)
   for li in face.loop_indices:
    co=mesh.vertices[mesh.loops[li].vertex_index].co
    if wood:
     co=grain[mesh.loops[li].vertex_index]
     q=((co[across]-lo[across])/.34+phase,(co[along]-lo[along])/1.8+phase*.61)
     uv[li].uv=q if record['grainAxis']=='v' else q[::-1]
    else:
     repeat=record['repeatM'];uv[li].uv=(co[axes[0]]/repeat+phase,co[axes[1]]/repeat+phase*.37)
