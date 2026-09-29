"""Original compact furniture variety HOME-093--105, geometry-only authoring.

All dimensions are millimetres. No scene mutations outside newly created parts.
The parent driver owns normalization, editable .blend saves, export and review.
"""
import math
import bpy
from build_kitchen_essentials import B,C,mesh,tube,ring,lathe,rounded_loop,material
from household_entry import beam,group_transform,open_box,pillow


def hinge_lid(name,w,d,z,M,mat='wood',angle=96,thickness=26,pad=False):
    before=set(bpy.context.scene.objects)
    B(name+' framed lid',(0,0,z),(w,d,thickness),M[mat],9)
    if pad:B(name+' upholstered lid',(0,0,z+28),(w+4,d+4,58),M['fabric'],22)
    group_transform(set(bpy.context.scene.objects)-before,-math.radians(angle),(0,d/2-15,z),axis='X')
    for x in [-w*.32,w*.32]:
        C(name+' hinge barrel',(x,d/2-15,z),6,48,M['brass'],axis='X',s=12)
        tube(name+' articulated lid stay',[(x,d/2-45,z-145),(x,d/2-130,z+75),(x,d/2-24,z+240)],5,M['steel'],8)


def blanket_chest(M):
    open_box('blanket chest cedar interior',1050,480,420,65,M,'wood2',23)
    for x in [-492,492]:
        for y in [-207,207]:B('through-tenon chest foot',(x,y,61),(57,57,122),M['wood'],6)
    for y in [-247,247]:
        for x in [-337,0,337]:
            B('raised mission panel',(x,y,280),(304,18,294),M['wood'],4)
            for s in [-1,1]:B('panel frame stile',(x+s*153,y*1.015,280),(22,16,327),M['endgrain'],3)
        for z in [108,447]:B('long mission rail',(0,y*1.015,z),(1050,25,35),M['wood'],4)
    hinge_lid('blanket chest',1080,510,496,M,angle=96)
    for x in [-534,534]:
        tube('side chest handle',[(x,-68,305),(x*1.035,-60,270),(x*1.035,60,270),(x,68,305)],6,M['brass'],8)


def plant_stand(M):
    centers=[(-170,-105,380),(165,-90,610),(0,175,815)]
    for i,(x,y,z) in enumerate(centers):
        lathe('lipped plant tray',[(0,z-6),(128,z-6),(133,z),(133,z+18),(127,z+18),(125,z+4),(0,z+4)],M['sage'],48,(x,y,0))
        for a in [0,math.tau/3,math.tau*2/3]:
            dx,dy=95*math.cos(a),95*math.sin(a)
            tube('tray support leg',[(x+dx*1.07,y+dy*1.07,8),(x+dx,y+dy,z-7)],8,M['dark'],8)
            C('plant stand foot',(x+dx*1.07,y+dy*1.07,5),11,10,M['rubber'],s=12)
    for a,b in [(0,1),(1,2),(0,2)]:
        x,y,z=centers[a];xx,yy,zz=centers[b]
        tube('interconnected frame stretcher',[(x,y,160),(xx,yy,160)],7,M['dark'],8)


def adjustable_bed(M):
    for x in [-665,665]:
        for y in [-820,0,820]:
            C('adjustable bed support leg',(x,y,131),29,262,M['dark'],s=20)
            C('leveling foot',(x,y,8),34,16,M['rubber'],s=20)
        B('steel longitudinal frame',(x,0,291),(48,1970,60),M['dark'],6)
    for y in [-800,0,800]:B('steel frame crossbeam',(0,y,290),(1390,42,48),M['dark'],5)
    # Flat lower deck, separate hinged calf/hip supports and raised head segment.
    for y,length in [(-740,510),(-235,490),(150,250)]:
        B('separate upholstered deck segment',(0,y,351),(1470,length-6,55),M['dark'],8)
        B('fitted mattress segment',(0,y,466),(1480,length-6,181),M['sage'],25)
        for x in [-700,700]:C('segment hinge pin',(x,y+length/2,350),12,42,M['steel'],axis='X',s=16)
    before=set(bpy.context.scene.objects)
    B('hinged back support deck',(0,642,351),(1470,735,55),M['dark'],8)
    B('raised fitted mattress head',(0,642,466),(1480,727,181),M['sage'],25)
    pillow('tailored head pillow',630,365,110,M,'clay')
    pillow_parts=[o for o in bpy.context.scene.objects if o not in before and 'pillow' in o.name]
    group_transform(pillow_parts,translation=(0,795,558))
    group_transform(set(bpy.context.scene.objects)-before,math.radians(38),(0,275,351),axis='X')
    for x in [-500,500]:
        beam('head raising arm',(x,130,310),(x,628,593),27,18,M['steel'])
        tube('head actuator cylinder',[(x,-150,302),(x,264,431)],19,M['dark'],12)
        tube('head actuator polished rod',[(x,264,431),(x,566,565)],9,M['steel'],10)
        C('actuator pivot pin',(x,264,431),13,40,M['steel'],axis='X',s=12)
    tube('mattress retaining foot rail',[(-395,-1004,413),(-395,-1004,587),(395,-1004,587),(395,-1004,413)],10,M['dark'],10)
    B('side control remote',(755,-35,399),(35,110,16),M['dark'],6)
    for y in [-66,-36,-6]:B('raised remote control button',(757,y,409),(21,17,3),M['cream'],2)


def floor_chair(M,relaxed=False):
    fabric=material('entry-floor-chair-plum',(.27,.105,.17),.95)
    B('floor chair concealed steel pan',(0,-115,34),(590,680,43),M['dark'],15)
    B('floor chair tailored seat',(0,-135,113),(660,750,168),fabric,45)
    for x in [-314,314]:C('concealed recline ratchet',(x,226,102),38,28,M['dark'],axis='X',s=20)
    before=set(bpy.context.scene.objects)
    B('articulated back panel',(0,268,455),(640,130,660),fabric,43)
    B('separate head cushion',(0,201,705),(585,75,160),fabric,32)
    for z in [294,515]:tube('back articulation welt',[(-286,199,z),(286,199,z)],1.8,M['fabric'],6)
    group_transform(set(bpy.context.scene.objects)-before,math.radians(-40 if relaxed else -7),(0,235,115),axis='X')
    for y in [-410,-190,30]:tube('seat quilting seam',[(-295,y,193),(295,y,193)],1.8,M['fabric'],6)


def clothes_valet(M):
    for x in [-218,218]:
        B('valet shaped base foot',(x,0,22),(43,370,44),M['wood'],10)
        beam('slightly splayed valet upright',(x,82,38),(x*.72,65,1175),30,32,M['wood'])
    B('lower accessory tray',(0,0,157),(410,280,18),M['wood2'],8)
    rounded_loop('tray retaining edge',400,270,18,178,M['wood'],5)
    tube('rounded shoulder hanger',[(-230,61,1055),(-198,61,1081),(-132,61,1098),(-67,61,1136),(0,61,1148),(67,61,1136),(132,61,1098),(198,61,1081),(230,61,1055)],17,M['wood'],10)
    tube('forward trouser support', [(-154,65,955),(-170,-112,955),(-144,-130,955),(144,-130,955),(170,-112,955),(154,65,955)],13,M['wood'],10)
    for x in [-158,158]:
        tube('small accessory hook',[(x,55,821),(x*1.22,31,820),(x*1.24,20,849)],7,M['brass'],8)
        C('valet joint screw',(x,44,1113),4,3,M['brass'],axis='Y',s=8)


def bar_cabinet(M):
    for x in [-421,421]:
        for y in [-195,195]:beam('bar cabinet tapered leg',(x*1.015,y*1.03,0),(x,y,300),43,43,M['wood'])
    for x in [-462,462]:B('bar cabinet solid side',(x,0,870),(25,515,1120),M['wood'],5)
    B('recessed walnut rear',(0,246,870),(900,18,1120),M['endgrain'],3)
    for z in [320,750,1424]:B('bar cabinet shelf',(0,0,z),(924,515,25),M['wood2'],5)
    # Stowed pocket-door leaves are intentionally distinct from open shelves.
    for x in [-422,422]:
        B('stowed pocket door',(x,0,1083),(20,470,623),M['wood'],4)
        for z in [790,1380]:B('pocket slide track',(x*1.035,0,z),(12,454,13),M['steel'],2)
        tube('pocket door brass pull',[(x,-238,1080),(x,-254,1080),(x,-254,1160),(x,-238,1160)],5,M['brass'],8)
    # Nine genuine vertical bottle bays, sized for conventional 75--90 mm bottles.
    for x in [-360,-270,-180,-90,0,90,180,270,360]:B('bottle divider',(x,36,534),(12,360,400),M['wood'],3)
    for x in [-270,-90,90,270]:
        for dx in [-21,21]:tube('stemware slide rail',[(x+dx,-203,1345),(x+dx,190,1345)],5,M['brass'],8)
        B('stemware mounting block',(x,180,1390),(68,38,52),M['wood'],4)
    for x in [-445,445]:
        for z in [820,970,1120,1270]:C('adjustable shelf pin',(x,-170,z),3,8,M['steel'],axis='X',s=8)


def daybed(M,wide=False):
    for x in [-1035,1035]:
        for y in [-435,435]:B('daybed corner post',(x,y,418),(55,55,836),M['sage'],8)
        B('daybed raised end panel',(x,0,683),(26,870,272),M['sage'],5)
        B('end cap rail',(x,0,830),(65,930,36),M['wood'],8)
    B('daybed finished back',(0,441,682),(2070,30,272),M['sage'],5)
    B('back cap rail',(0,446,830),(2140,54,36),M['wood'],8)
    for x in range(-910,911,130):B('vertical back panel bead',(x,422,682),(9,8,246),M['wood'],2)
    for y in [-426,426]:B('stationary frame bearer',(0,y,355),(2030,40,84),M['wood'],4)
    extension=-890 if wide else 0
    for x in [-1020,1020]:
        for yy in [extension-425,extension+365]:C('pullout glide wheel',(x,yy,40),27,22,M['rubber'],axis='X',s=20)
    B('moving drawer platform',(0,extension,276),(2020,860,26),M['wood'],4)
    for x in [-670,0,670]:
        B('front storage drawer face',(x,extension-442,207),(648,23,276),M['sage'],6)
        B('drawer inset panel',(x,extension-456,207),(584,7,212),M['sage'],4)
        for dx in [-195,195]:C('drawer round knob',(x+dx,extension-477,225),13,20,M['brass'],axis='Y',s=16)
    for i,x in enumerate(range(-951,952,106)):
        B('stationary slatted deck',(x,0,397),(50,826,20),M['wood2'],3)
        B('interleaved pullout slat',(x+52,extension,397),(49,826,20),M['wood2'],3)
    for j in range(2):
        y=-890*j if wide else 0;z=472 if wide else 472+j*143
        B('separate fitted mattress',(0,y,z),(1950,853,142),M['blue' if j==0 else 'clay'],30)
        for yy in [-408,408]:tube('mattress tailored edge',[(-924,y+yy,z+50),(924,y+yy,z+50)],1.5,M['fabric'],6)


def wall_bed(M,opened=False):
    for x in [-797,797]:B('wall bed cabinet upright',(x,183,1120),(32,396,2240),M['wood'],5)
    B('cabinet rear',(0,366,1118),(1570,18,2236),M['sage'],3)
    B('cabinet cornice',(0,183,2242),(1650,426,38),M['wood'],8)
    B('cabinet base plinth',(0,183,60),(1600,392,120),M['wood'],5)
    for x in [-760,760]:C('bed mechanism pivot',(x,170,399),43,40,M['steel'],axis='X',s=20)
    if opened:
        B('deployed bed face',(0,-815,372),(1530,1980,38),M['sage'],8)
        for x in [-705,705]:B('bed steel side rail',(x,-815,418),(35,1940,54),M['dark'],4)
        for y in range(-1700,120,110):B('visible timber bed slat',(0,y,437),(1440,62,18),M['wood2'],3)
        B('retained queen mattress',(0,-815,542),(1450,1910,194),M['blue'],34)
        for y in [-1500,-90]:B('mattress retaining webbing',(0,y,641),(1450,41,4),M['clay'],2)
        tube('folded down support foot',[(-652,-1759,368),(-652,-1759,25),(652,-1759,25),(652,-1759,368)],18,M['steel'],10)
        for x in [-736,736]:
            beam('bed lift strut',(x,260,803),(x,-245,430),26,18,M['steel'])
            tube('gas spring housing',[(x,255,793),(x,66,657)],18,M['dark'],10)
    else:
        B('closed plain bed face',(0,-23,1130),(1550,34,2150),M['sage'],7)
        for x in [-692,692]:B('closed face vertical reveal',(x,-42,1130),(9,4,2030),M['wood'],2)
        for x in [-92,92]:tube('vertical pull handle',[(x,-42,994),(x,-67,994),(x,-67,1234),(x,-42,1234)],7,M['brass'],10)
        # Original retained mattress and platform are modeled behind the face.
        B('stored bed deck',(0,35,1130),(1500,28,2075),M['dark'],5)
        B('stored mattress',(0,145,1150),(1450,180,1950),M['blue'],26)
        for z in [460,1810]:B('retaining mattress strap',(0,48,z),(1454,8,42),M['clay'],2)


def storage_ottoman(M):
    # Real lined well, separate rim and raised upholstered hinged lid.
    for x in [-430,430]:
        for y in [-267,267]:B('ottoman turned block foot',(x,y,58),(68,68,116),M['wood'],12)
    open_box('ottoman hollow upholstered carcass',980,650,325,82,M,'blue',30)
    B('soft lined storage floor',(0,0,113),(908,578,20),M['fabric'],5)
    for x in [-468,468]:B('felt interior side',(x,0,263),(6,578,280),M['fabric'],2)
    for y in [-303,303]:B('felt interior end',(0,y,263),(925,6,280),M['fabric'],2)
    rounded_loop('tailored upper welt',968,638,20,398,M['fabric'],2)
    hinge_lid('ottoman',994,665,420,M,'blue',angle=70,pad=True)


def lift_recliner(M,pose='seated'):
    # Different high-leg chassis and waterfall cushions from the manual recliner.
    for x in [-301,301]:
        B('lift base runner',(x,0,27),(54,765,54),M['dark'],8)
    for y in [-291,291]:B('base frame crossbar',(0,y,47),(645,44,35),M['dark'],5)
    lift=245 if pose=='raised' else 0
    before=set(bpy.context.scene.objects)
    B('lift chair lower carrier',(0,0,217),(652,630,120),M['dark'],11)
    B('lift chair seat cushion',(0,-76,442),(573,560,145),M['clay'],39)
    B('flexible lift chair lumbar bridge',(0,214,520),(573,124,116),M['clay'],26)
    for x in [-354,354]:
        B('tailored full arm side',(x,0,439),(142,730,465),M['clay'],29)
        B('padded arm cap',(x,-35,658),(149,725,99),M['clay'],35)
    back_before=set(bpy.context.scene.objects)
    for z,w,h in [(615,616,183),(789,630,182),(964,640,197)]:
        B('waterfall padded back roll',(0,274+(z-600)*.08,z),(w,150,h),M['clay'],36)
    B('back upholstered shell',(0,352,804),(664,92,560),M['clay'],30)
    if pose=='reclined':group_transform(set(bpy.context.scene.objects)-back_before,math.radians(-25),(0,250,520),axis='X')
    if pose=='reclined':
        B('continuous extended leg support',(0,-694,417),(575,713,104),M['clay'],29)
        for x in [-221,221]:beam('extended linkage',(x,-220,220),(x,-897,366),25,11,M['steel'])
    else:B('continuous waterfall front footrest',(0,-364,301),(574,88,263),M['clay'],30)
    B('stitched controller pocket',(431,42,372),(8,188,152),M['fabric'],8)
    B('corded lift controller',(443,15,477),(29,62,105),M['dark'],7)
    for z in [456,487]:B('controller rocker button',(460,5,z),(4,30,20),M['cream'],3)
    tube('curved controller cord',[(443,16,423),(452,-3,380),(454,-52,285),(416,-68,240)],3,M['dark'],6)
    chair=set(bpy.context.scene.objects)-before
    if pose=='raised':group_transform(chair,math.radians(16),(0,0,160),translation=(0,-85,lift),axis='X')
    for x in [-231,231]:
        if pose=='raised':
            for a,b in [((x,-280,64),(x,166,414)),((x,278,64),(x,-279,414))]:beam('raised scissor lift arm',a,b,38,15,M['steel'])
            tube('central powered lift cylinder',[(x,245,69),(x,-70,293)],24,M['dark'],12)
            tube('polished lift piston',[(x,-70,293),(x,-262,403)],12,M['steel'],12)
        else:
            beam('lowered scissor lift arm',(x,-274,65),(x,252,180),38,15,M['steel'])
        C('lift mechanism center pivot',(x,0,219 if pose=='raised' else 120),12,35,M['steel'],axis='X',s=16)


def chair_sleeper(M,bed=False):
    for x in [-421,421]:
        for y in [-315,315]:B('sleeper timber block foot',(x,y,56),(70,70,112),M['wood'],11)
    for x in [-445,445]:B('sleeper low upholstered arm',(x,0,387),(171,882,550),M['sage'],33)
    B('finished rear shell',(0,389,442),(737,90,650),M['sage'],28)
    if bed:
        for y in [-1360,-715,-70]:
            B('single sleeper support deck',(0,y,235),(722,636,27),M['dark'],4)
            B('unfolded mattress panel',(0,y,345),(720,636,187),M['blue'],27)
            for x in [-316,316]:
                C('pullout segment support leg',(x,y,114),17,228,M['steel'],s=16)
        for x in [-340,340]:B('telescopic sleeper guide',(x,-760,219),(20,1690,33),M['steel'],3)
        B('lowered head cushion',(0,294,355),(712,100,240),M['blue'],26)
    else:
        B('folded mattress lower section',(0,-55,308),(721,705,137),M['blue'],25)
        B('folded mattress upper section',(0,-55,438),(721,705,122),M['blue'],29)
        back=B('sleeper upright back cushion',(0,243,602),(720,165,415),M['blue'],31);back.rotation_euler.x=math.radians(-7)
        B('visible front pull webbing',(0,-414,328),(83,6,50),M['fabric'],5)
        for x in [-321,321]:B('stowed pullout rail',(x,-55,217),(22,693,28),M['steel'],3)


def vinyl_cabinet(M):
    for x in [-532,532]:
        for y in [-181,181]:beam('vinyl cabinet angled foot',(x*1.03,y*1.08,0),(x,y,180),42,42,M['wood'])
    for x in [-588,588]:B('vinyl cabinet side',(x,0,503),(24,462,670),M['wood'],5)
    # Split rear leaves a genuine 75-mm-wide equipment cable opening.
    for x,w in [(-319,537),(319,537)]:B('rear cable opening panel',(x,222,501),(w,16,644),M['endgrain'],2)
    for z in [190,568,830]:B('record cabinet horizontal panel',(0,0,z),(1200,460,26),M['wood2'],5)
    for x in [-380,-190,0,190,380]:B('vertical LP divider',(x,12,379),(16,396,352),M['wood'],3)
    B('equipment bay divider',(105,0,699),(20,435,236),M['wood'],3)
    B('equipment half shelf',(-247,0,700),(680,425,20),M['wood2'],4)
    for x in [-500,-300,-100,160,330,500]:
        C('shelf fixing',(x,-210,830),3,3,M['brass'],s=8)


def drop_leaf(M,opened=False):
    # Local bottom at bracket/leaf tip; mounting height must be set on the wall.
    B('wall table backplate',(0,40,520),(730,44,970),M['sage'],6)
    for x in [-342,342]:B('shallow storage side',(x,-27,712),(21,140,490),M['wood'],4)
    for z in [478,711,956]:B('shallow ledged shelf',(0,-27,z),(698,140,22),M['wood2'],4)
    for x in [-280,280]:
        for z in [110,902]:C('wall mounting cap',(x,14,z),8,4,M['steel'],axis='Y',s=12)
    if opened:
        B('deployed rounded leaf',(0,-388,474),(720,650,26),M['wood'],14)
        for x in [-237,237]:
            beam('deployed hinged diagonal support',(x,5,103),(x,-519,455),24,18,M['dark'])
            B('underleaf support rail',(x,-350,450),(30,531,25),M['dark'],4)
            C('bracket hinge pivot',(x,5,103),12,36,M['steel'],axis='X',s=16)
        C('continuous leaf hinge',(0,-61,462),6,664,M['brass'],axis='X',s=12)
    else:
        B('folded rounded leaf',(0,-103,154),(720,26,650),M['wood'],12)
        for x in [-237,237]:B('stowed support bracket',(x,-72,280),(25,22,344),M['dark'],4)
        C('continuous leaf hinge',(0,-87,470),6,664,M['brass'],axis='X',s=12)


def create(catalog_id,M):
    if catalog_id in {'adjustable-bed-base','expanding-daybed','expanding-daybed-wide','wall-bed','wall-bed-open','storage-ottoman','lift-recliner','lift-recliner-raised','lift-recliner-reclined','chair-sleeper','chair-sleeper-open'}:
        M=dict(M)
        M['blue']=material('entry-slate-upholstery',(.13,.27,.34),.96)
        M['clay']=material('entry-terracotta-textile',(.47,.18,.105),.97)
        if catalog_id in {'adjustable-bed-base','chair-sleeper','chair-sleeper-open'}:M['sage']=material('entry-sage-upholstery',(.23,.34,.26),.96)
    dispatch={
        'blanket-chest':lambda:blanket_chest(M),
        'tiered-plant-stand':lambda:plant_stand(M),
        'adjustable-bed-base':lambda:adjustable_bed(M),
        'floor-chair':lambda:floor_chair(M),'floor-chair-relaxed':lambda:floor_chair(M,True),
        'clothes-valet':lambda:clothes_valet(M),'bar-cabinet':lambda:bar_cabinet(M),
        'expanding-daybed':lambda:daybed(M),'expanding-daybed-wide':lambda:daybed(M,True),
        'wall-bed':lambda:wall_bed(M),'wall-bed-open':lambda:wall_bed(M,True),
        'storage-ottoman':lambda:storage_ottoman(M),
        'lift-recliner':lambda:lift_recliner(M),'lift-recliner-raised':lambda:lift_recliner(M,'raised'),
        'lift-recliner-reclined':lambda:lift_recliner(M,'reclined'),
        'chair-sleeper':lambda:chair_sleeper(M),'chair-sleeper-open':lambda:chair_sleeper(M,True),
        'vinyl-cabinet':lambda:vinyl_cabinet(M),
        'wall-drop-leaf-table':lambda:drop_leaf(M),'wall-drop-leaf-table-open':lambda:drop_leaf(M,True),
    }
    if catalog_id not in dispatch:raise KeyError(catalog_id)
    dispatch[catalog_id]()


def support_surfaces(catalog_id):
    """Raw Blender mm support planes; parent maps Y to browser local Z."""
    surfaces={
        'blanket-chest':[("inside", "Inside open blanket chest",0,0,970,400,88,370)],
        'tiered-plant-stand':[("low", "Low circular tray interior",-170,-105,170,170,384,900),("middle", "Middle circular tray interior",165,-90,170,170,614,900),("high", "High circular tray interior",0,175,170,170,819,900)],
        'clothes-valet':[("tray", "Low accessory tray",0,0,330,205,166,540)],
        'bar-cabinet':[("serving", "Recessed serving shelf",0,-8,770,430,762.5,540),("top", "Cabinet top",0,0,870,465,1436.5,650)],
        'expanding-daybed':[("mattress", "Upper flat daybed mattress",0,0,1840,750,686,600)],
        'expanding-daybed-wide':[("mattress-back", "Flat rear daybed mattress",0,0,1840,750,543,600),("mattress-front", "Flat extended daybed mattress",0,-890,1840,750,543,600)],
        'wall-bed-open':[("mattress", "Flat queen mattress between straps",0,-795,1350,1300,639,800)],
        'chair-sleeper':[("seat", "Flat sleeper chair seat",0,-125,635,460,499,350)],
        'chair-sleeper-open':[("mattress-foot", "Flat foot mattress panel",0,-1360,650,560,438.5,600),("mattress-middle", "Flat middle mattress panel",0,-715,650,560,438.5,600),("mattress-head", "Flat head mattress panel",0,-80,650,560,438.5,400)],
        'storage-ottoman':[("inside", "Inside open storage ottoman",0,-12,865,535,123,258)],
        'vinyl-cabinet':[("top", "Turntable top",0,0,1140,410,843,850),("equipment-low", "Left equipment bay lower",-242,0,615,395,581,107),("equipment-high", "Left equipment bay upper",-242,0,615,395,710,107),("equipment-right", "Right equipment bay",342,0,418,395,581,230)],
        'wall-drop-leaf-table':[("lower", "Lower shallow wall shelf",0,-27,650,100,489,200),("middle", "Middle shallow wall shelf",0,-27,650,100,722,210),("top", "Upper shallow wall shelf",0,-27,650,100,967,500)],
        'wall-drop-leaf-table-open':[("worktop", "Deployed dining leaf",0,-404,665,585,487,900),("middle", "Middle shallow wall shelf",0,-27,650,100,722,210),("top", "Upper shallow wall shelf",0,-27,650,100,967,500)],
    }
    if catalog_id=='vinyl-cabinet':
        surfaces[catalog_id]+=[(f'lp-{i+1}',f'LP bay {i+1}',x,12,160,350,203,352) for i,x in enumerate([-478,-285,-95,95,285,478])]
    keys=('id','label','x','z','width','depth','height','clearance')
    return [dict(zip(keys,s)) for s in surfaces.get(catalog_id,[])]
