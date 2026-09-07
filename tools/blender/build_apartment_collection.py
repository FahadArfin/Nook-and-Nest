"""Original millimetre-scale apartment and reading collection, Blender 5.2."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from studio_geometry import *

def rounded_path(w,d,r,z,y=0):
 pts=[]
 for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(7):
   a=math.radians(start+i*15);pts.append((cx+r*math.cos(a),cy+y+r*math.sin(a),z))
 return pts+[pts[0]]

def cushion(n,p,d,m,piping):
 o=B(n,p,d,m,min(d[2]*.24,35))
 if d[1]<d[2]:
  pts=[(x+p[0],p[1]-d[1]/2-1,y+p[2]) for x,y,z in rounded_path(d[0]-12,d[2]-12,min(35,d[0]/5,d[2]/5),0)]
 else:pts=[(x+p[0],y+p[1],z) for x,y,z in rounded_path(d[0]-12,d[1]-12,min(35,d[0]/5,d[1]/5),p[2]+d[2]*.28)]
 tube(n+' sewn welt',pts,2.4,piping,6)
 return o

def cloth(M):
 for name,color in [('linen',(.70,.66,.55)),('cotton',(.91,.9,.83)),('bluecloth',(.13,.25,.33)),('claycloth',(.43,.21,.15)),('seam',(.52,.49,.41))]:M[name]=material(name,color,.94)
 return M

def bed(row,M):
 id,_,_,w,d,h=row[:6];full='full' in id;mw,md=(1372,1905) if full else (1524,2032);wood=M['oak'] if 'oak' in id else M['wood'];uphol='linen' in id or 'storage' in id;storage='storage' in id
 # Positive Y is the head end. Narrow sides leave the full sleeping surface intact.
 if storage:
  B('recessed toe plinth',(0,0,60),(w-100,d-120,120),M['black'],7)
  B('cabinet carcase',(0,0,235),(w-22,d-45,320),wood,9)
  for side in [-1,1]:
   for y in [-d*.25,d*.25]:
    B('separate storage drawer',(side*(w/2-12),y,230),(22,d*.46,245),wood,4)
    tube('recessed pull',[(side*(w/2),y-90,305),(side*(w/2),y+90,305)],5,M['brass'])
  top=390
 else:
  top=290 if 'platform' in id else 320
  for x in [-w/2+36,w/2-36]:
   B('slim side rail',(x,0,top-60),(32,d-45,120),M['linen'] if uphol else wood,9)
  for y in [-d/2+17,d/2-17]:B('joined end rail',(0,y,top-60),(w-45,34,120),M['linen'] if uphol else wood,8)
  if 'platform' in id:B('inset floating base',(0,0,90),(w-240,d-280,180),M['black'],12)
  else:
   for x in [-w/2+48,w/2-48]:
    for y in [-d/2+60,d/2-60]:C('tapered timber leg',(x,y,105),24,210,wood,s=12,r2=32)
  for y in range(-int(md/2)+35,int(md/2),100):B('sprung bed slat',(0,y,top-9),(mw-15,72,18),M['oak'],3)
  B('center support beam',(0,0,top-42),(45,md,65),wood,4)
 # Headboard construction has visible rear structure and edge layers.
 if uphol:
  B('headboard structural panel',(0,d/2-22.5,h*.56),(w,45,h*.88),wood,12)
  count=6 if storage else 2
  for i in range(count):cushion('tailored headboard channel',((i-(count-1)/2)*(w-45)/count,d/2-57,h*.68),((w-55)/count-7,45,h*.58),M['linen'],M['seam'])
 else:
  for x in [-w/2+20,w/2-20]:B('headboard upright',(x,d/2-21,h/2),(40,42,h),wood,6)
  if 'oak' in id:
   for z in [h*.60,h*.76,h*.92]:B('slatted headboard',(0,d/2-27,z),(w-60,28,82),wood,6)
  else:B('thin walnut headboard',(0,d/2-27,h*.70),(w-36,30,h*.55),wood,8)
 cushion('full sized mattress',(0,-12,top+105),(mw,md,210),M['cotton'],M['seam'])
 # Mesh duvet has a folded hem and slight natural waves, not a flat card.
 width=mw+5;length=md*.72;v=[];nx,ny=28,26
 for j in range(ny+1):
  y=-md/2+j*length/ny-12
  for i in range(nx+1):
   x=(i/nx-.5)*width;drop=max(0,abs(x)-mw*.44)*.50
   v.append((x,y,top+224-drop+6*math.sin(i*.74+j*.31)+3*math.cos(j*.8)))
 f=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
 blanket=mesh('shaped linen duvet',v,f,M['bluecloth'] if full else M['claycloth']);sol=blanket.modifiers.new('Hem thickness','SOLIDIFY');sol.thickness=7;bpy.context.view_layer.objects.active=blanket;bpy.ops.object.modifier_apply(modifier=sol.name)
 for x in [-mw*.25,mw*.25]:cushion('piped sleeping pillow',(x,md*.33,top+258),(mw*.43,370,100),M['cotton'],M['seam'])
 B('folded duvet cuff',(0,md*.19,top+232),(mw-8,125,24),M['cotton'],8)

def bedside(row,M):
 id,_,_,w,d,h=row[:6];wood=M['oak'];roundtop='round' in id
 if roundtop:
  C('round oak top',(0,0,h-12),w/2,24,wood,s=64);C('fluted pedestal',(0,0,h/2),52,h-48,wood,s=48)
  for i in range(24):a=i*math.tau/24;C('pedestal flute',(52*math.cos(a),52*math.sin(a),h/2),5,h-58,wood,s=6)
  C('round foot',(0,0,14),w*.34,28,wood,s=48)
 elif 'metal-c' in id:
  B('folded steel top',(0,0,h-10),(w,d,16),M['jade'],5);B('sliding foot',(0,0,10),(w,d,20),M['jade'],6)
  for x in [-w*.39,w*.39]:B('rear upright',(x,d*.42,h/2),(18,22,h-20),M['jade'],5)
  B('oak inlay',(0,-5,h-1),(w-20,d-25,2),wood,1)
 else:
  B('continuous usable top',(0,0,h-12),(w,d,24),wood,7)
  floating='floating' in id;leg=0 if floating else 150
  B('bottom shelf',(0,0,leg+12),(w-8,d-8,24),wood,5)
  for x in [-w/2+10,w/2-10]:B('side joinery',(x,0,(h+leg)/2),(20,d-8,h-leg-24),wood,4)
  B('back panel',(0,d/2-8,(h+leg)/2),(w-22,12,h-leg-24),wood,2)
  if 'drawer' in id:
   for z in [leg+82,leg+238]:
    B('drawer face',(0,-d/2+14,z),(w-30,20,140),wood,4);C('round pull',(0,-d/2+8,z),10,12,M['brass'],axis='Y',s=16)
  if not floating:
   for x in [-w/2+22,w/2-22]:
    for y in [-d/2+22,d/2-22]:C('short tapered leg',(x,y,leg/2),12,leg,wood,s=12,r2=18)
  else:
   for x in [-w*.3,w*.3]:B('wall mounting cleat',(x,d/2-5,h*.6),(40,10,55),M['steel'],2)

def shade(n,p,r0,r1,h,M,pleats=0):
 # Open double wall with visible lower diffuser and rolled rims.
 s=96 if pleats else 48;v=[]
 for r,z in [(r0,0),(r1,h),(r0-3,0),(r1-3,h)]:
  for i in range(s):
   a=i*math.tau/s;rr=r+(2.5 if pleats and i%2==0 else 0);v.append((p[0]+rr*math.cos(a),p[1]+rr*math.sin(a),p[2]+z))
 f=[]
 for a,b in [(0,1),(2,3),(0,2),(1,3)]:
  for i in range(s):f.append((a*s+i,a*s+(i+1)%s,b*s+(i+1)%s,b*s+i))
 mesh(n,v,f,M);ring(n+' lower rolled hem',p,r0,2,M);ring(n+' upper rim',(p[0],p[1],p[2]+h),r1,2,M)

def lamp(row,M):
 id,_,_,w,d,h=row[:6];r=min(w,d)/2
 C('weighted lamp foot',(0,0,12),r*.55,24,M['brass'] if 'banker' in id else M['white'],s=48)
 if 'banker' in id:
  tube('arched brass stem',[(0,0,20),(0,0,h*.65),(0,-35,h*.82)],10,M['brass'])
  # Barrel shade is an open curved green shell with brass end caps.
  verts=[]
  for x in [-w*.48,w*.48]:
   for i in range(25):a=math.pi*i/24;verts.append((x,math.cos(a)*60-20,h*.81+math.sin(a)*55))
  mesh('green curved banker shade',verts,[(i,i+1,26+i,25+i) for i in range(24)],M['jade'])
  for x in [-w*.48,w*.48]:tube('brass end rim',[(x,math.cos(math.pi*i/24)*60-20,h*.81+math.sin(math.pi*i/24)*55) for i in range(25)],3,M['brass'])
  C('warm light tube',(0,-20,h*.82),9,w*.8,M['light'],axis='X');tube('pull chain',[(w*.29,-30,h*.8),(w*.29,-30,h*.50)],1.6,M['brass'],6);ball('chain end',(w*.29,-30,h*.49),4,M['brass'])
 elif 'task' in id:
  tube('jointed metal arm',[(0,20,25),(0,50,h*.55),(0,-45,h*.86)],9,M['black'])
  for y,z in [(50,h*.55),(-45,h*.86)]:C('hinge wheel',(0,y,z),15,26,M['brass'],axis='X',s=20)
  shade('task cone',(0,-45,h*.67),70,32,h*.27,M['jade']);C('opal task diffuser',(0,-45,h*.67+2),66,4,M['light'])
 elif 'opal' in id:
  C('satin stem',(0,0,h*.35),r*.19,h*.62,M['brass'],s=32)
  # Revolved domed diffuser with closed curved crown.
  v=[];s=64;profiles=[(r,0),(r*.98,h*.11),(r*.82,h*.24),(r*.52,h*.33),(r*.12,h*.37),(0,h*.38)]
  for rr,z in profiles:
   for i in range(s):a=i*math.tau/s;v.append((rr*math.cos(a),rr*math.sin(a),h*.60+z))
  dome=mesh('opal glass dome',v,[(j*s+i,j*s+(i+1)%s,(j+1)*s+(i+1)%s,(j+1)*s+i) for j in range(len(profiles)-1) for i in range(s)],M['white'])
  for face in dome.data.polygons:face.use_smooth=True
  C('warm underside diffuser',(0,0,h*.60),r*.91,5,M['light'])
 else:
  ceramic='ceramic' in id;cone='cone' in id
  if ceramic:
   C('ceramic vase',(0,0,h*.31),r*.38,h*.48,M['blue'],s=48,r2=r*.26)
   for i in range(28):a=i*math.tau/28;tube('ceramic fluting',[(r*.36*math.cos(a),r*.36*math.sin(a),28),(r*.38*math.cos(a),r*.38*math.sin(a),h*.30),(r*.26*math.cos(a),r*.26*math.sin(a),h*.54)],2.3,M['blue'],6)
  else:C('lamp stem',(0,0,h*.38),r*.10,h*.7,M['brass'],s=24)
  z=h*.57;shade('pleated shade' if not cone else 'spun metal shade',(0,0,z),r-3,r*(.44 if cone else .60),h-z,M['jade'] if cone else M['linen'],0 if cone else 48)
  C('warm shade diffuser',(0,0,z+5),r*.85,3,M['light']);ball('shade finial',(0,0,h-1),5,M['brass'])
 # Switch and a short strain relief are modeled, without a long obstructing cord.
 C('touch control',(r*.30,0,26),5,3,M['black'],s=16)

def bathmat(row,M):
 id,_,_,w,d,h=row[:6];notch='toilet' in id or 'sink' in id;nw=280 if 'toilet' in id else 220;nd=330 if 'toilet' in id else 230
 color=M['linen'] if 'toilet' in id else M['bluecloth'] if 'shower' in id else M['cotton']
 # A stepped mesh footprint leaves actual negative space around the fixture.
 pts=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2)]
 if notch:pts += [(nw/2,d/2),(nw/2,d/2-nd+45)]+[(nw/2*math.cos(math.pi*i/12),d/2-nd+45-45*math.sin(math.pi*i/12)) for i in range(1,13)]+[(-nw/2,d/2)]
 pts += [(-w/2,d/2)]
 # Tessellate concave outline, preserving the cutout on top and bottom.
 from mathutils.geometry import tessellate_polygon
 v=[Vector((x,y,2)) for x,y in pts];faces=[]
 for tri in tessellate_polygon([v]):faces.append(tuple((p if isinstance(p,int) else v.index(p)) for p in tri))
 obj=mesh('rubber backed contour mat',v,faces,M['rubber']);sol=obj.modifiers.new('Backing thickness','SOLIDIFY');sol.thickness=2;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=sol.name)
 mesh('woven textile foundation',[(x,y,6) for x,y in pts],faces,color)
 outline=[(x,y,5) for x,y in pts]+[(pts[0][0],pts[0][1],5)];tube('bound fabric edge',outline,4,color,8)
 def inside(x,y):
  if not notch:return True
  if abs(x)>nw/2+5:return True
  return y<d/2-nd+45-45*math.sqrt(max(0,1-(x/(nw/2))**2))-6
 for y in range(-int(d/2)+12,int(d/2)-8,14):
  for x in range(-int(w/2)+12,int(w/2)-8,20):
   if inside(x,y):tube('dense cotton pile loop',[(x-7,y,5),(x,y,10),(x+7,y,5)],2,color,4)

def couch(row,M):
 id,_,_,w,d,h=row[:6];chaise='chaise' in id;color=M['bluecloth'] if chaise else M['linen']
 for x in [-w*.39,w*.39]:
  for y in [-d*.39,d*.39]:C('splayed oak foot',(x,y,95),22,190,M['oak'],s=12,r2=30)
 B('joined seat frame',(0,0,235),(w-60,d-55,115),M['wood'],15)
 B('upholstered seat deck',(0,0,305),(w-38,d-32,105),color,26)
 if chaise:
  cushion('long reading cushion',(0,-30,405),(w-95,d-170,170),color,M['seam'])
  back=cushion('supportive sloped back',(0,d/2-160,650),(w-95,150,440),color,M['seam']);back.rotation_euler.x=math.radians(12)
  cushion('reading arm',(-w/2+65,d*.16,530),(120,d*.54,255),color,M['seam'])
 else:
  for x in [-w*.225,w*.225]:
   cushion('separate seat cushion',(x,-25,405),(w*.44,d-160,155),color,M['seam'])
   back=cushion('tailored back cushion',(x,d/2-130,652),(w*.44,150,390),color,M['seam']);back.rotation_euler.x=math.radians(10)
  for x in [-w/2+58,w/2-58]:cushion('supportive arm',(x,0,515),(115,d-65,290),color,M['seam'])

def sectional(row,M):
 id,_,_,w,d,h=row[:6];soft='soft' in id;tailored='tailored' in id;arm=170 if soft else 120;chaiseW=900;bodyD=920 if not tailored else 850;backY=d/2-bodyD/2;front=d/2-bodyD
 color=M['linen'] if soft else M['bluecloth'] if tailored else material('soft-grey-chenille',(.36,.39,.40),.96)
 for x in [-w/2+80,-w/2+chaiseW-80,w/2-80]:
  for y in ([d/2-90,-d/2+90] if x<0 else [d/2-90,front+90]):
   B('dark block foot',(x,y,65),(75,75,130),M['wood'],7)
 # Two meeting frames leave the inside of the L genuinely empty.
 B('chaise base',(-w/2+chaiseW/2,0,235),(chaiseW,d,250),color,35)
 B('sofa base',(chaiseW/2,backY,235),(w-chaiseW,bodyD,250),color,35)
 cushion('long chaise seat',(-w/2+arm+(chaiseW-arm)/2,-65,440),(chaiseW-arm-15,d-200,180),color,M['seam'])
 seatW=(w-chaiseW-arm)/2
 for j in range(2):
  x=-w/2+chaiseW+seatW*(j+.5)
  cushion('separate sofa seat',(x,backY-50,440),(seatW-12,bodyD-180,180),color,M['seam'])
 for j in range(3):
  x=-w/2+arm+(w-2*arm)*(j+.5)/3
  back=cushion('attached tailored back',(x,d/2-105,710),((w-2*arm)/3-12,170,390 if not soft else 420),color,M['seam']);back.rotation_euler.x=math.radians(9)
 for x in [-w/2+arm/2,w/2-arm/2]:
  length=d if x<0 else bodyD
  y=0 if x<0 else backY
  cushion('soft track arm',(x,y,500),(arm,length-30,365 if soft else 330),color,M['seam'])
  if soft:cushion('padded arm crown',(x,y,667),(arm+22,length-80,80),color,M['seam'])
 if tailored:
  for x in [-w/2+arm/2,w/2-arm/2]:B('tailored lower seam',(x,backY,335),(arm-15,bodyD-45,7),M['seam'],2)
 # Left/right describe the chaise when standing in front, as Ashley does.
 if id.endswith('-right'):
  bpy.context.view_layer.update()
  for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
   transform=o.matrix_world.copy()
   for vertex in o.data.vertices:
    v=transform@vertex.co;v.x=-v.x;vertex.co=v
   o.matrix_world.identity()
   # Mirroring vertices reverses winding; restore outward normals.
   import bmesh
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()

def painting(row,M):
 id,_,_,w,d,h=row[:6];atlas=id.split('-')[-2];q=int(id[-1])-1;antique=atlas in ['classic','portrait'];frame=M['brass'] if antique else M['black'];border=26 if antique else 16
 B('sealed frame backing',(0,d*.30,h/2),(w-10,10,h-10),M['wood'],3)
 for inset,thick,depth in [(0,border,d*.85),(border-5,7,d),(border+5,5,d*.72)]:
  for x in [-w/2+inset+thick/2,w/2-inset-thick/2]:B('stepped frame side',(x,0,h/2),(thick,depth,h-2*inset),frame,3)
  for z in [inset+thick/2,h-inset-thick/2]:B('stepped frame rail',(0,0,z),(w-2*inset,depth,thick),frame,3)
 iw=w-2*(border+10);ih=h-2*(border+10)
 mat=textured('original-apartment-'+atlas,'assets-source/textures/apartment-art-'+atlas+'.png',.88)
 o=mesh('original framed artwork',[(-iw/2,-d/2+4,h/2-ih/2),(iw/2,-d/2+4,h/2-ih/2),(iw/2,-d/2+4,h/2+ih/2),(-iw/2,-d/2+4,h/2+ih/2)],[(0,1,2,3)],mat)
 uv=o.data.uv_layers.new();u=(q%2)*.5;v=.5 if q<2 else 0;e=.001
 for loop,co in zip(uv.data,[(u+e,v+e),(u+.5-e,v+e),(u+.5-e,v+.5-e),(u+e,v+.5-e)]):loop.uv=co
 # Fine gilt corner rosettes add genuine modeled construction.
 if antique:
  for x in [-w/2+border/2,w/2-border/2]:
   for z in [border/2,h-border/2]:C('gilt corner rosette',(x,-d/2,z),7,3,frame,axis='Y',s=12)

def globe(row,M):
 C('walnut pedestal',(0,0,15),150,30,M['wood'],s=64);ring('brass base inlay',(0,0,30),100,2,M['brass'])
 C('turned support',(0,0,79),27,100,M['brass'],s=32,r2=18)
 # Both the meridian and globe use the same 23.4 degree axial tilt.
 center=Vector((0,0,284));rot=__import__('mathutils').Matrix.Rotation(math.radians(23.4),4,'Y')
 pts=[center+rot@Vector((151*math.sin(i*math.tau/96),0,151*math.cos(i*math.tau/96))) for i in range(97)]
 tube('brass meridian',pts,5,M['brass'],10)
 for i in range(72):
  a=i*math.tau/72;points=[center+rot@Vector((r*math.sin(a),-5,r*math.cos(a))) for r in [143,149]];tube('latitude engraving',points,.7,M['black'],4)
 image=bpy.data.images.load(str(ROOT/'assets-source/textures/apartment-earth-nasa-source.jpg'));image.scale(2048,1024);image.filepath_raw=str(ROOT/'assets-source/textures/apartment-earth-2k.png');image.file_format='PNG';image.save()
 mat=material('NASA Earth Observatory globe',(1,1,1),.72);tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 o=ball('rotating Earth',center,136,mat);o['motion_role']='globe';o['pivot_mm']=[0,0,284]
 for sign in [-1,1]:p=center+rot@Vector((0,0,sign*142));ball('polar bearing',p,7,M['brass'])

rows=json.loads((ROOT/'src/apartmentExpansion.json').read_text());args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
statfile=ROOT/'assets-source/apartment-model-audit.json';stats=json.loads(statfile.read_text()) if statfile.exists() else {}
for row in rows:
 id=row[0]
 if args and id not in args:continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):bpy.data.materials.remove(m)
 for im in list(bpy.data.images):
  if im.name!='Render Result':bpy.data.images.remove(im)
 M=cloth(palette())
 if id.startswith('apartment-art-'):painting(row,M)
 elif id.startswith('apartment-bedside-'):bedside(row,M)
 elif id.startswith('apartment-lamp-'):lamp(row,M)
 elif id.startswith('apartment-mat-'):bathmat(row,M)
 elif id=='library-rotating-globe':globe(row,M)
 elif id.startswith('library-reading-'):couch(row,M)
 elif id.startswith('everyday-sectional-'):sectional(row,M)
 else:bed(row,M)
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update();pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=Vector([row[3+i]/(hi[i]-lo[i])/1000 for i in range(3)])
 for o in objects:
  mat=o.matrix_world.copy()
  for v in o.data.vertices:
   p=mat@v.co-center;v.co=Vector([p[i]*scale[i] for i in range(3)])
  o.matrix_world.identity();o['catalog_id']=id
  if o.get('motion_role')=='globe':
   pivot=Vector([(o['pivot_mm'][i]-center[i])*scale[i] for i in range(3)])
   for v in o.data.vertices:v.co-=pivot
   o.location=pivot
   tilt=__import__('mathutils').Matrix.Rotation(math.radians(23.4),3,'Y')
   for v in o.data.vertices:v.co=tilt@v.co
 scene=bpy.context.scene;scene['nominal_dimensions_m']=[v/1000 for v in row[3:6]];scene['catalog_id']=id;scene['construction']='Original detailed apartment and reading collection'
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/f'{id}.blend'),compress=True)
 triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
 bpy.ops.object.select_all(action='DESELECT');static=[o for o in objects if not o.get('motion_role')]
 for o in static:o.select_set(True)
 bpy.context.view_layer.objects.active=static[0];bpy.ops.object.join();bpy.context.object.name=id+' authored assembly'
 bpy.ops.object.select_all(action='SELECT');out=ROOT/'public/models/furniture'/f'{id}.glb';bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True)
 stats[id]={'dimensionsMm':row[3:6],'triangles':triangles,'editableParts':len(objects),'glbBytes':out.stat().st_size};statfile.write_text(json.dumps(stats,indent=2)+'\n');print('APARTMENT COMPLETE',id,stats[id],flush=True)
