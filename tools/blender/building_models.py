"""Original doors and stairs for Nook & Nest, metres / Z up.
Named components stay editable in .blend; exported GLBs are joined by material.
Generic construction references are documented in docs/building-research.md.
"""
import math


def building_builders(box,cyl,material,finish):
    def door(m,style):
        w=1.55 if style in ("french","bifold") else .95;d=.16;h=2.15
        frame=material("door-frame",(.64,.57,.43),None,.9)
        panel=material("door-surface",(.78,.74,.63),None,.95)
        trim=material("door-panel-trim",(.72,.69,.60),None,.93)
        handle=material("door-hardware",(.17,.16,.13),None,.65,.25)
        glass=material("door-frosted-glass",(.53,.69,.65),None,.36)
        glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value=.42;glass.surface_render_method='DITHERED'
        inner=w-.12;leaf_h=h-.065
        for side in (-1,1):box("thick_side_jamb",(.065,d,h-.065),(side*(w-.065)/2,0,(h-.065)/2),frame,.013)
        box("header_casing",(w,d,.065),(0,0,h-.0325),frame,.014)
        # Separate leaves and true framed recesses make each style identifiable.
        leaves=2 if style=="french" else 4 if style=="bifold" else 1
        for index in range(leaves):
            lw=inner/leaves-.008;x=-inner/2+(index+.5)*inner/leaves;front=-.034
            if style=="french":
                for side in (-1,1):box("french_stile",(.06,.05,leaf_h),(x+side*(lw-.06)/2,0,leaf_h/2),panel,.012)
                for z in (.055,leaf_h-.055):box("french_end_rail",(lw-.09,.05,.11),(x,0,z),panel,.013)
                box("frosted_glass_pane",(lw-.12,.013,leaf_h-.22),(x,0,leaf_h/2),glass,.004)
                for z in (.58,1.07,1.56):box("glazing_crossbar",(lw-.1,.057,.035),(x,0,z),trim,.008)
            else:
                box("door_leaf",(lw,.048,leaf_h),(x,0,leaf_h/2),panel,.012)
                rows=3 if style=="six-panel" else 2 if style in ("shaker","bifold") else 0
                columns=2 if style=="six-panel" else 1
                for row in range(rows):
                    ph=(leaf_h-.22)/rows-.08;z=.13+(row+.5)*(leaf_h-.22)/rows
                    for column in range(columns):
                        pw=(lw-.12)/columns-.025;px=x-(lw-.12)/2+(column+.5)*(lw-.12)/columns
                        for face in (-1,1):
                            y=face*.03
                            for sign in (-1,1):
                                box("panel_vertical_moulding",(.024,.018,ph),(px+sign*pw/2,y,z),trim,.006)
                                box("panel_horizontal_moulding",(pw,.018,.024),(px,y,z+sign*ph/2),trim,.006)
            if style=="pocket":
                for face in (-1,1):box("recessed_sliding_pull",(.028,.01,.11),(x+lw*.37,face*.027,1.00),handle,.009)
            else:
                hx=x+(lw*.34 if leaves==1 or index<leaves/2 else -lw*.34)
                for face in (-1,1):
                    cyl("handle_rosette",.028,.018,(hx,face*.037,1.00),handle,16,(math.pi/2,0,0))
                    box("door_lever",(.10,.025,.022),(hx-.03,face*.054,1.00),handle,.008)
            if style=="bifold":
                for z in (.30,1.1,1.85):box("bifold_hinge",(.022,.018,.06),(x+lw/2,-.035,z),handle,.005)
        if style=="pocket":box("overhead_pocket_track",(inner,.05,.023),(0,0,h-.075),handle,.006)
        return w,d,h

    def stairs(m,style):
        turning=style in ("switchback","l-turn");w,d=(2.2,3.2) if style=="switchback" else (3.2,3.2) if style=="l-turn" else (1.10,4.2)
        rise=2.8;rise_step=rise/16;wood=m["wood"]
        body=material("stair-risers",(.74,.73,.65),None,.95)
        steel=material("stair-structure",(.12,.15,.15),None,.85)
        rail=material("handrail",(.29,.22,.16),None,.89)
        glow=material("warm-led-strip",(.95,.67,.28),None,.7)
        shader=glow.node_tree.nodes.get("Principled BSDF");shader.inputs["Emission Color"].default_value=(1,.59,.2,1);shader.inputs["Emission Strength"].default_value=1.5
        def beam(name,a,b,thick,mat):
            dy=b[1]-a[1];dz=b[2]-a[2];length=math.hypot(dy,dz)
            return box(name,(thick,length,thick),tuple((a[i]+b[i])/2 for i in range(3)),mat,thick*.2,(math.atan2(dz,dy),0,0))
        if not turning:
            step=d/16
            for n in range(16):
                z=(n+1)*rise_step;y=-d/2+(n+.5)*step
                box("thick_wood_tread",(w,step+.014,.075),(0,y,z-.0375),wood,.015)
                if style=="traditional":box("closed_riser",(w-.025,.045,rise_step),(0,y-step/2+.02,z-rise_step/2),body,.009)
                if style in ("cantilever","led"):
                    box("wall_anchor_plate",(.055,step*.70,.17),(-w/2+.028,y,z-.09),steel,.01)
                if style=="led":box("under_nosing_light",(w*.89,.012,.012),(0,y-step/2+.004,z-.074),glow,.003)
                if style in ("traditional","floating"):
                    for side in (-1,1):box("solid_baluster",(.045,.045,.85),(side*(w/2-.025),y,z+.425),rail,.01)
            if style in ("traditional","floating"):
                for side in (-1,1):beam("continuous_handrail",(side*(w/2-.025),-d/2+step/2,rise_step+.85),(side*(w/2-.025),d/2-step/2,rise+.85),.065,rail)
                for side in (-1,1):box("upper_landing_newel",(.07,.07,.90),(side*(w/2-.035),d/2-step/2,rise+.45),rail,.014)
            if style=="floating":
                beam("central_mono_stringer",(0,-d/2+.10,.15),(0,d/2-.10,rise-.16),.17,steel)
                box("mono_floor_baseplate",(.34,.26,.05),(0,-d/2+.14,.025),steel,.01)
            if style=="traditional":
                for side in (-1,1):beam("painted_closed_stringer",(side*(w/2-.09),-d/2+.10,.14),(side*(w/2-.09),d/2-.10,rise-.16),.16,body)
        elif style=="switchback":
            flight=.99;run=d-flight;step=run/8
            box("turning_landing",(w,flight,.10),(0,d/2-flight/2,rise/2-.05),wood,.018)
            for n in range(8):
                for upper in (False,True):
                    x=(1 if upper else -1)*(w-flight)/2;y=(-d/2+(n+.5)*step) if not upper else (d/2-flight-(n+.5)*step)
                    z=(n+1+(8 if upper else 0))*rise_step
                    box("return_flight_tread",(flight,step+.01,.075),(x,y,z-.0375),wood,.013)
                    box("return_riser",(flight-.025,.04,rise_step),(x,y-step/2 if not upper else y+step/2,z-rise_step/2),body,.007)
                    box("outer_return_post",(.05,.05,.82),((w/2-.025)*(1 if upper else -1),y,z+.41),rail,.012)
            for x,upper in ((-w/2+.025,False),(w/2-.025,True)):
                a=(x,-d/2+step/2,(rise if upper else rise_step)+.82);b=(x,d/2-flight-step/2,(rise/2+rise_step if upper else rise/2)+.82);beam("return_handrail",a,b,.065,rail)
            for x in (-w/2+.025,w/2-.025):box("landing_post",(.055,.055,.85),(x,d/2-.04,rise/2+.425),rail,.012)
            box("landing_guard",(w,.06,.07),(0,d/2-.04,rise/2+.85),rail,.016)
            box("return_upper_newel",(.07,.07,.90),(w/2-.035,-d/2+step/2,rise+.45),rail,.014)
        else:
            flight=1.0;run=d-flight;step=run/8
            box("quarter_turn_landing",(flight,flight,.1),(-w/2+flight/2,d/2-flight/2,rise/2-.05),wood,.018)
            for n in range(8):
                z=(n+1)*rise_step;y=-d/2+(n+.5)*step
                box("lower_quarter_tread",(flight,step+.01,.075),(-w/2+flight/2,y,z-.0375),wood,.014)
                box("lower_tread_riser",(flight-.02,.04,rise_step),(-w/2+flight/2,y-step/2,z-rise_step/2),body,.009)
                x=-w/2+flight+(n+.5)*step;z=(n+9)*rise_step
                box("upper_quarter_tread",(step+.01,flight,.075),(x,d/2-flight/2,z-.0375),wood,.014)
                box("upper_tread_riser",(.04,flight-.02,rise_step),(x-step/2,d/2-flight/2,z-rise_step/2),body,.009)
            # Visible stringers under both flights, without filling the empty L corner.
            beam("lower_quarter_stringer",(-w/2+.15,-d/2+.08,.15),(-w/2+.15,d/2-flight,rise/2-.1),.15,steel)
            # Upper diagonal follows X; both flights have a substantial spine.
            a=(-w/2+flight,d/2-.15,rise/2-.1);b=(w/2-.08,d/2-.15,rise-.13)
            length=math.hypot(b[0]-a[0],b[2]-a[2])
            box("upper_quarter_stringer",(length,.15,.15),tuple((a[i]+b[i])/2 for i in range(3)),steel,.025,(0,-math.atan2(b[2]-a[2],b[0]-a[0]),0))
            box("landing_support",(.12,.12,rise/2),(-w/2+.14,d/2-.14,rise/4),steel,.022)
        # Open cantilever and L stairs intentionally expose their geometry; guard
        # configuration is not represented as construction-ready safety design.
        height=rise+.90 if style in ("traditional","floating","switchback") else rise
        return w,d,height

    return {**{f"door-{style}":lambda m,s=style:door(m,s) for style in ("flush","shaker","six-panel","french","bifold","pocket")},
            **{f"stairs-{style}":lambda m,s=style:stairs(m,s) for style in ("traditional","switchback","l-turn","floating","cantilever","led")}}
