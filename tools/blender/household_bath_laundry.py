"""Original bathroom hardware and laundry construction, in millimetres."""
import bpy, math
from mathutils import Matrix
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material

def outline(w,d,r,steps=6):
 pts=[]
 for x,y,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(steps+1):
   t=math.radians(a+i*90/steps);pts.append((x+r*math.cos(t),y+r*math.sin(t)))
 return pts

def shell(name,profiles,mat,center=(0,0,0)):
 # A continuous closed cross-section creates actual hollow wells and rolled lips.
 n=28;verts=[(x+center[0],y+center[1],z+center[2]) for w,d,r,z in profiles
             for x,y in ([(0,0)]*n if w<=8 and d<=8 else outline(w,d,r))]
 faces=[(j*n+i,j*n+(i+1)%n,((j+1)%len(profiles))*n+(i+1)%n,((j+1)%len(profiles))*n+i)
        for j in range(len(profiles)) for i in range(n)]
 o=mesh(name,verts,faces,mat)
 import bmesh
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 return o

def wall_rose(x,z,M,r=25,y=36):
 C('wall mounting rose',(x,y,z),r,8,M['brass'],axis='Y')
 C('stepped collar',(x,y-7,z),r*.76,8,M['brass'],axis='Y')
 C('concealed grub screw',(x,y-13,z-r*.48),2,1,M['dark'],axis='Y',s=12)

def hardware(kind,M):
 if kind.startswith('bath-grab-bar'):
  for x in [-215,215]:
   wall_rose(x,45,M,45,39)
   tube('curved grip return',[(x,35,45),(x,8,45),(x,-26,45),(x+(-22 if x>0 else 22),-34,45)],16,M['steel'],16)
   C('grip collar',(x,-34,45),18,12,M['brass'],axis='X')
  C('continuous grip',(0,-34,45),16,430,M['steel'],axis='X',s=32)
  if kind.endswith('vertical'):
   bpy.context.view_layer.update()
   transforms=[(o,o.matrix_world.copy()) for o in bpy.context.scene.objects]
   for o,transform in transforms:o.matrix_world=Matrix.Rotation(math.pi/2,4,'Y')@transform
 elif kind=='bath-towel-bar':
  for x in [-295,295]:
   wall_rose(x,40,M,30)
   C('bar standoff',(x,0,40),10,64,M['brass'],axis='Y')
   C('end collar',(x,-31,40),14,14,M['brass'],axis='X')
  C('towel hanging bar',(0,-32,40),9,625,M['brass'],axis='X')
 elif kind=='bath-tissue-holder':
  wall_rose(-66,75,M,26,60)
  tube('cantilever spindle',[(-66,59,75),(-66,-37,75),(-50,-51,75),(83,-51,75),(88,-51,85)],7,M['brass'],12)
  roll=lathe('hollow wound paper roll',[(20,-52),(64,-52),(66,-49),(66,49),(64,52),(20,52)],M['paper'],64)
  roll.rotation_euler.y=math.pi/2;roll.location=(12,-50,75)
  core=lathe('hollow cardboard core',[(14,-54),(20,-54),(20,54),(14,54)],M['wood2'],32)
  core.rotation_euler.y=math.pi/2;core.location=(12,-50,75)
  B('loose paper sheet',(12,-113,29),(103,1.5,57),M['paper'],.3)
  for z in [4,7]:B('paper perforation',(12,-114,z),(96,.6,.5),M['cream'],0)
 elif kind=='bath-towel-ring':
  wall_rose(0,218,M,28,27)
  C('ring pivot',(0,0,218),12,42,M['brass'],axis='Y')
  ring('round towel ring',(0,-24,109),103,6,M['brass'],axis='Y',steps=64)
 elif kind=='bath-robe-hook':
  wall_rose(0,43,M,36,28)
  for x in [-30,30]:
   tube('curved robe hook',[(0,16,42),(x*.8,-12,30),(x,-30,34),(x,-32,64)],7,M['brass'],12)
   C('rounded hook tip',(x,-32,66),8,8,M['brass'],s=20)

def grille(M):
 B('recessed fan back',(0,0,29),(286,286,12),M['dark'],14)
 shell('rounded grille surround',[(300,300,28,0),(300,300,28,17),(265,265,18,17),(265,265,18,0)],M['cream'])
 for x in range(-120,121,15):B('separate airflow louvre',(x,0,8),(8,255,12),M['cream'],3)
 for y in [-103,103]:B('recessed cross brace',(0,y,21),(266,9,8),M['cream'],3)
 for x in [-115,115]:tube('retaining spring clip',[(x,70,25),(x,74,34),(x,92,34)],1.5,M['steel'])

def caddy(M):
 for x,y in [(85,75),(-85,75)]:tube('vertical caddy spine',[(x,y,55),(x,y,545)],5,M['steel'],10)
 for z in [70,285,500]:
  # Three triangular draining shelves, without a solid plate under the air slots.
  for i in range(10):
   y=-84+i*18;half=92*(y+100)/190
   B('draining tray slat',(0,y,z),(max(12,half*2),10,5),M['sage'],2)
  pts=[(-95,90,z+3),(95,90,z+3),(0,-100,z+3),(-95,90,z+3)]
  tube('triangular tray rim',pts,5,M['steel'],8)
  tube('basket guard',[(x,y,zz+45) for x,y,zz in pts],4,M['steel'],8)
  for x,y in [(-90,84),(90,84),(0,-90)]:C('guard upright',(x,y,z+25),3,48,M['steel'],s=10)
 for x in [-65,65]:
  wall_rose(x,551,M,20,90)
  tube('lower hanging hook',[(x,72,64),(x,45,8),(x,30,5),(x,20,20)],4,M['steel'])

def curtain(M):
 C('telescoping curtain rod',(0,0,1786),12,1576,M['steel'],axis='X')
 C('rod overlap sleeve',(240,0,1786),13,110,M['steel'],axis='X')
 for x in [-790,790]:C('end wall cup',(x,0,1786),24,20,M['cream'],axis='X')
 # Slightly parted, modeled pleats and a second folded hem layer.
 nx=96;nz=12;verts=[]
 for k in range(nz+1):
  t=k/nz;z=20+t*1700
  for i in range(nx+1):
   x=-755+i/nx*1510;y=33*math.sin(i/nx*math.tau*12)+7*math.sin(t*math.pi+i*.3)
   verts.append((x,y,z+3*math.sin(i*.35)*(1-t)))
 faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(nz) for i in range(nx)]
 o=mesh('pleated shower fabric',verts,faces,M['sage']);mod=o.modifiers.new('fabric thickness','SOLIDIFY');mod.thickness=1.5
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for z in [24,38,1690,1710]:
  tube('stitched curtain hem',[(-755+i/96*1510,33*math.sin(i/96*math.tau*12)-1,z) for i in range(97)],1.4,M['cream'],6)
 for i in range(13):
  x=-750+i*125;ring('rod ring',(x,0,1760),23,2.8,M['steel'],axis='X',steps=24)
  ring('reinforced curtain eyelet',(x,0,1719),6,2.3,M['brass'],axis='Y',steps=16)

def vanity(kind,M):
 if kind=='bath-soap-pump':
  lathe('hollow fluted pump bottle',[(0,4),(32,4),(40,12),(43,99),(40,118),(28,131),(16,133),(14,128),(14,14),(0,14)],M['blue'],64)
  for i in range(32):
   a=math.tau*i/32;tube('fine bottle flute',[(40*math.cos(a),40*math.sin(a),16),(42*math.cos(a),42*math.sin(a),96),(39*math.cos(a),39*math.sin(a),115)],1.1,M['blue'],6)
  C('pump collar',(0,0,139),21,14,M['brass']);C('pump stem',(0,0,163),7,36,M['brass'])
  B('pump head',(0,-16,184),(28,65,12),M['brass'],5)
  C('spout tip',(0,-45,177),4,12,M['brass'],s=16)
 elif kind=='bath-toothbrush-cup':
  lathe('open tumbler with glazed well',[(0,4),(31,4),(35,0),(38,4),(41,103),(40,110),(36,110),(35,102),(30,11),(0,11)],M['blue'],64)
  ring('rolled glazed lip',(0,0,107),38,2,M['cream'])
 elif kind=='bath-vanity-tray':
  shell('inset oval-ended tray',[(290,140,30,0),(300,150,34,16),(299,149,34,22),(284,134,27,22),(278,128,25,7),(8,8,3,7),(8,8,3,0)],M['cream'])
 elif kind=='bath-toothbrush':
  tube('ergonomic brush handle',[(0,0,5),(1,0,28),(0,0,75),(-1,2,113),(0,0,152)],7,M['sage'],12)
  B('grip inset',(0,-6, 60),(6,2,55),M['cream'],1)
  B('brush head',(0,0,168),(16,10,34),M['sage'],4)
  for x in [-5,0,5]:
   for z in range(155,183,5):C('bristle tuft',(x,-8,z),1.5,10,M['paper'],axis='Y',s=6)

def shower_seat(M):
 for x in [-215,215]:
  B('wall hinge backplate',(x,181,57),(45,16,105),M['steel'],4)
  C('seat hinge barrel',(x,159,76),14,65,M['steel'],axis='X')
  tube('load support arm',[(x,171,20),(x,-116,70),(x,-150,75)],11,M['steel'],12)
  for z in [25,88]:C('fixing screw',(x,171,z),4,2,M['dark'],axis='Y',s=16)
 for i in range(6):B('separate rounded teak slat',(-211+i*84.4,-8,96),(75,350,28),M['wood' if i%2 else 'wood2'],10)
 for y in [-135,135]:B('underside cross rail',(0,y, 70),(486,22,16),M['steel'],4)

def drying_rack(M):
 for y in [-283,283]:
  for sign in [-1,1]:
   tube('crossed tubular leg',[(-sign*500,y,12),(sign*480,y,820)],12,M['cream'],12)
   C('protective floor shoe',(-sign*500,y,12),16,42,M['rubber'],axis='Y',s=16)
  C('crossing pivot',(0,y,422),24,26,M['blue'],axis='Y',s=24)
 for z,xlim in [(820,480)]:
  for y in [-285,285]:tube('central frame side',[(-xlim,y,z),(xlim,y,z)],10,M['cream'])
  for x in range(-475,476,65):tube('central drying rod',[(x,-285,z),(x,285,z)],3.5,M['steel'])
 for sign in [-1,1]:
  for y in [-285,285]:
   tube('raised wing side',[(sign*400,y,825),(sign*840,y,1040)],9,M['cream'])
   tube('wing support brace',[(sign*390,y,630),(sign*660,y,950)],5,M['steel'])
  for i in range(8):
   t=i/7;x=sign*(400+440*t);z=825+215*t;tube('wing drying rail',[(x,-285,z),(x,285,z)],3.5,M['steel'])
 for x in [-420,420]:
  for y in [-294,294]:C('wing hinge',(x,y,825),15,12,M['blue'],axis='Y',s=16)

def sink(M):
 for x in [-207,207]:
  for y in [-248,248]:
   B('steel leg',(x,y,430),(30,30,820),M['steel'],3)
   C('adjustable foot',(x,y,14),23,28,M['rubber'],s=20)
 shell('deep laundry basin',[(378,435,35,550),(510,595,48,840),(520,605,48,880),
        (500,584,43,902),(468,520,38,902),(356,390,30,578),(330,362,28,568),(8,8,3,568),(8,8,3,550)],M['cream'],(0,-8,0))
 B('rear tap ledge',(0,271,886),(468,72,30),M['cream'],9)
 C('drain flange',(0,0,570),30,4,M['steel']);C('drain hole',(0,0,573),19,2,M['dark'])
 for a in range(0,360,60):
  t=math.radians(a);C('drain aperture',(24*math.cos(t),24*math.sin(t),574),2,1,M['dark'],s=8)
 tube('exposed curved trap',[(0,0,558),(0,0,468),(0,22,429),(0,65,419),(0,101,441),(0,105,491),(0,275,491)],19,M['steel'],16)
 C('faucet pedestal',(0,260,924),21,48,M['steel'])
 tube('gooseneck faucet',[(0,260,925),(0,260,1040),(0,242,1066),(0,200,1070),(0,166,1044),(0,162,1015)],13,M['steel'],16)
 for x in [-75,75]:
  C('tap base',(x,260,911),22,20,M['steel']);B('lever handle',(x,250,930),(65,17,14),M['steel'],5)

def ironing(M):
 # Flat tailored top has an asymmetric pointed nose and real perimeter thickness.
 pts=[(-700,0),(-670,-78),(-575,-153),(-425,-198),(465,-198),(485,-180),(485,180),(465,198),(-425,198),(-575,153),(-670,78)]
 n=len(pts);vs=[(x,y,z) for z in [878,900] for x,y in pts]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 top=mesh('tailored tapered board',vs,faces,M['fabric'])
 mod=top.modifiers.new('padded perimeter','BEVEL');mod.width=8;mod.segments=3;bpy.context.view_layer.objects.active=top;bpy.ops.object.modifier_apply(modifier=mod.name)
 tube('stitched perimeter',[(x*.996,y*.97,893) for x,y in pts+[pts[0]]],1.5,M['cream'],6)
 for y in [-142,142]:
  for sign in [-1,1]:tube('crossed folding leg',[(sign*385,y,25),(-sign*300,y,869)],13,M['cream'],12)
  C('crossed leg pivot',(0,y,480),20,15,M['brass'],axis='Y')
 for x in [-385,385]:
  tube('ground cross foot',[(x,-195,18),(x,195,18)],15,M['cream'],12)
  for y in [-187,187]:C('rubber foot cap',(x,y,18),18,26,M['rubber'],axis='Y',s=20)
 B('height latch rail',(40,0,861),(470,34,18),M['steel'],4)
 tube('height adjustment lever',[(180,0,858),(195,-68,845),(150,-78,845)],5,M['steel'])
 for y in [-150,150]:tube('iron rest frame',[(470,y,878),(685,y,878)],7,M['steel'])
 for x in range(495,681,26):B('slotted iron-rest rail',(x,0,884),(12,310,10),M['steel'],3)

def iron(M):
 # Soleplate and reservoir follow a pointed plan outline instead of a box.
 p=[(0,-150),(28,-121),(54,-73),(68,7),(67,105),(52,134),(-52,134),(-67,105),(-68,7),(-54,-73),(-28,-121)]
 def body(name,levels,mat):
  n=len(p);v=[(x*s,y*s,z) for s,z in levels for x,y in p]
  f=[tuple(reversed(range(n))),tuple(range((len(levels)-1)*n,len(levels)*n))]
  f +=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(levels)-1) for i in range(n)]
  return mesh(name,v,f,mat)
 body('pointed metal soleplate',[(.98,0),(1,6),(.97,11)],M['steel'])
 body('blue translucent tank',[(.95,12),(.92,38),(.68, 70)],M['blue'])
 body('upper tank shoulder',[(.69,69),(.55,86)],M['cream'])
 tube('open raised handle',[(-2,-75,77),(-2,-38,140),(-2,-15,150),(-2,86,150),(-2,117,91)],12,M['dark'],16)
 for x in [-17,17]:B('steam and spray button',(x,-43,130),(19,25,11),M['blue'],5)
 C('temperature dial',(0,20,89),25,12,M['brass'],s=32)
 for i in range(12):
  a=i*math.tau/12;B('dial knurl',(24*math.cos(a),20+24*math.sin(a),91),(3,3,9),M['brass'],1)
 B('fill hatch',(0,-95,80),(35,29,9),M['dark'],5)
 tube('heel cord swivel',[(0,120, 90),(0,145,91),(0,148, 60)],6,M['rubber'],10)
 for x in [-37,0,37]:
  for y in [-55,-25,10,45,80,110]:C('sole steam perforation',(x,y,-.3),2.3,.8,M['dark'],s=10)

def basket(M):
 shell('hollow flexible carry tub',[(485,280,90,0),(595,378,130,228),(615,397,137,240),
       (610,392,135,251),(591,373,128,246),(473,268,85,15),(8,8,3,15),(8,8,3,0)],M['sage'])
 for sign in [-1,1]:
  tube('molded oval handle',[(sign*284,-75,236),(sign*301,-66,268),(sign*305,-44,276),(sign*305,44,276),(sign*301,66,268),(sign*284,75,236)],7,M['sage'],12)
  for y in [-70,70]:B('handle reinforcement',(sign*285,y,228),(14,24, 30),M['sage'],5)
 for z in [26,36]:rounded_loop('molded lower rib',500+z*.4,290+z*.4,92,z,M['sage'],2)

def hamper(M):
 for x in [-312,312]:
  for y in [-173,173]:B('timber hamper upright',(x,y,370),(30,30,740),M['wood'],4)
 for z in [110,715]:
  for y in [-173,173]:B('horizontal frame rail',(0,y,z),(650,26,30),M['wood2'],4)
 for x in [-312,312]:
  for z in [110,715]:B('side frame rail',(x,0,z),(28,376,30),M['wood2'],4)
 for x in [-155,155]:
  shell('open cloth hamper bag',[(240,275,30,135),(284,330,34,674),(292,338,34,701),
        (270,316,30,699),(262,306,28,158),(8,8,3,158),(8,8,3,135)],M['fabric'],(x,0,0))
  for y in [-167,167]:
   tube('stitched bag top hem',[(x-135,y,687),(x+135,y,687)],2,M['cream'],6)
   for xx in [-104,104]:
    tube('cloth suspension strap',[(x+xx,y-5,670),(x+xx,y-5,730),(x+xx,y+8,736),(x+xx,y+15,701)],5,M['cream'],8)
  for sign in [-1,1]:tube('vertical tailored seam',[(x+sign*115,-144,145),(x+sign*135,-166,677)],1.5,M['cream'],6)

def washer(M):
 # Four shell walls retain a modeled tub; no solid cube filling the interior.
 for x in [-335,335]:B('enamel side panel',(x,0,480),(20,665,910),M['cream'],8)
 for y in [-328,325]:B('front or back panel',(0,y,480),(650,20,910),M['cream'],8)
 B('lower chassis',(0,0,70),(650,650,80),M['dark'],12)
 for x in [-290,290]:
  for y in [-285,285]:C('leveling foot',(x,y,18),25,36,M['rubber'])
 lathe('recessed stainless wash basket',[(0,280),(236,280),(250,300),(263,883),(256,900),(248,896),(240,313),(0,313)],M['steel'],64,center=(0,-20,0))
 for j in range(10):
  a=math.tau*j/10
  for z in [385,465,545,625,705,785]:
   C('basket perforation',(245*math.cos(a),-20+245*math.sin(a),z),4,1,M['dark'],s=8)
 lathe('center agitator',[(0,315),(75,315),(67,370),(35,422),(31,730),(27,748),(0,748)],M['cream'],48,center=(0,-20,0))
 for i in range(4):
  a=i*math.pi/2;tube('agitator fin',[(r*math.cos(a+t),-20+r*math.sin(a+t),z) for r,t,z in [(65,0,345),(57,.2,365),(44,.35,402),(31,.45,480)]],9,M['cream'],8)
 shell('top rolled rim',[(688,686, 30,922),(688,686,30,951),(570,570, 70,951),(570,570,70,922)],M['cream'])
 B('lid shadow gasket',(0,-32,954),(607,564,8),M['rubber'],25)
 B('separate inset lid',(0,-36,966),(596,552,18),M['cream'],22)
 B('front recessed finger lift',(0,-303,963),(155,15,10),M['dark'],5)
 for x in [-225,225]:C('lid hinge barrel',(x,250,966),12,60,M['steel'],axis='X')
 B('rear control console',(0,290,1040),(676,99,160),M['cream'],15)
 B('recessed control fascia',(0,235,1040),(635,8,111),M['dark'],10)
 for x,r in [(-220,26),(0,43),(216,24)]:
  C('program selector',(x,224,1040),r,18,M['steel'],axis='Y',s=48)
  B('selector index',(x,212,1053),(3,2,18),M['cream'],1)
 for x in [84,124,164]:
  C('option button',(x,222,1032),7,4,M['blue'],axis='Y',s=16)
  B('option label dash',(x,226,1053),(19,1.5,2),M['paper'],0)
 for x in range(-306,307,51):B('rear ventilation slot',(x,342,1030),(29,1.5,5),M['dark'],1)

def create(catalog_id,M):
 if catalog_id.startswith('bath-grab-bar') or catalog_id in ['bath-towel-bar','bath-tissue-holder','bath-towel-ring','bath-robe-hook']:hardware(catalog_id,M)
 elif catalog_id.startswith('bath-') and catalog_id in ['bath-soap-pump','bath-toothbrush-cup','bath-vanity-tray','bath-toothbrush']:vanity(catalog_id,M)
 else:{'bath-exhaust-fan':grille,'bath-shower-caddy':caddy,'bath-shower-curtain':curtain,
  'bath-folding-shower-seat':shower_seat,'laundry-drying-rack':drying_rack,'laundry-utility-sink':sink,
  'laundry-ironing-board':ironing,'laundry-steam-iron':iron,'laundry-carry-basket':basket,
  'laundry-divided-hamper':hamper,'laundry-top-load-washer':washer}[catalog_id](M)

def support_surfaces(catalog_id):
 def plane(id,label,x,y,h,w,d,c=1500):
  return dict(id=id,label=label,x=x,z=y,height=h,width=w,depth=d,clearance=c)
 if catalog_id=='bath-shower-caddy':
  return [plane('tray-'+str(i),'Caddy tray '+str(i+1),0,35,z+2.5,84,80,170 if i<2 else 500) for i,z in enumerate([70,285,500])]
 if catalog_id=='bath-vanity-tray':return [plane('well','Tray interior',0,0,7,230,95)]
 if catalog_id=='bath-folding-shower-seat':return [plane('seat','Teak seat',0,-8,110,470,310)]
 if catalog_id=='laundry-ironing-board':
  return [plane('board','Padded ironing surface',-40,0,900,990,325),plane('rest','Slotted iron rest',587,0,889,170,290)]
 return []
