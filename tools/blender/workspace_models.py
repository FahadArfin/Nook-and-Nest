"""Original coffee, computer-workspace and cooling collection. Blender metres/Z up."""
import math
import bpy


def workspace_builders(box, cyl, material, finish):
    def materials(m):
        return {**m,"dark":material("matte-graphite",(.07,.09,.10),None,.86),
                "light":material("warm-ivory",(.82,.80,.73),None,.9),
                "display":material("quiet-blue-display",(.12,.25,.30),None,.65),
                "accent":material("muted-status-light",(.47,.67,.60),None,.8)}

    def ring(name,radius,tube,loc,mat,rot=(math.pi/2,0,0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=tube,major_segments=32,minor_segments=6,location=loc,rotation=rot)
        obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat)
        return finish(obj,0,1)

    def legs(m,w,d,h):
        for x in (-w*.40,w*.40):
            for y in (-d*.36,d*.36):box("tapered_wood_leg",(.075,.075,h),(x,y,h/2),m["wood"],.016,(0,-x*.03,0))

    def coffee(m,style):
        m=materials(m)
        if style=="drum":
            w=d=.86;h=.4
            cyl("recessed_plinth",.34,.06,(0,0,.03),m["dark"],32)
            cyl("drum_body",.39,.29,(0,0,.205),m["variant"],40)
            for i in range(24):
                a=i*math.tau/24
                box("soft_fluted_stave",(.045,.028,.28),(.392*math.cos(a),.392*math.sin(a),.205),m["variant"],.009,(0,0,a-math.pi/2))
            cyl("round_wood_top",.43,.065,(0,0,.3675),m["wood"],48)
        elif style=="lift":
            w,d,h=1.1,.60,.46;legs(m,w,d,.18)
            box("storage_body",(w*.94,d*.92,.22),(0,0,.265),m["variant"],.028)
            box("lid_shadow_reveal",(w*.94,d*.91,.018),(0,0,.393),m["dark"],.008)
            box("closed_lift_lid",(w,d,.06),(0,0,.43),m["wood"],.018)
            box("recessed_finger_pull",(.27,.025,.025),(0,-d*.465,.36),m["dark"],.008)
            for x in (-.36,.36):box("back_hinge",(.11,.03,.026),(x,d*.455,.39),m["metal"],.007)
        elif style=="glass":
            w,d,h=1.05,.60,.43;legs(m,w,d,.38)
            box("lower_reeded_shelf",(w*.85,d*.81,.045),(0,0,.16),m["variant"],.014)
            glass=material("smoked-table-glass",(.43,.59,.59),None,.3)
            glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.48;glass.surface_render_method='DITHERED'
            box("glass_inset",(w-.07,d-.07,.027),(0,0,.411),glass,.01)
            for x in (-1,1):box("rim_side",(.045,d,.065),(x*(w-.045)/2,0,.3975),m["wood"],.012)
            for y in (-1,1):box("rim_end",(w-.09,.045,.065),(0,y*(d-.045)/2,.3975),m["wood"],.012)
        else:
            w,d,h=1.2,.60,.42
            for x in (-w*.33,w*.33):
                for y in (-d*.26,d*.26):box("oval_table_leg",(.075,.075,.36),(x,y,.18),m["wood"],.016)
            for name,z,sx,sy in (("oval_top",.385,1,1),("lower_magazine_shelf",.15,.83,.78)):
                obj=cyl(name,.5,.07,(0,0,z),m["wood"] if z>.3 else m["variant"],48);obj.scale.x=w*sx;obj.scale.y=d*sy
            for x in (-.39,.39):box("shelf_joint",(.06,.39,.05),(x,0,.12),m["wood_dark"],.01)
        return w,d,h

    def desk(m,style):
        m=materials(m)
        if style=="compact":
            w,d,h=1,.55,.76;legs(m,w,d,.70)
            box("compact_worktop",(w,d,.065),(0,0,h-.0325),m["wood"],.022)
            box("keyboard_tray",(.70,.30,.04),(0,-.08,.60),m["variant"],.012)
            for x in (-.37,.37):box("tray_slide",(.025,.33,.055),(x,-.07,.63),m["dark"],.006)
            box("rear_crossrail",(.84,.05,.10),(0,.20,.20),m["variant"],.012)
        elif style=="gaming":
            w,d,h=1.6,.8,.76
            box("gaming_desktop",(w,d,.075),(0,0,h-.0375),m["dark"],.04)
            box("front_color_inlay",(w*.90,.018,.015),(0,-d*.495,h-.047),m["variant"],.005)
            for side in (-1,1):
                box("sled_foot",(.10,d*.86,.065),(side*w*.39,0,.0325),m["dark"],.016)
                box("angled_leg",(.085,.13,.68),(side*w*.36,.035,.36),m["variant"],.017,(0,side*.10,0))
            box("cable_trough",(1.10,.13,.07),(0,.28,.59),m["dark"],.015)
            ring("cable_grommet",.027,.008,(.57,.28,h-.001),m["variant"],(0,0,0))
        else:
            w,d,h=1.5,.70,.76
            box("studio_worktop",(w,d,.065),(0,0,h-.0325),m["wood"],.02)
            for side in (-1,1):
                x=side*.56
                box("drawer_pedestal",(.32,.58,.67),(x,.02,.355),m["variant"],.025)
                box("pedestal_foot",(.28,.51,.04),(x,.02,.02),m["wood_dark"],.008)
                for z in (.19,.40,.61):
                    box("drawer_front",(.285,.035,.18),(x,-.283,z),m["variant"],.012)
                    box("wood_pull",(.13,.035,.027),(x,-.312,z+.025),m["wood"],.009)
        return w,d,h

    def monitor(m,wide=False):
        m=materials(m);w,d,h=(.82,.25,.45) if wide else (.61,.22,.46)
        box("monitor_foot",(w*.42,d,.023),(0,0,.0115),m["variant"],.01)
        box("stand_neck",(.045,.05,h*.44),(0,.025,h*.24),m["dark"],.009)
        box("display_shell",(w,.045,h*.70),(0,0,h*.65),m["variant"],.018)
        box("screen_bezel",(w-.021,.012,h*.70-.022),(0,-.028,h*.65),m["dark"],.008)
        box("display_glass",(w-.042,.006,h*.70-.046),(0,-.036,h*.65),m["display"],.004)
        box("status_light",(.018,.007,.006),(w*.38,-.037,h*.325),m["accent"],.002)
        for i in range(6):box("rear_vent",(.04,.005,.006),(-.14+i*.055,.025,h*.62),m["dark"],.001)
        return w,d,h

    def chair(m,gaming=False):
        m=materials(m);w,d,h=(.72,.72,1.24) if gaming else (.66,.66,1.12)
        cyl("lift_column",.033,.33,(0,0,.24),m["steel"],16)
        for i in range(5):
            a=i*math.tau/5
            box("five_star_leg",(.29,.045,.042),(.15*math.cos(a),.15*math.sin(a),.09),m["dark"],.012,(0,0,a))
            cyl("rubber_caster",.035,.050,(.285*math.cos(a),.285*math.sin(a),.043),m["dark"],12,(math.pi/2,0,a))
        box("seat_pan",(.51,.49,.055),(0,-.035,.445),m["dark"],.019)
        box("seat_cushion",(.51,.49,.095),(0,-.05,.49),m["fabric"],.031)
        for side in (-1,1):
            box("arm_support",(.04,.045,.22),(side*.285,.015,.58),m["dark"],.01)
            box("arm_pad",(.075,.30,.055),(side*.285,-.025,.705),m["variant"],.018)
        if gaming:
            box("tall_racing_back",(.48,.105,.67),(0,.205,.87),m["dark"],.034,(-.08,0,0))
            box("central_back_padding",(.31,.055,.58),(0,.135,.875),m["fabric"],.018,(-.08,0,0))
            for side in (-1,1):
                box("side_bolster",(.09,.105,.45),(side*.205,.145,.82),m["fabric"],.029,(0,side*.10,0))
                box("shoulder_wing",(.115,.10,.15),(side*.20,.17,1.115),m["variant"],.027,(0,-side*.25,0))
                box("harness_recess",(.075,.012,.032),(side*.11,.105,1.085),m["dark"],.009)
            box("head_pad",(.25,.065,.11),(0,.12,1.17),m["fabric"],.026)
            box("lumbar_pad",(.28,.08,.115),(0,.10,.64),m["fabric"],.025)
        else:
            for x in (-.215,.215):box("back_frame_side",(.045,.075,.43),(x,.205,.77),m["dark"],.014)
            for z in (.565,.975):box("back_frame_rail",(.44,.075,.045),(0,.205,z),m["dark"],.014)
            for i in range(11):box("woven_back_band",(.39,.019,.019),(0,.205,.59+i*.034),m["variant"],.005)
            for x in (-.13,0,.13):box("mesh_vertical",(.012,.013,.38),(x,.207,.775),m["variant"],.004)
            box("lumbar_support",(.32,.065,.07),(0,.15,.63),m["fabric"],.016)
            box("headrest_stem",(.035,.04,.14),(0,.225,1.025),m["dark"],.008)
            box("headrest",(.28,.085,.105),(0,.20,1.067),m["fabric"],.026)
        box("height_paddle",(.10,.035,.022),(.27,-.05,.408),m["dark"],.006)
        return w,d,h

    def computer(m,kind):
        m=materials(m)
        if kind=="tower":
            w,d,h=.23,.45,.47
            box("pc_chassis",(w,d*.97,h*.94),(0,0,h*.52),m["variant"],.022)
            for x in (-w*.32,w*.32):
                for y in (-d*.33,d*.33):box("rubber_foot",(.035,.05,.025),(x,y,.0125),m["dark"],.007)
            box("front_mesh_panel",(w*.85,.012,h*.76),(0,-d*.49,h*.45),m["dark"],.012)
            for z in (.15,.31):
                ring("intake_fan_rim",.077,.006,(0,-d*.505,z),m["variant"])
                cyl("intake_hub",.023,.012,(0,-d*.51,z),m["dark"],16,(math.pi/2,0,0))
                for i in range(3):
                    a=i*math.tau/3
                    box("intake_blade",(.085,.009,.022),(.032*math.cos(a),-d*.505,z+.032*math.sin(a)),m["variant"],.007,(0,-a,0))
            for x in (-.05,0):box("usb_port",(.022,.008,.009),(x,-d*.497,.427),m["dark"],.002)
            cyl("power_button",.012,.009,(.069,-d*.499,.427),m["accent"],12,(math.pi/2,0,0))
            box("side_service_panel",(.01,d*.75,h*.70),(w*.5,.02,h*.52),m["dark"],.007)
        elif kind=="mini":
            w=d=.14;h=.052
            box("mini_pc_base",(w*.93,d*.93,.009),(0,0,.0045),m["dark"],.004)
            box("mini_pc_enclosure",(w,d,h-.008),(0,0,h/2+.004),m["variant"],.011)
            for x in (-.038,-.010):box("front_usb",(.018,.004,.006),(x,-.070,.024),m["dark"],.002)
            cyl("mini_power",.005,.004,(.044,-.071,.025),m["accent"],12,(math.pi/2,0,0))
            for i in range(7):box("mini_side_vent",(.003,.006,.020),(.070,-.04+i*.013,.028),m["dark"],.001)
        else:
            w,d,h=.35,.26,.25
            box("laptop_base",(w,d,.017),(0,0,.010),m["variant"],.007)
            box("keyboard_well",(.31,.097,.003),(0,.015,.020),m["dark"],.003)
            for row in range(4):
                for col in range(11):box("keycap",(.022,.016,.003),(-.137+col*.027,.048-row*.023,.023),m["light"],.001)
            box("trackpad",(.105,.054,.002),(0,-.080,.020),m["light"],.005)
            angle=-.12
            box("open_laptop_lid",(w,.013,.233),(0,.111,.133),m["variant"],.008,(angle,0,0))
            box("laptop_bezel",(.328,.006,.211),(0,.101,.133),m["dark"],.004,(angle,0,0))
            box("laptop_display",(.309,.003,.191),(0,.096,.136),m["display"],.003,(angle,0,0))
            cyl("webcam",.002,.004,(0,.088,.233),m["dark"],8,(math.pi/2,0,0))
        return w,d,h

    def fan(m,tower=False):
        m=materials(m)
        if tower:
            w=d=.29;h=1.05
            cyl("tower_foot",.145,.035,(0,0,.0175),m["dark"],32)
            cyl("oscillating_base_neck",.045,.065,(0,0,.06),m["dark"],16)
            box("tower_housing",(.17,.17,.965),(0,0,.5675),m["variant"],.045)
            box("tower_air_channel",(.12,.018,.79),(0,-.082,.55),m["dark"],.018)
            for i in range(25):box("tower_louvre",(.115,.024,.013),(0,-.095,.17+i*.031),m["light"],.004)
            box("top_controls",(.10,.065,.01),(0,-.025,1.052),m["dark"],.012)
            for x in (-.028,0,.028):cyl("touch_control",.006,.003,(x,-.029,1.059),m["accent"],10)
            box("speed_display",(.035,.006,.021),(0,-.089,.99),m["dark"],.004)
        else:
            w,d,h=.46,.40,1.25
            cyl("pedestal_foot",.19,.045,(0,0,.0225),m["variant"],36)
            cyl("telescoping_pole",.025,.68,(0,.04,.38),m["steel"],16)
            cyl("height_lock",.036,.065,(0,.04,.56),m["dark"],16)
            box("motor_neck",(.075,.08,.20),(0,.04,.79),m["variant"],.02)
            cyl("motor_housing",.08,.15,(0,.055,1.015),m["variant"],20,(math.pi/2,0,0))
            for i in range(3):
                a=i*math.tau/3
                outline=[(.025,-.025),(.09,-.04),(.17,-.012),(.18,.045),(.11,.075),(.04,.035)]
                verts=[(x*math.cos(a)-z*math.sin(a),-.06,1.015+x*math.sin(a)+z*math.cos(a)) for x,z in outline]
                mesh=bpy.data.meshes.new('paddle_blade');mesh.from_pydata(verts,[],[tuple(range(6))]);mesh.update();obj=bpy.data.objects.new('swept_fan_blade',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(m["variant"])
                solid=obj.modifiers.new('blade_thickness','SOLIDIFY');solid.thickness=.006
                bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name);finish(obj,.005,2)
            for radius in (.085,.15,.22):ring("front_guard_ring",radius,.0035,(0,-.096,1.015),m["light"])
            ring("guard_outer_rim",.225,.009,(0,-.06,1.015),m["dark"])
            for i in range(12):
                a=i*math.tau/12
                box("guard_spoke",(.215,.007,.006),(.109*math.cos(a),-.098,1.015+.109*math.sin(a)),m["light"],.002,(0,-a,0))
            cyl("fan_center_badge",.042,.026,(0,-.109,1.015),m["variant"],20,(math.pi/2,0,0))
            box("oscillation_button",(.027,.032,.035),(0,.11,1.098),m["dark"],.008)
        return w,d,h

    return {
        "drum-coffee-table":lambda m:coffee(m,"drum"),"lift-coffee-table":lambda m:coffee(m,"lift"),
        "glass-coffee-table":lambda m:coffee(m,"glass"),"oval-coffee-table":lambda m:coffee(m,"oval"),
        "compact-computer-desk":lambda m:desk(m,"compact"),"gaming-desk":lambda m:desk(m,"gaming"),"pedestal-computer-desk":lambda m:desk(m,"pedestal"),
        "desktop-monitor":lambda m:monitor(m),"wide-monitor":lambda m:monitor(m,True),
        "ergonomic-office-chair":lambda m:chair(m),"gaming-chair":lambda m:chair(m,True),
        "pc-tower":lambda m:computer(m,"tower"),"mini-pc":lambda m:computer(m,"mini"),"laptop":lambda m:computer(m,"laptop"),
        "tower-fan":lambda m:fan(m,True),"pedestal-fan":lambda m:fan(m),
    }
