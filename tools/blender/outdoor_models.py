"""Original outdoor miniatures and opt-in perimeter dioramas. Metres, Z up."""
import math,random
import bpy
from mathutils import Vector

def outdoor_builders(box,cyl,material,finish):
    def mesh(name,verts,faces,mat):
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
    def rod(name,a,b,r,mat):
        a,b=Vector(a),Vector(b);o=cyl(name,r,(b-a).length,(a+b)/2,mat,8);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
    def leaf(name,center,length,width,angle,mat,maple=False):
        x,y,z=center;c,s=math.cos(angle),math.sin(angle)
        points=[(0,-.5),(.17,-.15),(.46,-.23),(.32,.06),(.5,.21),(.18,.21),(0,.5),(-.18,.21),(-.5,.21),(-.32,.06),(-.46,-.23),(-.17,-.15)] if maple else [(0,-.5),(.5,-.06),(.35,.26),(0,.5),(-.35,.26),(-.5,-.06)]
        v=[(x,y,z+.025*length)]+[(x+px*width*c-py*length*s,y+px*width*s+py*length*c,z-.025*length) for px,py in points]
        o=mesh(name,v,[(0,n+1,(n+1)%len(points)+1) for n in range(len(points))],mat)
        # Fold leaves through the canopy rather than arranging every leaf flat.
        tilt=.55*math.sin(x*13+y*7+z*9)
        for vertex in o.data.vertices:
            dy=vertex.co.y-y;dz=vertex.co.z-z;vertex.co.y=y+dy*math.cos(tilt)-dz*math.sin(tilt);vertex.co.z=z+dy*math.sin(tilt)+dz*math.cos(tilt)
        return o
    def palette(m):
        return {**m,'leaf':material('foliage-main',(.27,.42,.20),None,.99),'leaf2':material('foliage-tips',(.43,.55,.25),None,.99),'pink':material('blossom-pink',(.80,.43,.48),None,.97),'purple':material('lavender-petals',(.42,.30,.53),None,.97),'soil':material('garden-soil',(.19,.12,.08),None,1),'stone':material('paving-stone',(.52,.51,.45),None,.99),'grout':material('paving-joints',(.30,.31,.27),None,1),'cream':material('canvas-cream',(.89,.81,.67),None,.98)}
    def flower(m,x,y,z,kind,scale=1):
        rod('flower_stem',(x,y,0),(x,y,z),.009*scale,m['leaf'])
        for n in range(3):leaf('stem_leaf',(x+.02*n,y,z*(.25+n*.14)),.15*scale,.06*scale,n*2,m['leaf'])
        if kind=='lavender':
            for n in range(5):
                for a in range(3):leaf('lavender_floret',(x+.018*math.cos(a*2),y+.018*math.sin(a*2),z-n*.029*scale),.067*scale,.037*scale,a*2,m['purple'])
        else:
            count=5 if kind=='tulip' else 8
            for n in range(count):
                a=n*math.tau/count;r=.032*scale
                o=leaf('flower_petal',(x+r*math.cos(a),y+r*math.sin(a),z),.095*scale,.049*scale,a-math.pi/2,m['pink'] if kind=='tulip' else m['cream'])
                if kind=='tulip':
                    for v in o.data.vertices:v.co.z+=.04*scale*((v.co.x-x)**2+(v.co.y-y)**2)**.5/(.08*scale)
            cyl('flower_center',.023*scale,.014*scale,(x,y,z+.01),m['mustard'],10)
    def planter(m,w,d,h):
        box('planter_soil',(w-.05,d-.05,h-.025),(0,0,(h-.025)/2),m['soil'],.006)
        for row in range(3):
            for sy in (-1,1):box('planter_long_board',(w,.04,h/3-.007),(0,sy*(d/2-.02),(row+.5)*h/3),m['wood'],.007)
            for sx in (-1,1):box('planter_end_board',(.04,d,h/3-.007),(sx*(w/2-.02),0,(row+.5)*h/3),m['wood'],.007)
    def vegetation(m,style):
        m=palette(m);rng=random.Random(82)
        sizes={'lavender':(.55,.5,.65),'daisy':(.5,.45,.5),'tulip':(.45,.45,.65),'bed':(1.6,.7,.65),'box':(1,.3,.42),'hedge':(1.5,.55,1.1),'bush':(.9,.85,1),'spruce':(1.8,1.8,3.6),'maple':(3.5,3.2,4.3),'sakura':(3.4,3.2,4),'grass':(.3,.3,.18)}
        w,d,h=sizes[style]
        if style=='grass':
            for n in range(18):
                a=rng.random()*math.tau;r=rng.random()*.12;x=math.cos(a)*r;y=math.sin(a)*r;bh=rng.uniform(.08,.18)
                mesh('tapered_grass_blade',[(x-.012,y,0),(x+.012,y,0),(x+math.cos(a)*.06,y+math.sin(a)*.06,bh)],[(0,1,2)],m['leaf'] if n%3 else m['leaf2'])
            return w,d,h
        if style in ('spruce','maple','sakura'):
            rod('branching_trunk',(0,0,0),(.08,.02,h*.83),.07,m['wood'])
            if style=='spruce':
                for tier in range(9):
                    z=.6+tier*.32;r=.9*(1-tier/10)
                    for n in range(7):
                        a=n*math.tau/7+tier*.5;end=(r*math.cos(a),r*math.sin(a),z-.12);rod('conifer_bough',(0,0,z+.12),end,.018,m['wood'])
                        for j in range(9):
                            t=(j+1)/9
                            for side in (-1,1):leaf('pointed_needle_spray',(end[0]*t-side*.06*math.sin(a),end[1]*t+side*.06*math.cos(a),z+.08*(1-t)),r*.85,.26,a-math.pi/2+side*.4,m['leaf'] if j%2 else m['leaf2'])
            else:
                for n in range(14):
                    a=n*2.4;r=rng.uniform(.6,1.35);z=rng.uniform(h*.60,h*.83);end=(r*math.cos(a),r*math.sin(a),z)
                    rod('spreading_branch',(0,0,h*.38),end,.027,m['wood'])
                    for j in range(70 if style=='maple' else 40):
                        x=end[0]+rng.uniform(-.48,.48);y=end[1]+rng.uniform(-.48,.48);zz=z+rng.uniform(-.42,.42)
                        leaf('maple_leaf' if style=='maple' else 'cherry_leaf',(x,y,zz),.45 if style=='maple' else .25,.36 if style=='maple' else .14,rng.random()*6.28,m['clay'] if style=='maple' and j%3 else m['mustard'] if style=='maple' else m['leaf2'],style=='maple')
                        if style=='sakura':
                            for petal in range(5):
                                pa=petal*math.tau/5;leaf('cherry_blossom',(x+.06*math.cos(pa),y+.06*math.sin(pa),zz+.045),.13,.085,pa,m['pink'] if j%3 else m['cream'])
            return w,d,h
        if style in ('hedge','bush'):
            for branch in range(12):
                x=rng.uniform(-w*.4,w*.4);y=rng.uniform(-d*.35,d*.35);z=rng.uniform(h*.55,h*.95);rod('shrub_branch',(x*.3,y*.3,0),(x,y,z),.013,m['wood'])
                for j in range(28):leaf('shrub_leaf',(x+rng.uniform(-.13,.13),y+rng.uniform(-.1,.1),z-rng.uniform(0,h*.5)),.15,.09,rng.random()*6.28,m['leaf'] if j%2 else m['leaf2'])
                if style=='bush':
                    for n in range(5):leaf('shrub_blossom',(x+.04*math.cos(n*1.25),y+.04*math.sin(n*1.25),z),.09,.06,n*1.25,m['pink'])
            return w,d,h
        base=0
        if style in ('bed','box'):base=h*.46;planter(m,w,d,base)
        if style=='tulip':
            base=.25;cyl('terracotta_pot',.13,base,(0,0,base/2),m['clay'],18,taper=1.38);cyl('pot_soil',.165,.012,(0,0,base),m['soil'],18)
        for n in range(18 if style=='bed' else 10 if style=='box' else 9):
            x=rng.uniform(-w*(.20 if style=='tulip' else .36),w*(.20 if style=='tulip' else .36));y=rng.uniform(-d*(.20 if style=='tulip' else .31),d*(.20 if style=='tulip' else .31));z=rng.uniform(h*.68,h)
            before=set(bpy.context.scene.objects);flower(m,x,y,z-base,'lavender' if style=='lavender' or (style=='bed' and n%2) else 'tulip' if style=='tulip' else 'daisy',.65 if style=='box' else 1)
            for o in set(bpy.context.scene.objects)-before:o.location.z+=base
        return w,d,h
    def furniture(m,style):
        m=palette(m);w,d,h={'chair':(.58,.62,.85),'adirondack':(.8,.95,.95),'love':(1.6,.8,.85),'chaise':(.72,1.95,.85),'bench':(1.5,.55,.85),'bistro':(.7,.7,.74),'table':(1.8,.9,.76),'umbrella':(2.4,2.4,2.45),'gas':(1.4,.65,1.15),'kettle':(.65,.7,.95),'fire':(.8,.8,.48)}[style]
        if style in ('bistro','table'):
            if style=='bistro':
                cyl('bistro_top',w/2,.05,(0,0,h-.025),m['wood'],48);cyl('pedestal',.055,h-.06,(0,0,(h-.06)/2),m['metal'],12)
                for a in (0,math.pi/2):box('cross_base',(w*.75,.08,.05),(0,0,.025),m['metal'],.012,rot=(0,0,a))
            else:
                for n in range(6):box('tabletop_plank',(w,d/6-.008,.05),(0,-d/2+(n+.5)*d/6,h-.025),m['wood'],.011)
                for x in (-w*.43,w*.43):
                    for y in (-d*.37,d*.37):box('table_leg',(.09,.09,h-.05),(x,y,(h-.05)/2),m['wood'],.016)
                box('table_stretcher',(w*.87,.06,.07),(0,0,.23),m['wood'],.012)
            return w,d,h
        if style=='umbrella':
            cyl('weighted_base',.32,.10,(0,0,.05),m['stone'],24);cyl('umbrella_pole',.034,h,(0,0,h/2),m['wood'],12)
            for n in range(8):
                a=n*math.tau/8;b=(n+1)*math.tau/8;verts=[(0,0,h),(w/2*math.cos(a),d/2*math.sin(a),h-.42),(w/2*math.cos(b),d/2*math.sin(b),h-.42)]
                verts+= [(x,y,z-.012) for x,y,z in verts];mesh('fabric_canopy_panel',verts,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],m['cream'] if n%2 else m['variant']);rod('canopy_rib',verts[0],verts[1],.013,m['wood'])
            return w,d,h
        if style in ('gas','kettle','fire'):
            if style=='gas':
                box('bbq_cart',(.82,.54,.69),(0,0,.385),m['metal'],.045)
                for s in (-1,1):box('cart_door',(.39,.025,.55),(s*.20,-.29,.40),m['variant'],.016);box('side_shelf',(.28,.53,.05),(s*.56,0,.79),m['metal'],.015)
                box('barbecue_lid',(.84,.57,.34),(0,0,.97),m['variant'],.12)
                box('lid_handle',(.36,.04,.04),(0,-.33,.98),m['wood'],.01)
                for x in (-.27,0,.27):cyl('heat_control',.027,.025,(x,-.296,.72),m['metal'],12,rot=(math.pi/2,0,0))
                for x in (-.35,.35):
                    for y in (-.23,.23):cyl('cart_foot',.038,.10,(x,y,.05),m['metal'],10)
            else:
                r=w*.44;z=h*.66 if style=='kettle' else h*.66
                # Lathed hemispherical shell with genuine open interior for fire bowl.
                verts=[];segments=32
                profile=[(r*.38,-r*.43),(r*.82,-r*.29),(r,0),(r-.022,0),(r*.79,-r*.24),(r*.38,-r*.37)]
                for radius,dz in profile:
                    for n in range(segments):a=n*math.tau/segments;verts.append((radius*math.cos(a),radius*math.sin(a),z+dz))
                mesh('open_bowl',verts,[(row*segments+n,row*segments+(n+1)%segments,(row+1)*segments+(n+1)%segments,(row+1)*segments+n) for row in range(len(profile)-1) for n in range(segments)],m['metal'])
                cyl('bowl_bottom',r*.39,.018,(0,0,z-r*.395),m['metal'],32)
                for n in range(3):
                    a=n*math.tau/3;rod('tripod_leg',(r*.60*math.cos(a),r*.60*math.sin(a),z-r*.22),(w*.36*math.cos(a),d*.36*math.sin(a),.025),.023,m['metal'])
                if style=='kettle':
                    cyl('closed_kettle_lid',r,.15,(0,0,z+.065),m['variant'],32,taper=.7);box('lid_grip',(.18,.05,.06),(0,0,z+.18),m['wood'],.016)
                    for n in range(3):box('lid_vent',(.04,.012,.007),(.10,n*.035-.035,z+.14),m['metal'],.002)
                    rod('wheel_axle',(-.22,.24,.075),(.22,.24,.075),.018,m['metal'])
                    for x in (-.20,.20):
                        rod('wheel_support',(x*.5,.12,z-r*.24),(x,.24,.075),.024,m['metal'])
                        cyl('tripod_wheel',.065,.035,(x,.24,.075),m['metal'],14,rot=(0,math.pi/2,0))
                else:
                    for n in range(3):rod('stacked_log',(-.18,.09*(n-1),z-.05),(.18,.09*(n-1),z+.015),.04,m['wood'])
            return w,d,h
        sy=.43 if style not in ('adirondack','chaise') else .30
        seatD=d*.6 if style=='chaise' else d*.69
        for x in (-w*.42,w*.42):
            for y in (-d*.37,d*.37):box('structural_leg',(.065,.065,sy),(x,y,sy/2),m['wood'],.012)
            box('seat_side_rail',(.075,d*.88,.10),(x,0,sy-.04),m['wood'],.014)
        for n in range(6):box('seat_slat',(w*.90,seatD/6-.012,.047),(0,-d*.1-seatD/2+(n+.5)*seatD/6,sy),m['wood'],.009)
        backY=d*.30
        for n in range(7 if w>1 else 5):
            count=7 if w>1 else 5;x=-w*.4+n*w*.8/(count-1);bh=h-sy-.05-(abs(x)/w*.18 if style=='adirondack' else 0)
            box('back_slat',(w*.8/count-.016,.055,bh),(x,backY,sy+bh/2),m['wood'],.012,rot=(-.25 if style in ('adirondack','chaise') else -.08,0,0))
        if style in ('love','chaise'):box('fitted_outdoor_cushion',(w*.83,seatD,.14),(0,-d*.10,sy+.08),m['fabric'],.045)
        if style=='love':box('fitted_back_cushion',(w*.84,.16,.32),(0,backY-.08,h-.18),m['fabric'],.046)
        for x in (-w*.46,w*.46):
            box('arm_front_support',(.055,.055,.20),(x,-d*.25,sy+.1),m['wood'],.01)
            box('broad_arm',(.12,d*.75,.055),(x,0,sy+.21),m['wood'],.014)
        return w,d,h
    def paving(m,style):
        m=palette(m);w,d,h=(.7,2.4,.06) if style=='steps' else (2,2,.09 if style=='deck' else .06 if style=='brick' else .07)
        if style=='steps':
            for n in range(4):
                cyl('irregular_stepping_slab',.32,h,((.04 if n%2 else -.04),-.88+n*.59,h/2),m['stone'],7)
            return w,d,h
        box('paving_foundation',(w,d,h*.45),(0,0,h*.225),m['grout'],.006)
        count=8 if style=='cobble' else 2 if style=='concrete' else 4 if style=='deck' else 10
        for row in range(count):
            for col in range(count):
                size=w/count;x=-w/2+(col+.5)*size;y=-d/2+(row+.5)*size
                if style=='deck':
                    for n in range(4):box('deck_tile_slat',(size-.012,size/4-.012,h*.55),(x,y-size/2+(n+.5)*size/4,h*.725),m['wood'],.007,rot=(0,0,0)) if (row+col)%2==0 else box('deck_tile_slat',(size/4-.012,size-.012,h*.55),(x-size/2+(n+.5)*size/4,y,h*.725),m['wood'],.007)
                elif style=='brick':
                    for n in range(2):box('woven_paving_brick',(size-.01,size/2-.01,h*.55),(x,y-size/4+n*size/2,h*.725),m['clay'],.007) if (row+col)%2==0 else box('woven_paving_brick',(size/2-.01,size-.01,h*.55),(x-size/4+n*size/2,y,h*.725),m['clay'],.007)
                else:
                    if style=='cobble' and row%2 and col%2:continue
                    span=2 if style=='cobble' and row%2 else 1
                    box('rounded_cobble' if style=='cobble' else 'concrete_slab',(size*span-.016,size-.016,h*.55),(x+size*(span-1)/2,y,h*.725),m['stone'] if (row+col)%3 else m['cream'],.025 if style=='cobble' else .008)
        return w,d,h
    def backdrop(m,style):
        m=palette(m);rng=random.Random(7)
        def house(x,y,w,d,h,barn=False):
            box('distant_building',(w,d,h),(x,y,h/2),m['clay'] if barn else m['cream'],.07)
            mesh('pitched_roof',[(x-w*.55,y-d*.55,h),(x+w*.55,y-d*.55,h),(x+w*.55,y+d*.55,h),(x-w*.55,y+d*.55,h),(x,y-d*.55,h+1.2),(x,y+d*.55,h+1.2)],[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2)],m['wood_dark'])
            for sx in (-.25,.25):box('distant_window',(.45,.06,.65),(x+sx*w,y-d/2-.04,h*.58),m['blue'],.02)
        for n in range(12 if style=='city' else 6):
            a=n*math.tau/(12 if style=='city' else 6);x=18*math.cos(a);y=18*math.sin(a)
            if style=='city':
                h=rng.uniform(3,8);box('city_block',(2.5,2.5,h),(x,y,h/2),m['stone'],.06)
                for z in range(1,int(h)):
                    for dx in (-.65,.65):box('city_window',(.52,.06,.57),(x+dx,y-1.28,z),m['cream'],.018)
            elif style=='medieval':
                cyl('distant_stone_tower',1.1,4,(x,y,2),m['stone'],10)
                cyl('conical_tower_roof',1.3,1.7,(x,y,4.85),m['clay'],10,taper=.01)
                house(x+2,y,2.8,2.2,2)
            elif style in ('suburban','farm'):house(x,y,3.5 if style=='farm' else 2.7,2.8,2.5,style=='farm')
            else:
                # Folded low-poly rolling terrain remains far outside the build area.
                mesh('distant_ridge',[(x-4,y-2,0),(x+4,y-2,0),(x+3,y+2,0),(x-3,y+2,0),(x-1,y,3),(x+1,y,2)],[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],m['leaf2'])
            if style=='farm':
                for j in range(5):box('field_row',(3,.18,.12),(x-1.5,y+2+j*.4,.06),m['mustard'],.02)
        # Symmetric datum patches establish a fixed empty-center envelope.
        for x in (-20,20):box('perimeter_marker',(.05,.05,.05),(x,0,.025),m['stone'],.008)
        for y in (-20,20):box('perimeter_marker',(.05,.05,.05),(0,y,.025),m['stone'],.008)
        return 40,40,8 if style=='city' else 5
    result={}
    for id,style in [('lavender-clump','lavender'),('daisy-clump','daisy'),('tulip-planter','tulip'),('raised-flowerbed','bed'),('balcony-flowerbox','box'),('garden-hedge','hedge'),('flowering-shrub','bush'),('spruce-tree','spruce'),('maple-tree','maple'),('sakura-tree','sakura'),('grass-clump','grass')]:result[id]=lambda m,s=style:vegetation(m,s)
    for id,style in [('patio-dining-chair','chair'),('adirondack-chair','adirondack'),('patio-loveseat','love'),('patio-chaise','chaise'),('patio-bistro-table','bistro'),('patio-dining-table','table'),('garden-bench','bench'),('patio-parasol','umbrella'),('gas-bbq','gas'),('kettle-bbq','kettle'),('patio-fire-bowl','fire')]:result[id]=lambda m,s=style:furniture(m,s)
    for id,style in [('cobble-patio','cobble'),('concrete-patio','concrete'),('brick-patio','brick'),('deck-patio','deck'),('stepping-stones','steps')]:result[id]=lambda m,s=style:paving(m,s)
    for style in ('city','suburban','rural','farm','medieval'):result['backdrop-'+style]=lambda m,s=style:backdrop(m,s)
    return result
