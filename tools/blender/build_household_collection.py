"""Serialized official Blender MCP authoring for the household collection.

Each module owns original millimetre construction. This driver owns only its
tagged scene, retains editable parts, exports one static assembly and records
actual mesh costs. Run build(id), render via MCP, then set_view for review.
"""
import bpy, importlib, json, math, struct, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
import build_kitchen_essentials as G
from household_geometry import ring
from household_materials import tag_used_materials, canonicalize_glb
G.ring=ring
G.OWNER='Nook household collection authoring'
MODULES={
 'householdBathLaundryExpansion':'household_bath_laundry',
 'householdEntryExpansion':'household_entry',
 'householdUtilitiesExpansion':'household_utilities',
 'householdLightingOfficeExpansion':'household_lighting_office',
 'householdSpecialtyExpansion':'household_specialty',
 'householdEntryVarietyExpansion':'household_entry_variety',
 'householdLightingVarietyExpansion':'household_lighting_variety',
 'householdSpecialtyVarietyExpansion':'household_specialty_variety',
 'householdFixtureVarietyExpansion':'household_fixture_variety',
 'householdArchitectureExpansion':'household_architecture',
}

def rows():
 return [(r,module) for name,module in MODULES.items() if (ROOT/'src'/f'{name}.json').exists()
         for r in json.loads((ROOT/'src'/f'{name}.json').read_text(encoding='utf-8-sig'))]

def build(catalog_id):
 row,module=next((r,m) for r,m in rows() if r[0]==catalog_id)
 s=G.own_scene();s.name='Household collection'
 for key in list(s.keys()):
  if key.startswith('household_'):del s[key]
 M=G.materials()
 M.update(brass=G.material('household-champagne-brass',(.49,.31,.12),.4,.72),
          fabric=G.material('household-slate-fabric',(.12,.21,.25),.92),
          paper=G.material('household-warm-paper',(.84,.81,.7),.93))
 creator=importlib.import_module(module);importlib.reload(creator);creator.create(catalog_id,M)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in list(s.objects):
  if obj.type in {'CURVE','FONT','SURFACE'}:
   obj.select_set(True);bpy.context.view_layer.objects.active=obj
   bpy.ops.object.convert(target='MESH');bpy.context.object.select_set(False)
 objects=[o for o in s.objects if o.type=='MESH'];bpy.context.view_layer.update()
 if not objects:raise ValueError('No authored geometry: '+catalog_id)
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 lo=Vector([min(p[i] for p in points) for i in range(3)])
 hi=Vector([max(p[i] for p in points) for i in range(3)])
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 raw=[hi[i]-lo[i] for i in range(3)]
 scale=Vector([row[3+i]/raw[i]/1000 for i in range(3)])
 support=None
 if 'household_support_center_mm' in s:
  p=Vector(s['household_support_center_mm'])-center
  footprint=s['household_support_footprint_mm']
  support={'dimensionsMm':row[3:6],'x':-p.x*scale.x*1000,'z':-p.y*scale.y*1000,
           'offset':p.z*scale.z*1000,'width':footprint[0]*scale.x*1000,
           'depth':footprint[1]*scale.y*1000,'shape':s.get('household_support_footprint_shape','rectangle')}
  if 'household_hanging_clear_radius_mm' in s:
   support['hangingClearRadius']=s['household_hanging_clear_radius_mm']*min(scale.x,scale.y)*1000
  placement_path=ROOT/'src/householdSupportFootprints.json'
  placement=json.loads(placement_path.read_text()) if placement_path.exists() else {}
  placement[catalog_id]=support;placement_path.write_text(json.dumps(placement,indent=2)+'\n')
 if hasattr(creator,'support_surfaces'):
  planes=creator.support_surfaces(catalog_id)
  if planes:
   target=ROOT/'src/householdShelfSurfaces.json'
   surfaces=json.loads(target.read_text()) if target.exists() else {}
   surfaces[catalog_id]=[{**p,'x':-(p['x']-center.x)*scale.x*1000,
      'z':-(p['z']-center.y)*scale.y*1000,'height':(p['height']-center.z)*scale.z*1000,
      'width':p['width']*scale.x*1000,'depth':p['depth']*scale.y*1000,
      'clearance':p['clearance']*scale.z*1000} for p in planes]
   target.write_text(json.dumps(surfaces,indent=2)+'\n')
 for o in objects:
  transform=o.matrix_world.copy()
  for v in o.data.vertices:
   p=transform@v.co-center;v.co=Vector([p[i]*scale[i] for i in range(3)])
  o.matrix_world.identity();o['catalog_id']=catalog_id
  if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
  o.data.update()
  for polygon in o.data.polygons:
   axis=max(range(3),key=lambda i:abs(polygon.normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in polygon.loop_indices:
    v=o.data.vertices[o.data.loops[li].vertex_index].co
    o.data.uv_layers.active.data[li].uv=(v[axes[0]],v[axes[1]])
 s.unit_settings.system='METRIC';s['catalog_id']=catalog_id
 s['nominal_dimensions_m']=[v/1000 for v in row[3:6]]
 s['construction']='Original individually editable household construction; fixed authored pose'
 source=ROOT/'assets-source/blender'/f'{catalog_id}.blend'
 tag_used_materials(objects)
 bpy.data.libraries.write(str(source),{s},fake_user=True,compress=True)
 triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
 parts=len(objects)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
 bpy.context.object.name=catalog_id+' authored assembly'
 out=ROOT/'public/models/furniture'/f'{catalog_id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,use_active_scene=True,
                          export_extras=True,export_yup=True,export_apply=True)
 canonicalize_glb(out)
 data=out.read_bytes();doc=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
 stats={'dimensionsMm':row[3:6],'authoredBoundsMm':raw,'normalization':[v*1000 for v in scale],
        'triangles':triangles,'editableParts':parts,'glbBytes':len(data),'materials':len(doc['materials']),
        'textures':len(doc.get('images',[])),'sourceCenterMm':list(center),
        'supportFootprint':support,'status':'exported; awaiting rendered review'}
 path=ROOT/'assets-source/household-collection-audit.json'
 audit=json.loads(path.read_text()) if path.exists() else {};audit[catalog_id]=stats
 path.write_text(json.dumps(audit,indent=2)+'\n')
 G.setup_render(row)
 # Ceiling fixtures are recognized by their visible underside, not their back.
 if row[8]=='ceiling':G.set_view('underside')
 return stats

def set_view(view='front'):
 return G.set_view(view)

def refresh_support_surfaces():
 """Refresh measured planes after metadata edits without rebuilding geometry."""
 audit=json.loads((ROOT/'assets-source/household-collection-audit.json').read_text())
 target=ROOT/'src/householdShelfSurfaces.json'
 surfaces={}
 for row,module in rows():
  creator=importlib.import_module(module);importlib.reload(creator)
  if not hasattr(creator,'support_surfaces'):continue
  planes=creator.support_surfaces(row[0])
  if not planes:continue
  info=audit[row[0]];center=info['sourceCenterMm'];scale=info['normalization']
  surfaces[row[0]]=[{**p,'x':-(p['x']-center[0])*scale[0],
    'z':-(p['z']-center[1])*scale[1],'height':(p['height']-center[2])*scale[2],
    'width':p['width']*scale[0],'depth':p['depth']*scale[1],
    'clearance':p['clearance']*scale[2]} for p in planes]
 target.write_text(json.dumps(surfaces,indent=2)+'\n')
 return {'hosts':len(surfaces),'planes':sum(len(p) for p in surfaces.values())}
