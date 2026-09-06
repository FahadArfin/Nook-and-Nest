"""blender -b -t 4 --python tools/blender/build_studio_collection.py -- [IDs]"""
import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from studio_geometry import *
from studio_architecture import shelf_model,light_model,backsplash_model
from studio_decor import manga,mat_model,clock,cleaning
from studio_devices import device,printer,rack,camera_device,drone
from studio_bathroom import bathroom
from studio_collectibles import collectible
rows=json.loads((ROOT/'src/studioExpansion.json').read_text())
base=(ROOT/'src/catalog.ts').read_text()
for line in base.splitlines():
 if any('"'+id+'"' in line for id in ['pedestal-sink','wall-hung-sink','vessel-sink','single-bath-vanity','double-bath-vanity','floating-bath-vanity','two-piece-toilet','one-piece-toilet','wall-hung-toilet']):
  a=re.search(r'^\s*(\[.*\]),?\s*$',line)
  if a:rows.append(json.loads(a[1]))
for f in ['homeExpansion.json','cozyExpansion.json','luxuryExpansion.json','modernExpansion.json']:
 rows.extend(r for r in json.loads((ROOT/'src'/f).read_text()) if r[0] in ['console-vanity','reed-double-vanity'])
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
surfaces_path=ROOT/'src/studioShelfSurfaces.json';surfaces=json.loads(surfaces_path.read_text()) if surfaces_path.exists() else {}
stats_path=ROOT/'assets-source/studio-model-audit.json';stats=json.loads(stats_path.read_text()) if stats_path.exists() else {}
for row in rows:
 id=row[0]
 if args and id not in args:continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):bpy.data.materials.remove(m)
 for image in list(bpy.data.images):
  if image.name!='Render Result':bpy.data.images.remove(image)
 M=palette();planes=[]
 if id=='shelf-floating-oak':M['oak']=textured('honey-oak','assets-source/textures/web/handpainted-honey-oak.png')
 if id in ['shelf-floating-marble','clock-marble-brass','backsplash-fluted']:M['white']=textured('ivory-marble','public/textures/countertops/ivory-marble.jpg',.45)
 if id.startswith('shelf-'):planes=shelf_model(row,M)
 elif row[2]=='Lighting':light_model(row,M)
 elif id.startswith('backsplash-'):backsplash_model(row,M)
 elif id.startswith('manga-'):manga(row,M)
 elif id.startswith('desk-mat-'):mat_model(row,M)
 elif 'clock' in id:clock(row,M)
 elif row[2]=='Bathroom':bathroom(row,M)
 elif id.startswith('brick-'):collectible(row,M)
 elif id.startswith('bambu-'):printer(row,M)
 elif id=='mini-network-rack':rack(row,M)
 elif id=='dji-mini-5-pro':drone(row,M)
 elif id in ['unifi-g6-bullet','unifi-g6-instant','unifi-g4-doorbell','ring-doorbell']:camera_device(row,M)
 elif row[2]=='Kitchen':cleaning(row,M)
 elif not device(row,M):raise ValueError('Missing builder: '+id)
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
 pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices];lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));scale=Vector(tuple(row[3+i]/(hi[i]-lo[i]) for i in range(3)));center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for o in objects:
  mat=o.matrix_world.copy()
  for v in o.data.vertices:
   p=mat@v.co-center;v.co=Vector(tuple(p[i]*scale[i]/1000 for i in range(3)))
  o.matrix_world.identity();o['catalog_id']=id
 scene=bpy.context.scene;scene['nominal_dimensions_m']=[v/1000 for v in row[3:6]];scene['catalog_id']=id;scene['construction']='Original editable Batch 8/9 detailed studio model'
 if planes:
  surfaces[id]=[{**p,'x':(p['x']-center.x)*scale.x,'z':-(p['z']-center.y)*scale.y,'width':p['width']*scale.x,'depth':p['depth']*scale.y,'height':(p['height']-lo.z)*scale.z,'clearance':p['clearance']*scale.z} for p in planes]
 bpy.ops.file.pack_all()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/f'{id}.blend'),compress=True)
 triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
 # One static mesh split by material on export; preserve the preview digits node for runtime replacement.
 bpy.ops.object.select_all(action='DESELECT');static=[o for o in objects if not o.get('motion_role')]
 for o in static:o.select_set(True)
 bpy.context.view_layer.objects.active=static[0];bpy.ops.object.join();bpy.context.object.name=id+' authored assembly'
 bpy.ops.object.select_all(action='SELECT');out=ROOT/'public/models/furniture'/f'{id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
 stats[id]={'dimensionsMm':row[3:6],'triangles':triangles,'editableParts':len(objects),'glbBytes':out.stat().st_size}
 surfaces_path.write_text(json.dumps(surfaces,indent=2)+'\n');stats_path.write_text(json.dumps(stats,indent=2)+'\n');print('STUDIO COMPLETE',id,stats[id],flush=True)
