"""Batch 4 original miniatures. Named editable parts; no retailer meshes.
Support planes below match src/shelfSurfaces.ts. See docs/interior-research.md.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

def interior_builders(box,cyl,material,finish):
    def palette(m):
        return {**m,'cream':material('warm-cream',(.87,.81,.69),None,.97),
                'accent':material('accent-clay',(.65,.34,.24),None,.97),
                'ink':material('ink-details',(.09,.14,.16),None,.98),
                'skin':material('warm-porcelain',(.74,.50,.33),None,.94),
                'seam':material('upholstery-seams',(.39,.46,.34),None,1)}
    def rod(name,a,b,r,mat,vertices=10):
        a,b=Vector(a),Vector(b);obj=cyl(name,r,(b-a).length,(a+b)/2,mat,vertices)
        obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return obj
    def mesh(name,verts,faces,mat,bevel=0):
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
        if bevel:finish(obj,bevel,2)
        return obj
    def flat(name,points,z,mat):
        return mesh(name,[(x,y,z) for x,y in points],[tuple(range(len(points)))],mat)
    def rug(m,style):
        m=palette(m);w,d,h={'diamond':(2,2.8,.024),'kilim':(1.8,2.6,.018),'jute':(2,2,.018),'arch':(2,2.8,.024),'checker':(2.4,3,.024)}[style]
        if style=='jute':
            cyl('round_bound_foundation',w/2,h*.55,(0,0,h*.275),m['linen'],96)
            for n in range(1,30):
                r=n*.034
                # Raised low-poly concentric woven strands, not stacked ellipsoids.
                bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.004,major_segments=64,minor_segments=4,location=(0,0,h-.004))
                obj=bpy.context.object;obj.name='woven_concentric_ring';obj.data.materials.append(m['cream'] if n%3==0 else m['mustard'])
            return w,d,h
        edge=.075 if style=='kilim' else .035
        box('bound_rug_foundation',(w,d-2*edge,h*.8),(0,0,h*.4),m['cream'],.006)
        box('soft_woven_field',(w-.07,d-2*edge-.07,h*.2),(0,0,h*.9),m['variant'],.003)
        z=h+.0003
        if style=='diamond':
            for x in (-.52,0,.52):
                for y in (-.78,0,.78):
                    corners=[(x,y-.35),(x+.24,y),(x,y+.35),(x-.24,y)]
                    for i in range(4):
                        a,b=corners[i],corners[(i+1)%4];rod('woven_diamond_line',(*a,z),(*b,z),.007,m['cream'],6)
            for s in (-1,1):box('border_stripe',(w-.16,.025,.001),(0,s*(d/2-.15),z),m['accent'],.0002)
        elif style=='kilim':
            for n in range(7):
                y=(n-3)*.31
                box('woven_band',(w-.1,.09,.001),(0,y,z),m['accent'] if n%2 else m['cream'],.0003)
                for x in (-.52,0,.52):flat('stepped_kilim_diamond',[(x-.19,y),(x,y+.12),(x+.19,y),(x,y-.12)],z+.001,m['ink'] if n%2 else m['accent'])
            for side in (-1,1):
                for n in range(32):
                    x=-w/2+.05+n*(w-.1)/31
                    rod('hand_tied_fringe',(x,side*(d/2-edge),h*.45),(x+.007*math.sin(n),side*d/2,h*.4),.007,m['cream'],6)
        elif style=='checker':
            for row in range(6):
                for col in range(5):
                    if (row+col)%2==0:box('broad_wool_check',((w-.12)/5,(d-.16)/6,.001),(-w/2+.06+(col+.5)*(w-.12)/5,-d/2+.08+(row+.5)*(d-.16)/6,z),m['cream'],.0002)
        else:
            # Nested arch silhouettes cut from flat textile, not rounded capsules.
            for n,mat in enumerate((m['cream'],m['accent'],m['variant'],m['cream'])):
                r=.85-n*.18;bottom=-1.14;cy=.33
                pts=[(-r,bottom),(r,bottom)]+[(r*math.cos(a),cy+r*math.sin(a)) for a in [math.pi*i/32 for i in range(33)]]
                flat('inlaid_arch_color_field',pts,z+n*.00025,mat)
        return w,d,h
    def shelf(m,style):
        m=palette(m)
        if style=='display':
            w,d,h=1.2,.42,1.9
            for x in (-.58,.58):box('bookcase_side',(.04,d,h),(x,0,h/2),m['wood'],.008)
            box('bookcase_back',(1.12,.025,h),(0,.1975,h/2),m['variant'],.006)
            for z in (.13,.72,1.31,1.88):box('usable_display_shelf',(1.12,d,.04),(0,0,z),m['wood'],.007)
            box('recessed_lower_plinth',(1.1,.34,.11),(0,.02,.055),m['wood_dark'],.006)
        elif style=='ladder':
            w,d,h=.8,.46,1.8
            for x in (-.372,.372):
                # Uprights live outside the usable shelf width at all heights.
                rod('leaning_front_upright',(x,-.19,.025),(x,.12,h-.025),.028,m['wood'],8)
                rod('straight_back_upright',(x,.202,.025),(x,.202,h-.025),.028,m['wood'],8)
            for x in (-.38,.38):
                box('ladder_foot',(.04,.04,.04),(x,-.21,.02),m['wood'],.004)
                box('ladder_top_cap',(.04,.04,.04),(x,.20,h-.02),m['wood'],.004)
            for z,depth in zip((.18,.64,1.10,1.56),(.42,.35,.28,.21)):
                box('graduated_display_shelf',(.69,depth,.04),(0,.23-depth/2,z),m['wood'],.007)
                box('raised_shelf_back',(.69,.024,.09),(0,.218,z+.045),m['variant'],.007)
        else:
            w,d,h=1.32,.36,1.32
            for x in (-.64,-.213333,.213333,.64):box('cubby_upright',(.04,d,h),(x,0,h/2),m['wood'],.008)
            for z in (.02,.446667,.873333,1.30):box('cubby_horizontal',(w,d,.04),(0,0,z),m['wood'],.008)
            box('cubby_back',(w,.02,h),(0,.17,h/2),m['variant'],.005)
        return w,d,h
    def collectible(m,style):
        m=palette(m)
        if style in ('adventurer','mecha'):
            robot=style=='mecha';w,d,h=(.18,.15,.29) if robot else (.15,.14,.27)
            box('collectible_display_base',(w,d,.018),(0,0,.009),m['wood'],.012)
            for s in (-1,1):
                x=s*.024
                box('sturdy_boot',(.04,.06,.028),(x,-.012,.032),m['ink'],.006)
                box('leg_armor' if robot else 'trouser_leg',(.033,.034,.068),(x,0,.076),m['cream'] if robot else m['ink'],.008)
            box('sculpted_torso',(.082,.047,.076),(0,0,.142),m['variant'] if robot else m['mustard'],.014)
            if robot:
                for s in (-1,1):
                    box('shoulder_plate',(.043,.052,.041),(s*.062,0,.166),m['cream'],.009,rot=(0,s*.13,s*.08))
                    box('arm_gauntlet',(.034,.037,.055),(s*.068,-.002,.12),m['accent'],.008)
                box('chest_inset',(.046,.009,.031),(0,-.025,.146),m['accent'],.006)
                box('helmet',(.064,.048,.058),(0,0,.221),m['cream'],.011)
                box('visor',(.045,.01,.019),(0,-.025,.225),m['ink'],.005)
                for s in (-1,1):rod('helmet_antenna',(s*.017,0,.246),(s*.035,0,.284),.006,m['accent'],6)
            else:
                for s in (-1,1):
                    rod('coat_sleeve',(s*.043,0,.167),(s*.059,-.004,.12),.014,m['mustard'])
                    box('little_hand',(.021,.024,.022),(s*.059,-.004,.113),m['skin'],.006)
                box('coat_hem',(.086,.051,.035),(0,0,.112),m['mustard'],.008)
                box('head',(.052,.045,.056),(0,-.002,.217),m['skin'],.012)
                box('sculpted_hair',(.058,.048,.026),(0,.002,.25),m['ink'],.008)
                for s in (-1,1):box('painted_eye',(.006,.003,.008),(s*.012,-.026,.222),m['ink'],.001)
                box('neck_scarf',(.064,.055,.021),(0,0,.185),m['variant'],.008)
                box('scarf_tail',(.021,.012,.062),(.024,-.03,.151),m['variant'],.004,rot=(0,-.11,-.1))
                box('traveler_satchel',(.037,.025,.043),(-.047,.018,.115),m['wood_dark'],.008)
            return w,d,h
        if style=='car':
            w,d,h=.28,.15,.11
            box('brick_chassis',(.264,.114,.027),(0,0,.041),m['ink'],.005)
            box('roadster_body',(.28,.11,.032),(0,0,.066),m['variant'],.006)
            box('rear_deck',(.065,.11,.022),(-.096,0,.09),m['variant'],.004)
            box('front_hood',(.078,.11,.019),(.094,0,.087),m['variant'],.004)
            box('open_cockpit',(.072,.078,.008),(-.004,0,.084),m['ink'],.006)
            box('windscreen',(.009,.084,.028),(.037,0,.096),m['blue'],.002,rot=(0,-.2,0))
            for x in (-.084,.084):
                for y in (-.062,.062):
                    cyl('rubber_wheel',.026,.026,(x,y,.029),m['ink'],16,rot=(math.pi/2,0,0))
                    cyl('wheel_hub',.013,.027,(x,y,.029),m['metal'],12,rot=(math.pi/2,0,0))
            for x in (-.116,-.086,.08,.112):
                for y in (-.028,.028):cyl('brick_stud',.007,.005,(x,y,.103),m['variant'],10)
            for y in (-.034,.034):box('headlight',(.005,.022,.012),(.139,y,.069),m['cream'],.002)
            return w,d,h
        w,d,h=.44,.18,.36
        # Chamfered hull taper, planked deck, twin sails and sturdy display cradle.
        verts=[(-.20,-.07,.09),(.14,-.07,.09),(.22,0,.09),(.14,.07,.09),(-.20,.07,.09),(-.17,-.035,.035),(.12,-.035,.035),(.18,0,.055),(.12,.035,.035),(-.17,.035,.035)]
        mesh('shaped_boat_hull',verts,[(0,1,2,3,4),(9,8,7,6,5),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)],m['wood'],.005)
        box('display_cradle',(.26,.18,.014),(0,0,.007),m['wood_dark'],.005)
        for x in (-.1,.1):box('cradle_support',(.018,.09,.04),(x,0,.027),m['wood_dark'],.004)
        rod('main_mast',(-.035,0,.075),(-.035,0,.36),.005,m['wood'])
        rod('boom',(-.18,0,.125),(.14,0,.125),.004,m['wood'])
        for name,points,mat in [('cream_main_sail',[(-.045,.34),(-.18,.14),(-.045,.14)],m['cream']),('warm_jib_sail',[(-.02,.32),(-.02,.14),(.18,.14)],m['linen'])]:
            verts=[(x,y,z) for y in (-.003,.003) for x,z in points]
            mesh(name,verts,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],mat)
        rod('forestay',(-.035,0,.35),(.205,0,.09),.0016,m['cream'],6)
        for n in range(5):box('deck_plank',(.30,.008,.003),(-.025,(n-2)*.019,.094),m['cream'],.001)
        return w,d,h
    def bunk(m,style):
        m=palette(m);w,d,h={'full':(1.53,2.16,1.9),'storage':(1.13,2.16,1.86),'low':(1.13,2.08,1.45)}[style]
        low=style=='low';bottom=.12 if low else .36;upper=.96 if low else 1.31
        innerW=w-.12;topW=1.01 if style=='full' else innerW
        # Upper bunk follows the rear edge on twin/full, giving the lower a real overhang.
        topX=(w-topW-.12)/2 if style=='full' else 0
        for level,bw,bx in ((bottom,innerW,0),(upper,topW,topX)):
            box('solid_bed_frame',(bw,d-.07,.12),(bx,0,level),m['wood'],.024)
            box('rounded_rect_mattress',(bw-.08,d-.20,.15),(bx,0,level+.135),m['cream'],.048)
            box('folded_duvet',(bw-.065,(d-.2)*.69,.075),(bx,-(d-.2)*.145,level+.23),m['fabric'],.033)
            box('blanket_turn_down',(bw-.07,.19,.025),(bx,(d-.2)*.13,level+.275),m['linen'],.01)
            box('sleeping_pillow',(bw*.67,.36,.095),(bx+.014,d*.32,level+.245),m['cream'],.04,rot=(0,0,.025))
            for y in (-d/2+.035,d/2-.035):
                box('head_and_foot_rail',(bw+.04,.065,.14),(bx,y,level+.15),m['wood'],.012)
        for x in (topX-topW/2-.025,topX+topW/2+.025):
            for y in (-d/2+.035,d/2-.035):box('continuous_bunk_post',(.07,.07,h),(x,y,h/2),m['wood'],.012)
            for z in (h-.055,h-.22):box('upper_guard_rail',(.055,d-.08,.075),(x,0,z),m['variant'],.012)
        for y in (-d/2+.035,d/2-.035):
            box('upper_end_guard',(topW+.10,.065,.085),(topX,y,h-.045),m['wood'],.012)
            for x in (-.25,0,.25):box('end_guard_spindle',(.045,.045,.27),(topX+x,y,h-.19),m['wood'],.008)
        # Ladder on the front end; enough separation between readable chunky rungs.
        lx=topX;ly=-d/2+.012
        for x in (lx-.21,lx+.21):box('ladder_stile',(.045,.075,upper+.27),(x,ly,(upper+.27)/2),m['wood'],.009)
        for n in range(1,4 if low else 5):box('ladder_step',(.43,.09,.045),(lx,ly,n*(upper+.1)/(3 if low else 4)),m['wood'],.009)
        if style=='full':
            for y in (-d/2+.035,d/2-.035):box('wide_lower_bunk_support',(.07,.07,bottom+.28),(-w/2+.035,y,(bottom+.28)/2),m['wood'],.012)
        if style=='storage':
            for y in (-.5,.5):
                box('under_bed_storage_box',(w-.07,.94,.20),(0,y,.13),m['variant'],.016)
                box('framed_drawer_front',(.035,.88,.19),(-w/2+.015,y,.14),m['wood'],.012)
                box('drawer_pull',(.025,.16,.025),(-w/2-.015,y,.18),m['metal'],.007)
        return w,d,h
    def nightstand(m,style):
        m=palette(m);w,d,h={'cane':(.54,.44,.59),'floating':(.52,.38,.23),'drum':(.46,.46,.55)}[style]
        if style=='drum':
            cyl('round_pedestal',.185,.40,(0,0,.20),m['wood'],48)
            for n in range(28):
                a=n*math.tau/28;cyl('pedestal_reed',.013,.36,(.178*math.cos(a),.178*math.sin(a),.20),m['wood'],8)
            cyl('drawer_drum',.22,.105,(0,0,.455),m['variant'],64)
            cyl('rounded_tabletop',.23,.04,(0,0,.53),m['wood'],64)
            box('curved_drawer_inset',(.27,.013,.075),(0,-.198,.455),m['variant'],.013)
            cyl('brass_drawer_knob',.016,.02,(0,-.218,.46),m['metal'],12,rot=(math.pi/2,0,0))
            return w,d,h
        base=0 if style=='floating' else .16
        if style=='cane':
            for x in (-.225,.225):
                for y in (-.175,.175):cyl('tapered_bedside_leg',.029,base,(x,y,base/2),m['wood'],8,taper=.8)
            box('open_lower_shelf',(w-.04,d-.035,.03),(0,0,.18),m['wood'],.007)
        for x in (-w/2+.02,w/2-.02):box('bedside_side',(.04,d,h-base),(x,0,(h+base)/2),m['wood'],.01)
        for z in (h-.022,h-.22):box('drawer_horizontal',(w,d,.035),(0,0,z+.004),m['wood'],.009)
        box('rear_panel',(w-.04,.03,h-base),(0,d/2-.015,(h+base)/2),m['wood'],.007)
        box('drawer_front',(w-.095,.029,.14),(0,-d/2+.009,h-.123),m['variant'],.01)
        if style=='cane':
            for i in range(16):box('woven_cane_vertical',(.012,.01,.125),(-.195+i*.026,-d/2-.009,h-.123),m['cream'],.003)
            for j in range(6):box('woven_cane_horizontal',(.40,.012,.008),(0,-d/2-.016,h-.183+j*.024),m['wood'],.002)
            for s in (-1,1):box('cane_drawer_stile',(.023,.03,.16),(s*.22,-d/2-.018,h-.12),m['wood'],.005)
            box('drawer_pull',(.1,.03,.022),(0,-d/2-.036,h-.115),m['metal'],.006)
        else:
            box('inset_finger_pull',(.18,.014,.013),(0,-d/2-.007,h-.075),m['wood_dark'],.004)
            for x in (-w/2+.02,w/2-.02):box('top_edge_lip',(.025,d,.022),(x,0,h-.011),m['wood'],.006)
        return w,d,h
    def art(m,id):
        m=palette(m);large=id=='valley-panorama';w,d,h=(1.6,.06,1.1) if large else (.6,.035,.9);t=.035 if large else .018
        box('backing_panel',(w,d*.3,h),(0,d*.35,h/2),m['wood_dark'],.003)
        for x in (-w/2+t/2,w/2-t/2):box('vertical_frame_rail',(t,d,h),(x,0,h/2),m['wood'],t*.2)
        for z in (t/2,h-t/2):box('horizontal_frame_rail',(w-2*t,d,t),(0,0,z),m['wood'],t*.2)
        source=Path(__file__).resolve().parents[2]/'assets-source'/'art'/f'{id}.png'
        dest=source.parent/'web'/source.name;dest.parent.mkdir(exist_ok=True)
        image=bpy.data.images.load(str(source));factor=768/max(image.size);image.scale(round(image.size[0]*factor),round(image.size[1]*factor));image.filepath_raw=str(dest);image.file_format='PNG';image.save()
        ink=material('original-printed-art',(1,1,1),None,1)
        tex=ink.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND';ink.node_tree.links.new(tex.outputs['Color'],ink.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        a=w/2-t;lo=t;hi=h-t
        obj=mesh('single_uv_artwork',[(-a,-d*.27,lo),(a,-d*.27,lo),(a,-d*.27,hi),(-a,-d*.27,hi)],[(0,1,2,3)],ink)
        uv=obj.data.uv_layers.new(name='FullArtwork');coords=[(0,0),(1,0),(1,1),(0,1)]
        for loop in obj.data.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
        return w,d,h
    def sofa(m,style):
        m=palette(m);foam=style.startswith('foam');w,d,h={'left':(2.85,1.85,.85),'right':(2.85,1.85,.85),'u':(3.6,2.2,.85),'foam-love':(1.9,1.05,.78),'foam-chaise':(1.15,1.75,.78)}[style]
        if foam:
            # A single connected bottom shell with wide bevels; sloped back wedge,
            # channel seams and tucked front folds distinguish it from a box sofa.
            box('continuous_foam_foundation',(w,d,.30),(0,0,.15),m['fabric'],.115)
            box('deep_quilted_seat',(w-.14,d-.31,.18),(0,-.105,.35),m['fabric'],.075)
            bw=w-.05;front=d/2-.38;rear=d/2
            verts=[(-bw/2,front,.27),(bw/2,front,.27),(bw/2,rear,.27),(-bw/2,rear,.27),(-bw/2,front+.08,h-.07),(bw/2,front+.08,h-.07),(bw/2,rear,h),(-bw/2,rear,h)]
            mesh('folded_sloping_back',verts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],m['fabric'],.045)
            for s in (-1,1):box('integrated_foam_side',( .16,d*.72,.24),(s*(w/2-.08),-.04,.37),m['fabric'],.071)
            channels=5 if style=='foam-love' else 3
            for n in range(1,channels):
                x=-w*.43+n*w*.86/channels
                rod('restrained_seat_channel',(x,-d/2+.11,.441),(x,d/2-.39,.441),.0025,m['seam'],6)
                rod('back_channel',(x,front+.042,.41),(x,front+.09,h-.12),.0025,m['seam'],6)
                rod('front_tucked_fold',(x,-d/2+.003,.07),(x+.028,-d/2+.003,.21),.0028,m['seam'],6)
            return w,d,h
        arm=.19;back=.19;rear=d/2;seatDepth=.70;bodyDepth=1.0;startY=rear-bodyDepth
        inner=w-2*arm;count=4 if style=='u' else 3;module=inner/count
        chaiseColumns={0,count-1} if style=='u' else {0} if style=='left' else {count-1}
        for n in range(count):
            x=-inner/2+(n+.5)*module;chaise=n in chaiseColumns;length=d-.08 if chaise else bodyDepth-.08;cy=rear-.04-length/2
            box('joined_upholstered_base',(module+.008,length,.24),(x,cy,.24),m['fabric'],.037)
            cushionD=length-back-.07
            box('tailored_seat_cushion',(module-.017,cushionD,.17),(x,cy-.075,.433),m['fabric'],.045)
            box('continuous_back_shell',(module+.01,back,.46),(x,rear-back/2,.62),m['fabric'],.055)
            box('fitted_back_cushion',(module-.02,.18,.34),(x,rear-back-.06,.655),m['fabric'],.055,rot=(.10,0,0))
            for y in (rear-.18,cy-length/2+.13):box('low_wood_foot',(.085,.10,.13),(x,y,.065),m['wood'],.017)
            # Recessed stitched seams are fine and local, never contrasting caps.
            rod('front_seat_stitch',(x-module*.42,cy-cushionD/2-.076,.429),(x+module*.42,cy-cushionD/2-.076,.429),.0018,m['seam'],6)
        for side in (-1,1):
            chaise=(side==-1 and 0 in chaiseColumns) or (side==1 and count-1 in chaiseColumns)
            length=d-.09 if chaise else bodyDepth-.09
            box('connected_padded_arm',(arm,length,.47),(side*(w/2-arm/2),rear-.04-length/2,.435),m['fabric'],.058)
        return w,d,h
    result={}
    for id,style in [('diamond-wool-rug','diamond'),('kilim-rug','kilim'),('jute-rug','jute'),('arch-color-rug','arch'),('wide-check-rug','checker')]:result[id]=lambda m,s=style:rug(m,s)
    for id,style in [('display-bookcase','display'),('ladder-display-shelf','ladder'),('cube-display-shelf','cube')]:result[id]=lambda m,s=style:shelf(m,s)
    for id,style in [('adventurer-figurine','adventurer'),('mecha-figurine','mecha'),('model-sailboat','ship'),('brick-roadster','car')]:result[id]=lambda m,s=style:collectible(m,s)
    for id,style in [('twin-full-bunk','full'),('storage-bunk','storage'),('low-kids-bunk','low')]:result[id]=lambda m,s=style:bunk(m,s)
    for id,style in [('cane-nightstand','cane'),('floating-nightstand','floating'),('pedestal-nightstand','drum')]:result[id]=lambda m,s=style:nightstand(m,s)
    for id in ('valley-panorama','starlight-poster','singer-poster','basketball-poster'):result[id]=lambda m,i=id:art(m,i)
    for id,style in [('left-chaise-sectional','left'),('right-chaise-sectional','right'),('u-sectional','u'),('boneless-loveseat','foam-love'),('boneless-chaise','foam-chaise')]:result[id]=lambda m,s=style:sofa(m,s)
    return result
