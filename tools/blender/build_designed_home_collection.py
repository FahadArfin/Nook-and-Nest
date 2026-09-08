"""Original researched home collection. Coordinates and construction are in mm.
The packed blend retains named individual parts; GLB groups static parts for the web.
"""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from studio_geometry import *

def rounded(w,d,r,z=0):
 pts=[]
 for x,y,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for j in range(7):
   t=math.radians(a+j*15);pts.append((x+r*math.cos(t),y+r*math.sin(t),z))
 return pts+[pts[0]]

def slab(n,p,w,d,h,m,roundness=35):
 pts=rounded(w,d,min(roundness,w/2,d/2));s=len(pts)-1
 verts=[(x+p[0],y+p[1],p[2]+z) for z in [-h/2,h/2] for x,y,_ in pts[:-1]]
 return mesh(n,verts,[tuple(reversed(range(s))),tuple(range(s,2*s))]+[(i,(i+1)%s,(i+1)%s+s,i+s) for i in range(s)],m)

def oval(n,p,w,d,h,m):
 o=C(n,p,w/2,h,m,s=64);o.scale.y=d/w;return o

def cushion(n,p,d,m,M):
 slab(n,p,d[0],d[1],d[2],m,45)
 tube(n+' sewn welt',[(x+p[0],y+p[1],p[2]+d[2]*.35) for x,y,z in rounded(d[0]-8,d[1]-8,42)],2,M['seam'],6)

def weave(n,x,y,z,w,h,M):
 # Open cane panels: two diagonal strand families, clipped to a rectangle.
 for slope in [-1,1]:
  for b in range(-int(w+h),int(w+h),24):
   pts=[]
   for xx in [-w/2,w/2]:
    zz=slope*xx+b
    if -h/2<=zz<=h/2:pts.append((x+xx,y,z+zz))
   for zz in [-h/2,h/2]:
    xx=(zz-b)/slope
    if -w/2<xx<w/2:pts.append((x+xx,y,z+zz))
   if len(pts)==2:tube(n+' diagonal cane',pts,2.3,M['cane'],5)
 for xx in [-w/2,w/2]:B(n+' stile',(x+xx,y,z),(18,22,h+20),M['oak'],5)
 for zz in [-h/2,h/2]:B(n+' rail',(x,y,z+zz),(w+18,22,18),M['oak'],5)

def legs(w,d,h,M,metal=False):
 for x in [-w*.40,w*.40]:
  for y in [-d*.34,d*.34]:
   C('tapered foot',(x,y,h/2),19,h,M['brass'] if metal else M['wood'],s=16,r2=26)
   C('floor glide',(x,y,3),18,6,M['rubber'],s=16)

def handle(x,y,z,width,M):
 for xx in [-width/2,width/2]:C('pull standoff',(x+xx,y+8,z),4,16,M['brass'],axis='Y',s=12)
 tube('solid brass pull',[(x-width/2,y,z),(x+width/2,y,z)],4,M['brass'])

def cabinet(row,M):
 id,_,_,w,d,h=row[:6];dresser='dresser' in id;floating='floating' in id;bottom=0 if floating else 95;mat=M['cream'] if ('fluted' in id or floating) else M['wood'] if ('walnut' in id or 'tambour' in id) else M['oak'];top=h-14
 if not floating:legs(w,d,bottom,M,'fluted' in id)
 slab('continuous fitted top',(0,0,top),w,d,28,mat,28)
 B('bottom carcass',(0,0,bottom+12),(w-20,d-20,24),mat,6)
 B('recessed back panel',(0,d/2-20,(h+bottom)/2),(w-40,12,h-bottom-30),mat,2)
 for x in [-w/2+14,w/2-14]:B('carcass side',(x,0,(h+bottom)/2),(28,d-12,h-bottom-28),mat,6)
 if dresser:
  count=5 if 'tall' in id else 3;dh=(h-bottom-38)/count
  for j in range(count):
   z=bottom+22+dh*(j+.5);B('inset drawer shadow',(0,-d/2+13,z),(w-50,22,dh-2),M['black'],3)
   slab('fitted drawer front',(0,-d/2,z),w-48,24,dh-7,mat,6)
   if 'fluted' in id:
    for x in range(-int(w/2)+38,int(w/2)-30,18):C('drawer flute',(x,-d/2-12,z),5.5,dh-13,mat,s=10)
   handle(0,-d/2-24,z+dh*.25,130,M)
 else:
  units=3;cw=(w-58)/units;ch=h-bottom-55
  for j in range(units):
   x=(j-1)*cw
   if j<2:B('internal divider',(x+cw/2,10,(bottom+h)/2),(18,d-45,ch),mat,3)
   if ('asymmetric' in id and j!=0) or ('cane' in id and j==1):
    B('open equipment shelf',(x,0,bottom+ch*.50),(cw-20,d-40,18),mat,3)
    # Back cable port has an actual dark inset and raised ring.
    C('cable aperture',(x,d/2-29,bottom+ch*.70),22,2,M['black'],axis='Y')
    ring('cable grommet',(x,d/2-31,bottom+ch*.70),22,2,M['rubber'],axis='Y')
   elif 'cane' in id:weave('cane door',x,-d/2+2,bottom+ch/2+23,cw-30,ch-15,M)
   else:
    B('recessed door',(x,-d/2+8,bottom+ch/2+23),(cw-7,22,ch),mat,4)
    if 'tambour' in id or 'asymmetric' in id:
     for xx in range(int(x-cw/2+12),int(x+cw/2-10),16):C('individual tambour reed',(xx,-d/2-4,bottom+ch/2+23),5,ch-8,mat,s=10)
    else:B('brass horizontal reveal',(x,-d/2-5,h-48),(cw-24,3,3),M['brass'],1)
    handle(x+cw*.32,-d/2-18,bottom+ch*.52,38,M)
 if floating:B('concealed wall cleat',(0,d/2-5,h*.65),(w*.7,10,60),M['black'],2)

def rug(row,M):
 id,_,_,w,d,h=row[:6];kind=id.rsplit('-',1)[1]
 slab('bound textile backing',(0,0,h*.35),w,d-50,h*.7,M['linen'],12)
 if kind in ['persian','kilim','amazigh','artdeco']:
  q=['persian','kilim','amazigh','artdeco'].index(kind);mat=textured('original-cultural-rug-pattern','assets-source/textures/designed-rug-atlas.png',.96)
  o=mesh('woven patterned face',[(-w/2+5,-d/2+28,h),(w/2-5,-d/2+28,h),(w/2-5,d/2-28,h),(-w/2+5,d/2-28,h)],[(0,1,2,3)],mat);uv=o.data.uv_layers.new();u=q%2*.5;v=.5 if q<2 else 0;e=.002
  for loop,co in zip(uv.data,[(u+e,v+e),(u+.5-e,v+e),(u+.5-e,v+.5-e),(u+e,v+.5-e)]):loop.uv=co
  for x in range(-int(w/2)+15,int(w/2)-10,18):
   for s in [-1,1]:tube('knotted fringe',[(x,s*(d/2-30),h*.6),(x+3,s*(d/2-12),h*.5),(x+2,s*d/2,h*.2)],1.8,M['linen'],5)
 elif kind=='tatami':
  for x in [-w/2+28,w/2-28]:B('indigo cloth border',(x,0,h-3),(56,d,6),M['indigo'],1)
  for y in range(-int(d/2)+5,int(d/2)-4,9):tube('woven rush rib',[(-w/2+57,y,h-1),(w/2-57,y,h-1)],1.5,M['cane'],5)
 else:
  slab('indigo woven face',(0,0,h*.8),w-10,d-60,3,M['indigo'],8)
  for x in range(-int(w/2)+40,int(w/2)-30,110):
   for y in range(-int(d/2)+60,int(d/2)-50,110):
    for dx,dy in [(0,30),(30,0),(0,-30),(-30,0)]:
     tube('sashiko running stitch',[(x+dx*.4,y+dy*.4,h),(x+dx,y+dy,h)],1.2,M['linen'],4)
 tube('stitched binding',rounded(w-6,d-54,10,h*.72),1.3,M['seam'],5)

def coffee(row,M):
 id,_,_,w,d,h=row[:6]
 if 'travertine' in id:
  oval('honed travertine slab',(0,0,h-18),w,d,36,M['stone']);oval('recessed slab underside',(0,0,h-39),w-35,d-35,8,M['cream'])
  for x in [-w*.26,w*.26]:slab('sculpted walnut trestle',(x,0,(h-44)/2),90,d*.66,h-44,M['wood'],40)
  B('joinery stretcher',(0,0,h*.38),(w*.58,65,60),M['wood'],10)
 elif 'fluted' in id:
  C('recessed pedestal',(0,0,(h-30)/2),w*.40,h-30,M['wood'],s=64)
  for j in range(72):
   a=j*math.tau/72;C('rounded drum flute',(w*.405*math.cos(a),w*.405*math.sin(a),(h-35)/2+5),11,h-40,M['wood'],s=10)
  C('bronze rim',(0,0,h-19),w/2,30,M['brass'],s=64);C('walnut circular top',(0,0,h-4),w/2-8,8,M['wood'],s=64)
 elif 'glass' in id:
  slab('smoked glass top',(0,0,h-8),w,d,16,M['darkglass'],45)
  for s in [-1,1]:
   pts=[(s*(w*.35-w*.2*t/20),-d*.28+d*.56*t/20,35+(h-86)*math.sin(math.pi*t/20)) for t in range(21)]
   tube('sweeping laminated oak arch',pts,35,M['oak'],12)
  for x in [-w*.25,w*.25]:B('glass support pad',(x,0,h-20),(65,65,8),M['rubber'],2)
 elif 'marble' in id:
  B('honed marble top',(0,0,h-24),(w,d,48),M['marble'],8)
  for x in [-w/2+30,w/2-30]:B('waterfall stone end',(x,0,(h-48)/2),(60,d,h-48),M['marble'],6)
  for x in [-w/2+64,w/2-64]:B('miter shadow reveal',(x,0,h-50),(3,d-16,3),M['seam'],0)
 else:
  legs(w,d,80,M);slab('rounded oak worktop',(0,0,h-15),w,d,30,M['oak'],28)
  B('lower display shelf',(0,0,110),(w-65,d-35,22),M['oak'],6)
  for x in [-w*.46,w*.46]:B('solid corner post',(x,0,(h+55)/2),(42,d-20,h-115),M['oak'],10)
  B('drawer box',(0,15,h-93),(w-100,d-55,130),M['wood'],3);B('fitted drawer fascia',(0,-d/2,h-93),(w-104,22,125),M['oak'],5);handle(0,-d/2-15,h-60,160,M)

def fridge(row,M):
 id,_,_,w,d,h=row[:6];retro='retro' in id;mat=M['cream'] if retro else M['steel'] if 'steel' in id else M['white'];front=-d/2+20;split=h*.70
 B('insulated refrigerator cabinet',(0,22,h/2),(w-8,d-50,h-20),mat,20)
 for z0,z1,n in [(28,split-6,'fresh food'),(split+6,h-8,'top freezer')]:
  B(n+' black gasket',(0,front+20,(z0+z1)/2),(w-20,14,z1-z0),M['rubber'],8)
  slab(n+' softly rounded door',(0,front,(z0+z1)/2),w,45,z1-z0-6,mat,22)
  if retro or 'steel' in id:
   z=(z0+z1)/2;length=min(180,(z1-z0)*.55);x=-w*.37
   for zz in [z-length/2,z+length/2]:C('handle mount',(x,front-29,zz),7,20,M['steel'],axis='Y',s=12)
   tube('vertical door handle',[(x,front-41,z-length/2),(x,front-45,z),(x,front-41,z+length/2)],7,M['steel'],10)
  else:B('recessed integrated grip',(-w*.27,front-23,z1-30),(w*.34,3,15),M['black'],3)
 for x in [-w*.4,w*.4]:B('covered hinge',(x,front+15,h-6),(30,40,12),mat,4)
 for x in range(-int(w*.4),int(w*.4),19):B('toe ventilation slot',(x,front-5,15),(9,3,10),M['black'],1)
 text('small temperature badge','COOL',(w*.25,front-24,h*.86),12,M['steel'])

def tap(x,y,z,M,height=230):
 C('mixer escutcheon',(x,y,z+4),24,8,M['steel'])
 pts=[(x,y,z+10),(x,y,z+height*.65)]+[(x,y-65+65*math.cos(t*math.pi/16),z+height*.65+65*math.sin(t*math.pi/16)) for t in range(9)]
 tube('swan neck mixer',pts,9,M['steel'],12);C('aerator',(x,y-65,z+height*.65+60),11,10,M['steel'])
 tube('mixer lever',[(x+18,y,z+45),(x+57,y,z+65)],4,M['steel'])

def drain(x,y,z,M):
 C('drain recess',(x,y,z),18,2,M['black']);C('metal waste cap',(x,y,z+2),13,2,M['steel'])
 for j in range(6):a=j*math.tau/6;C('drain slot',(x+15*math.cos(a),y+15*math.sin(a),z+1.5),1.8,1,M['black'],s=8)

def sink(row,M):
 id,_,_,w,d,h=row[:6];kitchen='sink-' in id;double='fluted' in id;vessel='vessel' in id;pedestal='pedestal' in id;wall='basin-wall' in id
 if kitchen:
  base=900;bh=220;bw=w-100;bd=470;bottom=base-bh
  legs(w,d,70,M);B('sink base lower case',(0,20,350),(w-20,d-60,560),M['cream'] if double else M['oak'],7)
  case=M['cream'] if double else M['oak']
  for x in [-w/2+15,w/2-15]:B('full-height sink cabinet side',(x,20,752),(30,d-60,264),case,5)
  B('upper cabinet back',(0,d/2-25,752),(w-40,20,264),case,3)
  B('apron support crossrail',(0,-d/2+12,654),(w-40,32,52),case,3)
  B('basin support shelf',(0,10,668),(w-55,d-80,20),case,3)
  for x in [-w/4,w/4]:
   B('shaker door frame',(x,-d/2+10,370),(w/2-18,24,540),M['cream'] if double else M['oak'],5)
   B('recessed shaker field',(x,-d/2-3,370),(w/2-85,4,455),M['wood'] if not double else M['linen'],2);handle(x,-d/2-15,570,95,M)
  for x in [-w/2+22,w/2-22]:B('countertop-surface',(x,0,base-15),(44,d,30),M['counter'],5)
  B('countertop-surface',(0,d/2-45,base-15),(w-88,90,30),M['counter'],5)
  if double:
   for x in [-bw/4,bw/4]:cavity('deep divided farmhouse bowl',(x,-35,bottom),bw/2-10,bd,bh,M['white'],5,18);drain(x,-35,bottom+13,M)
  else:cavity('deep single farmhouse bowl',(0,-35,bottom),bw,bd,bh,M['white'],5,22);drain(0,-35,bottom+13,M)
  B('ceramic apron',(0,-bd/2-41,base-bh/2),(bw,26,bh),M['white'],9)
  if double:
   for x in range(-int(bw/2)+16,int(bw/2)-10,22):C('apron ceramic flute',(x,-bd/2-54,base-bh/2),6,bh-20,M['white'],s=10)
  tap(0,d/2-48,base,M,250)
 else:
  bh=150 if vessel else 145;rim=h if vessel else h-180;bottom=rim-bh
  if pedestal:
   for j in range(40):a=j*math.tau/40;C('fluted pedestal shaft',(90*math.cos(a),70*math.sin(a),bottom/2),9,bottom,M['white'],s=8)
   oval('pedestal core',(0,0,bottom/2),170,130,bottom,M['white']);oval('pedestal foot',(0,0,14),260,220,28,M['white'])
  elif not vessel and not wall:
   for x in [-w*.42,w*.42]:
    for y in [-d*.36,d*.36]:tube('brass console leg',[(x,y,10),(x,y,bottom+35)],11,M['brass'],10)
   B('lower console shelf',(0,0,150),(w-60,d-45,20),M['stone'],5)
   # Four narrow ledges leave the basin interior open.
   for x in [-w/2+20,w/2-20]:B('stone side ledge',(x,0,bottom+35),(40,d,22),M['stone'],4)
   for y in [-d*.40,d*.40]:tube('console crossrail',[(-w*.43,y,bottom+22),(w*.43,y,bottom+22)],9,M['brass'])
  elif wall:
   B('wall mounting backplate',(0,d/2-12,rim-55),(w-30,24,105),M['white'],7)
  bowlw=w*.83 if wall else w-18;bowld=d-65 if not vessel else d
  cavity('recessed ceramic washbasin',(-w*.07 if wall else 0,-16 if not vessel else 0,bottom),bowlw,bowld,bh,M['stone'] if 'console' in id else M['white'],2 if vessel or 'console' in id else 3.2,12)
  drain(-w*.07 if wall else 0,-16 if not vessel else 0,bottom+13,M)
  if not vessel:
   B('ceramic tap ledge',(0,d/2-27,rim-15),(w-25,54,30),M['white'],8);tap(w*.30 if wall else 0,d/2-28,rim,M,180)

def sunroom(row,M):
 id,_,_,w,d,h=row[:6];table='table' in id;ottoman='ottoman' in id;chaise='chaise' in id;seat=320 if not ottoman else 270
 for x in [-w*.40,w*.40]:
  for y in [-d*.37,d*.37]:
   tube('bent rattan leg',[(x*1.06,y*1.05,10),(x,y,seat),(x*.95,y*.97,seat+15)],13,M['cane'],10)
   for z in [seat-32,seat-24,seat-16]:ring('bound leg joint',(x,y,z),14,2,M['linen'],steps=12)
 tube('lower bent cane stretcher',rounded(w*.81,d*.75,60,110),11,M['cane'])
 tube('structural seat frame',rounded(w*.9,d*.9,75,seat),16,M['cane'],10)
 if table:
  oval('clear glass tabletop',(0,0,h-6),w,d,12,M['glass']);ring('table upper cane rim',(0,0,h-22),w/2-20,12,M['cane'])
  for j in range(20):
   a=j*math.tau/20;tube('table woven radial support',[(w*.22*math.cos(a),d*.22*math.sin(a),150),(w*.45*math.cos(a),d*.45*math.sin(a),h-24)],5,M['cane'],6)
  oval('woven lower shelf',(0,0,140),w*.58,d*.58,12,M['oak']);return
 cushion('tailored seat cushion',(0,0,seat+48),(w*.88,d*.87,95),M['linen'],M)
 if ottoman:return
 backY=d*.40;backH=h-seat-50
 weave('open woven back',0,backY,seat+50+backH/2,w*.86,backH-35,M)
 tube('arched back frame',[(-w*.45,backY,seat),(-w*.45,backY,h-65),(-w*.37,backY,h-18),(w*.37,backY,h-18),(w*.45,backY,h-65),(w*.45,backY,seat)],16,M['cane'],10)
 # Back upholstery is a tailored rounded rectangular pad, not a stretched sphere.
 if not chaise:
  slab('tailored back cushion',(0,backY-55,seat+100+backH*.35),w*.80,85,backH*.65,M['sage'],35)
 for x in [-w*.46,w*.46]:
  tube('continuous bent arm',[(x,-d*.38,seat),(x,-d*.38,seat+210),(x,-d*.25,seat+245),(x,d*.25,seat+245),(x,backY,seat+190)],15,M['cane'],10)
  for y in [-d*.22,0,d*.22]:tube('arm vertical cane',[(x,y,seat+20),(x,y,seat+235)],5,M['cane'],6)

def mirror(row,M):
 id,_,_,w,d,h=row[:6];arch='arch' in id;pts=[]
 if arch:
  pts=[(-w/2,0,0),(w/2,0,0),(w/2,0,h-w/2)]+[(w/2*math.cos(t*math.pi/32),0,h-w/2+w/2*math.sin(t*math.pi/32)) for t in range(33)]+[(-w/2,0,0)]
 else:
  c=110;pts=[(-w/2+c,0,0),(w/2-c,0,0),(w/2,0,c),(w/2,0,h-c),(w/2-c,0,h),(-w/2+c,0,h),(-w/2,0,h-c),(-w/2,0,c),(-w/2+c,0,0)]
 mesh('silvered mirror glass',[(x*.95,-d/2+5,(z-h/2)*.96+h/2) for x,y,z in pts[:-1]],[tuple(range(len(pts)-1))],M['mirror'])
 tube('sculpted mirror frame',pts,15 if arch else 23,M['brass'] if arch else M['wood'],12)
 tube('inner polished reveal',[(x*.96,-d/2,(z-h/2)*.97+h/2) for x,y,z in pts],3,M['brass'],6)

def doormat(row,M):
 id,_,_,w,d,h=row[:6];slab('beveled rubber backing',(0,0,2),w,d,4,M['rubber'],12)
 tube('raised weather border',rounded(w-12,d-12,10,4),2,M['black'],6)
 if 'ribbed' in id:
  for y in range(-int(d/2)+20,int(d/2)-15,12):B('scraper rib',(0,y,5.5),(w-38,4,3),M['black'],1)
 elif 'diamond' in id:
  for x in range(-int(w/2)+35,int(w/2)-30,45):
   for y in range(-int(d/2)+35,int(d/2)-30,45):tube('molded diamond scraper',[(x-17,y,6),(x,y+17,6),(x+17,y,6),(x,y-17,6),(x-17,y,6)],2,M['black'],5)
 else:
  for x in range(-int(w/2)+25,int(w/2)-20,25):B('lengthwise lattice',(x,0,5),(4,d-35,3),M['black'],1)
  for y in range(-int(d/2)+25,int(d/2)-20,25):B('crosswise lattice',(0,y,5.5),(w-35,4,3),M['black'],1)

def stone_texture(mat,key):
 """Bake original restrained stone coloration into a portable shared bitmap."""
 from mathutils import noise
 path=ROOT/'assets-source/textures'/('designed-'+key+'.png')
 if path.exists():im=bpy.data.images.load(str(path),check_existing=True)
 else:
  size=256;im=bpy.data.images.new('original '+key,width=size,height=size);pixels=[]
  for y in range(size):
   for x in range(size):
    u=x/size;v=y/size;n=noise.noise(Vector((u*9,v*9,1.3)));fine=noise.noise(Vector((u*90,v*90,4)))
    wave=abs(math.sin(u*14+v*8+n*2.2));shade=(.78+.20*min(1,wave*8)+fine*.018) if key=='marble' else (.92+n*.045+fine*.035)
    base=(.83,.81,.77) if key=='marble' else (.78,.70,.56);pixels.extend([min(1,c*shade) for c in base]+[1])
  im.pixels.foreach_set(pixels);im.filepath_raw=str(path);im.file_format='PNG';im.save()
 nodes=mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=im;mat.node_tree.links.new(tex.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
 for o in [o for o in bpy.context.scene.objects if o.type=='MESH' and mat in list(o.data.materials)]:
  uv=o.data.uv_layers.active or o.data.uv_layers.new()
  for poly in o.data.polygons:
   normal=poly.normal;drop=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=drop]
   for loop in poly.loop_indices:
    p=o.matrix_world@o.data.vertices[o.data.loops[loop].vertex_index].co;uv.data[loop].uv=(p[axes[0]]/1000,p[axes[1]]/1000)

rows=json.loads((ROOT/'src/designedHomeExpansion.json').read_text());args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
audit=ROOT/'assets-source/designed-home-model-audit.json';stats=json.loads(audit.read_text()) if audit.exists() else {}
for row in rows:
 id=row[0]
 if args and id not in args:continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):bpy.data.materials.remove(m)
 for im in list(bpy.data.images):
  if im.name!='Render Result':bpy.data.images.remove(im)
 M=palette();M.update(linen=material('natural-linen',(.73,.69,.58),.98),seam=material('stitched-warm-edge',(.44,.38,.28),.95),cane=material('natural-rattan',(.55,.34,.15),.87),cream=material('warm-lacquer',(.76,.72,.62),.65),sage=material('sage-upholstery',(.35,.43,.31),.98),indigo=material('indigo-cloth',(.015,.045,.11),.98),stone=material('honed-travertine',(.67,.58,.43),.88),marble=material('warm-veined-marble',(.75,.72,.66),.6),counter=material('countertop-surface',(.70,.68,.61),.7),mirror=material('silvered-mirror',(.65,.76,.78),.12,.92))
 # Fine procedural stone variation survives in the packed editable source.
 for key in ['stone','marble']:
  mat=M[key];nodes=mat.node_tree.nodes;noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3 if key=='marble' else 90;noise.inputs['Detail'].default_value=2
  ramp=nodes.new('ShaderNodeValToRGB');base=mat.diffuse_color;ramp.color_ramp.elements[0].color=tuple(c*.65 for c in base[:3])+(1,);ramp.color_ramp.elements[1].color=base;mat.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0]);mat.node_tree.links.new(ramp.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
 if '-media-' in id or '-dresser-' in id:cabinet(row,M)
 elif '-rug-' in id:rug(row,M)
 elif '-coffee-' in id:coffee(row,M)
 elif '-fridge-' in id:fridge(row,M)
 elif '-sink-' in id or '-basin-' in id:sink(row,M)
 elif '-sunroom-' in id:sunroom(row,M)
 elif '-mirror-' in id:mirror(row,M)
 else:doormat(row,M)
 bpy.context.view_layer.update()
 for key in ['stone','marble']:
  if M[key].users:stone_texture(M[key],key)
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in objects for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=Vector([row[3+i]/(hi[i]-lo[i])/1000 for i in range(3)])
 for o in objects:
  transform=o.matrix_world.copy()
  for vertex in o.data.vertices:
   p=transform@vertex.co-center;vertex.co=Vector([p[i]*scale[i] for i in range(3)])
  o.matrix_world.identity();o['catalog_id']=id
 scene=bpy.context.scene;scene['catalog_id']=id;scene['nominal_dimensions_m']=[v/1000 for v in row[3:6]];scene['construction']='Original detailed designed home collection'
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/f'{id}.blend'),compress=True)
 triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons);parts=len(objects)
 bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=id+' authored assembly';out=ROOT/'public/models/furniture'/f'{id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True)
 stats[id]={'dimensionsMm':row[3:6],'triangles':triangles,'editableParts':parts,'glbBytes':out.stat().st_size};audit.write_text(json.dumps(stats,indent=2)+'\n');print('DESIGNED COMPLETE',id,stats[id],flush=True)
