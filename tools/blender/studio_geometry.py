"""Millimetre-scale editable construction helpers for the luxury studio models."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
def material(name,color,rough=.6,metal=0,alpha=1,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha;m.diffuse_color=(*color,alpha)
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
def palette():
 return dict(black=material('graphite-metal',(.025,.034,.045),.55,.3),steel=material('satin-steel',(.5,.56,.60),.32,.8),brass=material('champagne-brass',(.55,.36,.14),.38,.7),white=material('porcelain-white',(.87,.88,.85),.32),wood=material('walnut',(.26,.12,.055),.83),oak=material('honey-oak',(.61,.36,.14),.82),glass=material('clear-glass',(.57,.75,.78),.12,0,.18),darkglass=material('smoked-glass',(.06,.13,.16),.15,0,.38),rubber=material('matte-rubber',(.014,.018,.023),.96),paper=material('ivory-pages',(.89,.86,.76),.96),light=material('warm-light',(.98,.75,.40),.4,0,1,.7),blue=material('cobalt-blue',(.015,.12,.42),.52),orange=material('papaya-orange',(.95,.22,.018),.5),jade=material('jade-enamel',(.22,.38,.28),.72),red=material('crimson',(.6,.025,.055),.6))

def textured(name,path,rough=.8):
 mat=material(name,(1,1,1),rough);tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/path),check_existing=True);mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color']);return mat
def finish(o,n,m):o.name=n;o.data.materials.append(m);o.select_set(False);return o
def B(n,p,d,m,b=2):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  mod=o.modifiers.new('Soft construction edges','BEVEL');mod.width=min(b,min(d)*.25);mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,m)
def C(n,p,r,h,m,axis='Z',s=32,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=s,radius1=r,radius2=r if r2 is None else r2,depth=h,location=p);o=bpy.context.object
 if axis=='X':o.rotation_euler.y=math.pi/2
 if axis=='Y':o.rotation_euler.x=math.pi/2
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,n,m)
def mesh(n,v,f,m):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);me.materials.append(m);return o
def tube(n,pts,r,m,s=8):
 pts=[Vector(p) for p in pts];v=[]
 for i,p in enumerate(pts):
  t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized();u=t.cross(Vector((0,0,1)))
  if u.length<.01:u=t.cross(Vector((0,1,0)))
  u.normalize();a=t.cross(u)
  v.extend([p+r*(u*math.cos(j*math.tau/s)+a*math.sin(j*math.tau/s)) for j in range(s)])
 f=[(i*s+j,i*s+(j+1)%s,(i+1)*s+(j+1)%s,(i+1)*s+j) for i in range(len(pts)-1) for j in range(s)];f += [tuple(reversed(range(s))),tuple(range((len(pts)-1)*s,len(pts)*s))]
 return mesh(n,v,f,m)
def ring(n,p,r,t,m,axis='Z',steps=48):
 pts=[]
 for i in range(steps+1):
  a=i*math.tau/steps;u,v=r*math.cos(a),r*math.sin(a);pts.append((p[0]+(0 if axis=='X' else u),p[1]+(u if axis=='X' else v if axis=='Z' else 0),p[2]+(v if axis!='Z' else 0)))
 return tube(n,pts,t,m)
def ball(n,p,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=r,location=p)
 for f in bpy.context.object.data.polygons:f.use_smooth=True
 return finish(bpy.context.object,n,m)
def text(n,body,p,size,m,front=True):
 cu=bpy.data.curves.new(n,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.08;cu.resolution_u=2
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.location=p
 if front:o.rotation_euler.x=math.pi/2
 cu.materials.append(m);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False);return o
def bolt(p,m,r=3):C('Hex fixing',p,r,2,m,s=6)
def feet(w,d,M,z=5):
 for x in [-w*.38,w*.38]:
  for y in [-d*.35,d*.35]:C('Isolation foot',(x,y,z),min(w,d)*.07,z*2,M['rubber'])
def cavity(n,p,w,d,h,M,exponent=3,wall=12):
 # Continuous outer shell, rolled rim and genuinely recessed inner floor.
 profiles=[(.72,.72,0),(.90,.92,h*.15),(1,1,h-3),(.99,.99,h),((w-2*wall)/w,(d-2*wall)/d,h-4),(.72,.69,h*.32),(.42,.38,10)];v=[];s=48
 for a,b,z in profiles:
  for i in range(s):
   t=i*math.tau/s;c,ss=math.cos(t),math.sin(t);v.append((p[0]+w*a/2*math.copysign(abs(c)**(2/exponent),c),p[1]+d*b/2*math.copysign(abs(ss)**(2/exponent),ss),p[2]+z))
 f=[(j*s+i,j*s+(i+1)%s,(j+1)*s+(i+1)%s,(j+1)*s+i) for j in range(len(profiles)-1) for i in range(s)];f += [tuple(reversed(range(s))),tuple(range((len(profiles)-1)*s,len(profiles)*s))];o=mesh(n,v,f,M)
 for poly in o.data.polygons:poly.use_smooth=True
 o['cavity_depth_mm']=h-10;return o
def art(n,p,w,h,M,quadrant=0,top=False):
 path=ROOT/'assets-source/textures/studio-art-atlas.png'
 if not path.exists():raise FileNotFoundError(path)
 key='original-studio-art';mat=bpy.data.materials.get(key)
 if mat is None:
  mat=material(key,(1,1,1),.8);tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path));mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 v=[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)]
 if top:v=[(x,z,0) for x,y,z in v]
 o=mesh(n,v,[(0,1,2,3)],mat);o.location=p;uv=o.data.uv_layers.new();u=(quadrant%2)*.5;vv=.5 if quadrant<2 else 0
 for loop,co in zip(uv.data,[(u,vv),(u+.5,vv),(u+.5,vv+.5),(u,vv+.5)]):loop.uv=co
 return o
