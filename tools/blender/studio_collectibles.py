from studio_geometry import *

def beam(n,a,b,r,M,holes=True):
 a,b=Vector(a),Vector(b)
 if not holes:return tube(n,[a,b],r,M['black'],s=8)
 t=(b-a).normalized();normal=Vector((1,0,0)) if abs(t.x)<.5 else Vector((0,1,0));u=normal.cross(t).normalized();normal=t.cross(u);count=max(2,round((b-a).length/(r*2)));pitch=(b-a).length/count;s=16
 for i in range(count):
  p=a.lerp(b,(i+.5)/count);v=[]
  for z,inner in [(-r*.55,False),(-r*.55,True),(r*.55,False),(r*.55,True)]:
   for j in range(s):
    angle=j*math.tau/s;xx,yy=math.cos(angle),math.sin(angle)
    k=r*.51 if inner else min(pitch/2/max(abs(xx),.0001),r/max(abs(yy),.0001))
    v.append(p+t*(xx*k)+u*(yy*k)+normal*z)
  f=[]
  for j in range(s):
   k=(j+1)%s;f.extend([(j,k,s+k,s+j),(2*s+j,3*s+j,3*s+k,2*s+k),(j,2*s+j,2*s+k,k),(s+j,s+k,3*s+k,3*s+j)])
  mesh(n+' perforated element',v,f,M['white'])

def wheel(x,y,z,r,width,M,rover=False):
 C('Tire',(x,y,z),r,width,M['rubber'],'X',48);C('Wheel rim',(x+(width/2+.4)*(1 if x>0 else -1),y,z),r*.68,2,M['black'],'X',32);C('Axle hub',(x,y,z),r*.20,width+3,M['steel'],'X')
 for j in range(24 if rover else 40):
  a=j*math.tau/(24 if rover else 40);o=B('Tire tread block',(x,y+r*math.sin(a),z+r*math.cos(a)),(width,3.4,2.5),M['black'],.6);o.rotation_euler.x=-a
 for j in range(8):
  a=j*math.tau/8;tube('Rim spoke',[(x+(width/2+1)*(1 if x>0 else -1),y,z),(x+(width/2+1)*(1 if x>0 else -1),y+r*.59*math.sin(a),z+r*.59*math.cos(a))],1.7,M['steel'])

def panel(n,sections,M):
 # Each section is Y, half-width, bottom Z, top Z; original connected loft.
 v=[]
 for y,w,b,t in sections:v.extend([(-w,y,b),(w,y,b),(w,y,t),(-w,y,t)])
 f=[(k*4+i,k*4+(i+1)%4,(k+1)*4+(i+1)%4,(k+1)*4+i) for k in range(len(sections)-1) for i in range(4)]+[(3,2,1,0),tuple(range(len(v)-4,len(v)))];return mesh(n,v,f,M)

def collectible(row,M):
 id=row[0]
 if id=='brick-perseverance':return rover(M)
 f1='mclaren' in id;length=610 if f1 else 390;track=99 if f1 else 73;r=40 if f1 else 32;front=-179 if f1 else -112;rear=177 if f1 else 115
 B('Technic chassis',(0,0,25),(110 if f1 else 124,length*.75,9),M['black'],2)
 for x in [-track,track]:
  for y in [front,rear]:
   wheel(x,y,r,r,49 if f1 else 31,M)
   for z in [29,48]:
    beam('Wishbone',((x/abs(x))*24,y-25,z),(x,y,r),2.3,M,False);beam('Wishbone',((x/abs(x))*24,y+25,z),(x,y,r),2.3,M,False)
   tube('Damper rod',[(x*.85,y,r),(x*.32,y+15,r+30)],2,M['steel'])
   for j in range(7):ring('Suspension spring',(x*.39+j*x*.055,y+13-j*1.8,r+27-j*3),4,1,M['red'],'X',12)
 for x in [-22,22]:
  for y in ([60,79,98] if f1 else [73,86,99]):C('V6 cylinder',(x,y,53),7,21,M['steel']);C('Piston crown',(x,y,65),5,3,M['brass'])
 if f1:
  panel('Tapered papaya nose',[(-280,12,27,37),(-224,17,29,47),(-113,30,30,71),(-63,37,29,72)],M['orange'])
  for y,z,ww in [(-283,22,242),(-271,30,223),(-258,37,199)]:B('Front wing element',(0,y,z),(ww,16,3),M['black'],1)
  for x in [-122,122]:B('Front wing endplate',(x,-270,31),(4,48,28),M['orange'],2)
  for x in [-53,53]:
   p=panel('Sculpted sidepod',[(-64,21,28,56),(-31,33,29,69),(83,26,29,65),(136,11,31,47)],M['orange']);p.location.x=x
   B('Sidepod intake',(x,-62,49),(35,3,18),M['black'],3)
   for j in range(12):B('Side cooling louvre',(x,3+j*8,70-j*.09),(30,3,1.6),M['black'],.5)
  B('Cockpit well',(0,-25,56),(58,84,9),M['black'],9);B('Driver seat',(0,-7,65),(36,36,24),M['black'],6)
  tube('Halo titanium hoop',[(-30,-67,77),(-39,-41,99),(-26,5,109),(26,5,109),(39,-41,99),(30,-67,77)],3.4,M['black'],12);tube('Halo front strut',[(0,-65,66),(0,-60,99)],3,M['black'])
  ring('Steering wheel',(0,-45,77),11,2,M['black'],'Y');panel('Engine cover',[(21,20,59,111),(73,24,50,116),(155,10,40,72),(192,4,39,49)],M['orange'])
  B('Airbox',(0,35,113),(25,25,23),M['black'],4)
  for x in [-58,58]:B('Rear wing endplate',(x,238,94),(5,56,68),M['orange'],2)
  for y,z in [(218,108),(238,120)]:B('Rear wing aerofoil',(0,y,z),(119,25,5),M['black'],1)
  for x in [-21,21]:B('Rear wing pylon',(x,223,72),(5,10,73),M['black']);B('Rear diffuser strake',(x,239,24),(3,81,24),M['black'])
  text('Model livery number','4',(0,-162,64),19,M['white'],False)
  for side in [-1,1]:
   beam('Sidepod Technic rail',(side*81,-29,35),(side*77,101,35),4,M)
   B('Black sidepod lower panel',(side*65,35,31),(25,148,5),M['black'],1)
  for y in range(-208,-83,17):B('Nose panel joint',(0,y,51),(29,1.2,.8),M['black'],0)
 else:
  # Open Technic cabin, wheel-arch panels and the GT's distinctive flying buttresses.
  B('Lower blue sills',(0,0,29),(148,285,13),M['blue'],3)
  panel('Nose and bonnet',[(-191,69,25,34),(-157,76,26,46),(-71,60,33,58),(-47,49,40,59)],M['blue'])
  for x in [-8,8]:B('White bonnet stripe',(x,-119,58),(10,136,1.3),M['white'],.3)
  for side in [-1,1]:
   for y in [front,rear]:
    tube('Shaped wheel arch',[(side*74,y+39*math.cos(a),33+39*math.sin(a)) for a in [j*math.pi/20 for j in range(21)]],6,M['blue'],8)
   B('Door skin',(side*67,-1,47),(10,109,31),M['blue'],3)
   beam('Windscreen pillar',(side*51,-57,57),(side*39,-9,86),3.2,M,False);beam('Roof side frame',(side*39,-9,86),(side*39,57,84),3.2,M,False)
   tube('Flying buttress',[(side*39,47,83),(side*61,89,64),(side*64,140,58)],7,M['blue'],6)
   B('Rear intake',(side*56,94,50),(15,59,22),M['black'],4);B('Headlamp lens',(side*61,-157,47),(21,38,5),M['glass'],4)
   B('Wing mirror',(side*85,-43,62),(16,17,9),M['blue'],3);tube('Mirror stalk',[(side*66,-38,53),(side*83,-43,60)],2,M['black'])
   B('Sport seat',(side*23,19,49),(30,44,15),M['black'],4);B('Seat back',(side*23,35,65),(30,12,32),M['black'],5)
  B('Roof panels',(0,24,86),(83,74,7),M['blue'],4)
  for x in [-8,8]:B('White roof stripe',(x,24,90),(10,73,1),M['white'],.2)
  B('Rear deck',(0,133,57),(140,95,8),M['blue'],4);B('Rear wing',(0,164,71),(150,23,5),M['blue'],2)
  for x in [-56,56]:ring('Round rear light',(x,183,50),9,3,M['red'],'Y');C('Exhaust',(x*.36,185,34),5,8,M['steel'],'Y')
  B('Front grille',(0,-191,29),(116,3,17),M['black']);text('Ford badge','Ford',(0,-185,40),8,M['white'],False);ring('Steering wheel',(-24,-23,66),10,2,M['black'],'Y')
  for side in [-1,1]:
   beam('Blue sill pin beam',(side*72,-69,32),(side*72,76,32),3.8,{**M,'white':M['blue']})
   for y in [-150,-131,-112,-93]:B('Bonnet panel seam',(side*37,y,57),(36,1.5,1),M['black'],0)
   B('Bonnet cooling recess',(side*37,-110,58),(19,36,1.5),M['black'],2)
   for j in range(5):B('Bonnet vent slat',(side*37,-123+j*6,60),(19,2,1),M['blue'],.3)
   B('Headlight backing',(side*61,-157,46),(21,38,6),M['steel'],4)
   for j in range(3):C('Headlamp optic',(side*61,-166+j*9,50),4,2,M['white'])
  for x in range(-52,53,6):B('Front grille mesh upright',(x,-193,29),(1,1,15),M['steel'],0)
 # Explicit pin sockets and construction seams establish the brick model scale.
 for x in [-44,44]:
  for y in range(-int(length*.32),int(length*.32),16):ring('Panel pin socket',(x,y,39 if f1 else 32),2.7,1,M['black'],steps=12);C('Blue connector pin',(x,y,39 if f1 else 32),1.2,2,M['blue'],s=8)

def rover(M):
 B('Rover lower equipment tray',(0,0,91),(119,154,16),M['black'],2)
 for x in [-56,56]:
  for z in [92,113]:beam('White chassis liftarm',(x,-75,z),(x,77,z),4,M)
 for y in [-71,0,71]:beam('Cross chassis liftarm',(-59,y,110),(59,y,110),4,M)
 for x in [-37,37]:B('Avionics enclosure',(x,0,118),(31,95,22),M['white'],2)
 for x in [-95,95]:
  beam('Rocker',((x/abs(x))*55,0,113),(x,63,60),5,M);beam('Rocker',((x/abs(x))*55,0,113),(x,-67,65),5,M)
  for y in [-84,0,84]:
   wheel(x,y,32,32,31,M,True);beam('Steering knuckle',(x,y,32),(x,y,66),4,M)
   beam('Bogie',(x,10,83),(x,y,62),4,M)
 for x in [-58,58]:
  for z in [85,123]:beam('White side liftarm',(x,-75,z),(x,77,z),4,M)
 for j in range(6):B('Science deck panel',(-50+j*20,0,132),(17,117,5),M['white'],1)
 for x in [-45,45]:
  for y in [-54,-34,-14,6,26,46]:C('Deck connector',(x,y,137),2.3,3,M['blue'],s=12)
 for y in [-50,50]:C('Steering reduction gear',(0,y,134),16,5,M['black'])
 C('Mast turntable',(-24,-48,142),22,12,M['steel']);C('Camera mast',(-24,-48,176),7,65,M['white']);B('Mast camera head',(-24,-48,218),(55,29,24),M['white'],3)
 for x,r in [(-40,8),(-16,12)]:C('Mast optical assembly',(x,-65,218),r,5,M['steel'],'Y');C('Mast camera glass',(x,-69,218),r*.7,2,M['darkglass'],'Y')
 C('Radio isotope generator',(0,79,157),27,56,M['steel'],'Y')
 for j in range(9):C('Generator cooling fin',(0,60+j*5,157),32,1.4,M['black'],'Y')
 for x in [-43,43]:beam('Generator support',(x,54,126),(x,90,176),4,M)
 beam('Robot arm upper',(38,-73,109),(61,-126,61),5,M);beam('Robot arm forearm',(61,-126,61),(11,-154,48),5,M);C('Turret wrist',(11,-154,48),17,20,M['white']);B('Instrument turret',(10,-153,36),(48,31,32),M['white'],3)
 for x in [-3,22]:C('Drill and sampler',(x,-159,16),4,31,M['steel'])
 C('High gain antenna',(40,22,153),20,4,M['white']);C('Antenna post',(48,42,174),2,73,M['black']);tube('Mast cable',[(-21,-46,211),(-13,-38,162),(-14,-15,140)],1.2,M['black'])
 text('Rover name','PERSEVERANCE',(0,-83,111),8,M['black'])
