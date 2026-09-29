"""Original garage and shed construction studies, authored in millimetres.

Front is -Y, base is Z0. The caller owns scene isolation, normalization,
editable source saving, GLB export and render review. No retailer media.
Every model is a fixed stored/display pose, not a machine simulation.
"""
import math
import bpy
from mathutils import Vector, Matrix
from build_kitchen_essentials import B, C, mesh, tube, lathe, rounded_loop, material
from household_geometry import ring
from studio_geometry import text, cavity


def palette(M):
    P=dict(M)
    P.update(
        enamel=material('garage-slate-powdercoat',(.105,.17,.205),.63,.22),
        red=material('garage-oxide-red-powdercoat',(.43,.052,.029),.61,.12),
        green=material('garage-olive-polymer',(.26,.35,.105),.72),
        cream=material('garage-putty-powdercoat',(.70,.70,.63),.62,.12),
        steel=material('garage-satin-machined-steel',(.43,.48,.51),.36,.82),
        dark=material('garage-graphite-cast-metal',(.035,.045,.048),.75,.32),
        plastic=material('garage-graphite-moulded-polymer',(.045,.057,.065),.77),
        rubber=material('garage-fine-rubber',(.015,.020,.021),.95),
        wood=material('garage-oiled-maple-wood',(.48,.28,.13),.72),
        wood2=material('garage-maple-lamella-wood',(.59,.37,.19),.74),
        glass=material('garage-smoked-translucent-glass',(.34,.47,.48),.17,0,.28),
        clear=material('garage-clear-storage-polymer',(.50,.58,.58),.42,0,.30),
        yellow=material('garage-ochre-tool-polymer',(.67,.40,.055),.68),
        grit=material('garage-abrasive-stone',(.29,.31,.29),.98),
        blue=material('garage-blue-hose-polymer',(.065,.23,.36),.8),
        white=material('garage-ivory-utility-polymer',(.81,.83,.79),.68),
        brass=material('garage-machined-brass',(.47,.31,.105),.36,.76),
        light=material('garage-static-status-lens',(.36,.65,.40),.4,0,1,.15),
    )
    return P


def beam(name,a,b,w,d,mat,bevel=1):
    a,b=Vector(a),Vector(b);o=B(name,(a+b)/2,(w,d,(b-a).length),mat,bevel)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o


def bolt(name,p,M,r=4,axis='Y'):
    return C(name,p,r,3,M['steel'],axis=axis,s=6)


def screw(name,p,M,r=3,axis='Y'):
    C(name,p,r,1.5,M['steel'],axis=axis,s=12)
    if axis=='Y':B(name+' slot',(p[0],p[1]-.9,p[2]),(r*1.3,.5,.65),M['dark'],0)


def polyxy(name,outline,z,h,mat):
    n=len(outline);verts=[(x,y,zz) for zz in [z,z+h] for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat)


def polyxz(name,outline,y,d,mat):
    n=len(outline);verts=[(x,yy,z) for yy in [y-d/2,y+d/2] for x,z in outline]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces += [(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return mesh(name,verts,faces,mat)


def handle(name,x,y,z,w,M,mat=None):
    tube(name,[(x-w/2,y+18,z),(x-w/2,y,z),(x+w/2,y,z),(x+w/2,y+18,z)],5,mat or M['steel'],8)


def feet(w,d,M,z=30):
    for x in [-w*.40,w*.40]:
        for y in [-d*.37,d*.37]:
            C('Adjustable threaded foot',(x,y,z),8,z*2,M['steel'],s=12)
            C('Rubber leveling pad',(x,y,6),21,12,M['rubber'],s=20)


def caster(x,y,z,M,r=28):
    C('Caster mounting swivel',(x,y,z+r*2.1),r*.65,10,M['steel'],s=16)
    for dx in [-r*.48,r*.48]:B('Caster fork cheek',(x+dx,y,z+r*1.35),(4,r*1.7,r*1.3),M['steel'],1)
    C('Caster tire',(x,y,z+r),r,r*.8,M['rubber'],axis='X',s=20)
    for sign in [-1,1]:C('Caster wheel hub',(x+sign*r*.43,y,z+r),r*.40,3,M['steel'],axis='X',s=16)


def wheel(name,x,y,z,r,width,M,axis='X',tread=True):
    o=lathe(name+' open tire',[(r*.57,-width*.5),(r*.78,-width*.5),(r*.97,-width*.35),
        (r,-width*.18),(r,width*.18),(r*.97,width*.35),(r*.78,width*.5),(r*.57,width*.5)],M['rubber'],40)
    o.location=(x,y,z)
    if axis=='X':o.rotation_euler.y=math.pi/2
    elif axis=='Y':o.rotation_euler.x=math.pi/2
    C(name+' recessed wheel rim',(x,y,z),r*.58,width*.68,M['steel'],axis=axis,s=32)
    C(name+' axle cap',(x,y,z),r*.18,width*.95,M['dark'],axis=axis,s=16)
    if tread:
        for i in range(24):
            a=i*math.tau/24
            if axis=='X':
                p=(x,y+r*math.sin(a),z+r*math.cos(a));o=B(name+' tread lug',p,(width*.72,r*.15,r*.045),M['rubber'],0);o.rotation_euler.x=-a
            elif axis=='Z':
                p=(x+r*math.cos(a),y+r*math.sin(a),z);o=B(name+' tread lug',p,(r*.045,r*.15,width*.72),M['rubber'],0);o.rotation_euler.z=a


def grill(name,x,y,z,w,h,M,rows=10,mat=None,face=-1):
    B(name+' recessed plenum',(x,y-face*5,z),(w,4,h),M['dark'],2)
    for i in range(rows):
        o=B(name+' pitched louver',(x,y,z-h/2+(i+.5)*h/rows),(w-8,10,max(2,h/rows*.2)),mat or M['enamel'],1)
        o.rotation_euler.x=face*.28


def laminate(name,w,d,z,t,M,center=(0,0)):
    count=max(4,int(w/125))
    for i in range(count):
        B(name+' joined timber lamella %02d'%i,(center[0]-w/2+(i+.5)*w/count,center[1],z),(w/count-.4,d,t),M['wood2' if i%3==0 else 'wood'],2)


def perforated(name,w,h,x,y,z,M,cell=25):
    """One editable thin steel mesh with genuine square perforations."""
    cols=max(2,int(w/cell));rows=max(2,int(h/cell));vs=[];fs=[]
    for j in range(rows):
        for i in range(cols):
            xx=x-w/2+(i+.5)*w/cols;zz=z-h/2+(j+.5)*h/rows
            dx=w/cols/2;dz=h/rows/2;r=min(dx,dz)*.28;k=len(vs)
            vs += [(xx+a,y,zz+b) for a,b in [(-dx,-dz),(dx,-dz),(dx,dz),(-dx,dz),(-r,-r),(r,-r),(r,r),(-r,r)]]
            fs += [(k+n,k+(n+1)%4,k+4+(n+1)%4,k+4+n) for n in range(4)]
    mesh(name+' perforated steel face',vs,fs,M['enamel'])
    for xx in [x-w/2,x+w/2]:B(name+' folded side hem',(xx,y+8,z),(7,18,h),M['enamel'],1)
    for zz in [z-h/2,z+h/2]:B(name+' folded end hem',(x,y+8,zz),(w,18,7),M['enamel'],1)


def cabinet(kind,M):
    if kind=='corner-cabinet':
        outline=[(-450,450),(-450,-150),(-150,-450),(450,-450),(450,450)]
        polyxy('Five-sided corner worktop',outline,892,38,M['wood'])
        polyxy('Five-sided corner bottom',[(x*.95,y*.95) for x,y in outline],85,18,M['enamel'])
        for a,b in zip(outline,outline[1:]+outline[:1]):
            # Front diagonal is reserved for a distinct recessed door.
            if a==(-450,-150):continue
            mid=((a[0]+b[0])/2,(a[1]+b[1])/2,486)
            o=B('Corner shell folded wall',mid,((Vector(a)-Vector(b)).length,12,800),M['enamel'],2)
            o.rotation_euler.z=math.atan2(b[1]-a[1],b[0]-a[0])
        door=B('Recessed diagonal corner door',(-290,-290,486),(408,16,780),M['enamel'],3);door.rotation_euler.z=-math.pi/4
        tube('Diagonal cabinet pull',[(-337,-260,620),(-348,-271,620),(-271,-348,620),(-260,-337,620)],5,M['steel'],8)
        # The clipped front corner cannot carry the ordinary square-case foot.
        for x,y in [(-300,-245),(-300,300),(300,-300),(300,300)]:
            C('Corner cabinet threaded foot',(x,y,45),8,90,M['steel'],s=12)
            C('Corner cabinet leveling pad',(x,y,6),21,12,M['rubber'],s=20)
        for p in [(-438,250,250),(250,-438,250)]:bolt('Shell fastening',p,M)
        return
    w,d,h={'tall-cabinet':(914,610,1980),'wall-cabinet':(711,356,600),'drawer-base':(1067,559,930)}[kind]
    z0=60 if kind!='wall-cabinet' else 0;top=h-(38 if kind=='drawer-base' else 12)
    if z0:feet(w,d,M,z0/2)
    for x in [-w/2+8,w/2-8]:B('Folded cabinet side',(x,0,(z0+top)/2),(16,d,top-z0),M['enamel'],2)
    for z in [z0+8,top-8]:B('Cabinet base or top',(0,0,z),(w-30,d,16),M['enamel'],2)
    B('Separate rear sheet',(0,d/2-5,(z0+top)/2),(w-30,10,top-z0-16),M['enamel'],1)
    for z in ([500,970,1440] if kind=='tall-cabinet' else [250]):
        B('Editable internal adjustable shelf',(0,10,z),(w-40,d-40,15),M['steel'],1)
    if kind=='drawer-base':
        laminate('Maple worktop',w,d,h-19,38,M)
        heights=[110,135,155,180,220];z=z0+18
        for i,hh in enumerate(reversed(heights)):
            B('Graduated drawer folded face %d'%i,(0,-d/2-3,z+hh/2),(w-32,18,hh-7),M['enamel'],3)
            B('Drawer inset panel %d'%i,(0,-d/2-14,z+hh/2),(w-58,3,hh-30),M['enamel'],2)
            handle('Full-width aluminium drawer pull',0,-d/2-33,z+hh-26,w-100,M)
            z+=hh
        C('Drawer lock barrel',(w/2-47,-d/2-16,top-27),8,5,M['steel'],axis='Y',s=20)
    elif kind=='wall-cabinet':
        B('Lift-up ribbed door',(0,-d/2-3,h/2),(w-30,18,h-24),M['enamel'],3)
        for z in [170,290,410]:B('Pressed horizontal door reinforcement',(0,-d/2-14,z),(w-83,3,15),M['enamel'],2)
        handle('Lower lift-up pull',0,-d/2-36,80,220,M)
        for x in [-w*.29,w*.29]:B('Rear wall suspension cleat',(x,d/2+5,h-65),(145,14,60),M['steel'],2)
        for x in [-w*.35,w*.35]:C('Top hinge barrel',(x,-d/2+6,h-13),7,74,M['steel'],axis='X',s=12)
    else:
        for sign in [-1,1]:
            x=sign*w*.247
            B('Separate full-height locker leaf',(x,-d/2-4,(z0+top)/2),(w/2-20,18,top-z0-28),M['enamel'],3)
            B('Recessed locker panel',(x,-d/2-15,(z0+top)/2),(w/2-62,3,top-z0-95),M['enamel'],2)
            for z in [240,h-185]:grill('Locker ventilation',x,-d/2-19,z,w/2-110,82,M,6)
            tube('Vertical steel cabinet pull',[(sign*33,-d/2-15,990),(sign*33,-d/2-44,990),(sign*33,-d/2-44,1230),(sign*33,-d/2-15,1230)],7,M['steel'],8)
            for z in [300,980,1680]:C('External hinge knuckle',(sign*(w/2-17),-d/2+4,z),6,72,M['steel'],s=12)
        C('Lock barrel',(53,-d/2-17,1170),8,5,M['steel'],axis='Y',s=20)


def workbench(kind,M):
    if kind=='folding-wall-bench':
        laminate('Fold-down maple top',1041,610,411,38,M)
        for x in [-360,360]:
            B('Wall bracket vertical',(x,288,210),(38,28,420),M['dark'],2)
            B('Top bracket arm',(x,-5,382),(35,570,20),M['dark'],2)
            beam('Locked folding diagonal',(x,280,70),(x,-230,376),25,17,M['steel'],2)
            for y,z in [(283,77),(-227,372)]:C('Folding joint pivot',(x,y,z),9,47,M['steel'],axis='X',s=16)
            for z in [60,190,330]:bolt('Wall anchor',(x,270,z),M,5)
            C('Worktop hinge pin',(x,287,388),7,95,M['steel'],axis='X',s=16)
        return
    for x in [-820,820]:
        for y in [-242,242]:
            B('Square bench leg',(x,y,439),(55,55,790),M['enamel'],3)
            C('Leveling pad',(x,y,20),31,40,M['rubber'],s=20)
        B('Deep end stretcher',(x,0,207),(45,530,75),M['enamel'],2)
    B('Rear long stretcher',(0,250,400),(1640,36,68),M['enamel'],2)
    B('Lower folded shelf',(0,0,213),(1640,510,18),M['enamel'],2)
    laminate('Laminated full bench top',1830,635,873,54,M)
    for x in [-420,420]:
        B('Underbench drawer box',(x,-12,774),(805,516,132),M['dark'],2)
        B('Underbench drawer face',(x,-273,774),(805,18,126),M['enamel'],3)
        handle('Bench drawer pull',x,-304,790,480,M)
    for x in [-885,885]:B('Hutch upright',(x,276,1310),(45,45,980),M['enamel'],3)
    perforated('Full width perforated hutch',1720,710,0,267,1320,M,40)
    B('Hutch upper shelf',(0,233,1776),(1830,170,24),M['enamel'],2)
    B('Under-shelf light housing',(0,186,1749),(1120,40,20),M['dark'],2)
    B('Frosted task-light diffuser',(0,178,1737),(1080,29,5),M['white'],1)
    for x in [-884,884]:
        for z in [925,1360,1750]:bolt('Bench frame fixing',(x,250,z),M,6)


def service_cart(M):
    for x in [-325,325]:
        for y in [-170,170]:
            caster(x,y,0,M,43)
            B('Bolted angle cart upright',(x,y,510),(27,27,780),M['enamel'],2)
    for z in [170,480,850]:
        B('Pressed tray base',(0,0,z),(704,414,14),M['enamel'],2)
        for x in [-344,344]:B('Tray folded side',(x,0,z+24),(16,414,50),M['enamel'],2)
        for y in [-199,199]:B('Tray folded end',(0,y,z+24),(675,16,50),M['enamel'],2)
        for x in [-325,325]:
            for y in [-185,185]:bolt('Tray fastening',(x,y,z+14),M,5)
    tube('Service cart push handle',[(346,-148,835),(401,-148,835),(414,-128,835),(414,128,835),(401,148,835),(346,148,835)],12,M['dark'],10)
    for x in [-325,325]:B('Caster brake pedal',(x,-207,72),(30,45,7),M['steel'],2)


def stool(M):
    C('Gas-lift cylinder',(0,0,260),34,275,M['dark'],s=32)
    C('Polished telescopic post',(0,0,398),23,105,M['steel'],s=24)
    for i in range(5):
        a=i*math.tau/5;x,y=178*math.cos(a),178*math.sin(a)
        beam('Five-star stool base',(0,0,131),(x,y,64),28,23,M['steel'],3);caster(x,y,0,M,25)
    lathe('Dished underseat tool tray',[(38,140),(155,140),(177,151),(177,179),(171,179),(166,154),(38,150)],M['plastic'],48)
    C('Seat mounting pan',(0,0,439),175,20,M['dark'],s=48)
    lathe('Rounded tailored vinyl mechanic seat',[(0,439),(166,439),(181,445),(190,457),(189,476),(179,491),(165,496),(0,496)],M['rubber'],64)
    ring('Seat stitched welt',(0,0,485),185,2,M['dark'],steps=64)
    tube('Height release lever',[(24,0,424),(145,-40,420),(172,-45,423)],5,M['steel'],8)
    B('Lever fingertip grip',(177,-46,423),(43,24,12),M['plastic'],4)


def ceiling_rack(M):
    for x in [-1200,1200]:
        B('Rack boxed end beam',(x,0,28),(40,1220,56),M['enamel'],3)
        for y in [-590,590]:
            B('Suspension angle vertical',(x,y,360),(32,32,680),M['enamel'],2)
            B('Ceiling mounting plate',(x,y,693),(140,75,14),M['steel'],2)
            for dx in [-48,48]:bolt('Ceiling anchor',(x+dx,y,698),M,6,'Z')
            for z in range(160,640,100):bolt('Hanger adjustment bolt',(x,y-18,z),M,4)
    for y in [-590,590]:B('Rack boxed long beam',(0,y,28),(2440,40,56),M['enamel'],3)
    for x in range(-1100,1101,100):B('Welded wire deck cross rod',(x,0,57),(6,1180,6),M['steel'],0)
    for y in range(-500,501,100):B('Welded wire deck long rod',(0,y,63),(2380,6,6),M['steel'],0)
    for x in [-600,0,600]:B('Deck structural crossmember',(x,0,23),(26,1180,38),M['enamel'],2)


def wall_rack(kind,M):
    if kind=='tire-rack':
        for x in [-580,580]:
            B('Wall tire rack upright',(x,292,353),(44,30,706),M['enamel'],2)
            beam('Deep tire cradle arm',(x,285,180),(x,-317,180),35,28,M['steel'],2)
            beam('Triangular tire rack brace',(x,285,620),(x,-317,180),25,18,M['steel'],2)
            for z in [80,660]:bolt('Wall rack anchor',(x,272,z),M,6)
            C('Folding rack pivot',(x,285,180),11,60,M['steel'],axis='X',s=16)
        for y in [-300,215]:B('Tire supporting cross rail',(0,y,180),(1180,34,34),M['enamel'],3)
    else:
        for x in [-550,550]:
            B('Lumber rack drilled spine',(x,180,550),(40,35,1100),M['enamel'],2)
            for z in [75,260,445,630,815,1000]:
                B('Cantilever lumber arm',(x,-4,z),(38,400,32),M['enamel'],2)
                beam('Arm root gusset',(x,162,z-65),(x,35,z-18),18,20,M['steel'],1)
                B('Raised end retaining stop',(x,-195,z+25),(41,14,53),M['yellow'],2)
                bolt('Arm through bolt',(x,159,z),M,5)


def tool_rack(kind,M):
    if kind=='long-tool-stand':
        for x in [-290,290]:
            for y in [-188,188]:B('Tool stand square post',(x,y,425),(33,33,850),M['enamel'],2)
        for z in [28,790]:
            for x in [-290,290]:B('Tool stand side rail',(x,0,z),(33,410,30),M['enamel'],2)
            for y in [-188,188]:B('Tool stand cross rail',(0,y,z),(610,33,30),M['enamel'],2)
        B('Base drip tray',(0,0,36),(550,345,12),M['plastic'],2)
        for x in [-190,-95,0,95,190]:B('Tool separator rail',(x,0,790),(12,350,22),M['enamel'],2)
        B('Center shaft divider',(0,0,791),(570,12,22),M['enamel'],2)
        for x in [-220,-110,0,110,220]:B('Bottom tool well divider',(x,0,68),(8,343,54),M['plastic'],1)
    elif kind=='hook-rail':
        B('Continuous wall rail',(0,79,112),(1220,27,91),M['steel'],3)
        for z in [73,151]:B('Extruded rail retaining lip',(0,60,z),(1220,18,8),M['dark'],1)
        for x in [-490,-170,170,490]:
            B('Clip-on hook base',(x,40,107),(86,36,113),M['plastic'],5)
            for dx in [-26,26]:tube('Vinyl-coated storage hook',[(x+dx,28,94),(x+dx,-87,44),(x+dx,-102,54),(x+dx,-102,85)],8,M['rubber'],10)
        for x in [-570,-285,285,570]:bolt('Wall rail anchor',(x,59,113),M,5)
    else:pegboard(M)


def hammer(x,y,z,M,scale=1):
    beam('Hickory hammer handle',(x,y,z),(x,y,z+230*scale),22*scale,18*scale,M['wood'],3)
    B('Forged hammer head',(x-11*scale,y,z+245*scale),(113*scale,32*scale,36*scale),M['steel'],5)
    for dx in [-9,9]:beam('Separated curved hammer claw',(x+35*scale,y+dx*scale,z+245*scale),(x+72*scale,y+dx*scale,z+218*scale),14*scale,8*scale,M['steel'],1)


def spanner(x,y,z,M,length=230):
    B('Spanner tapered stem',(x,y,z+length/2),(16,6,length-48),M['steel'],3)
    for zz,r in [(z+20,19),(z+length-20,24)]:
        ring('Open-center spanner head',(x,y,zz),r,6,M['steel'],axis='Y',steps=20)


def pegboard(M):
    for x in [-203.25,203.25]:perforated('Separate steel peg panel',403,813,x,47,406.5,M,25.4)
    for x in [-372,0,372]:
        for z in [38,406,776]:bolt('Pegboard stand-off fixing',(x,44,z),M,4)
    hammer(-273,-27,230,M,1.35)
    for x,l in [(-92,260),(7,220),(95,175)]:spanner(x,-23,377,M,l)
    for x in [205,270,335]:
        C('Screwdriver forged shaft',(x,-27,345),3,220,M['steel'],s=12)
        C('Screwdriver molded grip',(x,-27,516),13,111,M['yellow'],s=16)
        for j in range(4):B('Driver grip rib',(x-10+j*6.7,-39,516),(2,3,91),M['dark'],.5)
    for x,z in [(-273,570),(-92,652),(7,612),(95,567)]:
        tube('Individual removable peg hook',[(x,45,z),(x,8,z),(x,-19,z-10),(x,-20,z-35)],3,M['steel'],6)
    for x in [205,270,335]:
        tube('Screwdriver support fork',[(x-10,45,458),(x-10,-40,458),(x+10,-40,458),(x+10,45,458)],3,M['steel'],6)
    # Pliers below the short spanners: real separated handles and jaws.
    for sign in [-1,1]:
        beam('Pliers grip',(sign*37,-27,90),(sign*15,-27,220),15,15,M['red'],4)
        beam('Pliers forged jaw',(sign*15,-27,220),(sign*9,-27,275),13,10,M['steel'],2)
    C('Pliers hinge',(0,-32,225),13,16,M['steel'],axis='Y',s=16)
    for x in [-18,18]:tube('Pliers supporting peg',[(x,45,231),(x,-29,231),(x,-38,237)],3,M['steel'],6)
    B('Pegboard small parts ledge',(251,-26,130),(230,129,9),M['enamel'],2)
    B('Parts ledge front lip',(251,-87,149),(230,7,44),M['enamel'],2)


def parts_bins(M):
    for x in [-338,338]:B('Hardware rack upright',(x,74,450),(24,30,900),M['enamel'],2)
    for z in [20,892]:B('Hardware rack crossmember',(0,74,z),(700,30,16),M['enamel'],1)
    for y in [-96,88]:B('Stable rack floor foot',(0,y,12),(700,22,24),M['dark'],2)
    for row in range(6):
        z=46+row*141
        B('Bin carrier channel',(0,80,z+78),(674,25,28),M['steel'],1)
        for col in range(4):
            x=-252+col*168
            # Hollow square bin: low front affords a real visible interior.
            B('Bin bottom',(x,-13,z),(155,222,7),M['blue'],2)
            for dx in [-74,74]:B('Bin sidewall',(x+dx,-13,z+48),(7,222,99),M['blue'],2)
            B('Bin back wall',(x,95,z+48),(148,7,99),M['blue'],2)
            B('Low open-front bin lip',(x,-121,z+26),(148,7,51),M['blue'],2)
            B('Recessed label card holder',(x,-126,z+30),(89,3,26),M['dark'],1)
            B('Blank stock label',(x,-128,z+30),(76,1,17),M['white'],0)


def cases(M):
    for x in [-232,232]:wheel('Toolcase transport wheel',x,130,97,95,48,M)
    B('Rolling bottom case',(0,0,284),(533,418,360),M['red'],12)
    for z,h in [(575,195),(810,215)]:B('Separate modular tool case',(0,0,z),(533,418,h),M['red'],10)
    for z in [466,676,919]:
        B('Reinforced separate toolbox lid',(0,0,z),(548,437,24),M['plastic'],7)
        for x in [-170,-50,70,190]:B('Interlocking lid cleat',(x,0,z+18),(65,327,13),M['plastic'],3)
        for x in [-183,183]:
            B('Metal clasp body',(x,-225,z-35),(44,17,61),M['steel'],3)
            B('Clasp grip',(x,-237,z-36),(42,14,23),M['plastic'],3)
    for x in [-255,255]:
        for y in [-194,194]:
            C('Corner reinforcing rod',(x,y,531),10,784,M['steel'],s=12)
            for z in [145,420,718,895]:B('Impact corner bumper',(x,y,z),(27,36,76),M['plastic'],5)
    for x in [-181,181]:
        B('Telescopic handle outer rail',(x,217,485),(33,31,765),M['plastic'],3)
        B('Telescopic polished inner rail',(x,220,903),(20,20,280),M['steel'],2)
    B('Transport top handle',(0,220,1040),(400,40,39),M['plastic'],9)


def tote(M):
    cavity('Clear tapered hollow storage tub',(0,0,6),586,388,315,M['clear'],exponent=6,wall=6)
    B('Removable reinforced tote lid',(0,0,330),(610,410,24),M['plastic'],12)
    for x in [-240,-160,-80,0,80,160,240]:B('Lid stiffening rib',(x,0,345),(9,338,11),M['plastic'],2)
    for sign in [-1,1]:
        B('Recessed side carry grip',(sign*289,0,283),(7,142,40),M['dark'],6)
        for x in [-210,210]:
            B('Tote snap latch',(x,sign*202,323),(59,15,62),M['blue'],4)
            C('Latch pivot',(x,sign*202,343),5,59,M['steel'],axis='X',s=12)


def ladder(M):
    # Stored horizontally: full-size compact ladder, not a shrunken standing one.
    for section in range(3):
        y=0;z=37+section*56;length=2480-section*90;width=410-section*48
        for side in [-1,1]:
            B('Extension ladder hollow side rail',(0,y+side*width/2,z),(length,31,57),M['steel'],2)
            for zz in [-23,23]:B('Rail longitudinal ridge',(0,y+side*width/2,z+zz),(length,34,3),M['steel'],0)
        for j in range(9):
            x=-1100+j*275
            B('Flattened D-section ladder rung',(x,y,z),(35,width-8,27),M['steel'],3)
            for xx in [-10,0,10]:B('Rung traction rib',(x+xx,y,z+14),(2,width-14,2),M['dark'],0)
        for x in [-length/2,length/2]:
            for side in [-1,1]:B('Ladder rail end shoe',(x,y+side*width/2,z),(28,40,67),M['rubber'],4)
    for x in [-880,760]:
        B('Stored ladder wall hook back',(x,240,85),(67,22,170),M['enamel'],3)
        tube('Deep coated ladder storage hook',[(x,231,17),(x,-230,17),(x,-244,35),(x,-244,67)],10,M['rubber'],8)
    C('Extension rope pulley',(1000,0,151),24,14,M['plastic'],axis='Y',s=20)
    tube('Stored lifting rope',[(-885,-17,166),(997,-17,166),(1020,-17,150),(1001,-17,127),(-877,-17,127)],3,M['cream'],6)
    for x in [-710,665]:B('Fly-section rung lock',(x,-35,119),(59,43,36),M['dark'],4)


def arc_shell(name,p,r,inner,thick,mat,start=0,end=math.tau,axis='X',steps=40):
    """Actual annular guard or partial shroud, open in its uncovered sector."""
    vs=[]
    for side in [-thick/2,thick/2]:
        for rr in [inner,r]:
            for i in range(steps+1):
                a=start+(end-start)*i/steps;u=rr*math.cos(a);v=rr*math.sin(a)
                vs.append((p[0]+(side if axis=='X' else u),p[1]+(u if axis=='X' else side),p[2]+v))
    n=steps+1;fs=[]
    for i in range(steps):
        fs.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),
            (i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
    fs += [(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)]
    return mesh(name,vs,fs,mat)


def gauge(name,x,y,z,r,M,value=''):
    C(name+' rolled bezel',(x,y,z),r,8,M['steel'],axis='Y',s=28)
    C(name+' ivory dial',(x,y-4.5,z),r-3,1,M['white'],axis='Y',s=28)
    for i in range(9):
        a=math.pi*.15+i*math.pi*.7/4
        tube(name+' dial tick',[(x+math.cos(a)*(r-7),y-5.5,z+math.sin(a)*(r-7)),(x+math.cos(a)*(r-4),y-5.5,z+math.sin(a)*(r-4))],.6,M['dark'],4)
    tube(name+' needle',[(x,y-6,z),(x-r*.36,y-6,z+r*.56)],.7,M['red'],4)
    if value:text(name+' marking',value,(x,y-6,z-r*.32),r*.27,M['dark'])


def battery(name,x,y,z,M,w=70,d=90,h=48):
    B(name+' slide battery case',(x,y,z+h/2),(w,d,h),M['plastic'],6)
    B(name+' battery release button',(x,y-d/2-2,z+h*.65),(w*.48,8,h*.26),M['red'],2)
    for xx in [-w*.28,w*.28]:B(name+' contact rail',(x+xx,y,z+h+3),(8,d*.7,6),M['steel'],1)
    for i in range(4):B(name+' charge indicator',(x-w*.22+i*w*.15,y-d/2-6,z+h*.35),(w*.10,2,3),M['light'],.5)


def drill(M):
    battery('Drill',0,3,0,M,80,92,49)
    beam('Angled rubberized drill grip',(0,0,52),(0,22,149),50,46,M['rubber'],9)
    for z in [71,88,105,122]:B('Grip molded traction rib',(0,-24,z),(37,3,4),M['plastic'],1)
    C('Vented drill motor barrel',(0,13,187),40,126,M['yellow'],axis='Y',s=28)
    C('Clutch setting collar',(0,-71,187),35,35,M['dark'],axis='Y',s=32)
    C('Machined rotating chuck',(0,-105,187),25,37,M['steel'],axis='Y',s=28,r2=16)
    C('Centered drill bit',(0,-143,187),3,37,M['steel'],axis='Y',s=12)
    for i in range(14):
        a=i*math.tau/14;B('Clutch knurl',(32*math.cos(a),-72,187+32*math.sin(a)),(5,30,5),M['plastic'],1)
    B('Finger trigger',(0,-28,145),(27,22,24),M['plastic'],5)
    B('Forward reverse selector',(0,0,164),(62,12,10),M['dark'],2)
    B('Top two-speed switch',(0,20,228),(28,30,9),M['dark'],2)
    for x in [-40,40]:
        for y in [22,33,44,55]:B('Motor ventilation slot',(x,y,185),(3,4,30),M['dark'],1)
    C('Separate ventilated motor end cap',(0,79,187),39,8,M['plastic'],axis='Y',s=28)
    for x in [-23,-12,0,12,23]:B('Motor end cap cooling rib',(x,84,187),(5,3,47-abs(x)*.65),M['yellow'],1)
    C('Driver work light',(0,-27,120),5,3,M['white'],axis='Y',s=16)
    bpy.context.scene['household_support_center_mm']=[0,3,0]
    bpy.context.scene['household_support_footprint_mm']=[80,92]


def sawblade(name,x,y,z,r,M,axis='X'):
    C(name+' steel blade',(x,y,z),r,2,M['steel'],axis=axis,s=64)
    C(name+' arbor flange',(x,y,z),r*.15,12,M['dark'],axis=axis,s=20)
    for i in range(36):
        a=i*math.tau/36;u,v=r*math.cos(a),r*math.sin(a)
        if axis=='X':p=(x,y+u,z+v);o=B(name+' carbide tooth',p,(3,r*.055,r*.065),M['steel'],0);o.rotation_euler.x=a
        else:p=(x+u,y,z+v);o=B(name+' carbide tooth',p,(r*.055,3,r*.065),M['steel'],0);o.rotation_euler.y=-a


def circular_saw(M):
    B('Stamped saw shoe',(0,0,6),(218,323,12),M['steel'],3)
    B('Separate shoe throat',(0,0,13),(10,253,2),M['dark'],0)
    sawblade('Circular saw',-36,0,111,91,M)
    arc_shell('Upper blade guard',(-42,0,111),103,91,43,M['yellow'],0,math.pi,steps=28)
    arc_shell('Retracted lower blade guard',(-44,0,111),96,87,13,M['steel'],math.pi*.83,math.pi*1.97,steps=28)
    C('Motor housing',(41,0,132),53,114,M['yellow'],axis='X',s=32)
    for y in range(-31,32,12):B('Motor intake slot',(101,y,135),(2,5,47),M['dark'],1)
    tube('Closed trigger handle',[(55,80,170),(55,88,215),(55,48,239),(55,-31,217),(55,-38,181)],15,M['rubber'],10)
    tube('Front assist handle',[(63,-70,169),(77,-89,191),(100,-83,193)],12,M['plastic'],10)
    battery('Saw',54,101,103,M,75,70,49)
    B('Bevel adjustment bracket',(-72,-138,51),(54,7,81),M['steel'],2)
    C('Bevel lock knob',(-73,-148,65),14,17,M['plastic'],axis='Y',s=16)
    tube('Guard return lever',[(-66,65,135),(-70,81,168),(-67,101,173)],5,M['dark'],8)
    for x in [-92,92]:bolt('Shoe fixing',(x,-141,16),M,4,'Z')
    bpy.context.scene['household_support_center_mm']=[0,0,0]
    bpy.context.scene['household_support_footprint_mm']=[218,323]


def miter_saw(M):
    B('Cast mitre base',(0,-45,39),(740,415,78),M['dark'],12)
    C('Rotating machined mitre table',(0,-65,77),230,18,M['steel'],s=64)
    B('Replaceable throat insert',(0,-129,89),(17,263,4),M['plastic'],1)
    for x in [-298,298]:
        B('Cast extension wing',(x,-44,75),(137,393,26),M['steel'],5)
        for y in [-168,42]:B('Extension wing groove',(x,y,90),(114,5,2),M['dark'],0)
    for x in [-194,194]:
        B('Split rear machined fence',(x,101,162),(340,22,152),M['steel'],4)
        for j in range(5):B('Fence extrusion ridge',(x,115,129+j*23),(320,8,6),M['dark'],1)
    B('Rear slide casting',(0,266,194),(170,208,220),M['yellow'],14)
    for x in [-58,58]:C('Twin precision slide rail',(x,211,281),17,584,M['steel'],axis='Y',s=24)
    B('Blade-head pivot carriage',(0,18,286),(167,109,88),M['dark'],10)
    beam('Cast blade support arm',(0,18,284),(0,-101,362),71,62,M['yellow'],9)
    sawblade('Miter saw',-21,-100,325,151,M)
    arc_shell('Deep upper blade casing',(-33,-100,325),162,148,58,M['yellow'],0,math.pi,steps=36)
    arc_shell('Clear articulated lower guard',(-42,-100,325),157,142,21,M['glass'],math.pi,math.tau,steps=36)
    C('Saw motor barrel',(82,-99,345),57,155,M['yellow'],axis='X',s=32)
    tube('Overhead saw trigger grip',[(29,-190,425),(29,-211,505),(29,-150,539),(29,-40,488)],15,M['rubber'],10)
    B('Handle trigger',(29,-190,486),(25,31,18),M['red'],4)
    tube('Miter locking handle',[(0,-275,76),(0,-342,76)],14,M['dark'],12)
    C('Bevel lock pivot',(0,289,200),33,193,M['steel'],axis='X',s=24)
    B('Dust collection bag',(0,388,403),(109,163,142),M['rubber'],25)
    C('Dust outlet sleeve',(0,291,381),29,71,M['dark'],axis='Y',s=24)
    for x in [-282,282]:
        C('Workpiece clamp post',(x,76,190),8,218,M['steel'],s=16)
        B('Clamp top arm',(x,33,297),(22,112,18),M['steel'],2)
        C('Clamp pressure foot',(x,-5,193),24,8,M['rubber'],s=24)
        C('Clamp threaded shaft',(x,-5,254),5,126,M['steel'],s=12)
        B('Clamp wing handle',(x,-5,322),(63,17,11),M['dark'],3)


def table_saw(M):
    for x in [-330,330]:
        for sign in [-1,1]:
            beam('Foldable stand splayed leg',(x,sign*290,727),(x,sign*381,46 if sign<0 else 95),37,31,M['dark'],4)
        B('Stand upper end saddle',(x,0,766),(52,600,90),M['dark'],4)
        B('Stand cross brace',(x,0,390),(29,662,26),M['steel'],2)
    for y in [-290,290]:B('Upper bolted stand crossmember',(0,y,752),(660,38,42),M['dark'],3)
    for x in [-341,341]:wheel('Transport stand wheel',x,322,104,104,55,M)
    for x in [-332,332]:C('Rubber stand foot',(x,-376,29),34,58,M['rubber'],s=20)
    B('Saw motor lower case',(0,0,649),(568,460,265),M['yellow'],16)
    for x in [-292,292]:B('Impact-protecting side rib',(x,0,651),(24,474,277),M['plastic'],7)
    grill('Front motor ventilation',140,-239,654,201,106,M,8,M['yellow'])
    B('Paddle switch housing',(-179,-259,625),(101,45,110),M['dark'],7)
    B('Large stop paddle',(-179,-284,618),(72,11,69),M['red'],5)
    C('Depth adjustment handwheel',(0,-278,689),61,18,M['dark'],axis='Y',s=32)
    for i in range(3):
        a=i*math.tau/3;tube('Handwheel spoke',[(0,-290,689),(50*math.cos(a),-290,689+50*math.sin(a))],5,M['steel'],8)
    B('Machined cast table',(0,0,816),(670,556,27),M['steel'],3)
    for x in [-130,144]:B('T-slot recessed channel',(x,0,831),(10,535,2),M['dark'],0)
    B('Blade throat insert',(0,-28,832),(56,313,5),M['plastic'],2)
    sawblade('Table saw',0,0,756,127,M)
    B('Clear over-blade guard',(0,3,894),(45,281,69),M['glass'],14)
    B('Steel riving knife',(0,142,857),(5,57,115),M['steel'],2)
    for y in [-296,296]:B('Telescopic fence rail',(0,y,805),(950,31,39),M['dark'],3)
    B('Long straight rip fence',(230,0,872),(61,621,80),M['steel'],3)
    B('Fence locking lever',(230,-329,834),(27,53,73),M['dark'],4)
    for x in range(-410,430,35):B('Rack adjustment tooth',(x,-312,803),(15,5,5),M['steel'],0)
    tube('Transport lift handle',[(-240,-285,743),(-240,-390,680),(240,-390,680),(240,-285,743)],14,M['dark'],10)


def drill_press(M):
    B('Heavy cast drill-press foot',(0,0,28),(350,460,56),M['dark'],12)
    for x in [-82,82]:B('Base fixing T-slot',(x,-49,58),(17,220,4),M['steel'],2)
    C('Bolted column flange',(0,146,73),68,38,M['steel'],s=32)
    C('Ground steel column',(0,146,415),31,675,M['steel'],s=32)
    for z in range(149,657,21):B('Table lift rack tooth',(34,146,z),(8,21,7),M['steel'],0)
    C('Height-adjustable table collar',(0,146,414),47,89,M['dark'],s=24)
    B('Cast table support arm',(0,53,430),(73,188,54),M['dark'],6)
    B('Slotted drill worktable',(0,-61,448),(295,286,26),M['steel'],8)
    for x in [-81,0,81]:B('Drill table open slot',(x,-61,462),(12,203,2),M['dark'],1)
    B('Head casting',(0,48,742),(191,346,96),M['red'],15)
    B('Separate upper belt cover',(0,50,814),(207,372,112),M['plastic'],20)
    C('Rear electric motor',(0,240,710),67,199,M['dark'],s=32)
    for i in range(12):
        a=i*math.tau/12;B('Motor cooling fin',(63*math.cos(a),240+63*math.sin(a),710),(4,4,160),M['dark'],0)
    C('Spindle quill',(0,-73,661),28,141,M['steel'],s=28)
    C('Keyed drill chuck',(0,-73,574),29,50,M['dark'],s=24,r2=18)
    C('Stationary drill bit',(0,-73,513),4,77,M['steel'],s=12)
    C('Feed lever hub',(117,-27,735),30,51,M['steel'],axis='X',s=24)
    for a in [-.8,1.2,3.2]:
        end=(159,-27+149*math.cos(a),735+149*math.sin(a))
        tube('Three-arm feed lever',[(143,-27,735),end],7,M['steel'],8)
        C('Feed lever rounded grip',end,17,38,M['rubber'],axis='X',s=16)
    B('Drill press front switch',(0,-131,744),(63,15,44),M['dark'],4)
    B('Drill stop button',(0,-141,744),(35,9,24),M['red'],3)
    for x in [-78,78]:bolt('Head cover screw',(x,-131,818),M,4)


def grinder(M):
    B('Cast grinder base',(0,0,31),(230,177,62),M['dark'],12)
    C('Central grinder motor',(0,15,160),63,199,M['yellow'],axis='X',s=32)
    for x in range(-78,80,14):ring('Motor cooling fin',(x,15,160),64,2,M['dark'],axis='X',steps=24)
    for sign in [-1,1]:
        x=sign*142
        C('Vitrified abrasive wheel',(x,0,162),76,21,M['grit'],axis='X',s=48)
        arc_shell('Deep safety wheel casing',(x,0,162),87,75,42,M['dark'],-math.pi*.1,math.pi*1.28,steps=30)
        C('Wheel retaining flange',(x+sign*16,0,162),24,6,M['steel'],axis='X',s=20)
        B('Adjustable tool rest',(x,-86,126),(65,76,10),M['steel'],2)
        B('Tool rest supporting bracket',(x,-48,102),(13,63,43),M['dark'],2)
        beam('Clear shield mounting arm',(x,-9,239),(x,-70,274),12,8,M['steel'],1)
        shield=B('Separate clear eye shield',(x,-86,258),(93,6,79),M['glass'],3);shield.rotation_euler.x=-.27
        C('Shield tilt knob',(x+sign*50,-74,278),8,10,M['dark'],axis='X',s=12)
    B('Sealed grinder switch',(0,-93,48),(63,15,28),M['red'],3)
    for x in [-77,77]:bolt('Grinder base fixing',(x,44,66),M,6,'Z')


def vise(M):
    C('Swivelling vise base',(0,23,18),88,36,M['dark'],s=40)
    C('Swivel graduated ring',(0,23,38),81,7,M['steel'],s=40)
    B('Fixed cast vise body',(0,12,103),(152,192,126),M['enamel'],13)
    B('Rear anvil',(0,82,174),(112,81,13),M['steel'],3)
    B('Square sliding jaw beam',(0,-119,97),(74,260,45),M['steel'],3)
    B('Moving jaw casting',(0,-184,140),(149,43,94),M['enamel'],9)
    for y in [-156,-31]:
        B('Replaceable serrated jaw',(0,y,187),(156,12,36),M['steel'],2)
        for x in range(-68,69,10):B('Jaw machined serration',(x,y+(-7 if y==-31 else 7),188),(2,2,30),M['dark'],0)
    C('Lead screw boss',(0,-209,93),23,44,M['dark'],axis='Y',s=24)
    C('Sliding screw handle',(0,-237,93),8,175,M['steel'],axis='X',s=16)
    for x in [-90,90]:C('Handle retaining ball end',(x,-237,93),12,15,M['steel'],axis='X',s=16)
    for x in [-69,69]:C('Swivel base fixing',(x,22,46),9,14,M['steel'],s=6)
    tube('Swivel lock lever',[(80,29,37),(111,23,42),(133,-6,42)],6,M['dark'],8)


def compressor(M):
    lathe('Pressed pancake receiver',[(0,62),(159,62),(204,92),(224,138),(228,220),(212,261),(178,284),(0,284)],M['red'],64)
    ring('Welded receiver mid seam',(0,0,211),227,3,M['red'],steps=64)
    for a in [-.5,1.6,3.6]:
        x,y=159*math.cos(a),159*math.sin(a)
        B('Tank welded foot bracket',(x,y,48),(56,44,74),M['red'],4)
        C('Rubber tank isolation foot',(x,y,14),30,28,M['rubber'],s=20)
    B('Oil-free pump protective cover',(0,31,370),(237,267,171),M['plastic'],20)
    grill('Motor front cooling',0,-108,373,165,82,M,7,M['plastic'])
    tube('Compressor carry loop',[(-88,34,422),(-89,34,497),(89,34,497),(88,34,422)],15,M['plastic'],10)
    B('Front regulator manifold',(0,-135,305),(220,65,52),M['dark'],5)
    for x in [-59,59]:gauge('Tank and regulated pressure',x,-177,340,28,M,'PSI')
    C('Regulator thumb dial',(0,-179,288),21,37,M['plastic'],axis='Y',s=20)
    for x in [-81,81]:
        C('Quick-connect pneumatic coupling',(x,-184,279),11,47,M['brass'],axis='Y',s=16)
        ring('Coupler locking sleeve',(x,-196,279),11,2,M['steel'],axis='Y',steps=16)
    tube('Copper pump transfer pipe',[(90,64,329),(139,62,324),(170,22,280),(164,-7,258)],7,M['brass'],8)
    B('On-off rocker',(87,-81,421),(27,18,21),M['red'],3)
    C('Lower drain petcock',(0,-166,64),8,27,M['brass'],axis='Y',s=12)


def pressure_washer(M):
    for x in [-160,160]:wheel('Pressure washer wheel',x,76,118,117,58,M)
    for x in [-154,154]:
        tube('Protective tubular trolley frame',[(x,-170,31),(x,85,81),(x,102,660),(x,93,850)],14,M['dark'],10)
    tube('Washer upper push handle',[(-154,93,850),(-139,93,879),(139,93,879),(154,93,850)],19,M['rubber'],10)
    B('Pump motor housing',(0,-8,338),(260,235,364),M['green'],28)
    grill('Motor intake',0,-131,388,178,136,M,10,M['plastic'])
    C('Pump pressure selector',(0,-140,503),29,11,M['dark'],axis='Y',s=24)
    B('Detergent tank',(0,-34,185),(206,169,124),M['white'],17)
    C('Detergent screw cap',(56,-47,257),17,12,M['dark'],s=20)
    for x in [-166,166]:C('Brass water coupling',(x,-5,278),12,38,M['brass'],axis='X',s=16)
    for i in range(5):
        ring('Stored pressure hose coil',(0,143-i*11,570),120,5,M['rubber'],axis='Y',steps=36)
    tube('Stowed spray lance',[(182,-83,102),(182,-83,668),(159,-83,716)],6,M['steel'],8)
    tube('Spray pistol closed grip',[(159,-83,708),(177,-83,805),(143,-83,827),(127,-83,744),(159,-83,708)],13,M['plastic'],8)
    B('Spray pistol trigger',(151,-84,765),(12,18,48),M['red'],3)
    B('Quick-change nozzle carrier',(0,-71,568),(205,37,14),M['plastic'],4)
    for x in [-78,78]:beam('Nozzle carrier support',(x,-71,561),(x,-71,509),16,18,M['dark'],2)
    for x in [-78,-26,26,78]:C('Separate quick-change nozzle',(x,-71,585),9,31,M['brass'],s=12)


def generator(M):
    for x in [-189,189]:
        for y in [-99,99]:B('Generator isolation foot',(x,y,13),(63,52,26),M['rubber'],7)
    B('Sculpted inverter generator shell',(0,0,210),(489,275,337),M['red'],40)
    B('Separate lower generator frame',(0,0,45),(496,281,55),M['plastic'],15)
    B('Removable service cover',(133,-140,201),(187,9,230),M['red'],14)
    for x in [63,201]:
        for z in [103,297]:screw('Captive cover screw',(x,-146,z),M,4)
    B('Recessed generator control face',(-121,-143,209),(173,10,216),M['dark'],11)
    for x in [-155,-87]:
        B('Weatherproof outlet surround',(x,-151,189),(46,8,65),M['plastic'],4)
        for z in [176,204]:
            for xx in [-8,8]:B('Actual-looking outlet contact recess',(x+xx,-156,z),(3,1,10),M['dark'],0)
    C('Generator control selector',(-122,-154,274),22,10,M['plastic'],axis='Y',s=24)
    for x in [-154,-119,-84]:C('Generator status lens',(x,-155,312),4,2,M['light'],axis='Y',s=12)
    C('Fuel filler cap',(78,0,388),36,16,M['dark'],s=32)
    tube('Integral carrying handle',[(-174,0,359),(-145,0,409),(-55,0,409),(-26,0,359)],17,M['plastic'],12)
    grill('Rear cooling grille',28,143,202,337,214,M,14,M['plastic'],face=1)
    C('Recoil starter boss',(-239,0,211),57,18,M['dark'],axis='X',s=32)
    B('Recoil pull handle',(-247,-9,287),(15,85,29),M['plastic'],8)


def cyclone(M):
    for x in [-272,272]:
        for y in [-166,166]:caster(x,y,0,M,30)
    B('Shared wheeled separator platform',(0,0,87),(650,460,30),M['wood'],4)
    lathe('Collection drum',[ (0,104),(150,104),(169,132),(176,474),(181,484),(181,502),(0,502)],M['cream'],48,(-126,0,0))
    for z in [180,376]:ring('Drum strengthening rib',(-126,0,z),174,3,M['cream'],steps=48)
    C('Removable drum lid',(-126,0,512),187,22,M['plastic'],s=48)
    for a in [0,math.pi/2,math.pi,math.pi*1.5]:
        x,y=-126+183*math.cos(a),183*math.sin(a);B('Drum lid toggle latch',(x,y,500),(16,22,47),M['steel'],2)
    lathe('Tapered real cyclone shell',[(43,526),(43,566),(103,760),(103,865),(48,865),(48,904),(39,904),(39,846),(95,846),(95,762),(35,568),(35,526)],M['yellow'],48,(-126,0,0))
    C('Cyclone tangential inlet',(-34,-98,800),26,116,M['yellow'],axis='X',s=24)
    ring('Cyclone inlet rolled lip',(26,-98,800),26,3,M['dark'],axis='X',steps=24)
    B('Compact extraction motor base',(193,24,174),(178,279,144),M['plastic'],17)
    C('Pleated motor filter canister',(193,32,403),91,319,M['cream'],s=40)
    for i in range(24):
        a=i*math.tau/24;tube('Filter vertical pleat',[(193+92*math.cos(a),32+92*math.sin(a),255),(193+92*math.cos(a),32+92*math.sin(a),553)],3,M['white'],4)
    C('Extractor head',(193,32,593),98,74,M['dark'],s=40)
    tube('Connected overhead dust hose',[(-126,0,899),(-126,0,1029),(-97,0,1067),(155,0,1067),(193,13,1033),(193,32,633)],24,M['rubber'],12)
    for z in [954,982,1010]:ring('Corrugated hose end band',(-126,0,z),25,2,M['dark'],steps=24)
    for z in [690,745,800,855,910]:ring('Extraction hose rib',(193,32,z),25,2,M['dark'],steps=24)


def welding_cart(M):
    for x in [-198,198]:wheel('Welding cart rear wheel',x,262,95,93,42,M)
    for x in [-175,175]:caster(x,-284,0,M,36)
    for z,w,d,y in [(111,432,725,24),(411,421,478,-92),(766,417,456,-101)]:
        B('Folded welding cart shelf',(0,y,z),(w,d,12),M['dark'],2)
        for x in [-w/2+7,w/2-7]:B('Raised shelf side lip',(x,y,z+27),(14,d,54),M['dark'],2)
    for x in [-190,190]:
        for y in [-292,126]:B('Cart angle upright',(x,y,475),(23,23,735),M['dark'],2)
    B('Inverter welder enclosure',(0,-94,889),(362,412,227),M['red'],12)
    B('Welder front control panel',(0,-307,889),(335,13,198),M['plastic'],8)
    grill('Welder cooling',0,-316,841,277,80,M,6,M['plastic'])
    for x in [-93,93]:
        C('Welder parameter knob',(x,-324,930),27,15,M['dark'],axis='Y',s=24)
        B('Original static welder scale',(x,-333,962),(28,1,2),M['white'],0)
    B('Welder carry handle',(0,-67,1018),(215,35,23),M['plastic'],7)
    for x in [-86,86]:B('Handle standoff',(x,-67,998),(22,29,36),M['plastic'],3)
    lathe('Stored shield-gas cylinder',[(0,115),(86,115),(93,130),(93,860),(80,904),(42,932),(30,947),(0,947)],M['enamel'],40,(0,282,0))
    C('Closed cylinder protective cap',(0,282,1004),45,116,M['dark'],s=28)
    for z in [458,820]:
        tube('Cylinder restraint strap',[(-145,127,z),(-97,245,z),(-69,362,z),(69,362,z),(97,245,z),(145,127,z)],5,M['steel'],8)
    for i in range(4):ring('Stored welding lead',(221+i*13,-50,652),127,6,M['rubber'],axis='X',steps=32)
    tube('Trolley push handle',[(-190,112,835),(-190,147,905),(190,147,905),(190,112,835)],13,M['dark'],10)
    B('Welding torch grip',(234,-168,615),(27,39,125),M['rubber'],7)
    tube('Stored torch neck',[(234,-169,677),(234,-180,723),(234,-216,738)],8,M['steel'],8)


def charger(M):
    B('Four-port charging dock',(0,0,38),(480,198,76),M['red'],9)
    for i in range(4):
        x=-176+i*117
        B('Dock contact cradle',(x,15,83),(99,133,17),M['plastic'],4)
        battery('Dock battery %d'%i,x,15,91,M,86,111,57)
        C('Dock status LED',(x,-69,77),4,3,M['light'],s=12)
        for dx in [-27,-9,9,27]:B('Dock cooling vent',(x+dx,-100,44),(6,2,27),M['dark'],1)
    tube('Dock short stored mains lead',[(233,65,31),(250,75,31),(248,107,24),(201,108,24)],4,M['rubber'],6)


def reel(kind,M):
    air=kind=='air-hose-reel';r=165 if air else 141;depth=145 if air else 174
    color=M['red'] if air else M['enamel'];cord=M['blue'] if air else M['yellow']
    B('Wall reel swivel mounting plate',(0,depth/2+43,r),(104,18,290),M['dark'],3)
    for z in [r-115,r+115]:bolt('Reel wall anchor',(0,depth/2+31,z),M,7)
    B('Reel supporting cantilever',(0,depth/2+9,r),(66,83,59),M['steel'],4)
    for y in [-depth/2,depth/2]:
        C('Separate formed spool side',(0,y,r),r,11,color,axis='Y',s=48)
        ring('Raised drum edge',(0,y+(-6 if y<0 else 6),r),r-9,4,color,axis='Y',steps=48)
    C('Reel inner hub',(0,0,r),57,depth,M['dark'],axis='Y',s=32)
    for i in range(10):
        y=-depth/2+17+i*(depth-34)/9
        ring('Stored hose winding',(0,y,r),109 if air else 97,6,cord,axis='Y',steps=32)
    C('Central reel axle',(0,-depth/2-10,r),29,24,M['steel'],axis='Y',s=24)
    for x in [-92,92]:beam('Hose guide support',(x,-depth/2-2,r+85),(x,-depth/2-40,r+139),18,14,M['steel'],2)
    B('Hose guide upper bridge',(0,-depth/2-41,r+141),(205,21,24),M['steel'],3)
    tube('Stowed reel lead',[(94,-depth/2-22,r+77),(132,-depth/2-24,r+19),(113,-depth/2-25,38),(71,-depth/2-26,17)],6,cord,8)
    if air:
        C('Brass pneumatic quick coupler',(54,-depth/2-26,17),11,40,M['brass'],axis='X',s=16)
    else:
        B('Grounded outlet block',(57,-depth/2-28,30),(63,31,69),M['plastic'],5)
        for z in [13,47]:
            for x in [46,61]:B('Outlet contact slot',(x,-depth/2-44,z),(3,1,8),M['dark'],0)


def floor_jack(M):
    outline=[(-359,55),(-358,92),(-252,110),(-40,165),(250,175),(309,118),(309,39),(-245,39)]
    for x in [-153,153]:
        o=polyxz('Profiled steel jack cheek',outline,0,14,M['red']);o.rotation_euler.z=math.pi/2;o.location.x=x
        wheel('Front jack roller',x,-286,38,36,26,M,tread=False)
        caster(x,224,0,M,31)
        for y,z in [(-187,101),(64,148),(226,112)]:bolt('Lift linkage crossbolt',(x-8,y,z),M,9,'X')
    C('Front axle tube',(0,-286,39),13,323,M['steel'],axis='X',s=16)
    B('Rear hydraulic pump chassis',(0,172,87),(242,197,91),M['dark'],8)
    for x in [-39,39]:
        C('Parallel hydraulic cylinder',(x,99,115),25,188,M['steel'],axis='Y',s=24)
        C('Polished piston rod',(x,-48,115),12,129,M['steel'],axis='Y',s=16)
    for x in [-81,81]:beam('Lowered lift arm',(x,181,131),(x,-226,112),37,38,M['red'],3)
    B('Saddle crossmember',(0,-226,114),(194,46,32),M['steel'],4)
    C('Round lifting saddle',(0,-231,142),57,19,M['steel'],s=32)
    C('Replaceable rubber saddle pad',(0,-231,155),51,8,M['rubber'],s=32)
    C('Handle yoke pivot',(0,276,149),24,149,M['steel'],axis='X',s=20)
    tube('Upright stowed pumping handle',[(0,276,150),(0,403,797),(0,459,1104)],15,M['steel'],12)
    tube('Rubber upper handle grip',[(0,419,887),(0,459,1104)],18,M['rubber'],12)
    B('Foot-operated pumping pedal',(97,274,171),(47,121,15),M['dark'],4)


def axle_stands(M):
    for cx in [-160,160]:
        for x in [-92,92]:
            for y in [-104,104]:
                beam('Splayed axle-stand leg',(cx+x,y,14),(cx+x*.22,y*.18,262),33,20,M['red'],2)
                B('Wide welded stand foot',(cx+x,y,7),(60,53,14),M['dark'],2)
        B('Stand front cross tie',(cx,-77,75),(183,14,28),M['red'],2)
        B('Stand rear cross tie',(cx,77,75),(183,14,28),M['red'],2)
        B('Ratcheting mast guide',(cx,0,245),(69,69,93),M['red'],5)
        B('Forged ratchet post',(cx,0,322),(43,41,196),M['dark'],3)
        for z in range(265,407,21):B('Separate ratchet tooth',(cx,-25,z),(42,14,11),M['steel'],1)
        B('Saddle web',(cx,0,423),(99,47,16),M['steel'],3)
        for x in [-44,44]:B('Upturned saddle end',(cx+x,0,435),(16,48,29),M['steel'],3)
        tube('Ratchet release pawl handle',[(cx+27,0,281),(cx+89,0,285),(cx+104,-12,274)],7,M['steel'],8)


def creeper(M):
    rounded_loop('Bent tubular creeper frame',436,964,48,56,M['dark'],16)
    for y in [-410,0,410]:
        B('Creeper frame crossmember',(0,y,57),(423,24,27),M['dark'],2)
        for x in [-207,207]:caster(x,y,0,M,23)
    for i,(y,d) in enumerate([(-325,231),(-63,251),(216,286)]):
        B('Separate tailored creeper pad %d'%i,(0,y,94),(379,d,43),M['rubber'],18)
        rounded_loop('Pad stitched edge',369,d-10,25,109,M['plastic'],1.5,y=y)
    B('Raised shaped headrest',(0,410,117),(325,174,47),M['red'],18)
    rounded_loop('Headrest stitched edge',309,158,25,137,M['dark'],1.4,y=410)


def tires(M):
    for j in range(4):
        z=110+j*220
        lathe('Open-center seasonal tire %d'%j,[(189,z-105),(243,z-110),(300,z-92),(323,z-64),(325,z+64),
          (300,z+92),(243,z+110),(189,z+105),(184,z+88),(194,z+81),(194,z-81),(184,z-88)],M['rubber'],48)
        for zz in [z-96,z+96]:ring('Sidewall molded shoulder rib',(0,0,zz),271,1.5,M['plastic'],steps=48)
        for zz in [z-103,z+103]:ring('Inner bead lip',(0,0,zz),190,3,M['rubber'],steps=48)
        for i in range(40):
            a=(i+(j%2)*.35)*math.tau/40
            for side in [-1,1]:
                o=B('Original directional tread block',(325*math.cos(a),325*math.sin(a),z+side*39),(6,37,67),M['rubber'],0)
                o.rotation_euler.z=a;o.rotation_euler.x=side*.17


def ev_charger(M):
    B('Wall charging box rear plate',(0,61,451),(181,24,289),M['dark'],16)
    B('Curved EV charging enclosure',(0,0,451),(180,132,284),M['plastic'],24)
    B('Independent front faceplate',(0,-72,476),(152,13,222),M['enamel'],21)
    ring('Static charger status ring',(0,-81,508),36,3,M['light'],axis='Y',steps=40)
    B('Recessed connector holster',(0,-93,377),(87,55,69),M['dark'],8)
    for i in range(5):
        ring('Stowed EV charging cable loop',(0,-10-i*13,242),185-i*3,7,M['rubber'],axis='Y',steps=40)
    tube('Cable connection to holster',[(151,-66,333),(123,-81,356),(48,-111,362),(20,-117,385)],8,M['rubber'],10)
    o=B('Docked EV connector grip',(0,-121,408),(58,55,102),M['plastic'],13);o.rotation_euler.x=-.18
    B('Connector release thumb latch',(0,-144,446),(21,11,38),M['dark'],3)
    tube('Bottom charging cable inlet',[(0,21,313),(-68,23,289),(-155,13,232)],8,M['rubber'],10)


def wall_fan(M):
    B('Shop fan wall fixing plate',(0,128,236),(160,25,398),M['dark'],4)
    for z in [66,416]:bolt('Fan wall anchor',(0,112,z),M,7)
    tube('Fan cantilever bracket',[(0,117,146),(0,56,99),(0,-36,112),(0,-36,191)],19,M['steel'],10)
    for sign in [-1,1]:
        tube('Adjustable fan yoke',[(0,-27,155),(sign*249,-27,166),(sign*259,-27,340)],14,M['dark'],10)
        C('Fan tilt pivot',(sign*262,-27,362),21,26,M['steel'],axis='X',s=20)
    C('Finned fan motor',(0,57,371),70,109,M['dark'],axis='Y',s=32)
    for i in range(5):
        a=i*math.tau/5
        points=[]
        for rr,aa,yy in [(45,a-.14,-32),(122,a-.23,-41),(234,a+.04,-7),(219,a+.42,9),(91,a+.49,-19)]:
            points.append((rr*math.cos(aa),yy,371+rr*math.sin(aa)))
        # Pitched formed metal blades, deliberately not flat radial cards.
        n=len(points);verts=points+[(x,y+4,z) for x,y,z in points]
        fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
        mesh('Pitch-formed fan blade',verts,fs,M['steel'])
    for r in [55,90,126,164,202,239,264]:ring('Concentric front fan guard',(0,-69+18*(r/264)**2,371),r,2.3,M['dark'],axis='Y',steps=48)
    for r in [96,173,243,266]:ring('Rear wire fan guard',(0,43,371),r,2,M['dark'],axis='Y',steps=40)
    for i in range(16):
        a=i*math.tau/16
        tube('Front radial guard spoke',[(41*math.cos(a),-72,371+41*math.sin(a)),(264*math.cos(a),-51,371+264*math.sin(a))],2,M['dark'],6)
    C('Guard hub cap',(0,-74,371),47,14,M['enamel'],axis='Y',s=32)
    tube('Speed-control pull cord',[(143,41,164),(157,39,15)],2,M['dark'],6)
    C('Pull cord end',(157,39,14),7,24,M['plastic'],s=12)


def shop_heater(M):
    B('Electric heater folded cabinet',(0,0,181),(350,345,340),M['enamel'],11)
    grill('Real open front heater louvers',0,-179,186,302,241,M,8,M['enamel'])
    for x in range(-120,121,30):B('Recessed element cage',(x,-162,183),(3,5,219),M['dark'],0)
    grill('Rear cooling intake',0,176,201,256,198,M,12,M['dark'],face=1)
    for sign in [-1,1]:
        B('Ceiling yoke side',(sign*190,0,302),(20,51,327),M['dark'],3)
        C('Heater aiming pivot',(sign*183,0,248),21,26,M['steel'],axis='X',s=20)
    B('Ceiling yoke crossbar',(0,0,464),(400,62,28),M['dark'],4)
    for x in [-140,140]:bolt('Yoke ceiling bolt',(x,0,480),M,7,'Z')
    C('Temperature selector',(126,-186,58),22,15,M['dark'],axis='Y',s=20)
    C('Power lens',(70,-184,59),5,3,M['light'],axis='Y',s=12)
    for x in [-156,156]:
        for z in [38,323]:screw('Heater cover fixing',(x,-176,z),M,4)


def utility_sink(M):
    for x in [-235,235]:
        for y in [-180,180]:
            beam('Pressed steel utility sink leg',(x*1.09,y*1.09,18),(x,y,589),29,29,M['steel'],2)
            B('Utility sink non-slip foot',(x*1.09,y*1.09,11),(43,43,22),M['rubber'],3)
    cavity('Genuinely deep utility tub',(0,-17,533),605,475,330,M['white'],exponent=5,wall=15)
    B('Self-draining rear faucet ledge',(0,231,850),(610,47,27),M['white'],3)
    B('Rear retaining curb',(0,251,890),(610,14,83),M['white'],3)
    for x in [-220,220]:B('Front molded tub stiffener',(x,-249,689),(17,15,288),M['white'],2)
    C('Recessed bowl drain',(0,-17,547),25,5,M['steel'],s=24)
    for a in range(8):
        t=a*math.tau/8;B('Drain strainer slot',(16*math.cos(t),-17+16*math.sin(t),550),(3,4,1),M['dark'],0)
    C('Drain tailpiece',(0,-17,454),20,171,M['white'],s=24)
    tube('Exposed P-trap return',[(0,-17,371),(0,-17,294),(0,5,266),(0,66,266),(0,86,300),(0,86,346),(0,209,346)],22,M['white'],12)
    for x in [-54,54]:
        C('Tap escutcheon',(x,215,871),24,15,M['steel'],s=24)
        C('Tap valve body',(x,215,902),14,50,M['steel'],s=20)
        tube('Crosshead tap horizontal arm',[(x-26,215,930),(x+26,215,930)],5,M['steel'],8)
        tube('Crosshead tap perpendicular arm',[(x,189,930),(x,241,930)],5,M['steel'],8)
        C('Hot or cold tap center',(x,215,935),8,6,M['red'] if x<0 else M['blue'],s=16)
    tube('High utility faucet spout',[(0,221,878),(0,221,1061),(0,198,1091),(0,119,1091),(0,83,1064),(0,83,1025)],13,M['steel'],12)
    C('Threaded spout aerator',(0,83,1019),17,23,M['steel'],s=24)


def refrigerator(M):
    for x in [-300,300]:
        for y in [-293,293]:caster(x,y,0,M,39)
    B('Insulated all-refrigerator shell',(0,31,949),(770,720,1728),M['enamel'],18)
    B('Continuous separate fridge door gasket',(0,-337,973),(743,16,1668),M['rubber'],14)
    B('Full-height insulated fridge door',(0,-367,973),(756,51,1683),M['enamel'],16)
    for x in [-330,330]:B('Folded side door edge',(x,-396,974),(4,3,1607),M['steel'],1)
    tube('Long heavy-duty refrigerator pull',[(-291,-397,844),(-291,-441,844),(-291,-441,1340),(-291,-397,1340)],14,M['steel'],12)
    B('Brushed lower kick plate',(0,-402,184),(688,9,99),M['steel'],4)
    for x in range(-305,306,34):
        for z in [165,191,216]:
            o=B('Original kickplate raised traction mark',(x,-409,z),(22,3,4),M['dark'],0);o.rotation_euler.y=.45
    B('Top hinge cap',(298,-346,1804),(114,88,34),M['plastic'],5)
    B('Rear compressor cover',(0,399,279),(681,12,320),M['dark'],5)
    for x in range(-289,290,29):B('Rear condenser vertical fin',(x,399,1050),(4,6,1070),M['dark'],0)
    tube('Rear condenser continuous tubing',[(-300,407,513),(-300,407,1589),(300,407,1589),(300,407,513)],6,M['steel'],8)
    B('Static digital thermostat',(204,-398,1632),(119,6,51),M['dark'],5)
    text('Fridge temperature','4 C',(204,-404,1632),21,M['light'])


def softener(M):
    B('Molded brine cabinet',(0,0,504),(468,536,992),M['cream'],52)
    B('Separate salt access lid',(0,-42,1013),(480,425,40),M['plastic'],20)
    B('Recessed lift grip',(0,-197,1022),(166,32,18),M['dark'],7)
    B('Rear raised control head',(0,206,1093),(413,151,186),M['enamel'],20)
    B('Static LCD control face',(0,123,1125),(169,9,67),M['dark'],5)
    text('Softener original display','12:00',(0,116,1125),25,M['light'])
    for x in [-140,140]:C('Control selection button',(x,118,1099),11,5,M['plastic'],axis='Y',s=20)
    for x in [-122,122]:
        C('Rear bypass connection',(x,289,1070),22,50,M['steel'],axis='Y',s=20)
        C('Capped pipe fitting',(x,317,1070),27,13,M['dark'],axis='Y',s=20)
    B('Bottom appliance plinth',(0,0,22),(460,529,44),M['plastic'],14)
    # Preserved editable resin vessel within the opaque brine shell.
    C('Internal resin vessel',(0,105,530),123,832,M['dark'],s=32)
    for x in [-196,196]:B('Molded cabinet side reinforcement',(x,-7,510),(12,444,828),M['cream'],6)


def first_aid(M):
    B('Folded first-aid cabinet body',(0,4,275),(380,136,550),M['white'],5)
    B('Door perimeter shadow',(0,-69,275),(365,4,535),M['dark'],4)
    B('Separate hinged cabinet door',(0,-76,275),(356,12,525),M['white'],5)
    for z in [99,450]:C('Exposed cabinet hinge',(-179,-70,z),6,66,M['steel'],s=12)
    B('Latch lock plate',(147,-86,275),(23,7,66),M['steel'],4)
    C('Lock key barrel',(147,-92,276),6,4,M['dark'],axis='Y',s=16)
    B('Original first-aid emblem square',(0,-84,335),(116,2,116),M['green'],3)
    B('First aid cross upright',(0,-86,335),(23,1,78),M['white'],0)
    B('First aid cross horizontal',(0,-86,335),(78,1,23),M['white'],0)
    text('First aid label','FIRST AID',(0,-86,215),27,M['dark'])
    for z in [85,216,347,476]:B('Editable interior medicine shelf',(0,5,z),(350,108,6),M['white'],1)
    for x in [-134,134]:B('Rear keyhole mounting tab',(x,75,490),(34,8,66),M['steel'],2)


def riding_mower(M):
    # Stowed compact zero-turn layout: rear drive tires and swivelling front forks.
    B('Welded riding mower chassis',(0,50,340),(1000,1310,180),M['dark'],18)
    for x in [-511,511]:wheel('Rear turf drive tire',x,494,263,260,198,M)
    for x in [-428,428]:
        wheel('Front caster turf tire',x,-644,162,159,88,M)
        for dx in [-56,56]:B('Front wheel caster fork',(x+dx,-644,263),(18,82,258),M['steel'],3)
        C('Caster swivel bearing',(x,-644,423),45,62,M['dark'],s=24)
        beam('Front caster frame arm',(x*.7,-233,385),(x,-644,406),64,47,M['dark'],5)
    # Genuine deck flange and belt cover form a shallow stamped construction.
    outline=[(-646,-455),(-706,-260),(-701,250),(-478,335),(425,329),(663,237),(698,-226),(524,-458)]
    polyxy('Shaped stamped mower deck',outline,155,89,M['green'])
    polyxy('Separate upper mower-deck stamping',[(x*.91,y*.89) for x,y in outline],244,37,M['green'])
    for x in [-300,300]:
        C('Blade spindle cover',(x,-54,285),131,33,M['dark'],s=40)
        for y in [-195,181]:bolt('Deck mounting bolt',(x,y,287),M,7,'Z')
    B('Side discharge flap',(666,65,211),(183,370,41),M['rubber'],9)
    for x in [-530,530]:
        B('Rear-wheel separate fender',(x,466,558),(291,691,48),M['green'],23)
        B('Fender armrest platform',(x,304,694),(208,450,230),M['plastic'],24)
    B('Textured operator footboard',(0,-429,424),(629,595,32),M['plastic'],13)
    for x in range(-262,263,53):
        for y in [-632,-548,-465,-382,-300]:B('Footboard traction lug',(x,y,442),(31,35,5),M['rubber'],2)
    B('Seat suspension base',(0,326,674),(411,475,101),M['dark'],18)
    B('Tailored operator seat pad',(0,237,748),(479,484,98),M['rubber'],35)
    back=B('High-back contoured operator seat',(0,459,927),(468,104,373),M['rubber'],33);back.rotation_euler.x=-.11
    for x in [-130,0,130]:B('Seat stitched relief channel',(x,172,800),(3,312,2),M['plastic'],1)
    for x in [-184,184]:B('Backrest stitched side bolster',(x,394,940),(46,24,303),M['dark'],12)
    for sign in [-1,1]:
        tube('Independent zero-turn lap bar',[(sign*387,227,614),(sign*366,188,863),(sign*282,-24,885),(sign*86,-24,885)],13,M['steel'],10)
        tube('Lap bar rubber grip',[(sign*270,-24,885),(sign*86,-24,885)],18,M['rubber'],10)
        C('Lapbar pivot',(sign*397,224,640),22,25,M['steel'],axis='X',s=20)
    B('Rear battery compartment lid',(0,746,651),(731,277,113),M['green'],21)
    for x in [-252,-84,84,252]:B('Battery-cover molded rib',(x,746,712),(48,221,7),M['dark'],3)
    B('Original static driving screen',(513,136,825),(132,76,6),M['dark'],6)
    C('Blade-enable control knob',(507,250,827),19,22,M['yellow'],s=20)
    for x in [-179,179]:B('Front mower light lens',(x,-714,481),(103,13,31),M['white'],6)
    tube('Rear chassis protective bumper',[(-461,804,402),(-421,865,402),(421,865,402),(461,804,402)],25,M['dark'],10)


def snow_blower(M):
    # Open bucket, separately modeled auger helices and central gearbox.
    for x in [-281,281]:wheel('Snow blower lugged drive tire',x,280,198,195,121,M)
    B('Snowblower drive chassis',(0,143,376),(518,554,260),M['dark'],22)
    B('Dual battery enclosure',(0,162,561),(458,388,137),M['green'],25)
    for x in [-115,115]:
        B('Separate battery cover',(x,165,637),(209,312,19),M['plastic'],8)
        B('Battery-cover lift latch',(x,10,638),(69,25,14),M['green'],4)
    B('Auger bucket back plate',(0,-391,286),(644,21,520),M['green'],6)
    for x in [-318,318]:B('Auger bucket side plate',(x,-557,286),(14,346,520),M['green'],4)
    B('Auger bucket upper return',(0,-548,540),(644,331,18),M['green'],4)
    B('Replaceable front scraper blade',(0,-711,29),(638,29,17),M['steel'],2)
    for x in [-326,326]:B('Adjustable bucket skid shoe',(x,-600,28),(22,166,48),M['dark'],8)
    C('Cross auger axle',(0,-551,271),19,617,M['steel'],axis='X',s=20)
    C('Central auger gearbox',(0,-551,271),52,79,M['dark'],axis='X',s=24)
    for sign in [-1,1]:
        for phase in [0,math.pi]:
            vs=[];faces=[];n=45
            for j in range(n):
                x=sign*(44+j*261/(n-1));a=phase+sign*j*math.tau/(n-1)
                vs += [(x,-551+rr*math.cos(a),271+rr*math.sin(a)) for rr in [42,203]]
            for j in range(n-1):faces.append((j*2,j*2+1,j*2+3,j*2+2))
            o=mesh('Original curved helical auger flight',vs,faces,M['steel'])
            mod=o.modifiers.new('Auger formed steel thickness','SOLIDIFY');mod.thickness=7
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    C('Rotating chute collar',(0,-246,605),98,83,M['dark'],s=32)
    # An open U-section chute, its inside visible from the front.
    for x in [-74,74]:B('Discharge chute side',(x,-232,749),(10,141,233),M['plastic'],5)
    B('Discharge chute rear wall',(0,-158,749),(150,12,233),M['plastic'],5)
    hood=B('Adjustable upper chute hood',(0,-189,886),(162,211,15),M['plastic'],7);hood.rotation_euler.x=-.48
    for x in [-83,83]:C('Chute deflector hinge',(x,-181,849),12,12,M['steel'],axis='X',s=16)
    for x in [-244,244]:
        tube('Snowblower handle upright',[(x,228,518),(x,463,851),(x,587,1044)],17,M['dark'],10)
        tube('Rubber operator handgrip',[(x,502,1035),(x,612,1089)],23,M['rubber'],10)
    B('Snowblower control console',(0,535,1035),(521,186,58),M['plastic'],10)
    for x in [-144,0,144]:
        tube('Console control lever',[(x,514,1068),(x,481,1137)],7,M['steel'],8)
        B('Control lever grip',(x,477,1144),(54,25,24),M['green'],7)
    for x in [-205,205]:B('Snowblower front lamp',(x,-383,590),(77,19,39),M['white'],6)
    tube('Chute operating rod',[(32,-207,667),(103,189,773),(131,471,1029)],7,M['steel'],8)


def yard_cart(M):
    # A balanced two-wheel push/pull cart, distinct from the existing barrow.
    for x in [-294,294]:wheel('Yard cart pneumatic wheel',x,-143,128,127,97,M)
    C('Continuous cart axle',(0,-143,128),15,650,M['steel'],axis='X',s=20)
    for x in [-230,230]:
        beam('Cart bed support runner',(x,-326,219),(x,342,230),37,30,M['yellow'],3)
        tube('Rear parking leg',[(x,263,223),(x,331,27),(x,478,27),(x,448,169)],18,M['yellow'],10)
    cavity('Hollow impact-resistant poly cart bed',(0,-45,215),640,835,311,M['plastic'],exponent=5,wall=12)
    rounded_loop('Reinforced poly cart top rim',640,835,79,526,M['plastic'],10,y=-45)
    for x in [-240,240]:
        tube('One-piece push-pull handle',[(x,283,322),(x,500,567),(x,652,739)],18,M['yellow'],10)
    tube('Continuous handle crossgrip',[(-240,652,739),(-195,666,749),(195,666,749),(240,652,739)],21,M['rubber'],12)
    for x in [-235,235]:
        for y in [-311,236]:bolt('Cart bed fastener',(x,y,246),M,7,'Z')


def trimmer(M):
    C('String spool bumper',(0,-33,28),52,51,M['rubber'],s=28)
    C('Lower trimmer motor housing',(0,-33,91),61,81,M['plastic'],s=32,r2=40)
    C('Long aluminium drive shaft',(0,0,844),14,1459,M['steel'],s=20)
    # Partial circular guard leaves the cutting sector open.
    vs=[];fs=[];steps=22
    for zz in [55,66]:
        for r in [58,174]:
            for i in range(steps+1):
                a=.1+math.pi*.93*i/steps;vs.append((r*math.cos(a),-33+r*math.sin(a),zz))
    n=steps+1
    for i in range(steps):fs += [(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(n+i,n+i+1,3*n+i+1,3*n+i)]
    mesh('Partial trimmer debris guard',vs,fs,M['green'])
    tube('Stowed nylon cutting line',[(-154,-47,41),(-50,-36,41),(50,-36,41),(151,-49,41)],1.5,M['yellow'],6)
    tube('Adjustable loop assist handle',[(-83,0,1021),(-91,-94,1084),(-70,-130,1123),(70,-130,1123),(91,-94,1084),(83,0,1021)],13,M['rubber'],10)
    B('Shaft handle clamp',(0,0,1015),(65,54,56),M['plastic'],7)
    B('Upper trigger handle',(0,-34,1454),(65,86,195),M['plastic'],16)
    B('Trimmer trigger',(0,-81,1452),(26,16,78),M['green'],5)
    battery('Trimmer battery',0,8,1585,M,106,147,94)
    B('Upper shaft switch',(0,-74,1516),(24,13,28),M['red'],3)


def garden_tools(M):
    laminate('Garden tool rack timber',700,27,363,114,M,center=(0,64))
    for x in [-306,306]:screw('Wall rack timber fixing',(x,47,363),M,5)
    for x in [-249,-81,87,255]:
        tube('Forged garden tool hook',[(x,47,329),(x,12,329),(x,-4,312),(x,-4,288)],5,M['steel'],8)
    # A curved concave trowel, made as a bent sheet, not a flat silhouette.
    C('Trowel wood grip',(-249,-15,241),19,121,M['wood'],s=20)
    tube('Trowel steel neck',[(-249,-15,182),(-249,-30,160),(-249,-31,134)],6,M['steel'],8)
    mesh('Concave trowel scoop',[(-291,-21,142),(-249,-43,154),(-207,-21,142),(-220,-30,39),(-249,-39,11),(-278,-30,39)],[(0,1,5),(1,4,5),(1,2,3),(1,3,4)],M['steel'])
    C('Hand fork wood grip',(-81,-15,240),18,126,M['wood'],s=20)
    B('Hand fork shoulder',(-81,-25,151),(81,13,28),M['steel'],4)
    for x in [-112,-81,-50]:tube('Hand fork formed tine',[(x,-25,155),(x,-41,120),(x,-40,22)],6,M['steel'],8)
    for sign in [-1,1]:
        beam('Garden pruner grip',(87+sign*27,-15,182),(87+sign*15,-15,276),15,12,M['red'],4)
        beam('Pruner cutting jaw',(87+sign*15,-15,276),(87+sign*8,-15,323),15,7,M['steel'],2)
    C('Pruner hinge',(87,-24,273),12,14,M['steel'],axis='Y',s=16)
    C('Hand cultivator wood grip',(255,-15,245),18,117,M['wood'],s=20)
    tube('Cultivator shaft',[(255,-15,185),(255,-33,116)],7,M['steel'],8)
    for x in [222,255,288]:tube('Curved cultivator finger',[(255,-33,120),(x,-32,103),(x,-59,71),(x,-55,18)],6,M['steel'],8)


def fuel_can(M):
    B('Pressed rectangular utility can',(0,0,213),(324,149,402),M['red'],23)
    rounded_loop('Rolled can bottom seam',323,149,24,17,M['dark'],3)
    rounded_loop('Rolled can top seam',317,145,24,396,M['dark'],3)
    for sign in [-1,1]:
        y=sign*76
        for a,b in [((-116,y,101),(116,y,316)),((-116,y,316),(116,y,101))]:beam('Pressed diagonal reinforcing rib',a,b,15,7,M['red'],2)
        B('Central stamped reinforcing recess',(0,y+sign*3,207),(59,5,73),M['red'],8)
    for x in [-73,0,73]:
        tube('Three-rib welded carrying handle',[(x,21,394),(x,21,450),(x,-15,459),(x,-39,423)],11,M['red'],10)
    C('Closed filler neck',(112,-6,418),30,30,M['steel'],s=24)
    C('Latched filler cap',(112,-6,438),33,12,M['red'],s=24)
    B('Captive cap latch',(112,-6,451),(17,66,11),M['dark'],3)
    tube('Cap retaining pin',[(101,-30,450),(125,-30,450),(132,-18,442)],3,M['steel'],6)
    B('Original small utility identification plate',(-99,-80,340),(88,2,34),M['cream'],2)


def garage_door(kind,M):
    """Keep original garage anchor, aperture, jambs, hinges, rollers and rails."""
    from household_architecture import garage as original_garage
    before=set(bpy.context.scene.objects)
    original_garage(M)
    replace=('Insulated sectional slab','Top section lower insulated rail','Top section upper insulated rail',
        'Upper glazing structural mullion','Raised outer panel moulding','Inset panel field',
        'Upper glazing vertical frame','Upper glazing vertical gasket','Upper glazing horizontal frame',
        'Upper glazing horizontal gasket','Upper horizontal garage window')
    for o in list(bpy.context.scene.objects):
        if o not in before and o.name.startswith(replace):
            data=o.data;bpy.data.objects.remove(o,do_unlink=True)
            if data.users==0:bpy.data.meshes.remove(data)
    for j in range(4):
        z=271+j*532
        if kind=='door-full-view':
            for dz in [-244,244]:B('Extruded full-view section rail',(0,0,z+dz),(2700,44,38),M['dark'],3)
            for x in [-1328,-663,0,663,1328]:B('Extruded full-view vertical stile',(x,0,z),(44,44,451),M['dark'],3)
            for x in [-995,-332,332,995]:
                B('Independent translucent garage pane',(x,0,z),(615,7,449),M['glass'],1)
                for dz in [-222,222]:B('Glazing horizontal compression gasket',(x,-24,z+dz),(615,6,6),M['rubber'],1)
                for dx in [-305,305]:B('Glazing vertical compression gasket',(x+dx,-24,z),(6,6,449),M['rubber'],1)
        elif kind=='door-carriage':
            if j<3:
                B('Insulated carriage section',(0,0,z),(2700,44,526),M['cream'],4)
                for i in range(16):B('Individual carriage tongue-and-groove board',(-1265+i*168.7,-26,z),(163,9,486),M['cream'],2)
                for x in [-1273,-33,33,1273]:B('Carriage face stile',(x,-35,z),(59,10,524),M['wood'],2)
                for dz in [-230,230]:B('Carriage face horizontal rail',(0,-36,z+dz),(2700,11,53),M['wood'],2)
                for sign in [-1,1]:beam('Carriage diagonal bracing',(sign*1205,-38,z-194),(sign*93,-38,z+194),42,9,M['wood'],2)
            else:
                B('Carriage top lower rail',(0,0,z-194),(2700,44,138),M['cream'],3)
                B('Carriage top upper rail',(0,0,z+220),(2700,44,86),M['cream'],3)
                for x in [-1328,-663,0,663,1328]:B('Carriage window stile',(x,0,z+23),(45,44,306),M['cream'],3)
                for x in [-995,-332,332,995]:
                    outline=[(x-307,z-121),(x+307,z-121)]
                    outline += [(x+307*math.cos(a),z+107+54*math.sin(a)) for a in [i*math.pi/20 for i in range(21)]]
                    polyxz('Arched carriage glazing',outline,-3,6,M['glass'])
                    tube('Curved carriage glazing head',[(x+310*math.cos(a),-26,z+107+55*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],8,M['wood'],8)
                    for dx in [-305,0,305]:B('Carriage glass vertical divider',(x+dx,-23,z-7),(12,14,229),M['wood'],2)
                    B('Carriage glass lower glazing bead',(x,-23,z-121),(617,14,14),M['wood'],2)
                    cap=[(x-314,z+176),(x+314,z+176)]+[(x+314*math.cos(a),z+107+55*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]]
                    polyxz('Solid arched top infill',cap,0,44,M['cream'])
            if j in [0,2]:
                for x in [-1120,1120]:
                    B('Decorative carriage strap hinge',(x,-49,z),(351,8,27),M['dark'],5)
                    for dx in [-135,0,135]:bolt('Strap hinge rivet',(x+dx,-56,z),M,5)
        else:
            # Right-hand slim glazing cuts through each section: no opaque slab behind it.
            B('Insulated timber section left field',(-340,0,z),(2020,44,526),M['dark'],3)
            for zz in [z-187,z+187]:B('Insulated right window rail',(1010,0,zz),(680,44,152),M['dark'],3)
            for x in [695,1327]:B('Insulated right window stile',(x,0,z),(46,44,230),M['dark'],3)
            for i in range(7):
                zz=z-223+i*74.3
                B('Horizontal oiled timber board',(-340,-29,zz),(2020,16,68),M['wood2' if (i+j)%3==0 else 'wood'],2)
                if i in [0,1,5,6]:B('Short right timber board',(1010,-29,zz),(680,16,68),M['wood2' if i%2 else 'wood'],2)
            B('Slim true glazed garage light',(1010,-3,z),(583,6,219),M['glass'],1)
            for zz in [z-111,z+111]:B('Slim-light glazing rail',(1010,-28,zz),(594,13,14),M['dark'],2)
            for x in [711,1309]:B('Slim-light glazing stile',(x,-28,z),(14,13,230),M['dark'],2)
    bpy.context.scene['household_wall_anchor_mm']=[0.0,0.0,0.0]
    bpy.context.scene['household_door_aperture_mm']=[2700.0,2130.0]
    bpy.context.scene['garage_door_display_pose']='Fixed closed sectional with complete inherited overhead hardware'


def opener(kind,M):
    if kind=='door-keypad':
        B('Keypad wall backplate',(0,10,77),(75,15,154),M['dark'],8)
        B('Weatherproof keypad enclosure',(0,-1,77),(69,22,148),M['cream'],8)
        B('Raised rain hood top',(0,-6,145),(74,35,18),M['cream'],5)
        for r in range(4):
            for c in range(3):
                x=-19+c*19;z=109-r*23
                B('Separate tactile keypad button',(x,-15,z),(15,6,17),M['plastic'],3)
                label=str(r*3+c+1) if r<3 else ['*','0','#'][c]
                text('Original keypad numeral',label,(x,-19,z),9,M['white'])
        C('Keypad status lens',(0,-16,130),3,2,M['light'],axis='Y',s=12)
    else:
        B('Jackshaft opener rear plate',(0,51,224),(180,23,361),M['dark'],8)
        B('Jackshaft motor main enclosure',(0,-5,245),(193,128,327),M['plastic'],19)
        B('Separate front battery/service cover',(0,-75,219),(169,16,233),M['enamel'],12)
        C('Shaft collar housing',(-92,2,342),39,45,M['steel'],axis='X',s=24)
        arc_shell('Visible open drive shaft collar',(-111,2,342),30,17,30,M['dark'],axis='X',steps=24)
        B('Small static opener display',(0,-87,326),(87,5,30),M['dark'],3)
        for x in [-23,0,23]:C('Opener status indicator',(x,-91,326),3,2,M['light'],axis='Y',s=12)
        for z in [120,369]:
            for x in [-66,66]:screw('Motor cover screw',(x,-86,z),M,3)
        tube('Manual release cord',[(53,3,116),(61,0,33)],2,M['cream'],6)
        B('Manual release pull handle',(61,0,19),(41,20,26),M['red'],4)


def create(catalog_id,M):
    M=palette(M)
    if not catalog_id.startswith('garage-'):raise KeyError(catalog_id)
    kind=catalog_id.removeprefix('garage-')
    before=set(bpy.context.scene.objects)
    groups={
        'tall-cabinet':lambda:cabinet(kind,M),'wall-cabinet':lambda:cabinet(kind,M),
        'drawer-base':lambda:cabinet(kind,M),'corner-cabinet':lambda:cabinet(kind,M),
        'hutch-workbench':lambda:workbench(kind,M),'folding-wall-bench':lambda:workbench(kind,M),
        'service-cart':lambda:service_cart(M),'mechanic-stool':lambda:stool(M),
        'ceiling-rack':lambda:ceiling_rack(M),'tire-rack':lambda:wall_rack(kind,M),
        'lumber-rack':lambda:wall_rack(kind,M),'pegboard-tools':lambda:tool_rack(kind,M),
        'hook-rail':lambda:tool_rack(kind,M),'parts-bin-rack':lambda:parts_bins(M),
        'tool-case-tower':lambda:cases(M),'storage-tote':lambda:tote(M),
        'long-tool-stand':lambda:tool_rack(kind,M),'extension-ladder':lambda:ladder(M),
        'cordless-drill':lambda:drill(M),'circular-saw':lambda:circular_saw(M),
        'miter-saw':lambda:miter_saw(M),'table-saw':lambda:table_saw(M),
        'drill-press':lambda:drill_press(M),'bench-grinder':lambda:grinder(M),
        'bench-vise':lambda:vise(M),'air-compressor':lambda:compressor(M),
        'pressure-washer':lambda:pressure_washer(M),'inverter-generator':lambda:generator(M),
        'cyclone-extractor':lambda:cyclone(M),'welding-cart':lambda:welding_cart(M),
        'charger-dock':lambda:charger(M),'cord-reel':lambda:reel(kind,M),
        'air-hose-reel':lambda:reel(kind,M),'floor-jack':lambda:floor_jack(M),
        'axle-stands':lambda:axle_stands(M),'mechanic-creeper':lambda:creeper(M),
        'seasonal-tires':lambda:tires(M),'ev-charger':lambda:ev_charger(M),
        'wall-fan':lambda:wall_fan(M),'shop-heater':lambda:shop_heater(M),
        'utility-sink':lambda:utility_sink(M),'all-refrigerator':lambda:refrigerator(M),
        'water-softener':lambda:softener(M),'first-aid-cabinet':lambda:first_aid(M),
        'riding-mower':lambda:riding_mower(M),'snow-blower':lambda:snow_blower(M),
        'yard-cart':lambda:yard_cart(M),'string-trimmer':lambda:trimmer(M),
        'garden-tool-rack':lambda:garden_tools(M),'fuel-can':lambda:fuel_can(M),
        'door-full-view':lambda:garage_door(kind,M),'door-carriage':lambda:garage_door(kind,M),
        'door-slatted':lambda:garage_door(kind,M),'wall-opener':lambda:opener(kind,M),
        'door-keypad':lambda:opener(kind,M),
    }
    if kind not in groups:raise KeyError(catalog_id)
    groups[kind]()
    # These tabletop tools are presented side-on in their catalog width. A rigid
    # turn preserves round chucks/blades instead of distorting their proportions
    # when the driver's exact-envelope normalization runs.
    if kind in {'cordless-drill','circular-saw','bench-vise'}:
        turn=Matrix.Rotation(math.pi/2,4,'Z')
        for o in bpy.context.scene.objects:
            if o not in before:o.matrix_world=turn@o.matrix_world
        scene=bpy.context.scene
        if 'household_support_center_mm' in scene:
            x,y,z=scene['household_support_center_mm'];scene['household_support_center_mm']=[-y,x,z]
            w,d=scene['household_support_footprint_mm'];scene['household_support_footprint_mm']=[d,w]


def support_surfaces(catalog_id):
    """Real clear planes, raw millimetres; z below denotes Blender Y."""
    surfaces={
        'garage-drawer-base': [('top','Maple cabinet worktop',0,0,1023,515,930,1000)],
        'garage-corner-cabinet': [('top','Clear square of corner worktop',72,72,690,690,930,1000)],
        'garage-hutch-workbench': [('worktop','Clear bench worktop in front of hutch',0,-37,1750,492,900,835),('lower','Open lower bench shelf',0,-21,1560,435,222,464),('hutch','Upper hutch shelf between uprights',0,229,1705,128,1788,600)],
        'garage-folding-wall-bench': [('top','Open folding worktop',0,-15,985,532,430,1000)],
        'garage-service-cart': [('bottom','Inside lower cart tray between uprights',0,0,610,365,177,296),('middle','Inside middle cart tray between uprights',0,0,610,365,487,356),('top','Inside upper cart tray between uprights',0,0,610,365,857,650)],
        'garage-tool-case-tower': [],
        # A wire deck really supports broad solid-bottom totes, but its cross rods
        # are not a continuous plane for tiny objects; retain manual placement.
        'garage-ceiling-rack': [],
        'garage-mechanic-creeper': [],
        'garage-parts-bin-rack': [],
    }
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,row)) for row in surfaces.get(catalog_id,[])]


DEFAULT_ELEVATIONS_MM={
    'garage-wall-cabinet':1400,'garage-folding-wall-bench':470,
    'garage-tire-rack':1200,'garage-lumber-rack':650,'garage-pegboard-tools':1050,
    'garage-hook-rail':1550,'garage-extension-ladder':1850,
    'garage-cord-reel':1650,'garage-air-hose-reel':1600,'garage-ev-charger':700,
    'garage-wall-fan':1550,'garage-first-aid-cabinet':1200,'garage-garden-tool-rack':1200,
    'garage-wall-opener':1880,'garage-door-keypad':1100,
}
