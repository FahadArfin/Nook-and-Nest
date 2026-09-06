from studio_geometry import *
import json

def retained_palette(id,M):
 old=json.loads((ROOT/'src/modelMaterials.json').read_text()).get(id,[]);keep={}
 for a in old:
  c=a['color'].lstrip('#');color=(.40,.23,.105) if 'wood-honey' in a['id'] else tuple((int(c[i:i+2],16)/255)**2.2 for i in [0,2,4]);keep[a['id']]=material(a['id'],color,.35 if 'porcelain' in a['id'] else .7,.7 if any(s in a['id'] for s in ['steel','brass','bronze']) else 0)
 for key,name in [('white','warm-porcelain'),('steel','brushed-steel'),('brass','joinery-aged-brass'),('wood','wood-honey-textured'),('black','recess-shadow-detail')]:
  if name in keep:M[key]=keep[name]
 return keep

def faucet(x,y,z,M):
 C('Tap mounting collar',(x,y,z+4),24,8,M['steel']);C('Mixer body',(x,y,z+52),16,96,M['steel']);tube('Curved mixer spout',[(x,y,z+72),(x,y-18,z+102),(x,y-64,z+103),(x,y-77,z+86)],10,M['steel'],12);B('Mixer lever',(x,y+7,z+108),(16,43,5),M['steel'],2)

def bathroom(row,M):
 id=row[0];w,d,h=row[3:6];keep=retained_palette(id,M);por=M['white'];counter=keep.get('countertop-surface',por);paint=keep.get('variant-surface',por)
 if 'toilet' in id:
  hung='wall' in id;smart='smart' in id or 'neorest' in id;seat=285 if hung else 420;bodywidth=w-18;bowld=d-(70 if smart or hung else 170);cy=-d/2+bowld/2
  if hung:
   B('Wall attachment',(0,d/2-20,seat*.49),(w-55,40,seat*.77),por,18)
  else:
   # Slim skirt rises to a full-size ergonomic bowl, rather than a chunky full-width block.
   B('Skirted pedestal',(0,35,seat*.36),(w*.64,d*.56,seat*.72),por,40)
   B('Rear ceramic support',(0,d/2-62,seat*.48),(w*.63,112,seat*.96),por,24)
   B('Cistern mounting bridge',(0,d/2-99,seat-2),(w-48,194,42),por,14)
  cavity('Rimless porcelain bowl',(0,cy,seat-167),bodywidth,bowld,157,por,2.6,18)
  C('Recessed trap water',(0,cy+15,seat-155),35,1,M['glass'],s=48)
  # Open seat is an actual annulus, preserving the visible recessed bowl.
  v=[];n=64
  for ww,dd,zz in [(bodywidth,bowld,seat-7),(bodywidth,bowld,seat+5),(bodywidth-71,bowld-88,seat+5),(bodywidth-71,bowld-88,seat-7)]:
   for j in range(n):
    t=j*math.tau/n;v.append((ww/2*math.copysign(abs(math.cos(t))**.77,math.cos(t)),cy+dd/2*math.copysign(abs(math.sin(t))**.77,math.sin(t)),zz))
  mesh('Thin soft-close open seat',v,[(k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j) for k in range(4) for j in range(n)],por)
  if hung and not smart:
   B('Dual flush plate',(0,d/2-4,h-75),(210,8,150),M['steel'],6)
   for x,ww in [(-43,80),(48,55)]:B('Flush button',(x,d/2-9,h-75),(ww,3,57),M['steel'],3)
  elif smart:
   B('Bidet electronics deck',(0,d/2-45,seat+21),(w-22,88,62),por,22);B('Bidet wash nozzle',(0,cy+bowld*.34,seat-26),(18,47,10),M['steel'],3)
   B('Control strip',(w/2-4,d/2-48,seat+22),(5,63,22),M['black'],3)
   for yy in [-20,0,20]:C('Wash control',(w/2,d/2-48+yy,seat+22),3,2,M['blue'],'X',12)
   if not hung:B('Smooth compact rear tower',(0,d/2-49,h/2),(w-38,97,h),por,28)
  else:
   tankh=h-seat-30;B('Cistern',(0,d/2-77,seat+17+tankh/2),(w-22,154,tankh),por,22);B('Cistern lid',(0,d/2-77,h-8),(w,162,16),paint,7);C('Dual flush button',(0,d/2-77,h+1),20,3,M['steel']);B('Flush split',(0,d/2-77,h+3),(1,31,.5),M['black'],0)
  for x in [-73,73]:C('Seat hinge',(x,cy+bowld*.37,seat+5),10,8,M['steel'])
 else:
  vessel=id=='vessel-sink';console=id=='console-vanity';ped=id=='pedestal-sink';wall=id=='wall-hung-sink';double='double' in id;floating='floating' in id;basinheight=140 if vessel else 100;top=h if vessel else h-115;bw=w if vessel or ped or wall else min(510,w*.43) if double else min(580,w-100)
  if vessel:cavity('Fine rim vessel',(0,0,0),w,d,h,paint,2.2,12)
  else:
   if ped:
    C('Tapered pedestal',(0,65,(top-80)/2),83,top-80,paint,s=48,r2=64);C('Pedestal foot',(0,65,12),95,24,paint,s=48)
   elif wall:
    tube('Exposed bottle trap',[(0,0,top-110),(0,0,30),(0,d/2,30)],19,M['steel'],12);C('Wall flange',(0,d/2,30),35,8,M['steel'],'Y')
   else:
    deck=top-basinheight+15
    if console:
     for x in [-w/2+38,w/2-38]:
      for y in [-d/2+38,d/2-38]:B('Fine console leg',(x,y,deck/2),(32,32,deck),M['wood'],4)
     for y in [-d/2+38,d/2-38]:B('Console stretcher',(0,y,130),(w-60,24,24),M['wood'],3)
     for j in range(12):B('Open lower shelf slat',(-w/2+60+j*(w-120)/11,0,151),(42,d-70,20),M['wood'],2)
     tube('Exposed polished P trap',[(0,0,deck),(0,0,deck-150),(0,40,deck-190),(0,90,deck-160),(0,d/2,deck-160)],15,M['steel'],12)
    else:
     bottom=0 if floating else 100
     for x in [-w/2+14,w/2-14]:B('Vanity end panel',(x,0,(deck+bottom)/2),(28,d-8,deck-bottom),M['wood'],3)
     B('Carcass back',(0,d/2-12,(deck+bottom)/2),(w-28,24,deck-bottom),M['wood'],2)
     for j in range(2):
      z=bottom+(j+.5)*(deck-bottom)/2;B('Drawer front',(0,-d/2+14,z),(w-62,25,(deck-bottom)/2-7),paint,3)
      if 'reed' in id:
       for x in range(-int(w/2)+38,int(w/2)-30,16):C('Reeded drawer bead',(x,-d/2-1,z),5,(deck-bottom)/2-13,M['wood'],s=8)
      for xx in ([-w*.25,w*.25] if double else [0]):B('Inset brass pull',(xx,-d/2-6,z+28),(120,12,7),M['brass'],2)
     if not floating:
      for x in [-w/2+52,w/2-52]:
       for y in [-d/2+50,d/2-50]:B('Vanity leg',(x,y,50),(38,38,100),M['wood'],4)
    B('Stone worktop',(0,0,deck),(w,d,24),counter,4)
   for x in ([-w*.25,w*.25] if double else [0]):
    cavity('Recessed washbasin',(x,-20,top-basinheight),bw,d-65,basinheight,por,3.5 if not ped else 2.5,13);C('Drain',(x,-20,top-basinheight+11),18,2,M['steel']);faucet(x,d/2-42,top-2,M)
    B('Overflow slot',(x,d/2-71,top-24),(30,2,5),M['black'],2)
 # Retain every prior color key on a legitimate construction detail.
 used={m.name for o in bpy.context.scene.objects if o.type=='MESH' for m in o.data.materials}
 for i,(name,mat) in enumerate(keep.items()):
  if name not in used:C('Retained finish fixing '+name,(-w*.22+i*10,d*.30,12),3,3,mat,s=8)
