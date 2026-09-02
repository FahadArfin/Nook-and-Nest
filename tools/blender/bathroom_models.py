"""Original bathroom miniatures. Closed lofted shells give basins real cavities."""
import math
import bpy
import bmesh


def bathroom_builders(box, cyl, material, finish):
    def palette(m):
        glass=material('bathroom-shower-glass',(.64,.79,.78),None,.22)
        glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.18
        glass.surface_render_method='DITHERED'
        return {**m,'ceramic':material('warm-porcelain',(.88,.87,.81),None,.47),
                'mirror':material('bathroom-mirror',(.49,.65,.66),None,.24,.7),
                'glass':glass,'dark':material('bathroom-drain-shadow',(.13,.16,.16),None,.83),
                'glow':material('ivory-light-diffuser',(.98,.88,.62),None,.7)}

    def shell(name,w,d,h,loc,m,outer=None,exponent=2,inner_exponent=None,wall=.05,floor=.06):
        """Solid manifold shell, continuous outer skin/rim/sloped interior/bottom.

        No opaque top cap: the interior floor is recessed below the rim.
        """
        inner_exponent=inner_exponent or exponent
        profiles=[(w*.82,d*.82,0,exponent),(w*.94,d*.94,h*.12,exponent),
                  (w,d,h-.018,exponent),(w-.008,d-.008,h,exponent),
                  (w-wall*2,d-wall*2,h-.005,inner_exponent),
                  ((w-wall*2)*.98,(d-wall*2)*.98,h-min(.035,h*.20),inner_exponent),
                  ((w-wall*2)*.70,(d-wall*2)*.68,floor+.015,inner_exponent),
                  ((w-wall*2)*.62,(d-wall*2)*.58,floor,inner_exponent)]
        n=48;verts=[];faces=[]
        for rw,rd,z,power in profiles:
            for i in range(n):
                a=i*math.tau/n;co,si=math.cos(a),math.sin(a)
                verts.append((rw/2*math.copysign(abs(co)**(2/power),co),rd/2*math.copysign(abs(si)**(2/power),si),z))
        for ring in range(len(profiles)-1):
            for i in range(n):faces.append((ring*n+i,ring*n+(i+1)%n,(ring+1)*n+(i+1)%n,(ring+1)*n+i))
        faces.extend([tuple(reversed(range(n))),tuple(range((len(profiles)-1)*n,len(profiles)*n))])
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.location=loc
        mesh.materials.append(outer or m['variant']);mesh.materials.append(m['ceramic'])
        for face in mesh.polygons:face.material_index=0 if face.index<n*3 or face.index==len(faces)-2 else 1
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
        obj['cavity_depth_m']=h-floor;obj['construction']='continuous hollow shell'
        finish(obj,0,1)
        cyl(name+'_drain',min(.025,w*.055),.004,(loc[0],loc[1],loc[2]+floor+.002),m['steel'],16)
        return obj

    def faucet(m,x,y,z,tall=False):
        height=.24 if tall else .16
        cyl('tap_base',.026,.018,(x,y,z+.009),m['metal'],16)
        cyl('tap_column',.018,height,(x,y,z+height/2),m['metal'],16)
        box('tap_spout',(.035,.12,.026),(x,y-.047,z+height-.017),m['metal'],.008)
        box('tap_lever',(.025,.07,.014),(x,y+.018,z+height+.012),m['metal'],.005)

    def basin(m,kind):
        m=palette(m)
        if kind=='pedestal':
            w,d,h=.62,.50,.91
            cyl('pedestal_foot',.16,.08,(0,.025,.04),m['ceramic'],24)
            cyl('tapered_pedestal',.095,.56,(0,.055,.34),m['ceramic'],24,taper=.76)
            shell('pedestal_basin',w,d,.18,(0,0,.59),m,exponent=3,wall=.035,floor=.035)
            box('faucet_deck',(.32,.10,.045),(0,.18,.737),m['ceramic'],.012)
            faucet(m,0,.18,.75)
        elif kind=='wall':
            w,d,h=.60,.45,.36
            shell('wall_basin',w,d,.16,(0,0,.04),m,exponent=4,wall=.033,floor=.03)
            box('wall_basin_rear_deck',(.56,.09,.075),(0,.17,.157),m['ceramic'],.016)
            faucet(m,0,.17,.19)
            for x in (-.20,.20):box('wall_bracket',(.045,.23,.075),(x,.06,.04),m['metal'],.012)
        elif kind=='vessel':
            w,d,h=.46,.46,.16;shell('vessel_bowl',w,d,h,(0,0,0),m,exponent=2,wall=.025,floor=.027)
        else:
            double=kind=='double';floating=kind=='floating';w=1.4 if double else .90;d=.52;h=.93 if not floating else .60
            body_bottom=0 if floating else .10;top=.37 if floating else .70
            box('vanity_cabinet',(w*.96,d*.91,top-body_bottom),(0,.012,(top+body_bottom)/2),m['variant'],.023)
            if not floating:
                for x in (-w*.40,w*.40):
                    for y in (-.17,.17):box('vanity_foot',(.075,.075,.12),(x,y,.06),m['wood'],.016)
            for side in (-1,1):
                x=side*w*.235
                for level in (.30,.72):
                    z=body_bottom+(top-body_bottom)*level
                    box('vanity_drawer',(w*.45,.035,(top-body_bottom)*.38),(x,-d*.46,z),m['variant'],.012)
                    box('vanity_pull',(w*.20,.035,.025),(x,-d*.50,z+.025),m['wood'],.008)
            box('vanity_worktop',(w,d,.055),(0,0,top+.0275),m['counter'],.015)
            for x in ((-w*.255,w*.255) if double else (0,)):
                shell('vanity_vessel',.46,.36,.115,(x,-.02,top+.055),m,outer=m['ceramic'],exponent=3.5,wall=.026,floor=.025)
                faucet(m,x,.185,top+.055)
        return w,d,h

    def toilet(m,kind):
        m=palette(m);wall=kind=='wall';compact=kind=='one'
        w,d,h=(.38,.56,.55) if wall else (.40,.68,.74) if compact else (.40,.72,.81)
        base=0 if wall else .10;bowl_h=.27 if wall else .29
        if not wall:
            cyl('skirted_toilet_foot',.16,.12,(0,.01,.06),m['ceramic'],32)
            box('concealed_trapway',(.26,.37,.25),(0,.07,.185),m['ceramic'],.045)
        shell('toilet_bowl',w,.51,bowl_h,(0,-.085,base),m,outer=m['ceramic'],exponent=2.4,wall=.05,floor=.06)
        # A separate hollow seat ring, not a solid oval hiding the bowl.
        n=48;verts=[]
        for z in (base+bowl_h-.006,base+bowl_h+.023):
            for rw,rd in ((w*.99,.505),(w*.69,.365)):
                verts.extend([(rw/2*math.cos(i*math.tau/n),-.085+rd/2*math.sin(i*math.tau/n),z) for i in range(n)])
        faces=[]
        for i in range(n):
            j=(i+1)%n;faces.extend([(i,j,2*n+j,2*n+i),(n+i,3*n+i,3*n+j,n+j),(2*n+i,2*n+j,3*n+j,3*n+i),(i,n+i,n+j,j)])
        mesh=bpy.data.meshes.new('seat_ring');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('open_toilet_seat',mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(m['variant']);finish(obj,.005,2)
        if wall:
            box('rear_wall_connection',(.29,.12,.19),(0,.19,.12),m['ceramic'],.025)
            box('flush_plate',(.23,.02,.145),(0,.218,.4775),m['variant'],.015)
            for x,r in ((-.05,.025),(.055,.018)):cyl('dual_flush_button',r,.01,(x,.202,.48),m['steel'],16,(math.pi/2,0,0))
        else:
            if compact:box('integrated_rear_pedestal',(.32,.14,.49),(0,.25,.28),m['ceramic'],.045)
            box('cistern',(.37,.175,h-.36),(0,.22,(h+.36)/2-.018),m['ceramic'],.035)
            box('cistern_lid',(.39,.195,.035),(0,.22,h-.0175),m['variant'],.012)
            cyl('flush_button',.022,.008,(.10,.21,h+.001),m['steel'],16)
        return w,d,h

    def shower_kit(m,x,y,z):
        cyl('riser',.015,1.72,(x,y,z+.98),m['metal'],16)
        box('rain_arm',(.035,.36,.032),(x,y-.16,z+1.835),m['metal'],.009)
        cyl('rain_head',.115,.028,(x,y-.31,z+1.81),m['steel'],28)
        for xx in (-.055,0,.055):
            for yy in (-.055,0,.055):cyl('rain_nozzle',.003,.004,(x+xx,y-.31+yy,z+1.793),m['dark'],8)
        box('mixer_plate',(.15,.018,.10),(x,y-.022,z+.91),m['variant'],.012)
        cyl('temperature_dial',.025,.035,(x,y-.044,z+.91),m['metal'],16,(math.pi/2,0,0))
        box('hand_shower',(.042,.04,.18),(x+.16,y-.02,z+1.29),m['metal'],.014,(-.12,0,0))
        # Tubular hose sampled as a gentle loop, not a loose floating accessory.
        points=[(x+.16,y-.02,z+1.2),(x+.18,y-.01,z+.63),(x+.08,y-.01,z+.57),(x,y-.02,z+.88)]
        curve=bpy.data.curves.new('shower_hose','CURVE');curve.dimensions='3D';curve.bevel_depth=.008;curve.bevel_resolution=2
        spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
        for bp,co in zip(spline.bezier_points,points):bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
        obj=bpy.data.objects.new('shower_hose',curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(m['metal']);bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)

    def shower(m,corner=False):
        m=palette(m);w,d,h=(.90,.90,2.05) if corner else (1.2,.90,2.05)
        shell('shower_tray',w,d,.065,(0,0,0),m,outer=m['ceramic'],exponent=12,wall=.032,floor=.027)
        # Only the plumbing backboard is opaque; the standing enclosure stays readable.
        box('shower_backboard',(w,.035,h-.06),(0,d/2-.025,(h+.06)/2),m['variant'],.012)
        box('fixed_glass_side',(.014,d-.045,h-.12),(-w/2+.015,0,h/2+.035),m['glass'],.006)
        if corner:
            box('corner_return_wall',(.028,d,h-.06),(w/2-.014,0,(h+.06)/2),m['variant'],.010)
            box('front_glass_door',(w-.045,.014,h-.13),(0,-d/2+.02,h/2+.03),m['glass'],.005)
            box('door_pull',(.022,.045,.23),(w*.29,-d/2-.01,1.02),m['metal'],.007)
            for z in (.29,1.72):box('glass_hinge',(.035,.035,.065),(-w*.43,-d*.48,z),m['metal'],.007)
        else:
            box('walk_in_splash_screen',(w*.49,.014,h-.13),(-w*.25,-d/2+.02,h/2+.03),m['glass'],.005)
            box('screen_stabilizer',(.026,d*.96,.026),(-w*.07,0,h-.04),m['metal'],.006)
        for x in (-w/2+.025,w/2-.025):box('back_frame_upright',(.024,.04,h),(x,d/2-.04,h/2),m['metal'],.006)
        shower_kit(m,0,d/2-.055,.04)
        return w,d,h

    def bath(m,kind):
        m=palette(m);alcove=kind in ('alcove','combo');claw=kind=='claw'
        w,d,h=(1.52,.76,.58) if alcove else (1.70,.80,.71) if claw else (1.65,.78,.66)
        bottom=.13 if claw else 0;basin_h=.52 if claw else .56 if alcove else .60
        shell('bathtub_shell',w,d,basin_h,(0,0,bottom),m,exponent=10 if alcove else 2.4,inner_exponent=3 if alcove else 2.2,wall=.055,floor=.085)
        if claw:
            for x in (-w*.32,w*.32):
                for y in (-d*.31,d*.31):
                    box('claw_leg',(.075,.09,.14),(x,y,.095),m['metal'],.018,(0,-x*.08,0))
                    box('rolled_claw_foot',(.11,.14,.045),(x,y-.012,.0225),m['metal'],.017)
        elif alcove:
            box('front_apron',(w-.01,.035,basin_h-.06),(0,-d/2+.01,(basin_h-.06)/2),m['variant'],.015)
            for x in (-w*.29,0,w*.29):box('apron_recess',(w*.265,.012,.32),(x,-d/2-.009,.29),m['variant'],.017)
        else:
            plinth=cyl('recessed_tub_plinth',.5,.045,(0,0,.0225),m['dark'],48);plinth.scale.x=w*.79;plinth.scale.y=d*.70
        faucet(m,w*.31,d*.31,bottom+basin_h-.06)
        cyl('overflow_cover',.024,.01,(w*.33,0,bottom+basin_h*.71),m['steel'],16,(0,math.pi/2,0))
        if kind=='combo':
            h=2.1
            box('tub_shower_backboard',(w,.028,1.53),(0,d/2-.015,1.335),m['variant'],.012)
            box('tub_splash_screen',(w*.43,.015,1.35),(-w*.275,-d/2+.018,1.24),m['glass'],.006)
            shower_kit(m,-w*.26,d/2-.045,.24)
        return w,d,h

    def mirror(m,kind):
        m=palette(m)
        if kind=='cabinet':
            w,d,h=.80,.16,.80
            box('medicine_cabinet',(w,d,h),(0,0,h/2),m['variant'],.025)
            for x in (-w*.245,w*.245):
                box('mirror_door',(w*.47,.025,h*.93),(x,-d/2-.006,h/2),m['wood'],.011)
                box('mirror_inset',(w*.43,.009,h*.89),(x,-d/2-.024,h/2),m['mirror'],.009)
                box('cabinet_pull',(.025,.028,.12),(x*.22,-d/2-.035,.29),m['metal'],.007)
        elif kind=='round':
            w=h=.75;d=.055
            cyl('round_mirror_frame',w/2,d,(0,0,h/2),m['variant'],48,(math.pi/2,0,0))
            cyl('halo_diffuser',w*.463,.01,(0,-d/2-.001,h/2),m['glow'],48,(math.pi/2,0,0))
            cyl('mirror_glass',w*.438,.008,(0,-d/2-.008,h/2),m['mirror'],48,(math.pi/2,0,0))
        else:
            w,d,h=(.55,.05,.95) if kind=='pill' else (.70,.06,.90)
            # Capsule/rounded rectangle built as a continuous extruded outline.
            radius=w/2 if kind=='pill' else .10
            def panel(name,ww,hh,r,depth,y,mat):
                outline=[]
                for cx,cz,start in [(ww/2-r,hh-r,0),(-ww/2+r,hh-r,90),(-ww/2+r,r,180),(ww/2-r,r,270)]:
                    for i in range(13):a=math.radians(start+i*90/12);outline.append((cx+r*math.cos(a),cz+r*math.sin(a)))
                n=len(outline);verts=[(x,yy,z+(h-hh)/2) for yy in (y-depth/2,y+depth/2) for x,z in outline]
                faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
                mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat);finish(obj,.003,2)
            panel('continuous_mirror_frame',w,h,radius,d,0,m['variant'])
            panel('mirror_glass',w-.05,h-.05,max(.01,radius-.025),.008,-d/2-.002,m['mirror'])
        return w,d,h

    return {
        'bath-mirror-rounded':lambda m:mirror(m,'rounded'),'bath-mirror-pill':lambda m:mirror(m,'pill'),
        'bath-mirror-halo':lambda m:mirror(m,'round'),'bath-medicine-cabinet':lambda m:mirror(m,'cabinet'),
        'pedestal-sink':lambda m:basin(m,'pedestal'),'wall-hung-sink':lambda m:basin(m,'wall'),
        'vessel-sink':lambda m:basin(m,'vessel'),'single-bath-vanity':lambda m:basin(m,'single'),
        'double-bath-vanity':lambda m:basin(m,'double'),'floating-bath-vanity':lambda m:basin(m,'floating'),
        'two-piece-toilet':lambda m:toilet(m,'two'),'one-piece-toilet':lambda m:toilet(m,'one'),'wall-hung-toilet':lambda m:toilet(m,'wall'),
        'corner-shower':lambda m:shower(m,True),'walk-in-shower':lambda m:shower(m),
        'alcove-bathtub':lambda m:bath(m,'alcove'),'oval-freestanding-tub':lambda m:bath(m,'oval'),
        'clawfoot-bathtub':lambda m:bath(m,'claw'),'bath-shower-combo':lambda m:bath(m,'combo'),
    }
