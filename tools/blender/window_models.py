"""Original miniature window components; metres, Z up, wall on Y=0.

Each source retains named rails, panes and hardware. Bay projection points -Y.
All six designs share recolorable matte joinery, warm sills and pale glazing.
"""
import math
import bpy


def window_builders(box, cylinder, material, finish_mesh):
    def glass():
        mat = material("window-glazing", (.58, .78, .80), None, .28)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Alpha"].default_value = .38
        mat.diffuse_color = (.58, .78, .80, .38)
        mat.surface_render_method = 'DITHERED'
        return mat

    def pane(m, name, w, h, x, y, z, rotation=0):
        # The full frame is one connected assembly of overlapping bevelled rails.
        c, s = math.cos(rotation), math.sin(rotation)
        def part(label, dims, dx, dy, dz, mat, bevel=.012):
            box(name+label,dims,(x+dx*c-dy*s,y+dx*s+dy*c,z+dz),mat,bevel,(0,0,rotation))
        for side in (-1,1):
            part("_stile",(.065,.12,h),side*(w-.065)/2,0,0,m["variant"])
            part("_rail",(w,.12,.065),0,0,side*(h-.065)/2,m["variant"])
        part("_glass",(w-.10,.018,h-.10),0,.015,0,m["glass"],.005)

    def surround(m,w,d,h):
        for side in (-1,1):
            box("outer_jamb",(.09,.16,h-.06),(side*(w-.09)/2,0,h/2),m["variant"],.014)
        box("top_casing",(w,.18,.09),(0,0,h-.045),m["variant"],.015)
        box("warm_wood_sill",(w,d,.065),(0,0,.0325),m["wood"],.015)
        box("sill_apron",(w-.12,.12,.055),(0,.01,.085),m["variant"],.01)

    def rectangular(m,style,w,d,h):
        m={**m,"glass":glass()};surround(m,w,d,h)
        inner_w,inner_h=w-.16,h-.16
        if style=="casement":
            for side in (-1,1):
                pane(m,"casement_leaf",inner_w/2,inner_h,side*inner_w/4,-.015,h/2)
                box("brass_handle",(.018,.028,.11),(side*.055,-.092,h*.47),m["metal"],.007)
                for level in (.25,.75):box("hinge",(.02,.035,.065),(side*(w/2-.11),-.09,h*level),m["metal"],.006)
        elif style=="sash":
            for index in range(2):
                z=.09+inner_h*(.25+.5*index);y=-.028 if index==0 else .018
                pane(m,"sliding_sash",inner_w,inner_h/2+.025,0,y,z)
                for x in (-inner_w/6,inner_w/6):box("glazing_bar",(.026,.035,inner_h/2-.04),(x,y-.045,z),m["variant"],.006)
            box("sash_lift",(.16,.035,.025),(0,-.11,h*.49),m["metal"],.008)
        else:
            pane(m,"single_frame",inner_w,inner_h,0,-.012,h/2)
            if style=="awning":
                for x in (-w*.28,w*.28):box("top_hinge",(.09,.045,.025),(x,-.075,h-.13),m["metal"],.007)
                box("bottom_latch",(.14,.04,.027),(0,-.095,.14),m["metal"],.007)
        return w,d,h

    def arch(m):
        w,d,h=1,.22,1.45;m={**m,"glass":glass()}
        radius=.46;spring=h-radius-.04
        box("arch_sill",(w,d,.065),(0,0,.0325),m["wood"],.014)
        for side in (-1,1):box("arch_jamb",(.085,.16,spring),(side*.455,0,spring/2),m["variant"],.012)
        for side in (-1,1):pane(m,"lower_casement",.43,spring-.095,side*.215,0,(spring+.085)/2)
        box("fanlight_transom",(.92,.16,.065),(0,0,spring),m["variant"],.012)
        # A real extruded half-ring, not a scaled sphere or full disc crown.
        vertices=[];faces=[];steps=24
        for y in (-.08,.08):
            for r in (radius,radius-.075):
                for i in range(steps+1):
                    a=math.pi*i/steps;vertices.append((r*math.cos(a),y,spring+r*math.sin(a)))
        n=steps+1
        for i in range(steps):
            faces.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
        faces.extend([(0,n,3*n,2*n),(steps,2*n+steps,3*n+steps,n+steps)])
        mesh=bpy.data.meshes.new("arch_joinery");mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new("continuous_curved_crown",mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(m["variant"]);finish_mesh(obj,.008,2)
        r=radius-.065;verts=[(0,.012,spring)]+[(r*math.cos(math.pi*i/steps),.012,spring+r*math.sin(math.pi*i/steps)) for i in range(steps+1)]
        mesh=bpy.data.meshes.new("fan_glazing");mesh.from_pydata(verts,[],[(0,i+1,i+2) for i in range(steps)]);mesh.update();obj=bpy.data.objects.new("arched_fanlight",mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(m["glass"])
        for angle in (math.pi/4,math.pi/2,3*math.pi/4):
            length=radius-.06
            box("fanlight_spoke",(.025,.045,length),(length/2*math.cos(angle),-.012,spring+length/2*math.sin(angle)),m["variant"],.005,(0,math.pi/2-angle,0))
        return w,d,h

    def bay(m):
        w,d,h=1.8,.65,1.3;m={**m,"glass":glass()}
        # Plan is a trapezoid: the window grows out from the wall, with angled returns.
        outline=[(-.9,.06),(.9,.06),(.57,-.56),(-.57,-.56)]
        for name,z in (("bay_sill",.035),("bay_canopy",h-.035)):
            verts=[(x,y,z+offset) for offset in (-.035,.035) for x,y in outline]
            faces=[(0,3,2,1),(4,5,6,7)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
            mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(m["wood"]);finish_mesh(obj,.013,3)
        pane(m,"bay_front",1.14,h-.14,0,-.53,h/2)
        for side in (-1,1):
            dx,dy=side*.33,.59;angle=math.atan2(dy,dx)
            pane(m,"bay_return",math.hypot(dx,dy),h-.14,side*.735,-.235,h/2,angle)
        box("bay_center_mullion",(.035,.07,h-.16),(0,-.55,h/2),m["variant"],.008)
        return w,d,h

    return {
        "window-casement":lambda m:rectangular(m,"casement",1.2,.22,1.25),
        "window-sash":lambda m:rectangular(m,"sash",1,.22,1.4),
        "window-picture":lambda m:rectangular(m,"picture",1.8,.18,1.1),
        "window-awning":lambda m:rectangular(m,"awning",.9,.2,.65),
        "window-arched":arch,"window-bay":bay,
    }
