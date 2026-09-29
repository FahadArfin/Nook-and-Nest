"""Original architecture studies; host behavior lives in householdArchitecture.ts.

Source millimetre dimensions, named editable parts, no scene clearing or export.
"""
import math
import bpy
from build_kitchen_essentials import B,C,mesh,tube,ring,material
from household_lighting_office import poly_solid

IDS=['roof-skylight','secondary-storm-screen-door','sectional-garage-door','spiral-staircase']


def skylight(M):
    # Open rectangular curb and inner reveal; never a solid plate with a decal.
    for x in [-410,410]:
        B('Insulated timber curb side',(x,0,105),(80,1120,210),M['wood'],3)
        B('White interior reveal side',(x+(-42 if x>0 else 42),0,82),(12,1040,164),M['cream'],1)
        B('Folded side weather flashing',(x,0,202),(80,1180,24),M['dark'],3)
    for y in [-560,560]:
        B('Insulated timber curb end',(0,y,105),(740,80,210),M['wood'],3)
        B('White interior reveal end',(0,y+(-42 if y>0 else 42),82),(738,12,164),M['cream'],1)
        B('Folded end weather flashing',(0,y,202),(900,80,24),M['dark'],3)
    for x in [-426,426]:B('Raised glazing frame side',(x,0,230),(42,1192,52),M['dark'],4)
    for y in [-576,576]:B('Raised glazing frame end',(0,y,230),(810,48,52),M['dark'],4)
    B('Single insulated glazing unit',(0,0,237),(810,1100,12),M['glass'],1)
    for x in [-404,404]:B('Inner glazing gasket',(x,0,228),(8,1102,8),M['rubber'],1)
    for y in [-548,548]:B('End glazing gasket',(0,y,228),(812,8,8),M['rubber'],1)
    for x in [-422,422]:
        for y in [-490,0,490]:C('Frame fixing screw',(x,y,258.5),3,3,M['steel'],s=12)
    bpy.context.scene['household_roof_plane_mm']=160.0
    bpy.context.scene['household_roof_aperture_mm']=[748.0,1048.0]


def storm(M):
    enamel=material('household-storm-sage-enamel',(.23,.34,.26),.53,.15)
    meshmat=material('household-fine-insect-screen',(.11,.15,.14),.94,0,.20)
    for x in [-451,451]:B('Slim outer mounting jamb',(x,15,1065),(48,65,2130),enamel,3)
    for z in [24,2106]:B('Mounting head sill',(0,15,z),(854,65,48),enamel,3)
    for x in [-406,406]:B('Aluminium door leaf stile',(x,-26,1065),(50,34,2025),enamel,3)
    for z in [77,1055,2053]:B('Aluminium door leaf rail',(0,-26,z),(767,34,50),enamel,3)
    B('Upper storm glazing',(0,-27,1556),(760,5,946),M['glass'],0)
    B('Lower insect screen panel',(0,-26,558),(760,2,900),meshmat,0)
    # Fine geometry screen, restrained spacing for browser cost.
    for x in range(-372,373,24):tube('Vertical insect screen strand',[(x,-29,110),(x,-29,1004)],.42,M['dark'],4)
    for z in range(120,1000,24):tube('Horizontal insect screen strand',[(-377,-29,z),(377,-29,z)],.42,M['dark'],4)
    for z in [260,1065,1865]:
        C('Storm leaf hinge barrel',(-433,-30,z),7,62,M['steel'],s=16)
        B('Storm leaf hinge plate',(-430,-28,z),(29,7,54),M['steel'],1)
    B('Lever handle backplate',(396,-48,1050),(30,10,114),M['brass'],6)
    tube('Separate latch lever',[(398,-54,1048),(398,-77,1048),(342,-77,1048)],7,M['brass'],10)
    C('Key barrel',(396,-55,1005),7,8,M['steel'],axis='Y',s=20)
    # Hydraulic closer sits inside the secondary frame rather than in the wall.
    tube('Closer mounting bracket',[(-428,40,1900),(-396,50,1900)],5,M['steel'],8)
    C('Hydraulic closer body',(-300,51,1900),16,200,M['dark'],axis='X',s=24)
    tube('Closer piston rod',[(-202,51,1900),(-76,33,1900)],4,M['steel'],8)
    B('Closer leaf bracket',(-72,22,1900),(28,27,17),M['steel'],2)
    bpy.context.scene['household_secondary_leaf']='Existing doorway overlay; never cut a second aperture'


def garage(M):
    panel=material('household-garage-slate-enamel',(.13,.23,.28),.60,.18)
    for x in [-1390,1390]:B('Garage outer jamb',(x,0,1100),(70,100,2200),M['cream'],4)
    B('Garage header casing',(0,0,2165),(2710,100,70),M['cream'],4)
    B('Continuous lower weather seal',(0,0,13),(2710,45,26),M['rubber'],4)
    for j in range(4):
        z=271+j*532
        if j<3:B('Insulated sectional slab %d'%j,(0,0,z),(2700,44,526),panel,5)
        else:
            # Four genuine openings: the upper glass is not laid over a solid slab.
            B('Top section lower insulated rail',(0,0,z-191.5),(2700,44,143),panel,4)
            B('Top section upper insulated rail',(0,0,z+201.5),(2700,44,123),panel,4)
            for lo,hi in [(-1350,-1250.5),(-759.5,-580.5),(-89.5,89.5),(580.5,759.5),(1250.5,1350)]:
                B('Upper glazing structural mullion',((lo+hi)/2,0,z+10),(hi-lo,44,260),panel,3)
        for i in range(4):
            x=-1005+i*670
            if j<3:
                B('Raised outer panel moulding %d %d'%(j,i),(x,-25,z),(595,12,421),panel,7)
                B('Inset panel field %d %d'%(j,i),(x,-32,z),(532,9,349),panel,6)
            else:
                for side in [-1,1]:
                    B('Upper glazing vertical frame',(x+side*256,-28,z+10),(27,15,293),panel,3)
                    B('Upper glazing vertical gasket',(x+side*245,-34,z+10),(6,5,260),M['rubber'],1)
                    B('Upper glazing horizontal frame',(x,-28,z+10+side*143),(491,15,26),panel,3)
                    B('Upper glazing horizontal gasket',(x,-34,z+10+side*130),(491,5,6),M['rubber'],1)
                B('Upper horizontal garage window',(x,-29,z+10),(487,5,256),M['glass'],1)
        for x in [-1275,-425,425,1275]:
            B('Rear steel section stiffener',(x,26,z),(36,15,451),M['steel'],2)
        if j<3:
            for x in [-1275,-425,425,1275]:
                B('Section hinge plate',(x,38,z+266),(43,7,87),M['steel'],2)
                C('Section hinge knuckle',(x,44,z+266),9,54,M['steel'],axis='X',s=16)
                for dz in [-26,26]:C('Hinge fixing bolt',(x,44,z+266+dz),4,4,M['dark'],axis='Y',s=6)
    for x in [-130,130]:
        tube('Exterior pull handle',[(x-37,-41,800),(x-32,-83,800),(x,-83,800),(x+32,-83,800),(x+37,-41,800)],8,M['dark'],10)
    # Channel rails rise, turn through a 300 mm radius and continue overhead.
    for x in [-1360,1360]:
        pts=[(x,74,30),(x,74,1830)]
        for i in range(1,17):
            a=i*math.pi/32;pts.append((x,374-300*math.cos(a),1830+300*math.sin(a)))
        pts.append((x,2609,2130))
        for dx in [-15,15]:tube('Curved sectional guide channel',[(p[0]+dx,p[1],p[2]) for p in pts],7,M['steel'],8)
        for z in [271,803,1335,1867]:
            C('Track roller',(x,74,z),23,16,M['rubber'],axis='X',s=24)
            tube('Roller axle',[(x,74,z),(x+(-76 if x>0 else 76),35,z)],5,M['steel'],8)
        for y in [760,1770,2550]:
            B('Overhead rail hanger',(x,y,2260),(33,33,280),M['steel'],3)
            for z in [2180,2230,2280,2330]:C('Hanger bolt',(x,y-18,z),3,4,M['dark'],axis='Y',s=6)
    C('Torsion support shaft',(0,87,2320),13,2710,M['steel'],axis='X',s=24)
    for x in [-480,480]:
        C('Torsion spring core',(x,87,2320),34,510,M['dark'],axis='X',s=24)
        tube('Continuous torsion spring winding',[(x-248+496*j/312,87+35*math.cos(j*math.tau/12),2320+35*math.sin(j*math.tau/12)) for j in range(313)],3.1,M['steel'],6)
    for x in [-1280,1280]:
        C('Cable drum',(x,87,2320),52,65,M['dark'],axis='X',s=32)
        tube('Vertical door counterbalance cable',[(x,70,2300),(x,57,33)],2,M['steel'],6)
    bpy.context.scene['household_wall_anchor_mm']=[0.0,0.0,0.0]
    bpy.context.scene['household_door_aperture_mm']=[2700.0,2130.0]


def spiral(M):
    # 16 wedge treads, one full turn. Nominal tread rise=2800, top guard=900.
    radius=950;inner=92;rise=2800;step=rise/16
    C('Central structural column',(0,0,1850),68,3700,M['dark'],s=40)
    C('Bolted bottom base flange',(0,0,14),145,28,M['steel'],s=40)
    C('Upper landing column collar',(0,0,2800),103,130,M['dark'],s=32)
    for a in [math.pi/4+i*math.pi/2 for i in range(4)]:C('Column anchor bolt',(110*math.cos(a),110*math.sin(a),34),9,15,M['steel'],s=6)
    for i in range(16):
        a=-math.pi/2+i*math.tau/16;b=a+math.tau/16+.012;z=(i+1)*step
        outline=[(inner*math.cos(a),inner*math.sin(a))]
        outline += [(radius*math.cos(a+(b-a)*j/8),radius*math.sin(a+(b-a)*j/8)) for j in range(9)]
        outline += [(inner*math.cos(b),inner*math.sin(b))]
        poly_solid('Individual oak spiral tread %02d'%i,outline,43,M['wood2'],center=(0,0,z-21.5),bevel=3)
        # Steel bracket below every tread, tied to its column sleeve.
        mid=(a+b)/2;tube('Radial tread bracket',[(80*math.cos(mid),80*math.sin(mid),z-38),(810*math.cos(mid),810*math.sin(mid),z-38)],16,M['dark'],6)
        C('Column tread sleeve',(0,0,z-56),81,102,M['dark'],s=32)
        for angle in [a+.045,b-.045]:
            x,y=(radius-18)*math.cos(angle),(radius-18)*math.sin(angle)
            tube('Outer tread baluster',[(x,y,z),(x,y,z+886)],9,M['dark'],8)
            C('Baluster foot socket',(x,y,z+13),15,24,M['steel'],s=16)
    points=[]
    for i in range(129):
        t=i/128;a=-math.pi/2+t*math.tau
        points.append(((radius-18)*math.cos(a),(radius-18)*math.sin(a),step+875+t*(rise-step)))
    tube('Continuous helical timber handrail',points,25,M['wood'],10)
    # A narrow upper collar and widened final sector bridge the genuine circular
    # opening. The rest of the shaft stays open through the floor below.
    a=-math.pi/2-math.tau/16
    outline=[(inner*math.cos(a),inner*math.sin(a)),(1100*math.cos(a),1100*math.sin(a)),(0,-1100),(0,-inner)]
    poly_solid('Widened upper landing sector',outline,43,M['wood2'],center=(0,0,rise-21.5),bevel=2)
    for i in range(48):
        a=i*math.tau/48;b=(i+1)*math.tau/48
        outline=[(r*math.cos(t),r*math.sin(t)) for r,t in [(980,a),(1100,a),(1100,b),(980,b)]]
        poly_solid('Upper opening collar segment %d'%i,outline,43,M['wood'],center=(0,0,rise-21.5),bevel=0)
    for i in range(19):
        a=-math.pi/2+.35+i*(math.tau-.7)/18;x,y=1080*math.cos(a),1080*math.sin(a)
        tube('Upper circular guard baluster',[(x,y,rise),(x,y,rise+880)],8,M['dark'],8)
    tube('Upper circular landing handrail',[(1080*math.cos(a),1080*math.sin(a),3680) for a in [-math.pi/2+.35+i*(math.tau-.7)/80 for i in range(81)]],20,M['wood'],10)
    bpy.context.scene['household_stair_rise_mm']=2800.0
    bpy.context.scene['household_stair_opening_diameter_mm']=1960.0
    bpy.context.scene['household_stair_layout_only']='Flat walkthrough blocks the shaft and footprint; no simulated stair ascent'


def create(catalog_id,M):
    if catalog_id not in IDS:raise KeyError(catalog_id)
    {'roof-skylight':skylight,'secondary-storm-screen-door':storm,'sectional-garage-door':garage,'spiral-staircase':spiral}[catalog_id](M)
