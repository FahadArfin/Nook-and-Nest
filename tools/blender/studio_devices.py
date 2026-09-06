"""Original product-reference desk equipment; all parts remain editable in Blender."""
from studio_geometry import *

def ports(p,count,M,spacing=18):
 for i in range(count):
  x=p[0]+(i-(count-1)/2)*spacing;y=p[1];z=p[2]
  B('RJ45 metal shield',(x,y,z),(15,3,13),M['steel'],.6);B('Recessed RJ45 socket',(x,y-2,z),(12,2,9),M['black'],.3)
  for k in range(8):B('Contact pin',(x-4.2+k*1.2,y-3.1,z+1),( .45,.5,4),M['brass'],0)
  B('Link LED',(x+5,y-3,z+5),(2,.6,1),M['light'],0)

def device(row,M):
 id=row[0];w,d,h=row[3:6]
 if id=='fractal-terra':
  feet(w,d,M,4);B('Internal spine',(0,0,h/2),(3,d-25,h-25),M['steel'])
  for z in [12,h-7]:B('Aluminium perimeter',(0,0,z),(w,d,9),M['jade'])
  B('Front aluminium',(0,-d/2+5,h*.58),(w,10,h*.78),M['jade'],5)
  B('Solid walnut fascia',(0,-d/2+3,28),(w-4,13,41),M['wood'],3)
  for x in [-w/2+3,w/2-3]:
   for y in [-d/2+8,d/2-8]:B('Side frame',(x,y,h/2),(6,12,h-16),M['jade'])
   for j in range(37):B('Machined vertical ventilation slot rail',(x,-d/2+20+j*8.2,h/2),(6,4,h-35),M['jade'],1)
  for j in range(30):B('Top ventilation rail',(0,-d/2+25+j*9.8,h-1),(w-28,4,2),M['jade'],.7)
  for x in [-22,0,22]:
   if x==22:C('Power button',(x,-d/2-4,28),5,1,M['steel'],'Y')
   else:B('Front USB port',(x,-d/2-4,28),(11 if x<0 else 8,2,4),M['black'],1)
  B('Rear IO plate',(-34,d/2-2,110),(52,3,145),M['steel']);B('GPU',(35,10,105),(22,245,138),M['black'])
  for z in [66,126]:C('GPU fan',(49,10,z),29,4,M['rubber'],'X');ring('Fan surround',(52,10,z),28,2,M['steel'],'X')
 elif id in ['naim-atom-headphone','chord-dave-dac']:
  feet(w,d,M,5);chord=id.startswith('chord');B('Machined amplifier enclosure',(0,0,h/2+3),(w,d,h-10),M['steel'] if chord else M['black'],9 if chord else 3)
  if chord:
   before=set(bpy.data.objects)
   C('Display porthole',(0,0,0),42,5,M['steel'],'Y');C('LCD glass',(0,-4,0),34,2,M['black'],'Y');text('Top display','Opt1 -20dB\n44.1kHz\nCHORD DAVE',(0,-6,0),7,M['light'])
   from mathutils import Matrix
   transform=Matrix.Translation(Vector((0,-d*.48,h*.67)))@Matrix.Rotation(-math.pi/4,4,'X')
   for o in set(bpy.data.objects)-before:o.matrix_world=transform@o.matrix_world
   cutter=C('Porthole machining tool',(0,0,0),43,160,M['black'],'Y',64);cutter.matrix_world=transform@cutter.matrix_world
   body=bpy.data.objects['Machined amplifier enclosure'];mod=body.modifiers.new('Machined porthole recess','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
   C('Volume encoder',(87,-d*.12,h+3),11,10,M['steel'])
   for x,y in [(63,-d*.12),(112,-d*.12),(87,-d*.35)]:C('Ball control',(x,y,h+1),4,4,M['steel'])
   for x in [-w*.39,w*.39]:
    for j in range(8):C('Vent recess',(x,-40+j*11,h),3,1,M['black'],s=12)
  else:
   for x in [-w/2,w/2]:
    for j in range(30):B('Extruded heatsink fin',(x,-d/2+10+j*8,h/2),(5,3,h-20),M['black'],.7)
   C('Volume halo',(50,0,h),43,3,M['steel']);C('Knurled volume',(50,0,h+2),40,3,M['black']);B('Front display',(0,-d/2-1,h*.56),(97,2,53),M['darkglass'],2)
   art('Album display',(0,-d/2-2.2,h*.56),47,45,M,3);text('Naim wordmark','naim',(-88,-d/2-2,h*.63),12,M['white'])
  for x in [-w*.35,w*.35]:ring('Headphone jack',(x,-d/2-2,23),4.5,1.2,M['steel'],'Y')
  for x in [-w*.3,-w*.1,w*.1,w*.3]:C('Rear connector',(x,d/2+2,22),5,7,M['brass'],'Y')
 elif id=='technics-turntable':
  feet(w,d,M,20);B('Damped plinth',(0,0,62),(w,d,60),M['black'],7);B('Brushed top',(0,0,96),(w-4,d-4,12),M['steel'],5)
  C('Platter',(-62,0,119),148,30,M['steel'],s=96);C('Rubber mat',(-62,0,136),145,5,M['rubber'],s=96);C('Vinyl record',(-62,0,140),140,2,M['black'],s=96)
  for r in [58,73,89,106,125,137]:ring('Record groove',(-62,0,141.1),r,.25,M['rubber'],steps=96)
  C('Record label',(-62,0,142),43,1,M['orange']);C('Spindle',(-62,0,148),3.5,14,M['steel'])
  for a in range(80):
   t=a*math.tau/80
   for z in [109,117,125]:C('Strobe dot',(-62+148.2*math.cos(t),148.2*math.sin(t),z),1.2,1.5,M['black'],s=8)
  C('Tonearm tower',(144,112,128),23,53,M['black']);ring('Gimbal bearing',(144,112,153),15,3,M['steel'],'Y')
  tube('S shaped tonearm',[(144,112,153),(152,85,158),(140,40,158),(133,-30,151),(100,-78,146)],4,M['steel'],12)
  C('Counterweight',(146,136,157),14,33,M['black'],'Y');B('Headshell',(92,-88,146),(17,33,7),M['black']);B('Cartridge',(92,-89,138),(12,18,9),M['blue']);C('Cue lever',(172,52,143),2,35,M['steel'])
  B('Pitch slot',(191,-30,105),(5,125,2),M['black']);B('Pitch slider',(191,-17,110),(19,10,8),M['steel']);B('Start stop',(-185,-146,106),(38,26,6),M['black']);C('Power knob',(-188,-108,112),10,14,M['black']);text('Deck brand','Technics',(130,-152,104),12,M['black'],False)
 elif id=='edifier-speaker':
  B('Acoustic enclosure',(0,0,h/2),(w-18,d,h),M['black'],12)
  for x in [-w/2+5,w/2-5]:B('Curved walnut side cheek',(x,0,h/2),(13,d-3,h-3),M['wood'],6)
  C('Woofer cast basket',(0,-d/2-1,112),82,9,M['steel'],'Y',64);C('Rubber surround',(0,-d/2-7,112),74,7,M['rubber'],'Y',64);C('Woofer diaphragm',(0,-d/2-12,112),63,13,M['black'],'Y',64,r2=30);C('Dust cap',(0,-d/2-21,112),27,4,M['black'],'Y')
  B('Planar tweeter plate',(0,-d/2-3,266),(95,7,95),M['steel'],6);B('Planar diaphragm',(0,-d/2-8,266),(62,2,59),M['black'],2)
  for x in range(-25,26,5):B('Tweeter protective grille',(x,-d/2-10,266),(1.4,1,54),M['steel'],0)
  for x in [-42,42]:
   for z in [224,308]:C('Tweeter fastener',(x,-d/2-7,z),2,2,M['black'],'Y',8)
  text('Speaker maker','EDIFIER',(0,-d/2-3,22),10,M['steel']);C('Rear bass port',(0,d/2,95),30,6,M['black'],'Y');feet(w,d,M,4)
 elif id=='hifiman-manta':
  # Meze Manta is the sculptural stand; headphones are the separate Arya-style assembly.
  C('Manta weighted base',(0,0,8),82,16,M['black'],s=64)
  tube('Swept stand',[(0,28,12),(0,36,60),(0,26,160),(0,0,272)],11,M['steel'],12)
  B('Headband saddle',(0,0,274),(86,57,20),M['black'],9)
  for y in [-14,14]:tube('Spring steel headband',[(100*math.cos(a),y,205+108*math.sin(a)) for a in [i*math.pi/32 for i in range(33)]],2.5,M['steel'])
  tube('Suspension leather strap',[(89*math.cos(a),0,205+81*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],9,M['rubber'])
  for x in [-82,82]:
   o=C('Oval wooden earcup',(x,0,164),66.5,26,M['wood'],'X',64);o.scale.y=91/133
   o=C('Oval velour pad',(x*.78,0,164),60.5,22,M['rubber'],'X',64);o.scale.y=79/121
   for j in range(14):
    zz=109+j*8.2;span=80*math.sqrt(max(.01,1-((zz-164)/66.5)**2));B('Open back grille slat',(x+(-15 if x<0 else 15),0,zz),(2,span,2),M['steel'],.6)
   tube('Fork yoke',[(x,-39,169),(x,-43,222),(x,43,222),(x,39,169)],3,M['black']);C('Cable socket',(x,0,94),3,12,M['steel'])
  tube('Headphone cable',[(-82,0,88),(-90,-10,43),(-40,-48,20),(43,-55,19),(66,-30,35),(82,0,88)],2,M['rubber'])
 elif id in ['unifi-cloud-gateway','unifi-flex-switch']:
  B('UniFi enclosure',(0,0,h/2),(w,d,h),M['white'],7);text('UniFi mark','U',(0,0,h+.2),15,M['steel'],False)
  if id=='unifi-cloud-gateway':
   B('Status LCD',(-w*.34,-d/2-.3,h*.55),(24,1,18),M['darkglass'],3);text('Status','10G',(-w*.34,-d/2-1,h*.55),6,M['blue']);ports((w*.12,-d/2,16),5,M)
   for x in [w*.35,w*.43]:B('SFP cage',(x,d/2,15),(14,6,10),M['steel'],1)
  else:ports((-8,-d/2,18),8,M,20);B('Uplink SFP',(w*.44,-d/2,18),(14,4,10),M['steel']);ports((0,d/2,18),1,M)
 elif id.startswith('monitor-'):
  B('Weighted monitor foot',(0,0,8),(250,220,16),M['steel'],7);B('Cable managed column',(0,54,200),(38,34,380),M['black'],7);C('Tilt hinge',(0,32,321),17,70,M['steel'],'X')
  before=set(bpy.data.objects);sw=610;sh=350
  B('Display enclosure',(0,0,302),(sw,21,sh),M['black'],5);B('Panel glass',(0,-12,304),(sw-14,2,sh-17),M['darkglass'],2);art('Original screen image',(0,-13.2,304),sw-17,sh-20,M,0 if id.endswith('left') else 2 if id.endswith('front') else 3)
  text('Monitor branding','N&N',(0,-13,133),7,M['steel']);ang=0 if id.endswith('front') else math.radians(28 if id.endswith('left') else -28)
  for o in set(bpy.data.objects)-before:
   x,y=o.location.x,o.location.y;o.location.x=x*math.cos(ang)-y*math.sin(ang);o.location.y=x*math.sin(ang)+y*math.cos(ang);o.rotation_euler.z+=ang
  tube('Rear cable',[(0,65,320),(0,77,170),(0,77,27),(67,90,5)],3,M['rubber'])
 else:return False
 return True

def printer(row,M):
 id=row[0];w,d,h=row[3:6]
 if id=='bambu-ams2':
  B('AMS lower housing',(0,0,30),(w,d,60),M['black'],15)
  for x in [-w/2+7,w/2-7]:B('AMS end shell',(x,0,122),(14,d-6,180),M['white'],6)
  for j in range(4):
   x=-132+j*88
   for xx in [x-30,x+30]:C('Spool flange',(xx,0,124),93,3,M['white'],'X',48)
   C('Filament winding',(x,0,124),87,56,[M['jade'],M['orange'],M['white'],M['blue']][j],'X',48);C('Spool hub',(x,0,124),18,70,M['black'],'X')
   B('Feeder',(x,-105,52),(50,35,45),M['black'],5);C('Feed button',(x,-125,58),6,2,M['white'],'Y')
  B('Transparent top',(0,0,220),(w-20,d-8,5),M['darkglass'],2);B('Transparent front',(0,-d/2+4,139),(w-20,5,162),M['darkglass'],2);text('AMS name','AMS 2 Pro',(0,-d/2-1,24),11,M['white']);return
 feet(w,d,M,8)
 for x in [-w/2+8,w/2-8]:B('Steel side enclosure',(x,0,h/2),(16,d,h-15),M['black'],5)
 B('Back enclosure',(0,d/2-8,h/2),(w,16,h-15),M['black'],5);B('Bottom chassis',(0,0,30),(w,d,42),M['black'],7);B('Upper crossmember',(0,0,h-28),(w,d,56),M['black'],7)
 B('Tempered top glass',(0,0,h+1),(w-34,d-34,4),M['darkglass'],2)
 for x in [-145,145]:
  C('Precision Z guide',(x,95,238),4,346,M['steel']);C('Lead screw',(x,110,238),3,340,M['black'])
  for y in [-145,145]:C('XY pulley',(x,y,403),8,10,M['black'])
 for y in [-115,-92]:C('Carbon X gantry',(0,y,388),4,308,M['black'],'X')
 B('Bed carrier',(0,0,128),(272,272,20),M['black']);B('Textured PEI build plate',(0,0,140),(256,256,3),M['brass'],1);text('Build plate title','Bambu',(0,-90,142),16,M['black'],False)
 B('Chamber LED strip',(-173,0,401),(4,259,5),M['light'],1)
 B('Toolhead carriage',(27,-105,378),(65,56,60),M['white'],5);C('Part cooling fan',(27,-135,384),17,5,M['black'],'Y');C('Nozzle',(27,-105,342),4,13,M['brass'],r2=1)
 tube('PTFE bow',[(27,-90,410),(20,-30,445),(-35,60,437),(-60,125,410)],3,M['white'])
 B('Door seal',(0,-d/2-1,234),(w-31,4,361),M['black'],6);B('Glass door',(0,-d/2-4,234),(w-43,3,349),M['glass'],4)
 # Remove opaque seal centre: frame consists of four strips around the glass.
 bpy.data.objects.remove(bpy.data.objects['Door seal'],do_unlink=True)
 for x in [-w/2+15,w/2-15]:B('Door upright',(x,-d/2-3,234),(12,7,361),M['black'],3)
 for z in [54,414]:B('Door cross rail',(0,-d/2-3,z),(w-20,7,12),M['black'],3)
 for z in [120,340]:B('Door hinge',(-w/2+13,-d/2-7,z),(18,13,28),M['steel'],3)
 B('Door handle',(w/2-35,-d/2-13,239),(13,20,68),M['black'],5);B('Touchscreen housing',(97,-d/2-8,446),(117,15,58),M['black'],5);B('LCD',(97,-d/2-17,446),(103,2,47),M['darkglass'],2);text('Print status','P2S   READY',(97,-d/2-19,447),9,M['light']);text('Printer logo','Bambu Lab',(-92,-d/2-5,448),16,M['white'])
 for j in range(14):B('Back exhaust slit',(-80+j*12,d/2+.1,368),(5,1,42),M['rubber'],1)

def rack(row,M):
 w,d,h=row[3:6];cream=material('warm-ivory-rack',(.72,.68,.52),.78)
 for x in [-w/2+10,w/2-10]:
  for y in [-d/2+10,d/2-10]:B('Rack corner',(x,y,h/2),(20,20,h-42),M['white'],6)
  for z in [14,h-43]:B('Side perimeter',(x,0,z),(20,d,20),M['white'],5)
  # Open hexagonal side cells, modeled as joined rings.
  for iy in range(9):
   for iz in range(13):
    cy=-112+iy*26;cz=38+iz*26
    if cz<h-54:ring('Honeycomb side cell',(x,cy,cz),15,2.2,cream,'X',6)
  tube('Carry handle',[(x,-99,h-42),(x,-67,h-3),(x,61,h-3),(x,100,h-42)],8,M['white'])
 for z in [32,118,189,258,329,375]:B('Rack crossmember',(0,-d/2+8,z),(w-20,16,12),cream,3)
 for x in [-w/2+24,w/2-24]:
  B('Rack mounting rail',(x,-d/2+8,210),(20,7,355),cream,2)
  for z in range(40,385,22):C('Rack screw',(x,-d/2+2,z),4,3,M['black'],'Y',8)
 B('Gateway shelf',(0,-17,329),(266,236,5),cream);B('Gateway Fiber',(0,-20,349),(213,128,30),M['white'],6);B('Gateway LCD',(0,-85,352),(25,2,15),M['blue'],3)
 B('Patch panel',(0,-d/2+10,285),(260,7,46),cream);ports((0,-d/2+5,285),8,M,28)
 B('Network switch',(0,-77,229),(248,118,35),M['white'],5);ports((0,-138,229),8,M,28)
 for j in range(8):
  x=(j-3.5)*28;B('Clear RJ45 plug',(x,-151,285),(12,26,10),M['glass'],1);B('Clear switch plug',(x,-149,229),(12,23,10),M['glass'],1)
  tube('White patch cable',[(x,-161,285),(x,-176,270),(x,-182,228),(x,-173,203),(x,-154,207),(x,-147,229)],2.4,M['white'],8)
 B('Mini PC',(0,-38,160),(186,172,47),M['black'],5);B('Mini PC IO',(0,-125,160),(130,2,23),M['black']);ports((-25,-128,160),2,M,21);C('Mini PC power',(63,-129,160),4,2,M['steel'],'Y')
 for x in range(-115,116,23):B('Storage slot divider',(x,0,72),(4,258,78),cream,1)
 B('Storage shelf',(0,0,28),(264,270,6),cream)

def camera_device(row,M):
 id=row[0];w,d,h=row[3:6]
 if 'doorbell' in id:
  B('Mounting wedge',(0,d/2-5,h/2),(w-5,10,h-6),M['black'],5);B('Doorbell body',(0,0,h/2),(w,d-4,h),M['steel'] if id.startswith('ring') else M['black'],12)
  B('Camera fascia',(0,-d/2,h*.72),(w-8,2,h*.47),M['black'],10);C('Lens surround',(0,-d/2-2,h*.78),w*.21,3,M['black'],'Y');C('Camera lens',(0,-d/2-4,h*.78),w*.13,2,M['darkglass'],'Y')
  C('Doorbell button',(0,-d/2-2,h*.29),w*.24,3,M['steel'],'Y');ring('Illuminated button',(0,-d/2-4,h*.29),w*.21,1,M['blue'],'Y')
  for x in [-10,-5,0,5,10]:B('Speaker aperture',(x,-d/2-.5,11),(1.5,1,6),M['black'],.3)
  if id.startswith('unifi'):
   B('Doorbell message screen',(0,-d/2-2,h*.52),(w-18,2,19),M['darkglass'],2);text('Doorbell greeting','WELCOME',(0,-d/2-4,h*.52),4,M['white']);C('Package camera',(0,-d/2-3,16),5,3,M['darkglass'],'Y')
 elif id.endswith('bullet'):
  C('Wall base',(0,d/2-7,h*.5),32,14,M['white'],'Y');tube('Adjustable mounting arm',[(0,d/2-12,h*.5),(0,28,h*.48),(0,10,h*.56)],11,M['white']);C('Weatherproof cylinder',(0,-27,h*.6),35,100,M['white'],'Y',48);C('Black face',(0,-79,h*.6),30,3,M['black'],'Y');C('Lens',(0,-82,h*.6),14,3,M['darkglass'],'Y')
  for x in [-21,21]:C('IR illuminator',(x,-82,h*.6-10),5,2,M['darkglass'],'Y')
 else:
  B('Pedestal',(0,13,5),(66,44,10),M['white'],5);C('Swivel neck',(0,12,25),9,30,M['white']);B('Rounded weatherproof body',(0,0,54),(w,d-12,72),M['white'],14);B('Gloss front',(0,-d/2+4,54),(w-9,3,63),M['black'],13);C('Camera lens',(0,-d/2,61),15,3,M['darkglass'],'Y');C('Status LED',(0,-d/2,34),2,1,M['blue'],'Y')

def drone(row,M):
 # Top and bottom reference views establish arm sweep, battery, gimbal and sensor positions.
 shell=material('drone-light-grey',(.58,.62,.63),.63)
 sections=[(-82,18,32,47),(-58,41,24,62),(20,43,27,66),(66,32,28,57),(80,25,34,50)];v=[]
 for y,ww,lo,hi in sections:v += [(-ww,y,lo),(ww,y,lo),(ww,y,hi),(-ww,y,hi)]
 f=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(len(sections)-1) for i in range(4)]+[(3,2,1,0),(16,17,18,19)];mesh('Faceted aerodynamic fuselage',v,f,shell)
 B('Rear battery',(0,48,47),(62,59,34),shell,6);B('Battery seam',(0,20,63),(63,1,1),M['black'],0)
 for x in [-1,1]:
  for y in [-1,1]:
   root=(x*31,y*47,40);end=(x*(118 if y<0 else 111),y*84,47)
   tube('Folding arm',[root,(x*61,y*58,38),end],7,shell,6);C('Folding pivot',root,10,18,shell);C('Brushless motor',end,12,17,M['black']);C('Motor bell',(end[0],end[1],59),11,7,shell)
   # Two genuinely shaped propeller blades with pitched cross sections.
   for sign in [-1,1]:
    pts=[(0,-3,0),(18,-7,1),(57,-8,3),(73,-3,1),(70,2,0),(26,5,-1),(0,3,0)]
    vv=[(end[0]+sign*a,end[1]+sign*b,65+c) for a,b,c in pts];mesh('Tapered propeller blade',vv,[tuple(range(7))],M['black']);mesh('Orange propeller tip',[(end[0]+sign*a,end[1]+sign*b,65+c+.2) for a,b,c in [(61,-7,2.6),(73,-3,1),(70,2,0),(62,2,0)]],[(0,1,2,3)],M['orange'])
   if y<0:tube('Front landing leg',[(end[0],end[1],42),(end[0]+x*4,end[1]-3,8)],4,shell)
  C('Forward obstacle sensor',(x*26,-68,53),11,4,M['black'],'Y');C('Sensor glass',(x*26,-71,53),8,2,M['darkglass'],'Y');C('Rear obstacle sensor',(x*31,56,57),7,3,M['black'],'Y')
 B('Front LiDAR window',(0,-76,48),(16,2,10),M['darkglass'],3)
 tube('Three axis gimbal cradle',[(-25,-74,32),(-25,-84,16),(25,-84,16),(25,-74,32)],3,M['steel']);B('One inch camera housing',(0,-87,25),(35,27,28),M['black'],5);C('Camera lens rim',(0,-102,25),12,4,M['steel'],'Y');C('Camera optical glass',(0,-105,25),10,2,M['darkglass'],'Y');text('Camera marking','1 INCH',(0,-107,25),3,M['steel'])
 for x in [-19,19]:C('Downward vision sensor',(x,-8,24),7,3,M['black']);C('Landing light',(x,16,24),4,3,M['white'])
 for j in range(8):B('Rear cooling vent',(-21+j*6,77,41),(3,2,14),M['black'],.5)
 text('Drone model','MINI 5 PRO',(0,-16,66.4),7,M['black'],False)
