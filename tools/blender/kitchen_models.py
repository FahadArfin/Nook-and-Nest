"""Original kitchen / fitted storage miniatures. Editable named parts, metres/Z up.
References and intentionally simplified functionality: docs/kitchen-research.md.
"""
import math
import bpy

def kitchen_builders(box,cyl,material,finish):
    def palette(m):
        glass=material('cabinet-glass',(.63,.77,.72),None,.38)
        glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.32
        glass.surface_render_method='DITHERED'
        return {**m,'body':material('cabinet-body',(.69,.65,.53),None,.94),
                'front':material('variant-surface',(.62,.69,.56),None,.95),
                'trim':material('door-trim',(.75,.71,.60),None,.93),
                'hardware':material('pulls-and-controls',(.31,.25,.16),None,.68,.25),
                'dark':material('recesses',(.06,.075,.07),None,.95),
                'glass':glass,'ceramic':material('ceramic-tiles',(.79,.77,.67),None,.89),
                'grout':material('grout',(.47,.45,.38),None,1),
                'light':material('warm-diffuser',(.95,.80,.52),None,.85)}
    def rod(name,a,b,r,mat):
        from mathutils import Vector
        a,b=Vector(a),Vector(b);o=cyl(name,r,(b-a).length,(a+b)/2,mat,12)
        o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
    def shell(m,w,d,h,base=.08,plinth=True):
        t=.035
        if plinth:box('recessed_plinth',(w-.06,d-.09,base),(0,.025,base/2),m['dark'],.009)
        for x in (-w/2+t/2,w/2-t/2):box('thick_side_panel',(t,d,h-base),(x,0,(h+base)/2),m['body'],.009)
        for z in (base+.018,h-.018):box('carcass_shelf',(w-2*t,d,.036),(0,0,z),m['wood'],.009)
        box('back_panel',(w-2*t,.022,h-base-.07),(0,d/2-.011,(h+base)/2),m['body'],.006)
    def pull(m,x,y,z,w=.12):
        for s in (-1,1):box('pull_standoff',(.017,.022,.018),(x+s*w*.4,y+.012,z),m['hardware'],.004)
        box('rounded_bar_pull',(w,.022,.023),(x,y,z),m['hardware'],.007)
    def front(m,x,y,z,w,h,style='shaker',handle=True):
        if style!='glass':box('door_or_drawer_front',(w,.03,h),(x,y,z),m['front'],.009)
        else:box('translucent_door_pane',(w-.07,.012,h-.07),(x,y,z),m['glass'],.004)
        if style in ('shaker','glass','arched'):
            for s in (-1,1):
                box('framed_vertical_stile',(.035,.019,h),(x+s*(w-.035)/2,y-.022,z),m['trim'],.007)
                box('framed_horizontal_rail',(w-.055,.019,.035),(x,y-.022,z+s*(h-.035)/2),m['trim'],.007)
        if style=='arched':
            radius=(w-.11)/2
            for n in range(14):
                a=math.pi*n/14;b=math.pi*(n+1)/14
                rod('arched_panel_moulding',(x+radius*math.cos(a),y-.028,z+h*.17+radius*.6*math.sin(a)),(x+radius*math.cos(b),y-.028,z+h*.17+radius*.6*math.sin(b)),.01,m['trim'])
            for sx in (-1,1):box('carved_corner_block',(.055,.025,.055),(x+sx*w*.36,y-.026,z-h*.37),m['trim'],.012)
        if handle:pull(m,x,y-.047,z+h*.29,min(.12,w*.5))
    def cabinet(m,style):
        m=palette(m);w,d,h={'push':(.8,.62,.91),'drawers':(.9,.62,.91),'arched':(.9,.62,.91),'pantry':(.8,.62,2.2),'glass':(.8,.35,.75),'open':(.9,.33,.7)}[style]
        wall=style in ('glass','open');base=.035 if wall else .09;top=h if wall else h-.045 if style=='pantry' else h-.04
        shell(m,w,d,top,base)
        if not wall and style!='pantry':box('independent_worktop',(w,d,.04),(0,0,h-.02),m['counter'],.012)
        y=-d/2-.019
        if style=='drawers':
            for n in range(3):front(m,0,y,base+(n+.5)*(top-base)/3,w-.035,(top-base)/3-.012)
        elif style=='open':
            box('open_center_divider',(.03,d-.04,h-.09),(0,0,h/2),m['wood'],.008)
            box('open_middle_shelf',(w-.07,d-.02,.033),(0,0,h*.49),m['wood'],.009)
        else:
            if style=='glass':
                for z in (h*.34,h*.66):box('visible_interior_shelf',(w-.07,d-.055,.025),(0,.012,z),m['wood'],.007)
            rows=2 if style=='pantry' else 1
            for row in range(rows):
                for side in (-1,1):front(m,side*w*.245,y,base+(row+.5)*(top-base)/rows,w*.48,(top-base)/rows-.025,'glass' if style=='glass' else 'arched' if style=='arched' else 'flush' if style=='push' else 'shaker',style!='push')
            if style=='pantry':box('layered_crown',(w+.02,d+.012,.045),(0,0,h-.0225),m['trim'],.011)
        return w,d,h
    def closet(m,style):
        m=palette(m);w,d,h={'sliding':(1.8,.65,2.3),'double':(1.2,.62,2.3),'hanging':(.9,.6,2.2),'shelf':(.6,.6,2.2),'corner':(1,1,2.2),'wide':(1.5,.48,.85),'tall':(.7,.47,1.25)}[style]
        if style=='corner':
            # Two joined runs, not a solid square pretending to be a walk-in.
            for z in (.05,.48,.96,1.44,1.90,2.18):
                box('corner_long_shelf',(w,.38,.04),(0,.31,z),m['wood'],.008)
                box('corner_return_shelf',(.38,.62,.04),(-.31,-.19,z),m['wood'],.008)
            box('corner_back',(w,.03,h),(0,.485,h/2),m['body'],.007)
            box('corner_return_back',(.03,d-.03,h),(-.485,-.015,h/2),m['body'],.007)
            for x,y in ((.48,.30),(-.30,-.48)):box('corner_end_upright',(.035,.38,h),(x,y,h/2),m['body'],.006) if x>0 else box('corner_end_upright',(.38,.035,h),(x,y,h/2),m['body'],.006)
            return w,d,h
        base=.12 if style in ('wide','tall') else .065;shell(m,w,d,h,base,style not in ('wide','tall'))
        if style in ('wide','tall'):
            for x in (-w*.42,w*.42):
                for y in (-d*.34,d*.34):cyl('thick_tapered_foot',.037,base,(x,y,base/2),m['wood'],6,taper=.8)
            rows=3 if style=='wide' else 5;columns=2 if style=='wide' else 1
            for row in range(rows):
                for col in range(columns):
                    fw=w/columns-.028;fh=(h-base-.04)/rows-.012;x=-w/2+(col+.5)*w/columns;z=base+.02+(row+.5)*(h-base-.04)/rows
                    front(m,x,-d/2-.018,z,fw,fh,'flush' if style=='wide' else 'shaker')
                    if style=='wide':
                        for i in range(13):box('drawer_reeding',(.023,.014,fh-.025),(x-fw/2+(i+.5)*fw/13,-d/2-.04,z),m['wood'],.005)
        elif style=='sliding':
            for index in range(2):
                x=(index-.5)*w*.48;y=-d/2-.018-index*.025
                front(m,x,y,h/2,w*.51,h-.065,'flush',False)
                box('sliding_inset_pull',(.026,.014,.18),(x+(1 if index==0 else -1)*w*.20,y-.021,h*.45),m['hardware'],.007)
            for z in (.035,h-.025):box('sliding_track',(w,.09,.018),(0,-d/2,z),m['hardware'],.005)
        elif style=='double':
            for s in (-1,1):front(m,s*w*.245,-d/2-.015,(h+base)/2,w*.48,h-base-.015)
        else:
            if style=='hanging':
                box('upper_hat_shelf',(w-.07,d-.05,.035),(0,0,h-.30),m['wood'],.009)
                rod('clothes_rail',(-w/2+.04,-.06,h-.48),(w/2-.04,-.06,h-.48),.018,m['hardware'])
                for x in (-.23,0,.23):
                    rod('hanger_hook',(x,-.06,h-.48),(x,-.06,h-.56),.006,m['hardware'])
                    for y in (-.23,.11):rod('wood_hanger_shoulder',(x,-.06,h-.56),(x,y,h-.68),.009,m['wood'])
                    rod('hanger_crossbar',(x,-.23,h-.68),(x,.11,h-.68),.007,m['wood'])
                for n in range(2):front(m,0,-d/2+.025,.18+n*.24,w-.07,.22,'flush')
            else:
                for z in (.45,.85,1.25,1.65,1.98):box('adjustable_shelf',(w-.07,d-.045,.035),(0,0,z),m['wood'],.008)
                front(m,0,-d/2+.025,.22,w-.07,.27,'flush')
        return w,d,h
    def hood(m,style):
        m=palette(m);w,d,h={'chimney':(.9,.5,.8),'slim':(.76,.48,.16),'microwave':(.76,.4,.43)}[style]
        if style=='microwave':microwave_parts(m,w,d,h,True)
        else:
            box('hood_lower_lip',(w,d,.065),(0,0,.0325),m['front'],.018)
            if style=='chimney':
                # Tapered four-sided canopy rather than a stack of rectangular boxes.
                verts=[(s*w/2,t*d/2,.06) for s,t in ((-1,-1),(1,-1),(1,1),(-1,1))]+[(s*w*.23,t*d*.23,.29) for s,t in ((-1,-1),(1,-1),(1,1),(-1,1))]
                mesh=bpy.data.meshes.new('hood_canopy');mesh.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);mesh.update()
                o=bpy.data.objects.new('tapered_chimney_canopy',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m['front']);finish(o,.012,2)
                box('chimney_flue',(w*.34,d*.34,h-.22),(0,d*.12,(h+.22)/2),m['body'],.016)
            else:box('slim_motor_housing',(w-.02,d-.02,h-.05),(0,.005,(h+.05)/2),m['front'],.019)
            for x in (-w*.24,w*.24):
                box('extractor_filter',(w*.36,d*.64,.012),(x,.01,.008),m['steel'],.004)
                for n in range(5):box('filter_slit',(w*.30,.008,.004),(x,-d*.21+n*d*.10,.001),m['dark'],.002)
            for x in (-w*.36,w*.36):cyl('task_light',.025,.014,(x,-d*.32,.012),m['light'],16)
            for x in (-.035,0,.035):box('hood_control',(.02,.008,.014),(x,-d/2-.002,.036),m['hardware'],.004)
        return w,d,h
    def microwave_parts(m,w,d,h,vent=False):
        box('enamel_microwave_body',(w,d,h),(0,0,h/2),m['front'],.026)
        box('dark_door_window',(w*.69,.018,h*.69),(-w*.095,-d/2-.005,h*.51),m['dark'],.014)
        box('window_inner_glass',(w*.54,.007,h*.52),(-w*.12,-d/2-.017,h*.52),m['glass'],.009)
        box('vertical_door_handle',(.022,.035,h*.59),(w*.23,-d/2-.033,h*.51),m['hardware'],.007)
        box('clock_display',(w*.12,.006,h*.13),(w*.39,-d/2-.014,h*.74),m['dark'],.005)
        for r in range(3):
            for c in range(2):box('control_key',(.018,.008,.014),(w*.36+c*.026,-d/2-.018,h*.31+r*.04),m['hardware'],.004)
        if vent:
            for i in range(16):box('microwave_extraction_slot',(.017,.012,.018),(-w*.43+i*w*.055,-d/2-.015,h*.10),m['dark'],.003)
    def lathe(name,profile,mat,loc=(0,0,0),n=32):
        # Closed rim / inner wall profiles produce genuine open vessels.
        verts=[(r*math.cos(2*math.pi*i/n)+loc[0],r*math.sin(2*math.pi*i/n)+loc[1],z+loc[2]) for r,z in profile for i in range(n)]
        faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);finish(o,0);return o
    def appliance(m,style):
        m=palette(m);w,d,h={'toaster':(.30,.20,.21),'espresso':(.30,.38,.38),'coffee':(.22,.30,.36),'knives':(.18,.22,.34),'microwave':(.51,.40,.30),'mixer':(.26,.38,.36),'airfryer':(.30,.34,.34)}[style]
        if style=='microwave':microwave_parts(m,w,d,h)
        elif style=='toaster':
            box('toaster_lower_shell',(w,d,.16),(0,0,.08),m['front'],.036)
            # The top is assembled around slots, leaving actual recesses.
            for y in (-.084,0,.084):box('toaster_top_bridge',(.234,.026,.05),(0,y,.181),m['steel'],.009)
            for x in (-.133,.133):box('slot_end_bridge',(.032,d-.01,.05),(x,0,.181),m['steel'],.009)
            for y in (-.043,.043):box('recessed_toast_slot',(.228,.044,.015),(0,y,.162),m['dark'],.005)
            box('lever_track',(.01,.07,.075),(w/2+.002,0,.125),m['dark'],.003)
            box('toast_lift_lever',(.025,.06,.014),(w/2+.012,0,.155),m['hardware'],.006)
            cyl('browning_dial',.023,.018,(0,-d/2-.006,.072),m['hardware'],18,(math.pi/2,0,0))
        elif style=='espresso':
            box('espresso_base',(w,d,.05),(0,0,.025),m['front'],.017)
            box('rear_boiler_housing',(w,d*.45,h-.145),(0,d*.26,(h-.065)/2),m['front'],.027)
            box('top_control_bridge',(w,d*.84,.105),(0,.015,h-.0525),m['front'],.025)
            box('drip_tray',(w*.84,d*.47,.017),(0,-d*.22,.057),m['steel'],.006)
            for x in (-.08,-.04,0,.04,.08):box('drip_tray_slot',(.009,.12,.004),(x,-d*.22,.068),m['dark'],.002)
            cyl('group_head',.042,.035,(0,-.07,h-.116),m['steel'],24)
            rod('portafilter_handle',(0,-.07,.242),(0,-.18,.242),.017,m['hardware'])
            rod('steam_wand',(.108,-.015,.255),(.108,-.065,.105),.008,m['steel'])
            cyl('pressure_gauge',.025,.01,(-.073,-.15,h-.052),m['steel'],24,(math.pi/2,0,0))
            box('gauge_needle',(.003,.007,.03),(-.073,-.158,h-.049),m['dark'],.001,(0,.4,0))
        elif style=='coffee':
            box('coffee_foot',(w,d,.025),(0,0,.0125),m['front'],.018)
            box('water_reservoir',(w,.09,h-.02),(0,.095,h/2),m['front'],.025)
            cyl('filter_basket',.10,.105,(0,-.03,h-.0525),m['front'],28)
            lathe('glass_coffee_carafe',[(0,0),(.073,0),(.082,.018),(.083,.14),(.057,.17),(.052,.17),(.076,.136),(.075,.018),(0,.012)],m['glass'],(0,-.035,.037))
            cyl('carafe_lid',.058,.014,(0,-.035,.215),m['hardware'],24)
            rod('carafe_handle_top',(.075,-.035,.19),(.11,-.035,.17),.01,m['hardware']);rod('carafe_handle_grip',(.11,-.035,.17),(.11,-.035,.072),.012,m['hardware']);rod('carafe_handle_bottom',(.11,-.035,.072),(.075,-.035,.055),.01,m['hardware'])
        elif style=='knives':
            box('knife_block',(.17,.20,.205),(0,0,.1025),m['wood'],.019)
            for n in range(5):
                x=(n-2)*.03;y=-.06+(n%2)*.085;hh=.10+(n%3)*.011
                box('knife_slot',(.017,.007,.003),(x,y,.206),m['dark'],.001)
                box('knife_bolster',(.017,.012,.018),(x,y,.214),m['steel'],.003)
                box('individual_knife_handle',(.02,.022,hh),(x,y,.219+hh/2),m['hardware'],.007)
                for z in (.242,.275):cyl('handle_pin',.0025,.023,(x,y,z),m['steel'],8,(math.pi/2,0,0))
        elif style=='mixer':
            box('mixer_foot',(w,d,.033),(0,0,.0165),m['front'],.023)
            box('mixer_pedestal',(.105,.105,h-.055),(0,.123,(h+.015)/2),m['front'],.034)
            box('tilt_head',(.14,.29,.10),(0,.018,h-.05),m['front'],.038)
            cyl('head_hinge',.036,.13,(0,.123,h-.09),m['hardware'],24,(0,math.pi/2,0))
            lathe('hollow_mixing_bowl',[(0,0),(.060,0),(.083,.028),(.113,.155),(.106,.161),(.100,.145),(.073,.030),(.053,.012),(0,.012)],m['steel'],(0,-.058,.037))
            rod('beater_shaft',(0,-.07,.29),(0,-.07,.16),.008,m['steel'])
            for x in (-.039,.039):rod('beater_loop',(0,-.07,.21),(x,-.07,.105),.004,m['steel'])
            rod('beater_crossbar',(-.039,-.07,.105),(.039,-.07,.105),.004,m['steel'])
        else:
            cyl('airfryer_base',.142,.045,(0,0,.0225),m['front'],32)
            lathe('clear_cooking_bowl',[(0,0),(.11,0),(.136,.035),(.14,.205),(.132,.205),(.128,.04),(.103,.012),(0,.012)],m['glass'],(0,0,.042))
            cyl('removable_cooking_tray',.117,.012,(0,0,.065),m['dark'],28)
            cyl('heater_lid',.15,.085,(0,0,.29),m['front'],32,taper=.88)
            box('airfryer_control_display',(.13,.007,.035),(0,-.142,.29),m['dark'],.01)
            box('glass_bowl_handle',(.052,.065,.07),(0,-.151,.168),m['hardware'],.017)
        return w,d,h
    def pendant(m,style):
        m=palette(m);w,d,h=(.4,.4,.75) if style=='dome' else (1.2,.16,.65)
        shader=m['light'].node_tree.nodes.get('Principled BSDF');shader.inputs['Emission Color'].default_value=(1,.78,.4,1);shader.inputs['Emission Strength'].default_value=.4
        if style=='dome':
            lathe('open_dome_shade',[(.195,.015),(.20,.04),(.18,.09),(.13,.15),(.055,.19),(.046,.19),(.12,.14),(.17,.083),(.19,.036),(.185,.018)],m['front'])
            cyl('warm_shade_diffuser',.145,.008,(0,0,.038),m['light'],32)
            rod('pendant_cord',(0,0,.19),(0,0,h-.035),.009,m['hardware'])
            cyl('ceiling_canopy',.065,.035,(0,0,h-.0175),m['body'],24)
        else:
            box('linear_lamp_body',(w,d,.075),(0,0,.0375),m['front'],.021)
            box('continuous_warm_diffuser',(w-.035,d-.035,.013),(0,0,.008),m['light'],.005)
            for x in (-w*.32,w*.32):rod('suspension_cable',(x,0,.075),(x,0,h-.033),.006,m['hardware'])
            box('linear_ceiling_canopy',(w*.72,.10,.035),(0,0,h-.0175),m['body'],.009)
        return w,d,h
    def backsplash(m,style):
        m=palette(m);w,d,h=1.2,.024,.6
        box('backsplash_backing',(w,.012,h),(0,.006,h/2),m['grout'],.002)
        if style=='slab':box('continuous_stone_slab',(w,.017,h),(0,-.006,h/2),m['counter'],.004)
        else:
            tw,th=(.24,.10) if style=='subway' else (.10,.20)
            for row in range(round(h/th)):
                offset=tw/2 if style=='subway' and row%2 else 0
                for col in range(math.ceil(w/tw)+1):
                    left=max(-w/2,-w/2+col*tw-offset);right=min(w/2,-w/2+(col+1)*tw-offset)
                    if right-left>.008:box('individual_ceramic_tile',(right-left-.004,.015,th-.004),((left+right)/2,-.006,(row+.5)*th),m['ceramic'],.004)
        return w,d,h
    return {
        **{key:lambda m,s=style:cabinet(m,s) for key,style in [('push-base-cabinet','push'),('shaker-drawer-cabinet','drawers'),('arched-base-cabinet','arched'),('tall-pantry-cabinet','pantry'),('glass-wall-cabinet','glass'),('open-wall-cabinet','open')]},
        **{key:lambda m,s=style:closet(m,s) for key,style in [('sliding-closet','sliding'),('double-door-closet','double'),('closet-hanging-module','hanging'),('closet-shelf-module','shelf'),('closet-corner-module','corner'),('wide-fluted-dresser','wide'),('tall-drawer-chest','tall')]},
        **{key:lambda m,s=style:hood(m,s) for key,style in [('chimney-hood','chimney'),('under-cabinet-hood','slim'),('microwave-hood','microwave')]},
        **{key:lambda m,s=style:appliance(m,s) for key,style in [('two-slot-toaster','toaster'),('espresso-machine','espresso'),('filter-coffee-maker','coffee'),('knife-block','knives'),('countertop-microwave','microwave'),('stand-mixer','mixer'),('glass-air-fryer','airfryer')]},
        **{key:lambda m,s=style:pendant(m,s) for key,style in [('dome-pendant','dome'),('linear-pendant','linear')]},
        **{f'backsplash-{s}':lambda m,s=s:backsplash(m,s) for s in ('subway','stacked','slab')},
    }
