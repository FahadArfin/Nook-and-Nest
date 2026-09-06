from studio_geometry import *
import json

def shelf_model(row,M):
 id=row[0];w,d,h=row[3:6];surfaces=[]
 def level(z,width=None,x=0,depth=None,clearance=320):
  width=width or w-70;depth=depth or d-20
  B('Usable shelf deck',(x,0,z-12),(width,depth,24),M['wood'] if 'walnut' in id else M['glass'] if 'gallery' in id else M['steel'] if 'wire' in id else M['white'] if 'white' in id else M['black'])
  surfaces.append(dict(id='level-'+str(len(surfaces)+1),label='Shelf '+str(len(surfaces)+1),x=x,z=0,width=width-14,depth=depth-14,height=z,clearance=clearance))
 if 'floating' in id:
  mat=M['oak'] if 'oak' in id else M['white'] if 'marble' in id else M['black']
  B('Floating shelf',(0,0,14 if 'metal' in id else h/2),(w,d,28 if 'metal' in id else h),mat,3)
  if 'metal' in id:
   B('Folded raised back',(0,d/2-3,h/2),(w,6,h),mat,1)
   for x in [-w/2+3,w/2-3]:B('End return',(x,0,45),(6,d,90),mat,1)
  surfaces.append(dict(id='top',label='Shelf surface',x=0,z=-4,width=w-24,depth=d-28,height=28 if 'metal' in id else h,clearance=700))
 elif 'walnut' in id:
  for x in [-w/2+16,w/2-16]:B('Walnut outer stile',(x,0,h/2),(32,d,h),M['wood'],3)
  B('Recessed back',(0,d/2-7,h/2),(w-64,14,h),M['wood'],1)
  for i,z in enumerate([45,480,915,1350,1780]):
   B('Continuous shelf',(0,0,z-15),(w, d,30),M['wood'],3)
   if i<4:
    divider=(-.17 if i%2 else .17)*w;B('Offset divider',(divider,0,z+202),(26,d-16,405),M['wood'],2)
    left=-w/2+32;right=w/2-32
    for a,b in [(left,divider-13),(divider+13,right)]:surfaces.append(dict(id=f'bay-{i}-{a}',label=f'Level {i+1} bay',x=(a+b)/2,z=-7,width=b-a-14,depth=d-45,height=z,clearance=395))
 elif 'cantilever' in id:
  B('Weighted foot',(0,0,25),(w,d,50),M['steel'],5);B('Central spine',(0,d*.18,h/2),(70,90,h),M['white'],8)
  for i,z in enumerate([80,430,780,1130,1480,1820]):level(z,w-60,x=0,clearance=310 if i<5 else 600)
 elif 'wire' in id:
  for x in [-w/2+15,w/2-15]:
   for y in [-d/2+15,d/2-15]:
    C('Chrome tubular post',(x,y,h/2),13,h,M['steel']);C('Adjustable foot',(x,y,9),16,18,M['rubber'])
  for i,z in enumerate([100,510,920,1330,1740]):
   for y in [-d/2+15,d/2-15]:tube('Shelf perimeter', [(-w/2+15,y,z),(w/2-15,y,z)],5,M['steel'])
   for x in range(-int(w/2)+20,int(w/2),28):tube('Individual deck wire',[(x,-d/2+15,z),(x,d/2-15,z)],2,M['steel'],6)
   for x in [-w/2+15,w/2-15]:
    tube('Cross brace',[(x,-d/2+15,z),(x,d/2-15,z)],5,M['steel'])
    for y in [-d/2+15,d/2-15]:C('Locking sleeve',(x,y,z-12),17,26,M['black'])
   surfaces.append(dict(id=f'wire-{i}',label=f'Wire shelf {i+1}',x=0,z=0,width=w-60,depth=d-60,height=z+3,clearance=370 if i<4 else 700))
 else:
  garage='garage' in id;mat=M['black'] if garage else M['brass']
  for x in [-w/2+18,w/2-18]:
   for y in [-d/2+18,d/2-18]:
    B('Folded upright' if garage else 'Bronze upright',(x,y,h/2),(36,30,h),mat,2)
    if garage:
     for z in range(50,h-20,60):B('Punched adjustment slot',(x,y-16,z),(9,1,20),M['rubber'],1)
  for i,z in enumerate([65,480,895,1310,h-35]):
   level(z,clearance=370 if i<4 else 650)
   if garage:
    for y in [-d/2+10,d/2-10]:B('Folded beam',(0,y,z-24),(w,18,48),mat,2)
    for x in [-w/2+18,w/2-18]:
     for y in [-d/2+8,d/2-8]:bolt((x,y,z),M['steel'])
 return surfaces

def light_model(row,M):
 id=row[0];w,d,h=row[3:6];gold=M['brass'];glow=M['light']
 if id.startswith('recessed'):
  count=5 if 'linear' in id else 2 if 'twin' in id else 1
  if id in ['recessed-round','recessed-gimbal']:C('Thin ceiling trim',(0,0,h-3),w/2,6,M['white']);ring('Trim inner lip',(0,0,h-7),w*.40,3,gold)
  else:B('Thin ceiling trim',(0,0,h-3),(w,d,6),M['white'],2)
  for i in range(count):
   x=(i-(count-1)/2)*(w/count);r=min(w/count,d)*.33
   vv=[];steps=40
   for z,rr in [(3,r),(h-7,r),(h-7,r-2),(3,r-2)]:
    for j in range(steps):a=j*math.tau/steps;vv.append((x+rr*math.cos(a),rr*math.sin(a),z))
   mesh('Hollow anti-glare baffle',vv,[(k*steps+j,k*steps+(j+1)%steps,((k+1)%4)*steps+(j+1)%steps,((k+1)%4)*steps+j) for k in range(4) for j in range(steps)],M['black'])
   ring('Machined optic rim',(x,0,4),r,3,gold)
   C('Recessed warm optic',(x,0,7),r*.65,3,glow)
   if 'gimbal' in id:
    o=ring('Gimbal inner ring',(x,0,12),r*.78,3,M['black']);o.rotation_euler.y=.3
  return
 C('Ceiling canopy',(0,0,h-12),min(w,d)*.14,24,gold)
 if 'ring' in id:
  ring('Bronze suspension ring',(0,0,70),w*.43,16,gold)
  for i in range(36):
   a=i*math.tau/36;B('Alabaster segment',(w*.43*math.cos(a),w*.43*math.sin(a),64),(w*.065,28,48),M['white'],5).rotation_euler.z=a+math.pi/2
  ring('Warm underlight',(0,0,47),w*.43,6,glow)
  for i in range(3):a=i*math.tau/3;tube('Suspension cable',[(w*.43*math.cos(a),w*.43*math.sin(a),90),(0,0,h-23)],1.5,M['steel'])
 elif 'crystal' in id:
  tube('Central suspension',[(0,0,250),(0,0,h-24)],4,gold)
  for tier,r in enumerate([w*.45,w*.32,w*.19]):
   z=310-tier*120;ring('Tier ring',(0,0,z),r,6,gold)
   for i in range(28-tier*6):
    a=i*math.tau/(28-tier*6);C('Faceted crystal prism',(r*math.cos(a),r*math.sin(a),z-62),12,120,M['glass'],s=6)
   C('Tier diffuser',(0,0,z-8),r*.85,8,glow)
 elif 'branch' in id:
  tube('Central stem',[(0,0,150),(0,0,h-20)],8,gold)
  for i in range(6):
   a=i*math.tau/6;r=w*.37;z=120+(i%3)*80;p=(r*math.cos(a),r*.65*math.sin(a),z)
   tube('Branched brass arm',[(0,0,h*.5),(p[0]*.7,p[1]*.7,h*.5),p],7,gold);ball('Opal globe',p,85,M['white']);C('Globe socket',(p[0],p[1],z+78),19,24,gold)
 elif 'flush' in id:
  C('Stepped brass rim',(0,0,h*.68),w/2,h*.50,gold);C('Opal disc',(0,0,h*.28),w*.47,h*.5,M['white']);C('Warm underside',(0,0,5),w*.42,10,glow)
 else:
  count=5 if 'island' in id else 1
  if count>1:B('Suspension bar',(0,0,h-28),(w,45,28),gold,5)
  for i in range(count):
   x=(i-(count-1)/2)*(w/count);r=85 if count>1 else w*.46
   tube('Braided pendant cord',[(x,0,h-25),(x,0,180)],2,M['black']);C('Brass socket',(x,0,180),22,55,gold)
   if 'dome' in id:
    C('Spun copper dome',(x,0,80),r,135,M['orange'],s=48,r2=30);ring('Rolled copper rim',(x,0,12),r,5,gold);C('Recessed warm diffuser',(x,0,16),r*.92,5,glow)
   else:
    C('Glass shade',(x,0,90),r,170,M['glass'],s=48,r2=r*.8)
    for j in range(36):a=j*math.tau/36;tube('Individual glass flute',[(x+r*math.cos(a),r*math.sin(a),10),(x+r*.8*math.cos(a),r*.8*math.sin(a),170)],3,M['glass'],6)
    ball('Visible warm bulb',(x,0,100),25,glow);ring('Shade lower rim',(x,0,6),r,5,gold)

def backsplash_model(row,M):
 id=row[0];w,d,h=row[3:6];grout=material('tile-grout',(.37,.37,.34),.98);tile=material('ceramic-tiles',(.10,.30,.22) if 'kitkat' in id else (.73,.74,.66),.32)
 B('Continuous grout backing',(0,5,h/2),(w,d-10,h),grout,1)
 if 'fluted' in id:
  for x in range(-int(w/2)+15,int(w/2),30):C('Stone flute',(x,-3,h/2),14,h,M['white'],s=16)
 elif 'herringbone' in id:
  # Interlocking 3:1 rectangles, rotated 45 degrees and clipped at panel edges.
  def clip(poly,axis,bound,positive):
   out=[]
   for a,b in zip(poly,poly[1:]+poly[:1]):
    ia=(a[axis]>=bound) if positive else (a[axis]<=bound);ib=(b[axis]>=bound) if positive else (b[axis]<=bound)
    if ia:out.append(a)
    if ia!=ib:
     t=(bound-a[axis])/(b[axis]-a[axis]);out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
   return out
  unit=40
  for a in range(-12,13):
   for b in range(-24,25):
    ox=(3*a-b)*unit;oz=(3*a+b)*unit
    for rx,rz,rw,rh in [(0,0,120,40),(120,0,40,120)]:
     poly=[]
     for xx,zz in [(rx+1.5,rz+1.5),(rx+rw-1.5,rz+1.5),(rx+rw-1.5,rz+rh-1.5),(rx+1.5,rz+rh-1.5)]:
      xx+=ox;zz+=oz;poly.append(((xx-zz)*.7071,(xx+zz)*.7071+h/2))
     for axis,bound,pos in [(0,-w/2,True),(0,w/2,False),(1,0,True),(1,h,False)]:
      if poly:poly=clip(poly,axis,bound,pos)
     if len(poly)<3:continue
     n=len(poly);v=[(x,y,z) for y in [-13,-1] for x,z in poly];mesh('Interlocking marble tile',v,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],tile)
 else:
  cols=40 if 'kitkat' in id else 12;rr=4 if 'kitkat' in id else 6;tw=w/cols;th=h/rr
  for i in range(cols):
   for j in range(rr):B('Glazed finger tile' if cols==40 else 'Handmade zellige tile',(-w/2+(i+.5)*tw,-5-(i*j%3)*.3,(j+.5)*th),(tw-3,15,th-3),tile,3)
