"""Original HOME-044–057 utilities; millimetres, front = -Y, base = Z0.

create() only adds editable construction parts to the caller's active scene.
The parent authoring pipeline owns scene isolation, exact bounds, saving,
static export, camera setup and visual review. No external images or meshes.
"""
import math
import bpy
from mathutils import Vector
from build_kitchen_essentials import B, C, mesh, tube, ring, lathe, rounded_loop, material
from studio_geometry import text


def _screw(name, x, y, z, M, r=3):
    C(name, (x,y,z), r, 1.4, M['steel'], axis='Y', s=12)
    B(name+' slot', (x,y-0.8,z), (r*1.25,.5,.65), M['dark'], .15)


def _cut(obj, cutter):
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Actual recessed opening', 'BOOLEAN')
    mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    data=cutter.data
    bpy.data.objects.remove(cutter,do_unlink=True)
    if data.users==0:bpy.data.meshes.remove(data)


def _panel_frame(name,w,h,depth,z,M,mat=None,border=12):
    mat=mat or M['cream']
    for x in [-(w-border)/2,(w-border)/2]:B(name+' side',(x,0,z),(border,depth,h),mat,2)
    for zz in [z-(h-border)/2,z+(h-border)/2]:B(name+' end',(0,0,zz),(w-2*border,depth,border),mat,2)


def _feet(w,d,M,z=12,r=13):
    for x in [-w*.38,w*.38]:
        for y in [-d*.36,d*.36]:C('rubber isolation foot',(x,y,z),r,z*2,M['rubber'],s=16)


def _castors(w,d,M,z=22):
    for x in [-w*.35,w*.35]:
        for y in [-d*.34,d*.34]:
            B('caster yoke',(x,y,z+10),(22,28,22),M['dark'],3)
            C('rubber caster wheel',(x,y,z),18,23,M['rubber'],axis='X',s=20)
            C('caster axle',(x-13,y,z),5,3,M['steel'],axis='X',s=12)


def _grille(name,x,y,z,w,h,M,step=14,mat=None,depth=8):
    """Separate pitched slats, open gaps, and a recessed dark air plenum."""
    mat=mat or M['cream']
    # Positive-Y rear faces need the plenum on their negative-Y interior side.
    facing=-1 if y<=0 else 1
    B(name+' plenum',(x,y-facing*depth*.8,z),(w,3,h),M['dark'],2)
    count=max(3,int(h/step))
    for i in range(count):
        o=B(name+' pitched louver %02d'%i,(x,y,z-h/2+(i+.5)*h/count),(w-8,depth,3),mat,1)
        o.rotation_euler.x=math.radians(-24)


def _water_heater(M):
    lathe('insulated cylindrical tank',[(0,12),(225,12),(244,24),(250,45),
          (250,1135),(245,1160),(230,1180),(0,1180)],M['cream'],64)
    for z in [24,1157]:ring('rolled tank seam',(0,0,z),247,3,M['steel'],steps=64)
    C('bottom protective plinth',(0,0,16),248,32,M['dark'],s=64)
    for x,key in [(-107,'blue'),(107,'red')]:
        C('top coupling escutcheon',(x,0,1184),31,8,M['steel'],s=24)
        C('threaded water nipple',(x,0,1211),15,48,M['brass'],s=20)
        for z in [1194,1200,1206,1212,1218,1224]:ring('coupling thread',(x,0,z),15,1.2,M['steel'],steps=20)
        C('capped connection marker',(x,0,1238),17,6,M[key],s=20)
    B('electrical top service cover',(0,62,1190),(92,82,17),M['steel'],4)
    for z in [365,850]:
        B('service panel gasket',(0,-246,z),(167,8,192),M['dark'],7)
        B('removable element access cover',(0,-252,z),(156,7,182),M['cream'],7)
        for xx in [-62,62]:_screw('access screw',xx,-257,z,M)
    B('unbranded service data plate',(0,-253,1065),(115,2,82),M['paper'],1)
    text('service heading','WATER',(0,-255,1088),15,M['dark'])
    for i in range(5):B('service data line',(-8,-255,1073-i*9),(77-9*(i%2),.5,1.6),M['dark'],0)
    C('drain boss',(0,-247,120),21,26,M['brass'],axis='Y',s=20)
    C('drain tap outlet',(0,-270,120),12,27,M['brass'],axis='Y',s=16)
    B('drain valve lever',(0,-268,142),(51,9,6),M['blue'],2)
    C('pressure relief fitting',(214,0,1032),19,65,M['brass'],axis='X',s=16)
    tube('short capped relief pipe',[(240,0,1032),(267,0,1032),(275,0,1016),(275,0,934)],9,M['steel'])


def _outlet(M):
    B('wall plate rear lip',(0,3,65),(84,4,124),M['dark'],3)
    B('bevelled single gang faceplate',(0,-1,65),(90,8,130),M['cream'],4)
    B('duplex insert recessed frame',(0,-5.5,65),(42,2,90),M['dark'],3)
    for z in [42,88]:
        face=B('separate socket face',(0,-8,z),(37,6,39),M['cream'],5)
        for x,slot_h in [(-7,11),(7,9)]:
            _cut(face,B('slot cutter',(x,-8,z+5),(3,14,slot_h),M['dark'],.5))
        _cut(face,C('ground hole cutter',(0,-8,z-9),3.3,14,M['dark'],axis='Y',s=16))
        B('socket contact shadows',(0,-4,z),(29,1,31),M['dark'],1)
    _screw('centre face screw',0,-5.8,65,M,2.6)


def _radiator(M):
    B('rear pressed panel',(0,36,300),(878,7,570),M['cream'],6)
    B('front pressed panel',(0,-39,300),(878,9,570),M['cream'],8)
    for i in range(22):
        x=-420+i*40
        B('pressed vertical water channel',(x,-48,300),(24,12,541),M['cream'],5)
        # Folded zigzag convector strips behind the front water panel.
        verts=[]
        for j in range(6):verts.extend([(x-15+(j%2)*25,-28+j*12,37),(x-15+(j%2)*25,-28+j*12,563)])
        mesh('folded rear convector',verts,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(5)],M['steel'])
    for x in [-447,447]:B('removable side cover',(x,0,300),(14,104,578),M['cream'],3)
    B('top grille dark gap',(0,0,583),(879,93,5),M['dark'],2)
    for i in range(45):B('open top grille bar',(-433+i*19.7,0,592),(7,103,6),M['cream'],1)
    for x in [-260,260]:
        B('wall mounting standoff',(x,52,294),(28,24,420),M['steel'],3)
        for z in [110,488]:B('wall cleat',(x,61,z),(68,9,31),M['steel'],2)
    for x in [-462,462]:
        C('valve union',(x,0,75),17,42,M['steel'],axis='X',s=16)
    C('thermostatic valve body',(483,0,491),17,65,M['steel'],axis='Z',s=16)
    C('ridged thermostat cap',(483,0,540),23,56,M['cream'],s=24)
    for i in range(12):
        a=i*math.tau/12
        tube('thermostat grip rib',[(483+23*math.cos(a),23*math.sin(a),516),(483+23*math.cos(a),23*math.sin(a),565)],1.6,M['dark'],4)


def _corrugated_hose(M):
    # One open annular mesh. Fixed routing folds back into a bounded footprint.
    path=[]
    for i in range(13):
        a=i*math.pi/24
        path.append(Vector((0,170+130*math.sin(a),355+130*(1-math.cos(a)))))
    path.extend([Vector((0,300,z)) for z in range(505,666,20)])
    verts=[];s=32
    for i,p in enumerate(path):
        t=(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized()
        side=Vector((1,0,0));up=t.cross(side).normalized()
        for radius in [66 if i%2 else 62,57]:
            verts.extend([p+radius*(side*math.cos(j*math.tau/s)+up*math.sin(j*math.tau/s)) for j in range(s)])
    faces=[]
    for i in range(len(path)-1):
        for inner in [0,1]:
            for j in range(s):
                a=i*s*2+inner*s+j;b=i*s*2+inner*s+(j+1)%s
                faces.append((a,b,b+s*2,a+s*2) if not inner else (b,a,a+s*2,b+s*2))
    for i in [0,len(path)-1]:
        for j in range(s):
            a=i*s*2+j;b=i*s*2+(j+1)%s;faces.append((a,b,b+s,a+s))
    mesh('open fixed corrugated exhaust hose',verts,faces,M['cream'])
    C('rear exhaust flange',(0,182,355),74,26,M['dark'],axis='Y',s=32)


def _portable_ac(M):
    _castors(426,370,M)
    B('portable compressor cabinet',(0,-26,425),(438,360,758),M['cream'],35)
    B('separate lower bumper',(0,-26,63),(450,373,25),M['dark'],8)
    B('upper control deck',(0,-26,811),(426,355,20),M['sage'],10)
    B('top outlet recess',(0,-80,825),(342,177,9),M['dark'],8)
    for i in range(9):
        o=B('top discharge louver',(0,-151+i*17.6,833),(321,9,9),M['cream'],3);o.rotation_euler.x=.32
    B('control panel glass',(0,104,826),(177,36,4),M['dark'],4)
    text('static temperature display','22',(0,102,829),15,M['light'],front=False)
    for x in [-70,70]:C('top button',(x,104,830),5,2,M['cream'],s=16)
    _grille('lower front intake',0,-209,188,333,159,M,15,depth=6)
    for x in [-222,222]:B('recessed side carrying handhold',(x,-24,659),(3,102,30),M['dark'],5)
    _grille('rear filter',0,158,620,314,233,M,18,depth=6)
    C('condensate drain cap',(133,162,105),10,8,M['rubber'],axis='Y',s=16)
    _corrugated_hose(M)


def _ac_adaptor(M):
    plate=B('flat sliding window adaptor',(0,0,75),(650,22,150),M['cream'],4)
    _cut(plate,C('exhaust hole cutter',(0,0,75),56,45,M['dark'],axis='Y',s=40))
    collar=lathe('open hose adaptor collar',[(56,0),(62,0),(62,31),(57,35),(56,35)],M['cream'],40)
    collar.rotation_euler.x=math.pi/2;collar.location.z=75;collar.location.y=5
    for x in [-225,225]:
        B('overlap guide strip',(x,12,75),(147,3,128),M['steel'],1)
        for z in [26,124]:_screw('locking screw',x,-13,z,M,4)


def _purifier(M):
    C('hidden black plinth',(0,0,10),119,20,M['rubber'],s=48)
    C('dark filter behind open cage',(0,0,203),132,343,M['dark'],s=64)
    # Physically open slatted lower intake, alternating rings and upright ribs.
    for z in [28,91,154,217,280,343]:
        lathe('intake structural band',[(135,z),(140,z),(140,z+7),(135,z+7)],M['cream'],64)
    for i in range(48):
        a=i*math.tau/48
        o=B('intake grille upright',(137*math.cos(a),137*math.sin(a),190),(4,6,323),M['cream'],1)
        o.rotation_euler.z=a
    lathe('upper filter service casing',[(132,347),(140,347),(140,472),(135,492),(124,503),(72,503),(72,485),(126,478)],M['cream'],64)
    C('dark top outlet beneath vanes',(0,0,494),125,8,M['dark'],s=64)
    for i in range(32):
        a=i*math.tau/32
        o=B('radial top exhaust fin',(97*math.cos(a),97*math.sin(a),507),(51,4,13),M['cream'],1.5);o.rotation_euler.z=a
    C('inset top control disc',(0,0,509),64,13,M['dark'],s=48)
    ring('status light ring',(0,0,517),53,1.6,M['light'],steps=48)
    text('static air display','012',(0,0,518),20,M['cream'],front=False)
    for x in [-25,0,25]:C('top control dot',(x,-31,518),2,1,M['cream'],s=12)
    B('back sensor inset',(0,140,417),(44,3,34),M['dark'],3)


def _dehumidifier(M):
    _castors(365,365,M,z=19)
    # Hollow removable collection bucket; walls remain separately editable.
    B('deep tank bottom',(0,0,38),(380,380,22),M['blue'],12)
    for x in [-181,181]:B('water bucket side',(x,0,160),(18,378,263),M['blue'],5)
    for y in [-181,181]:B('water bucket front rear',(0,y,160),(348,18,263),M['blue'],5)
    B('tank water level window',(0,-192,130),(27,2,121),M['glass'],5)
    for z in [90,124,158]:B('tank level graduation',(25,-193,z),(11,2,2),M['cream'],0)
    B('upper machine housing',(0,0,440),(361,355,365),M['cream'],24)
    _grille('broad front intake',0,-181,430,305,251,M,17,depth=8)
    _grille('rear machine intake',0,181,430,305,251,M,17,depth=8)
    B('top control inset',(0,-62,627),(159,66,5),M['dark'],6)
    text('humidity display','45',(0,-65,631),24,M['light'],front=False)
    for x in [-59,59]:C('top control button',(x,-61,632),5,1,M['cream'],s=16)
    tube('folded top carrying handle',[(-88,45,624),(-88,61,640),(88,61,640),(88,45,624)],8,M['dark'],8)
    for x in [-183,183]:B('bucket lifting grip',(x,0,228),(8,112,30),M['dark'],5)
    C('drain hose port',(103,185,306),13,9,M['dark'],axis='Y',s=20)


def _electrical_panel(M):
    B('shallow service enclosure',(0,17,450),(374,72,877),M['steel'],7)
    B('outer folded trim flange',(0,-22,450),(400,7,900),M['steel'],3)
    B('inset door reveal',(0,-27,457),(340,4,796),M['dark'],5)
    B('closed hinged cover',(0,-31,457),(329,5,785),M['steel'],4)
    for z in [147,763]:C('door hinge knuckle',(-163,-33,z),5,48,M['steel'],s=16)
    B('latch recessed surround',(130,-35,467),(22,3,47),M['dark'],3)
    B('quarter turn recessed latch',(130,-38,467),(11,5,30),M['steel'],2)
    for x in [-185,185]:
        for z in [30,450,870]:_screw('trim fixing',x,-28,z,M,4)
    B('blank original identification plate',(0,-36,758),(137,1,53),M['paper'],1)
    text('plain service label','SERVICE',(0,-37,760),13,M['dark'])
    # Independent internal deadfront and switches preserved behind the closed door.
    B('internal deadfront',(0,-17,450),(306,3,740),M['dark'],2)
    for x in [-50,50]:
        for i in range(12):B('internal breaker toggle',(x,-21,155+i*49),(34,6,14),M['rubber'],1)


def _smoke_alarm(M):
    # Base at highest Z meets ceiling; detailed face points down toward occupants.
    C('twist mounting base',(0,0,41),60,8,M['dark'],s=48)
    lathe('alarm outer shell',[(0,7),(46,7),(61,11),(69,19),(70,31),(68,38),(63,42),(0,42)],M['cream'],64)
    C('lower perforation shadow disc',(0,0,8),58,4,M['dark'],s=48)
    C('large lower test hush button',(0,0,6),29,12,M['cream'],s=48)
    for i in range(32):
        a=i*math.tau/32
        o=B('radial air intake separator',(45*math.cos(a),45*math.sin(a),6),(21,4,5),M['cream'],1)
        o.rotation_euler.z=a
    C('status lens',(0,-20,-.5),2.5,1.5,M['light'],s=16)
    # Mesh font faces down. It remains original static labeling.
    o=text('test button legend','TEST',(0,4,-.4),6,M['dark'],front=False);o.rotation_euler.x=math.pi


def _humidifier(M):
    _feet(230,180,M,z=3,r=10)
    B('humidifier lower base',(0,0,58),(245,195,108),M['cream'],20)
    B('base tank seal',(0,0,111),(232,181,5),M['dark'],5)
    # Tank is a closed shell with real wall thickness and an open top beneath lid.
    tank=B('translucent removable water tank',(0,0,210),(234,184,199),M['glass'],19)
    _cut(tank,B('tank hollow interior cutter',(0,0,217),(222,172,202),M['glass'],16))
    B('original blue water level',(0,0,174),(214,164,114),M['blue'],16)
    B('removable top fill lid',(0,0,311),(237,187,15),M['cream'],8)
    C('directional nozzle swivel',(58,0,326),31,16,M['cream'],s=32)
    C('nozzle outlet',(58,0,335),20,3,M['dark'],s=28)
    B('nozzle jet divider',(58,0,338),(39,4,6),M['cream'],1)
    B('front display bezel',(0,-98,60),(115,3,46),M['dark'],6)
    text('static humidity reading','45%',(0,-101,65),21,M['light'])
    for x in [-33,0,33]:C('front touch control',(x,-101,37),3,1,M['cream'],axis='Y',s=12)
    for z in [146,181,216,251]:B('side level mark',(118,0,z),(1,16,2),M['cream'],0)


def _return_grille(M):
    _panel_frame('folded air return frame',350,350,20,175,M,border=20)
    _grille('room return',0,-7,175,312,305,M,18,depth=15)
    for x in [-161,161]:
        for z in [14,336]:_screw('frame countersunk screw',x,-11,z,M,3)


def _dimmer(M):
    B('rear plate shadow line',(0,3,65),(84,4,124),M['dark'],4)
    B('beveled dimmer faceplate',(0,-1,65),(90,8,130),M['cream'],4)
    B('insert recessed border',(0,-6,65),(44,3,90),M['dark'],2)
    o=B('rocker paddle',(-4,-9,65),(31,6,81),M['cream'],3);o.rotation_euler.x=.045
    B('slider recessed track',(15,-10,65),(4,3,70),M['dark'],1)
    B('dimmer slider thumb tab',(15,-13,76),(8,5,15),M['cream'],2)
    B('subtle status light bar',(14,-12,95),(1.5,1,10),M['light'],.5)


def _thermostat(M):
    B('rear wall mounting plate',(0,9,55),(98,9,98),M['dark'],8)
    B('soft square metal case',(0,0,55),(110,22,110),M['steel'],12)
    B('recessed glass screen',(0,-12,57),(99,3,95),M['dark'],9)
    text('static temperature graphic','21',(0,-14.1,60),31,M['cream'])
    text('static thermostat unit','C',(29,-14.1,69),8,M['cream'])
    text('static operating caption','ROOM',(0,-14.1,35),8,M['cream'])
    C('screen degree glyph',(23,-14.1,72),1.1,.8,M['cream'],axis='Y',s=12)
    B('lower sensor window',(0,-12,9),(24,3,4),M['rubber'],1)


def _extinguisher(M):
    # Flat back bracket and shaped spun cylinder are editable independent parts.
    B('wall bracket spine',(0,47,187),(33,8,320),M['dark'],3)
    B('bracket foot shelf',(0,11,8),(88,80,6),M['dark'],2)
    lathe('red spun pressure cylinder',[(0,12),(38,12),(47,20),(50,37),(50,301),
          (48,316),(40,334),(23,347),(17,350),(0,350)],M['red'],48)
    C('valve neck',(0,0,359),17,22,M['brass'],s=20)
    B('valve head',(0,0,379),(31,27,21),M['steel'],4)
    tube('lower carrying handle',[(-12,0,379),(-37,0,386),(-52,0,397),(-56,0,408),(-14,0,408)],5,M['dark'],8)
    tube('upper operating lever',[(11,0,389),(-4,0,410),(-53,0,418)],4,M['steel'],8)
    C('gauge metal housing',(18,-16,371),14,8,M['steel'],axis='Y',s=28)
    C('gauge pale dial',(18,-21,371),11.5,1.5,M['cream'],axis='Y',s=28)
    tube('gauge needle',[(18,-23,371),(22,-23,379)],.9,M['dark'],4)
    for a in [-.75,0,.75]:
        tube('gauge tick',[(18+8*math.sin(a),-23,371+8*math.cos(a)),(18+10*math.sin(a),-23,371+10*math.cos(a))],.5,M['dark'],4)
    ring('pull pin ring',(24,-3,400),9,1.5,M['steel'],axis='Y',steps=20)
    tube('retaining pin',[(14,-2,395),(-13,-2,395)],1.5,M['steel'],6)
    B('tamper seal flag',(30,-3,386),(12,2,15),M['blue'],1)
    tube('flexible black discharge hose',[(19,8,381),(49,8,387),(68,8,369),(70,8,293),(61,8,257)],7,M['rubber'],10)
    C('hose nozzle',(59,8,239),10,43,M['dark'],s=16)
    B('unbranded pictogram label',(0,-49,205),(68,1,139),M['paper'],3)
    text('label title','FIRE',(0,-51,252),16,M['dark'])
    text('label subtitle','PULL AIM',(0,-51,232),8,M['dark'])
    for z in [206,175]:
        B('instruction line',(0,-51,z),(48,.5,2),M['dark'],0)
        for x in [-19,0,19]:C('original pictogram marker',(x,-51,z-11),4,1,M['red'],axis='Y',s=6)
    for z in [98,285]:
        ring('bracket retaining band',(0,0,z),50.5,2.5,M['dark'],steps=48)


def _mini_split(M):
    B('back wall mounting rail',(0,101,162),(715,23,216),M['steel'],4)
    B('air handler main housing',(0,0,164),(850,214,259),M['cream'],30)
    B('service fascia seam',(0,-106,186),(826,3,205),M['dark'],12)
    B('curved front service fascia',(0,-111,196),(820,10,190),M['cream'],15)
    B('lower outlet cavity',(0,-85,42),(747,67,60),M['dark'],9)
    for i in range(18):
        o=B('independent directional outlet vane',(-349+i*41, -95,42),(3,41,43),M['cream'],1);o.rotation_euler.z=.19
    o=B('broad lower swing flap',(0,-106,27),(755,26,9),M['cream'],4);o.rotation_euler.x=math.radians(-20)
    B('top inlet shadow',(0,8,294),(757,150,4),M['dark'],4)
    for i in range(31):B('top inlet slat',(-360+i*24,8,298),(6,146,5),M['cream'],1)
    B('status window',(310,-119,151),(52,2,13),M['dark'],3)
    for x in [295,312]:C('indicator lens',(x,-121,151),2,1,M['light'],axis='Y',s=12)
    for x in [-411,411]:
        for z in [78,218]:_screw('service case fixing',x,-80,z,M,3)


BUILDERS={
    'utility-storage-water-heater':_water_heater,
    'duplex-electrical-outlet-plate':_outlet,
    'utility-panel-radiator':_radiator,
    'utility-portable-ac':_portable_ac,
    'utility-ac-window-adaptor':_ac_adaptor,
    'utility-air-purifier':_purifier,
    'utility-dehumidifier':_dehumidifier,
    'utility-electrical-panel':_electrical_panel,
    'safety-smoke-co-alarm':_smoke_alarm,
    'utility-humidifier':_humidifier,
    'utility-return-grille':_return_grille,
    'wall-switch-dimmer-plate':_dimmer,
    'utility-thermostat':_thermostat,
    'safety-fire-extinguisher':_extinguisher,
    'utility-indoor-mini-split':_mini_split,
}


def create(catalog_id,M):
    """Add one unbranded reference-informed appliance, never clear the scene."""
    if catalog_id not in BUILDERS:raise KeyError(catalog_id)
    before=set(bpy.context.scene.objects)
    BUILDERS[catalog_id](M)
    parts=list(set(bpy.context.scene.objects)-before)
    for obj in parts:
        obj['catalog_id']=catalog_id
        obj['source_family']='HOME-044–057'
        obj['design_basis']='Original reference-informed utility; not installation equipment'
        obj['fixed_pose']=True
    return parts
