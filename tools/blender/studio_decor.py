from studio_geometry import *

def manga(row,M):
 id=row[0];w,d,h=row[3:6];stack='stack' in id;n=4 if stack else 10 if 'garden' in id else 8
 for i in range(n):
  bw=w if stack else w/n-1;bh=h/n-1 if stack else h-(i%3)*3;x=0 if stack else -w/2+(i+.5)*w/n;z=(i+.5)*h/n if stack else bh/2
  jacket=M['blue'] if i%2 else M['white'];B('Ivory manga page block',(x,0,z),(bw-3,d-8,bh-4),M['paper'],1)
  for zz in [-1,1]:
   B('Jacket cover',(x,0,z+zz*(bh/2-1)) if stack else (x+zz*(bw/2-1),0,z),(bw,d,2) if stack else (2,d,bh),jacket,.4)
  B('Printed book spine',(x,-d/2+1,z),(bw,2,bh),jacket,.5)
  art('Original illustrated manga spine',(x,-d/2-.2,z),bw-2,bh-8,M,1 if 'garden' in id else 0)
  B('Volume number band',(x,-d/2-.6,z-bh*.36),(bw-2,.3,min(18,bh*.22)),jacket,.1)
  text('Volume number',f'{i+1:02}',(x,-d/2-1,z-bh*.36),min(11,bw*.44),M['brass'])
  for line in range(5):B('Individual page edges',(x,d/2-3,z-bh*.3+line*bh*.12),(bw-7,1,.35),M['white'],0)
 if stack:art('Deluxe cover art',(0,0,h+.1),w-8,d-8,M,1,True)

def mat_model(row,M):
 id=row[0];w,d,h=row[3:6];surface=M['wood'] if 'leather' in id else M['jade'] if 'sage' in id else M['black']
 B('Non-slip underside',(0,0,1),(w,d,2),M['rubber'],1);B('Desk mat face',(0,0,3),(w-1,d-1,2),surface,1)
 if 'anime' in id or 'gaming' in id:art('Original printed mat',(0,0,4.1),w-6,d-6,M,2 if 'gaming' in id else 1 if 'garden' in id else 0,True)
 for x in range(-int(w/2)+8,int(w/2)-5,10):
  for y in [-d/2+4,d/2-4]:B('Perimeter stitch',(x,y,4.15),(4,1,.4),M['light'] if 'gaming' in id else M['paper'],0)
 for y in range(-int(d/2)+8,int(d/2)-5,10):
  for x in [-w/2+4,w/2-4]:B('Perimeter stitch',(x,y,4.15),(1,4,.4),M['light'] if 'gaming' in id else M['paper'],0)

def clock(row,M):
 id=row[0];w,d,h=row[3:6]
 if id in ['divergence-clock','digital-alarm-clock']:
  if id=='divergence-clock':
   B('Exposed circuit base',(0,0,12),(w,d,24),M['black'],3)
   pcb=material('circuit-board-olive',(.18,.23,.11),.8);B('Top circuit board',(0,0,26),(w-8,d-8,4),pcb,.5)
   for i in range(8):
    x=(i-3.5)*37;C('Ceramic tube socket',(x,0,34),15,14,M['black']);C('Individual glass nixie envelope',(x,0,70),13,70,M['glass'],s=24,r2=10)
    for side in [-1,1]:tube('Tube cathode support',[(x+side*7,3,40),(x+side*7,3,92)],.6,M['steel'],6)
    for j in range(6):C('Tube contact pin',(x+(j-2.5)*3,0,28),.6,6,M['brass'],s=6)
   for x in [-w/2+8,w/2-8]:
    for y in [-d/2+8,d/2-8]:bolt((x,y,29),M['steel'])
   for i in range(12):B('Circuit resistor',(-135+i*24,32,30),(9,3,4),M['oak'],.5)
   z=70;dw=296;dh=47;yy=-14
  else:
   B('Digital aluminum case',(0,0,h/2),(w,d,h),M['black'],9);B('Display recess',(0,-d/2,h*.5),(w-12,2,h-16),M['rubber'],3)
   for i in range(3):B('Alarm control',(i*20-20,0,h),(12,12,3),M['steel'],2)
   z=h*.5;dw=w-20;dh=h-24;yy=-d/2-1
  live=material('live-clock-display',(.02,.015,.008),.8,alpha=0 if id=='divergence-clock' else 1)
  ob=mesh('Live time display',[(-dw/2,yy,z-dh/2),(dw/2,yy,z-dh/2),(dw/2,yy,z+dh/2),(-dw/2,yy,z+dh/2)],[(0,1,2,3)],live)
  uv=ob.data.uv_layers.new()
  for a,b in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):a.uv=b
  # Static preview digits disappear when the live texture is attached.
  if id=='divergence-clock':
   glow=material('nixie-orange-glow',(1,.23,.025),.5,emission=3)
   for i,c in enumerate('12:34:56'):
    ob=text('Preview time',c,((i-3.5)*37,yy-.2,z),dh*.80,glow);ob['motion_role']='clock_preview'
  else:
   ob=text('Preview time','12:34:56',(0,yy-.2,z),dh*.67,M['light']);ob['motion_role']='clock_preview'
  return
 rolex='rolex' in id;r=w*.48;z=h*.52
 if rolex:
  # A hemispherical case assembled from a radial profile, not a flat watch on feet.
  v=[];steps=64;rings=16
  for j in range(rings+1):
   a=j*math.pi/2/rings;rr=max(.01,r*math.cos(a));yy=-d*.20+d*.70*math.sin(a)
   for k in range(steps):t=k*math.tau/steps;v.append((rr*math.cos(t),yy,z+rr*math.sin(t)))
  o=mesh('Steel hemispherical case',v,[(j*steps+k,j*steps+(k+1)%steps,(j+1)*steps+(k+1)%steps,(j+1)*steps+k) for j in range(rings) for k in range(steps)],M['steel'])
  for f in o.data.polygons:f.use_smooth=True
  ring('Black ceramic bezel',(0,-d*.32,z),r*.93,r*.075,M['black'],'Y')
 elif 'sunburst' in id:
  r=w*.24;z=h/2
  for i in range(48):
   a=i*math.tau/48;length=w*(.25 if i%2 else .20);tube('Polished radial ray',[(r*math.sin(a),0,z+r*math.cos(a)),((r+length)*math.sin(a),0,z+(r+length)*math.cos(a))],3 if i%2 else 6,M['steel'])
 else:
  r=w*.46;z=h*.57;C('Pedestal',(0,0,10),w*.30,20,M['brass']);tube('Clock support',[(0,0,10),(0,0,z)],8,M['brass'])
 C('Dial case',(0,-d*.25 if rolex else 0,z),r,d*.10 if rolex else d*.55,M['brass'] if not rolex else M['steel'],'Y',64)
 C('Recessed dial',(0,-d*.29,z),r*.84,2,M['black'] if rolex or 'sunburst' in id else M['white'],'Y',64)
 for i in range(60):
  a=i*math.tau/60;rr=r*.76;B('Dial minute marker',(rr*math.sin(a),-d*.31,z+rr*math.cos(a)),(1.5 if i%5 else 3,1,3 if i%5 else 7),M['white'] if rolex else M['brass'],.2).rotation_euler.y=a
 for i in range(12):
  a=i*math.tau/12
  if rolex:
   C('Luminous hour index',(r*.62*math.sin(a),-d*.33,z+r*.62*math.cos(a)),2.3,1,M['paper'],'Y',12)
  else:text('Hour numeral',str(i or 12),(r*.62*math.sin(a),-d*.33,z+r*.62*math.cos(a)),r*.14,M['black'])
 for a,length in [(-.85,r*.49),(.9,r*.65)]:tube('Polished clock hand',[(0,-d*.36,z),(length*math.sin(a),-d*.36,z+length*math.cos(a))],max(.7,r*.024),M['white'] if rolex else M['black'])
 C('Hand pivot',(0,-d*.38,z),r*.055,2,M['brass'],'Y',16)
 if rolex:
  B('Date aperture',(r*.57,-d*.34,z),(10,1,7),M['white'],.5);text('Date','06',(r*.57,-d*.365,z),5,M['black']);B('Cyclops magnifier',(r*.57,-d*.39,z),(12,3,9),M['glass'],2)
  text('Dial identity','ROLEX',(0,-d*.34,z+r*.30),4,M['white']);text('Dial model','SUBMARINER',(0,-d*.34,z-r*.31),2.5,M['white'])

def cleaning(row,M):
 id=row[0];w,d,h=row[3:6]
 if 'bin' in id:
  B('Brushed rectangular bin',(0,0,h*.48),(w,d,h*.92),M['steel'],min(w,d)*.08)
  B('Liner rim',(0,0,h*.95),(w+2,d+2,24),M['black'],12);B('Soft-close lid',(0,0,h*.985),(w+4,d+4,20),M['steel'],12)
  B('Full width pedal',(0,-d/2-10,32),(w*.80,38,13),M['black'],5)
  B('Rear hinge',(0,d/2-7,h-25),(w*.6,24,30),M['black'],4)
  for x in [-w*.38,w*.38]:B('Bin feet',(x,0,4),(40,d*.7,8),M['rubber'],3)
  if 'dual' in id:B('Compartment divider seam',(-w*.08,-d/2-1,h*.48),(2,1,h*.72),M['black'],.2)
  text('Bin maker','simplehuman',(0,-d/2-1,h*.82),min(18,w*.06),M['black'])
  B('Pedal brushed tread',(0,-d/2-19,40),(w*.72,33,5),M['steel'],2)
  return
 if 'robot' in id:
  B('Dock back housing',(0,d*.19,h*.53),(w,d*.55,h*.94),M['white'],28);B('Water tank top',(0,d*.19,h*.92),(w-16,d*.5,h*.13),M['black'],20)
  B('Open docking recess',(0,-d*.105,150),(w*.82,12,230),M['rubber'],20)
  B('Dock service panel',(0,-d*.088,405),(w-22,5,228),M['white'],16);B('Tank access seam',(0,-d*.097,510),(w-28,1.2,2),M['black'],.3);B('Dock brushed trim',(0,-d*.094,289),(w-30,3,12),M['brass'],2)
  text('Dock identity','dreame',(0,-d*.101,394),23,M['brass']);B('Top control strip',(0,d*.19,h+1),(101,32,2),M['black'],5)
  for x in [-27,0,27]:C('Dock control button',(x,d*.19,h+3),5,1,M['white'])
  B('Wash tray',(0,-d*.2,12),(w*.93,d*.58,24),M['black'],20)
  for i in range(12):B('Tray drain rib',((i-5.5)*26,-d*.2,25),(8,d*.36,4),M['steel'],1)
  C('Robot bumper',(0,-d*.23,75),175,100,M['white'],s=64);C('Top disc',(0,-d*.23,127),169,7,M['white'],s=64)
  C('Lidar tower',(0,-d*.16,145),32,33,M['steel']);C('Lidar lens',(0,-d*.16,147),33,16,M['black'])
  B('Front vision window',(0,-d*.23-173,78),(70,5,28),M['black'],8)
  for x in [-125,125]:
   for angle in [0,2.1,4.2]:tube('Side brush bristles',[(x,-d*.32,29),(x+30*math.cos(angle),-d*.32+30*math.sin(angle),24)],2,M['black'],6)
  return
 if 'broom' in id:
  B('Dustpan base',(0,0,24),(w,d,48),M['black'],10)
  B('Dustpan hollow interior',(0,-15,50),(w-24,d-40,8),M['rubber'],3)
  for x in [-w/2+8,w/2-8]:B('Pan raised side',(x,0,75),(16,d,100),M['black'],4)
  for x in [-65,65]:tube('Long slim handle',[(x,50,65),(x,50,h-25)],10,M['steel']);B('Rubber hand grip',(x,50,h-65),(26,26,130),M['jade'],8)
  B('Broom head',(-65,-20,125),(w*.75,40,40),M['jade'],7)
  for i in range(40):tube('Individual broom bristles',[(-w*.35+i*w*.018,-20,110),(-w*.4+i*w*.020,-25,45)],2,M['paper'],6)
 else:
  mop='spray' in id;wet='wet' in id
  B('Floor cleaning head',(0,-10,35),(w,d,60),M['white'] if wet else M['black'],14)
  C('Visible cleaning roller',(0,-d*.32,30),24,w*.88,M['paper'],'X',32)
  tube('Swivel neck',[(0,15,50),(0,40,130),(0,55,h-50)],9 if mop else 15,M['steel'])
  B('Ergonomic handle',(0,55,h-70),(45,55,140),M['black'],15)
  if mop:B('Refill spray bottle',(0,30,h*.28),(70,65,180),M['darkglass'],18)
  elif wet:
   B('Upright body',(0,40,h*.37),(w*.70,d*.58,h*.53),M['white'],28)
   B('Removable water tank',(0,-d*.16,h*.37),(w*.57,45,h*.34),M['darkglass'],20)
   C('Wash status screen',(0,35,h*.72),34,6,M['black'])
  else:
   C('Cyclone dust bin',(0,45,h*.73),49,190,M['darkglass']);C('Motor housing',(0,45,h*.88),56,100,M['jade']);ring('Cyclone collar',(0,45,h*.79),49,6,M['orange'])
   tube('Open trigger grip',[(0,64,h*.92),(0,124,h*.91),(0,140,h*.80),(0,66,h*.79)],13,M['black'],10);B('Trigger',(0,119,h*.86),(18,15,30),M['orange'],4);B('Battery pack',(0,101,h*.78),(100,98,38),M['black'],7)
   for j in range(10):ring('Motor exhaust flute',(0,45,h*.87+j*6),55,1.3,M['black'])
   B('Roller clear window',(0,-d*.31,48),(w*.82,d*.25,10),M['glass'],4)
   for i in range(12):a=i*math.tau/12;C('Cyclone duct',(40*math.cos(a),45+40*math.sin(a),h*.84),5,65,M['steel'],s=10)
