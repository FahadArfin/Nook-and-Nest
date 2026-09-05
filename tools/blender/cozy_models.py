"""Original Batch 6 models. Named editable components; dimensions in metres."""
import json, math, random
from pathlib import Path
import bpy
from mathutils import Vector

def cozy_builders(box,cyl,material,finish):
    rows=json.loads((Path(__file__).resolve().parents[2]/'src/cozyExpansion.json').read_text())
    def rod(name,a,b,r,mat):
        a,b=Vector(a),Vector(b);o=cyl(name,r,(b-a).length,(a+b)/2,mat,8);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
    def leaf(name,loc,length,width,angle,mat):
        x,y,z=loc;c,s=math.cos(angle),math.sin(angle)
        pts=[(0,0,0),(length*.4,width*.5,length*.13),(length,0,length*.22),(length*.4,-width*.5,length*.13)]
        verts=[(x+u*c-v*s,y+u*s+v*c,z+h) for u,v,h in pts]
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)]);mesh.materials.append(mat)
        ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    def ring(name,r,h,loc,mat,inner=.75,n=32):
        x,y,z=loc;verts=[]
        for rr,zz in [(r,z),(r,z+h),(r*inner,z+h),(r*inner,z+h*.2)]:
            verts += [(x+rr*math.cos(i*math.tau/n),y+rr*math.sin(i*math.tau/n),zz) for i in range(n)]
        faces=[]
        for k in range(3):
            for i in range(n):j=(i+1)%n;faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
        faces.append(tuple(range(3*n,4*n)));me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(mat);ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    def build(row,m):
        id=row[0];w,d,h=[v/1000 for v in row[3:6]];rng=random.Random(id)
        cream=material('warm-porcelain',(.89,.83,.71));ink=material('ink-detail',(.045,.07,.07));gold=material('warm-brass',(.62,.40,.14),None,.65,.25)
        glow=material('warm-light', (1,.65,.2));bs=glow.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.48,.1,1);bs.inputs['Emission Strength'].default_value=2
        def B(n,size,p,mat=None,bevel=.015):return box(n,size,p,mat or m['wood'],min(bevel,min(size)*.22))
        def C(n,r,hh,p,mat=None):return cyl(n,r,hh,p,mat or m['wood'],24)
        def legs(z,hh):
            for x in [-w*.4,w*.4]:
                for y in [-d*.38,d*.38]:B('timber_leg',(.065,.065,hh),(x,y,z))
        def basin(x,y,z,bw,bd,bh):
            B('basin_bottom',(bw,bd,.025),(x,y,z+.012),cream)
            for xx in [-1,1]:B('basin_side',(.035,bd,bh),(x+xx*(bw/2-.018),y,z+bh/2),cream)
            for yy in [-1,1]:B('basin_rim',(bw-.07,.035,bh),(x,y+yy*(bd/2-.018),z+bh/2),cream)
            C('drain',.021,.006,(x,y,z+.03),m['steel'])
        def flower(x,y,z,size,mat):
            rod('flower_stem',(x,y,0),(x,y,z),.006,m['green'])
            for k in range(6):leaf('flower_petal',(x,y,z),size,size*.65,k*math.tau/6,mat)
            C('flower_center',size*.21,.015,(x,y,z+.018),gold)
        if id in ['wingback-chair','slat-lounge-chair','chester-sofa','slat-day-sofa']:
            legs(.1,.2);B('seat_frame',(w,d,.16),(0,0,.25));count=3 if w>1.5 else 1
            for i in range(count):B('tailored_seat',(w*.82/count-.018,d*.8,.18),((i-(count-1)/2)*w*.82/count,-.015,.41),m['fabric'],.065)
            B('padded_back',(w*.88,.17,h*.46),(0,d*.39,h*.7),m['fabric'],.065)
            for x in [-w*.45,w*.45]:
                if id in ['slat-lounge-chair','slat-day-sofa']:
                    B('open_arm_rail',(.07,d,.075),(x,0,.66));
                    for y in [-d*.35,0,d*.35]:B('side_slats',(.045,.045,.4),(x,y,.43))
                else:B('padded_arm',(.16,d*.9,.35),(x,0,.57),m['fabric'],.06)
                if id=='wingback-chair':B('back_wing',(.12,.34,.43),(x,d*.27,h*.79),m['fabric'],.04)
            if id=='chester-sofa':
                for x in range(9):
                    for z in range(2):C('tuft_button',.012,.015,((x-4)*.20,d*.28,.60+z*.12),gold).rotation_euler.x=math.pi/2
        elif id in ['canopy-bed','spindle-bed','nursery-crib','kids-house-bed']:
            crib=id=='nursery-crib';base=.3 if crib else .17
            B('bed_frame',(w,d,.12),(0,0,base));B('inset_mattress',(w-.1,d-.12,.17),(0,0,base+.14),m['linen'],.05)
            if not crib:B('folded_quilt',(w-.08,d*.6,.05),(0,-d*.13,base+.25),m['fabric']);B('pillow',(w*.65,.4,.10),(0,d*.32,base+.28),cream,.04)
            for x in [-w/2+.03,w/2-.03]:
                for y in [-d/2+.03,d/2-.03]:B('post',(.065,.065,h if id=='canopy-bed' else h*.6),(x,y,(h if id=='canopy-bed' else h*.6)/2))
            if id=='canopy-bed':
                for x in [-w/2,w/2]:B('canopy_side',(.065,d,.065),(x,0,h))
                for y in [-d/2,d/2]:B('canopy_end',(w,.065,.065),(0,y,h))
            elif id=='kids-house-bed':
                for y in [-d/2,d/2]:
                    rod('roof_beam',(-w/2,y,h*.6),(0,y,h),.035,m['wood']);rod('roof_beam',(w/2,y,h*.6),(0,y,h),.035,m['wood'])
                rod('ridge',(0,-d/2,h),(0,d/2,h),.035,m['wood'])
            elif crib:
                for x in [-w/2,w/2]:
                    B('crib_rail',(.045,d,.06),(x,0,h))
                    for i in range(12):B('crib_spindle',(.026,.026,h-base),(x,-d*.44+i*d*.88/11,(h+base)/2))
                for y in [-d/2,d/2]:B('crib_end',(w,.04,h-base),(0,y,(h+base)/2))
            else:
                for y,hh in [(d/2,h),(-d/2,h*.65)]:
                    B('head_rail',(w,.06,.065),(0,y,hh))
                    for i in range(11):B('spindle',(.025,.025,hh-base),(-w*.44+i*w*.088,y,(hh+base)/2))
        elif id in ['arc-reading-lamp','pleated-table-lamp','bath-three-light']:
            if id=='bath-three-light':
                B('wall_rail',(w,.045,.05),(0,d*.4,h*.5),gold)
                for x in [-w*.36,0,w*.36]:C('opal_globe',.085,.13,(x,0,h*.5),glow)
            else:
                C('lamp_foot',d*.43,.04,(-w*.25 if w>.5 else 0,0,.02),gold)
                if id=='arc-reading-lamp':
                    pts=[(-w*.25,0,.04),(-w*.25,0,h*.72),(-w*.1,0,h*.93),(w*.18,0,h),(w*.36,0,h*.92)]
                    for a,b in zip(pts,pts[1:]):rod('arc_stem',a,b,.015,gold)
                    C('wide_shade',d/2,.18,(w*.36,0,h*.88),cream);C('diffuser',d*.42,.01,(w*.36,0,h*.79),glow)
                else:
                    C('ceramic_base',.085,h*.42,(0,0,h*.23),m['variant']);C('shade_core',w*.44,h*.38,(0,0,h*.78),cream)
                    for i in range(36):a=i*math.tau/36;rod('linen_pleat',(.12*math.cos(a),.12*math.sin(a),h*.97),(.165*math.cos(a),.165*math.sin(a),h*.58),.008,m['linen'])
        elif id in ['electric-kettle','rice-cooker']:
            C('appliance_base',w*.42,.025,(0,0,.013),ink);C('body',w*.4,h*.68,(0,0,h*.4),m['variant']);C('lid',w*.41,.035,(0,0,h*.77),cream);C('lid_knob',.025,.04,(0,0,h*.88),ink)
            B('control_panel',(.09,.012,.035),(0,-d*.43,h*.3),ink)
            if id=='electric-kettle':rod('pour_spout',(w*.22,0,h*.5),(w*.55,0,h*.78),.027,cream);rod('handle_side',(-w*.48,0,h*.3),(-w*.48,0,h*.8),.023,m['wood'])
        elif id=='dish-rack':
            B('drip_tray',(w,d,.025),(0,0,.013),cream)
            for x in [-w*.42,w*.42]:B('rack_side',(.025,d,.035),(x,0,.05))
            for i in range(9):B('plate_divider',(.014,d*.85,h*.65),(-w*.38+i*w*.095,0,h*.4))
            for i in range(4):o=C('stacked_plate',h*.43,.013,(-w*.3+i*w*.15,0,h*.5),cream);o.rotation_euler.y=math.pi/2
        elif id in ['utensil-crock','pantry-jars','bud-vase-trio']:
            count=1 if id=='utensil-crock' else 3
            for i in range(count):
                x=(i-(count-1)/2)*w/count;rr=w/count*.38;hh=h*(.55+.15*i) if count>1 else h*.5
                ring('open_vessel',rr,hh,(x,0,0),cream if id!='pantry-jars' else m['blue'])
                if id=='pantry-jars':C('wood_lid',rr*1.06,.023,(x,0,hh))
                elif id=='bud-vase-trio':flower(x,0,h*(.7+.1*i),.04,m['rose'])
                else:
                    for j in range(4):xx=x+(j-1.5)*.029;rod('utensil_handle',(xx,0,.06),(xx,0,h*.9),.008,m['wood']);B('spatula_head',(.028,.015,.06),(xx,0,h*.88),m['wood'])
        elif id in ['open-pantry','bathroom-trolley','toy-organizer','towel-ladder']:
            levels=5 if id=='open-pantry' else 3
            for x in [-w*.46,w*.46]:
                for y in [-d*.42,d*.42]:B('upright',(.04,.04,h),(x,y,h/2))
            for i in range(levels):z=.06+i*(h-.1)/(levels-1);B('shelf',(w,d,.035),(0,0,z))
            if id=='toy-organizer':
                B('center_divider',(.03,d,h),(0,0,h/2))
                for i in range(3):
                    for x in [-w*.25,w*.25]:B('storage_bin',(w*.42,d*.84,h*.22),(x,-.02,.1+i*h*.3),m['variant'] if i%2 else cream)
            if id=='towel-ladder':
                for z in [.5,.95]:B('folded_towel',(w*.65,.07,.3),(0,-d*.4,z),m['linen'])
        elif id in ['stripe-runner','sunburst-rug']:
            if id=='stripe-runner':
                B('woven_foundation',(w,d,h*.7),(0,0,h*.35),m['linen'])
                for i in range(13):B('woven_stripe',(w*.97,.055,h*.25),(0,-d*.46+i*d*.076,h*.8),m['fabric'] if i%2 else m['rose'],.002)
            else:
                C('round_woven_base',w/2,h,(0,0,h/2),m['linen']);C('sun_center',w*.18,.003,(0,0,h+.002),m['clay'])
                for i in range(20):a=i*math.tau/20;leaf('sun_ray',(w*.22*math.cos(a),w*.22*math.sin(a),h+.004),w*.18,.09,a,m['mustard'])
        elif id in ['pedestal-dining-table','waterfall-table']:
            if id=='pedestal-dining-table':
                C('round_top',w/2,.065,(0,0,h-.032));C('pedestal',.12,h-.06,(0,0,(h-.06)/2))
                for i in range(4):a=i*math.pi/2;rod('foot',(0,0,.10),(w*.38*math.cos(a),w*.38*math.sin(a),.04),.055,m['wood'])
            else:
                B('continuous_top',(w,d,.065),(0,0,h-.032))
                for x in [-w/2+.033,w/2-.033]:B('waterfall_slab',(.066,d,h),(x,0,h/2))
        elif id in ['cat-tree','pet-feeding-station','dog-house-bed']:
            B('pet_base',(w,d,.07),(0,0,.035))
            if id=='pet-feeding-station':
                legs(h*.4,h*.8)
                for x in [-w*.24,w*.24]:ring('open_food_bowl',d*.4,.08,(x,0,h*.6),m['steel'])
            elif id=='cat-tree':
                for x,z in [(-w*.25,h*.55),(w*.23,h*.94)]:C('sisal_post',.05,z,(x,0,z/2),m['linen']);B('padded_perch',(w*.48,d*.8,.07),(x,0,z),m['fabric'])
                for x in [-w*.18,w*.18]:B('hideaway_side',(.035,d*.7,h*.28),(x,d*.06,h*.23))
                B('hideaway_roof',(w*.42,d*.7,.045),(0,d*.06,h*.38))
            else:
                B('pet_mattress',(w*.85,d*.87,.12),(0,0,.14),m['fabric'],.04)
                for x in [-w*.46,w*.46]:B('house_side',(.04,d,h*.55),(x,0,h*.3))
                for side in [-1,1]:
                    for y in [-d/2,d/2]:rod('gable',(side*w/2,y,h*.58),(0,y,h),.035,m['wood'])
                B('back_panel',(w,.03,h*.6),(0,d/2,h*.3))
        elif id in ['console-vanity','reed-double-vanity','rectangular-vessel','shower-wetroom']:
            if id=='rectangular-vessel':basin(0,0,0,w,d,h)
            elif id=='shower-wetroom':
                B('shower_tray',(w,d,.05),(0,0,.025),cream);glass=material('shower-glass',(.64,.79,.78),None,.12);bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=.88;bs.inputs['Alpha'].default_value=.27
                B('glass_screen',(.014,d*.84,h*.88),(-w*.44,0,h*.46),glass);rod('riser',(w*.36,d*.38,.3),(w*.36,d*.38,h*.94),.016,m['steel']);rod('shower_arm',(w*.36,d*.38,h*.94),(w*.36,0,h*.94),.016,m['steel']);C('rainfall_head',.14,.025,(w*.36,0,h*.92),m['steel'])
            else:
                legs(h*.4,h*.8);B('lower_shelf',(w,d,.045),(0,0,.15));n=2 if id=='reed-double-vanity' else 1
                # A worktop frame leaves actual holes beneath recessed bowls.
                for y in [-d*.45,d*.45]:B('worktop_rail',(w,d*.1,.05),(0,y,h*.84),m['counter'])
                for i in range(n):
                    x=(i-(n-1)/2)*w/n;basin(x,0,h*.78,w/n*.80,d*.74,h*.19);rod('faucet',(x,d*.39,h*.84),(x,d*.39,h*1.04),.012,m['steel']);rod('spout',(x,d*.39,h*1.04),(x,d*.20,h*1.04),.012,m['steel'])
                if n==2:
                    B('drawer_cabinet',(w,d*.95,h*.53),(0,0,h*.43))
                    for i in range(38):B('reeded_front',(.018,.018,h*.48),(-w*.48+i*w*.96/37,-d*.49,h*.43))
        elif id in ['desk-organizer','keyboard-mouse','high-chair']:
            if id=='desk-organizer':
                B('stationery_tray',(w,d,.025),(0,0,.012));ring('pen_cup',.047,h*.75,(-w*.28,0,.02),cream)
                for i in range(5):rod('pencil',(-w*.28+i*.008-.016,0,.025),(-w*.28+i*.008-.016,0,h),.003,m['clay'])
                B('note_stack',(w*.4,d*.7,.04),(w*.20,0,.04),cream)
            elif id=='keyboard-mouse':
                B('keyboard_case',(w*.72,d,.018),(-w*.13,0,.009),ink)
                for rown in range(5):
                    for col in range(14):B('keycap',(.025,.027,.01),(-w*.46+col*.029,-d*.35+rown*.033,.025),cream,.003)
                B('mouse',(.075,.115,.035),(w*.38,0,.018),m['variant'])
            else:
                legs(h*.35,h*.7);B('seat',(w*.7,d*.6,.045),(0,0,h*.63),m['variant']);B('back',(w*.7,.055,h*.32),(0,d*.28,h*.8),m['variant']);B('feeding_tray',(w,d*.38,.045),(0,-d*.27,h*.78),cream);B('footrest',(w*.6,.15,.025),(0,-d*.2,h*.38))
        elif id in ['candle-trio','decorative-bowl','mantel-clock','wall-clock']:
            if id=='candle-trio':
                for i in range(3):x=(i-1)*w*.3;hh=h*(.55+i*.2);C('wax_pillar',.045,hh,(x,0,hh/2),cream);C('glowing_wick',.006,.025,(x,0,hh+.012),glow)
            elif id=='decorative-bowl':
                ring('open_centerpiece',w/2,h,(0,0,0),m['variant'],.88,48)
                for i in range(32):a=i*math.tau/32;rod('fluted_rim',(w*.45*math.cos(a),w*.45*math.sin(a),.02),(w*.5*math.cos(a),w*.5*math.sin(a),h),.008,cream)
            else:
                B('clock_case',(w,d,h),(0,0,h/2));o=C('clock_face',w*.43,.012,(0,-d/2-.007,h*.54),cream);o.rotation_euler.x=math.pi/2
                for i in range(12):a=i*math.tau/12;B('hour_marker',(.011,.01,.022),(w*.35*math.sin(a),-d/2-.017,h*.54+w*.35*math.cos(a)),ink,.002)
                rod('hour_hand',(0,-d/2-.027,h*.54),(w*.18,-d/2-.027,h*.64),.008,ink);rod('minute_hand',(0,-d/2-.028,h*.54),(-w*.22,-d/2-.028,h*.7),.005,ink)
        elif id.startswith('anime-'):
            B('poster_frame',(w,d,h),(0,0,h/2),m['wood_dark'])
            art=material('original-anime-artwork',(1,1,1),None,.98)
            path=Path(__file__).resolve().parents[2]/'assets-source/textures'/('anime-moon-original.png' if 'moon' in id else 'anime-sky-original.png')
            image=bpy.data.images.load(str(path));image.pack();tex=art.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
            art.node_tree.links.new(tex.outputs['Color'],art.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
            me=bpy.data.meshes.new('original_illustration');me.from_pydata([(-w*.46,-d*.55,h*.03),(w*.46,-d*.55,h*.03),(w*.46,-d*.55,h*.97),(-w*.46,-d*.55,h*.97)],[],[(0,1,2,3)]);me.materials.append(art)
            uv=me.uv_layers.new();
            for loop,coord in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=coord
            ob=bpy.data.objects.new('original_anime_print',me);bpy.context.collection.objects.link(ob)
            return w,d,h
            B('poster_frame',(w,d,h),(0,0,h/2),m['wood_dark']);bg=material('original-art-sky',(.12,.22,.42) if 'moon' in id else (.45,.68,.78))
            B('art_background',(w*.92,.008,h*.94),(0,-d*.55,h/2),bg)
            # Layered graphic original artwork: moon, floating village, courier silhouette.
            o=C('moon',w*.17,.004,(w*.21,-d*.69,h*.77),cream);o.rotation_euler.x=math.pi/2
            for i in range(9):x=(i-4)*w*.10;hh=h*(.1+rng.random()*.17);B('distant_town',(w*.085,.004,hh),(x,-d*.68,h*.27),m['clay'] if i%2 else m['wood_dark'],.002)
            B('courier_coat',(w*.16,.008,h*.23),(-w*.12,-d*.85,h*.49),m['rose'],.025);o=C('character_head',w*.075,.009,(-w*.12,-d*.88,h*.67),cream);o.rotation_euler.x=math.pi/2
            for x in [-w*.17,-w*.07]:rod('character_boot',(x,-d*.86,h*.40),(x+w*.03,-d*.86,h*.29),.018,ink)
            for i in range(20):B('star',(.006,.003,.009),((rng.random()-.5)*w*.85,-d*.8,h*(.5+rng.random()*.43)),cream,.001)
        elif id in ['cottage-fireplace','wood-stove','linear-fireplace']:
            stove=id=='wood-stove';hh=h*.45 if stove else h
            B('hearth_base',(w,d,.08),(0,0,.04),m['wood_dark'])
            B('firebox_back',(w*.8,.035,hh*.7),(0,d*.35,hh*.47),ink)
            for x in [-w*.44,w*.44]:B('hearth_side',(w*.12,d,hh),(x,0,hh/2),ink if stove else cream)
            B('mantel_top',(w,d,.09),(0,0,hh),ink if stove else m['wood'])
            for i in range(4):rod('hearth_log',(-w*.28+i*w*.12,-d*.18,.12),(-w*.13+i*w*.12,d*.1,.17),.035,m['wood_dark']);B('glowing_ember',(.04,.04,.10),(-w*.24+i*w*.15,0,.20),glow)
            if stove:C('flue',.065,h-hh,(0,d*.15,(h+hh)/2))
        elif id in ['christmas-tree','christmas-slim-tree','birch-tree','weeping-willow','hydrangea-border','wildflower-patch','fern-clump']:
            holiday=id.startswith('christmas');tree=holiday or id in ['birch-tree','weeping-willow']
            if tree:
                C('branching_trunk',w*.045,h*.82,(0,0,h*.41),cream if id=='birch-tree' else m['wood_dark'])
                for level in range(7):
                    z=h*(.2+level*.105);radius=w*.48*(1-level*.115)
                    if holiday:
                        bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=radius*.92,radius2=radius*.20,depth=h*.17,location=(0,0,z+.025))
                        bpy.context.object.name='dense_tier_of_needles';bpy.context.object.data.materials.append(m['green'])
                    for branch in range(8):
                        a=branch*math.tau/8+level*.42;tip=(radius*math.cos(a),radius*math.sin(a),z+(0 if holiday else h*.10));rod('branch',(0,0,z),tip,.014,m['wood_dark'])
                        for j in range(7):
                            t=.25+j*.11;x=tip[0]*t;y=tip[1]*t;zz=z+(tip[2]-z)*t
                            for side in [-1,1]:leaf('needle_spray' if holiday else 'leaf_spray',(x,y,zz),radius*.23,w*.055 if holiday else w*.075,a+side*.8,m['green_light'] if j%3==0 else m['green'])
                        if holiday:
                            C('warm_fairy_light',.012,.018,(tip[0]*.8,tip[1]*.8,z+.025),glow)
                            if branch%2==0:C('ornament',.032,.055,(tip[0]*.68,tip[1]*.68,z-.035),m['rose'] if level%2 else gold)
                        elif id=='weeping-willow':
                            for j in range(6):
                                zz=tip[2]-j*h*.035;leaf('hanging_willow_leaf',(tip[0],tip[1],zz),.16,.026,a+j*.3,m['green'])
                if holiday:
                    C('tree_planter',w*.18,h*.13,(0,0,h*.065),m['wood'])
                    for i in range(5):a=i*math.tau/5+math.pi/2;b=a+math.pi*4/5;rod('five_point_star',(.075*math.cos(a),0,h*.95+.075*math.sin(a)),(.075*math.cos(b),0,h*.95+.075*math.sin(b)),.01,gold)
            elif id=='fern-clump':
                for i in range(12):
                    a=i*math.tau/12
                    for j in range(8):
                        t=(j+1)/9;x=w*.45*t*math.cos(a);y=d*.45*t*math.sin(a);z=h*math.sin(t*math.pi*.85)
                        for side in [-1,1]:leaf('fern_leaflet',(x,y,z),.12*(1-t*.6),.045,a+side*.95,m['green'])
            else:
                for i in range(32):x=(rng.random()-.5)*w*.85;y=(rng.random()-.5)*d*.85;z=h*(.35+rng.random()*.6);flower(x,y,z,.065 if id=='hydrangea-border' else .043,m['rose'] if i%3 else cream);leaf('stem_leaf',(x,y,z*.5),.11,.055,rng.random()*math.tau,m['green'])
        elif id=='wrapped-presents':
            for i in range(3):
                ww=w*(.32+i*.03);dd=d*(.55+i*.1);hh=h*(.5+i*.2);x=(i-1)*w*.3;y=(i%2)*d*.2
                B('gift_box',(ww,dd,hh),(x,y,hh/2),m['rose'] if i%2 else m['variant']);B('ribbon_length',(.023,dd+.005,hh+.006),(x,y,hh/2),gold);B('ribbon_cross',(ww+.005,.023,hh+.008),(x,y,hh/2),cream)
                for side in [-1,1]:rod('bow',(x,y,hh),(x+side*.06,y,hh+.04),.014,gold)
        else:raise ValueError(id)
        return w,d,h
    return {row[0]:(lambda m,row=row:build(row,m)) for row in rows}
